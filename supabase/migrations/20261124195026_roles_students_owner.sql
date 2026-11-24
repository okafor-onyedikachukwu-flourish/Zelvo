-- Students, released results, and the app owner's dashboard.

-- ===== Results are shown to students only after the teacher releases them =====
alter table public.exams add column results_released boolean not null default false;
grant insert (results_released), update (results_released) on public.exams to authenticated;

-- ===== Student accounts =====
-- A student signs up normally and asks to join a school and class; a teacher or admin approves
-- the request and links it to the right name on the class list.
create table public.student_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  typed_name text not null check (length(trim(typed_name)) between 2 and 120),
  student_id uuid,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade,
  foreign key (student_id, school_id) references public.students(id, school_id) on delete cascade,
  unique (user_id, school_id),
  check (status <> 'approved' or student_id is not null)
);
create unique index student_accounts_one_per_student on public.student_accounts(student_id) where status = 'approved';
create index student_accounts_school_idx on public.student_accounts(school_id);
create index student_accounts_class_school_idx on public.student_accounts(class_id, school_id);
create index student_accounts_student_school_idx on public.student_accounts(student_id, school_id);
create index student_accounts_decided_by_idx on public.student_accounts(decided_by);

alter table public.student_accounts enable row level security;
create policy "Students see their own requests; staff see their school's" on public.student_accounts
  for select to authenticated using (user_id = (select auth.uid()) or private.is_member(school_id));
create policy "Students can cancel; admins can remove" on public.student_accounts
  for delete to authenticated using (user_id = (select auth.uid()) or private.is_admin(school_id));
revoke all on public.student_accounts from anon, authenticated;
grant select, delete on public.student_accounts to authenticated;

-- Schools a student can search for when joining (names only).
create function public.find_schools(p_query text)
returns table (id uuid, name text, country text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.country from public.schools s
  where (select auth.uid()) is not null and length(trim(coalesce(p_query, ''))) >= 2
    and s.name ilike '%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%'
  order by s.name limit 20;
$$;

-- Class names of a school, for the joining student to pick from.
create function public.school_classes(p_school uuid)
returns table (id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name from public.classes c
  where (select auth.uid()) is not null and c.school_id = p_school
  order by c.name;
$$;

create function public.request_student_access(p_school uuid, p_class uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'You need to be signed in.'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Enter your full name.'; end if;
  if not exists (select 1 from public.classes where id = p_class and school_id = p_school) then
    raise exception 'That class was not found.';
  end if;
  if exists (select 1 from public.student_accounts where user_id = v_uid and school_id = p_school and status = 'approved') then
    raise exception 'You are already a student at this school.';
  end if;
  insert into public.student_accounts (user_id, school_id, class_id, typed_name)
  values (v_uid, p_school, p_class, regexp_replace(trim(p_name), '\s+', ' ', 'g'))
  on conflict (user_id, school_id) do update
    set class_id = excluded.class_id, typed_name = excluded.typed_name, status = 'pending',
        student_id = null, decided_by = null, decided_at = null, created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- Any staff member of the school (teacher or admin) can approve or decline.
create function public.decide_student_access(p_request uuid, p_student uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid;
begin
  select school_id into v_school from public.student_accounts where id = p_request;
  if v_school is null or not private.is_member(v_school) then
    raise exception 'Only staff of this school can do this.';
  end if;
  if p_approve then
    if p_student is null or not exists (select 1 from public.students where id = p_student and school_id = v_school) then
      raise exception 'Choose the student''s name from the class list.';
    end if;
    if exists (select 1 from public.student_accounts where student_id = p_student and status = 'approved' and id <> p_request) then
      raise exception 'That student is already linked to another account.';
    end if;
    update public.student_accounts
      set status = 'approved', student_id = p_student,
          class_id = (select class_id from public.students where id = p_student),
          decided_by = auth.uid(), decided_at = now()
      where id = p_request;
  else
    update public.student_accounts
      set status = 'declined', student_id = null, decided_by = auth.uid(), decided_at = now()
      where id = p_request;
  end if;
end;
$$;

-- The signed-in student's requests and links.
create function public.my_student_accounts()
returns table (id uuid, school_id uuid, school_name text, class_id uuid, class_name text,
               typed_name text, student_name text, status text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.school_id, s.name, a.class_id, c.name, a.typed_name, st.full_name, a.status
  from public.student_accounts a
  join public.schools s on s.id = a.school_id
  join public.classes c on c.id = a.class_id
  left join public.students st on st.id = a.student_id
  where a.user_id = (select auth.uid())
  order by a.created_at desc;
$$;

-- The signed-in student's released results, with the answer key so they can see what they got wrong.
create function public.my_results()
returns table (exam_id uuid, school_id uuid, title text, subject text, exam_date date,
               question_count integer, option_count integer, mark_per_question numeric,
               record_out_of numeric, answer_key text, answers text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.id, e.school_id, e.title, sub.name, e.exam_date, e.question_count, e.option_count,
         e.mark_per_question, e.record_out_of, e.answer_key, sc.answers, sc.updated_at
  from public.student_accounts a
  join public.scripts sc on sc.student_id = a.student_id
  join public.exams e on e.id = sc.exam_id and e.results_released
  join public.subjects sub on sub.id = e.subject_id
  where a.user_id = (select auth.uid()) and a.status = 'approved'
  order by coalesce(e.exam_date, e.created_at::date) desc, e.created_at desc;
$$;

-- ===== The app owner's dashboard =====
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

-- Counts only: the owner sees how each school uses Zelvo, not its scores or answer keys.
create function public.platform_overview()
returns table (school_id uuid, name text, country text, created_at timestamptz,
               staff integer, staff_joined integer, students integer, student_accounts integer,
               exams integer, scripts integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    raise exception 'Only the owner of Zelvo can see this.';
  end if;
  return query
  select s.id, s.name, s.country, s.created_at,
    (select count(*)::integer from public.staff x where x.school_id = s.id),
    (select count(*)::integer from public.staff x where x.school_id = s.id and x.user_id is not null),
    (select count(*)::integer from public.students x where x.school_id = s.id),
    (select count(*)::integer from public.student_accounts x where x.school_id = s.id and x.status = 'approved'),
    (select count(*)::integer from public.exams x where x.school_id = s.id),
    (select count(*)::integer from public.scripts x where x.school_id = s.id)
  from public.schools s
  order by s.created_at desc;
end;
$$;

revoke all on function public.find_schools(text), public.school_classes(uuid),
  public.request_student_access(uuid, uuid, text), public.decide_student_access(uuid, uuid, boolean),
  public.my_student_accounts(), public.my_results(), public.is_platform_admin(), public.platform_overview()
  from public, anon;
grant execute on function public.find_schools(text), public.school_classes(uuid),
  public.request_student_access(uuid, uuid, text), public.decide_student_access(uuid, uuid, boolean),
  public.my_student_accounts(), public.my_results(), public.is_platform_admin(), public.platform_overview()
  to authenticated;

-- Zelvo's owner.
insert into public.platform_admins (user_id)
select id from auth.users where email = 'flourishokafor13@gmail.com';
