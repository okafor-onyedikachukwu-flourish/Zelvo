-- "Who are you?" joining, replacing join codes.
--   Head of school: Principal (creates the school; one per school) or Vice-principal academic (one per school).
--   Staff: Head of department (picks a department; each department is one subject, up to 2 heads each)
--          or Teacher (picks the subjects they teach). Subjects are added by the vice-principal academic or principal.
--   Staff and the vice-principal ask to join; the principal or vice-principal approves.
--   Students pick their school, class and name and go straight to their dashboard; a teacher confirms
--   them before their scores show.

-- ===== Staff: head titles and teaching subjects =====
alter table public.staff add constraint staff_id_school_key unique (id, school_id);
alter table public.staff add column head_title text check (head_title in ('principal', 'vp_academic'));
alter table public.staff add constraint staff_head_title_role check (head_title is null or role = 'admin');
create unique index staff_one_principal on public.staff(school_id) where head_title = 'principal';
create unique index staff_one_vp_academic on public.staff(school_id) where head_title = 'vp_academic';
grant update (head_title) on public.staff to authenticated;

create table public.staff_subjects (
  staff_id uuid not null,
  subject_id uuid not null,
  school_id uuid not null references public.schools(id) on delete cascade,
  primary key (staff_id, subject_id),
  foreign key (staff_id, school_id) references public.staff(id, school_id) on delete cascade,
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete cascade
);
create index staff_subjects_subject_idx on public.staff_subjects(subject_id, school_id);
create index staff_subjects_school_idx on public.staff_subjects(school_id);
alter table public.staff_subjects enable row level security;
create policy "Members can view staff subjects" on public.staff_subjects
  for select to authenticated using (private.is_member(school_id));
create policy "Heads can add staff subjects" on public.staff_subjects
  for insert to authenticated with check (private.is_admin(school_id));
create policy "Heads can remove staff subjects" on public.staff_subjects
  for delete to authenticated using (private.is_admin(school_id));
revoke all on public.staff_subjects from anon, authenticated;
grant select, delete on public.staff_subjects to authenticated;
grant insert (staff_id, subject_id, school_id) on public.staff_subjects to authenticated;

-- Up to two heads per department (subject); tidy fields that don't apply to the role.
create or replace function private.guard_hod_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_others text[];
  v_subject text;
begin
  if new.role <> 'hod' then new.subject_id := null; end if;
  if new.role <> 'admin' then new.head_title := null; end if;
  if new.role = 'hod' and new.subject_id is not null then
    select name into v_subject from public.subjects where id = new.subject_id for update;
    select array_agg(full_name order by full_name) into v_others from public.staff
    where school_id = new.school_id and subject_id = new.subject_id and role = 'hod' and id <> new.id;
    if coalesce(array_length(v_others, 1), 0) >= 2 then
      raise exception '% already has 2 heads of department: %. Make one of them a teacher first.',
        v_subject, array_to_string(v_others, ' and ');
    end if;
  end if;
  return new;
end;
$$;
drop trigger staff_hod_limit on public.staff;
create trigger staff_hod_limit
  before insert or update of role, subject_id, head_title on public.staff
  for each row execute function private.guard_hod_limit();

-- The person who creates a school is its principal.
create or replace function public.create_school(
  p_name text, p_admin_name text, p_country text default null, p_timezone text default 'UTC'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_school uuid;
begin
  if v_uid is null then raise exception 'You need to be signed in.'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Enter the school''s name.'; end if;
  insert into public.schools (name, country, timezone, created_by)
  values (trim(p_name), nullif(trim(p_country), ''), coalesce(nullif(trim(p_timezone), ''), 'UTC'), v_uid)
  returning id into v_school;
  insert into public.staff (school_id, user_id, full_name, role, head_title, joined_at)
  values (v_school, v_uid, trim(p_admin_name), 'admin', 'principal', now());
  return v_school;
end;
$$;

-- ===== Asking to join a school as staff =====
create table public.staff_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  applied_as text not null check (applied_as in ('vp_academic', 'hod', 'teacher')),
  subject_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'declined')),
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, school_id)
);
create index staff_requests_school_idx on public.staff_requests(school_id);
create index staff_requests_decided_by_idx on public.staff_requests(decided_by);
alter table public.staff_requests enable row level security;
create policy "People see their own requests; heads see their school's" on public.staff_requests
  for select to authenticated using (user_id = (select auth.uid()) or private.is_admin(school_id));
create policy "People can cancel their own requests" on public.staff_requests
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.staff_requests from anon, authenticated;
grant select, delete on public.staff_requests to authenticated;

-- Subjects (departments) of a school, for someone choosing theirs while joining.
create function public.school_subjects(p_school uuid)
returns table (id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name from public.subjects s
  where (select auth.uid()) is not null and s.school_id = p_school
  order by s.name;
$$;

-- Whether a school already has a principal / vice-principal, and how many heads each department has.
create function public.school_openings(p_school uuid)
returns table (has_vp boolean, full_departments uuid[])
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where school_id = p_school and head_title = 'vp_academic'),
         coalesce((select array_agg(subject_id) from (
           select subject_id from public.staff
           where school_id = p_school and role = 'hod' and subject_id is not null
           group by subject_id having count(*) >= 2) f), '{}')
  where (select auth.uid()) is not null;
$$;

create function public.request_staff_access(p_school uuid, p_applied_as text, p_name text, p_subjects uuid[] default '{}')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_subjects uuid[] := coalesce(p_subjects, '{}');
  v_hods text[];
  v_id uuid;
begin
  if v_uid is null then raise exception 'You need to be signed in.'; end if;
  if not exists (select 1 from public.schools where id = p_school) then raise exception 'That school was not found.'; end if;
  if length(v_name) < 2 then raise exception 'Enter your full name.'; end if;
  if p_applied_as not in ('vp_academic', 'hod', 'teacher') then raise exception 'Choose your position.'; end if;
  if exists (select 1 from public.staff where school_id = p_school and user_id = v_uid) then
    raise exception 'You are already a member of this school.';
  end if;
  if (select count(*) from public.subjects where id = any(v_subjects) and school_id = p_school) <> cardinality(v_subjects) then
    raise exception 'Choose from this school''s list.';
  end if;

  if p_applied_as = 'vp_academic' then
    v_subjects := '{}';
    if exists (select 1 from public.staff where school_id = p_school and head_title = 'vp_academic') then
      raise exception 'This school already has a vice-principal academic.';
    end if;
  elsif p_applied_as = 'hod' then
    if cardinality(v_subjects) <> 1 then raise exception 'Choose your department.'; end if;
    select array_agg(full_name order by full_name) into v_hods from public.staff
    where school_id = p_school and subject_id = v_subjects[1] and role = 'hod';
    if coalesce(array_length(v_hods, 1), 0) >= 2 then
      raise exception 'This department already has 2 heads: %.', array_to_string(v_hods, ' and ');
    end if;
  else
    if cardinality(v_subjects) = 0 then raise exception 'Choose at least one subject you teach.'; end if;
  end if;

  insert into public.staff_requests (user_id, school_id, full_name, applied_as, subject_ids)
  values (v_uid, p_school, v_name, p_applied_as, v_subjects)
  on conflict (user_id, school_id) do update
    set full_name = excluded.full_name, applied_as = excluded.applied_as, subject_ids = excluded.subject_ids,
        status = 'pending', decided_by = null, created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- The signed-in person's requests, with names to show while they wait.
create function public.my_staff_requests()
returns table (id uuid, school_id uuid, school_name text, full_name text, applied_as text,
               subject_names text[], status text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.school_id, sc.name, r.full_name, r.applied_as,
         coalesce((select array_agg(s.name order by s.name) from public.subjects s where s.id = any(r.subject_ids)), '{}'),
         r.status, r.created_at
  from public.staff_requests r
  join public.schools sc on sc.id = r.school_id
  where r.user_id = (select auth.uid())
  order by r.created_at desc;
$$;

-- Requests waiting at a school, for the principal or vice-principal.
create function public.school_staff_requests(p_school uuid)
returns table (id uuid, full_name text, email text, applied_as text, subject_names text[], created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.full_name, u.email::text, r.applied_as,
         coalesce((select array_agg(s.name order by s.name) from public.subjects s where s.id = any(r.subject_ids)), '{}'),
         r.created_at
  from public.staff_requests r
  join auth.users u on u.id = r.user_id
  where r.school_id = p_school and r.status = 'pending' and private.is_admin(p_school)
  order by r.created_at;
$$;

-- The principal or vice-principal approves or declines.
create function public.decide_staff_request(p_request uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.staff_requests%rowtype;
  v_staff uuid;
begin
  select * into r from public.staff_requests where id = p_request for update;
  if r.id is null or not private.is_admin(r.school_id) then
    raise exception 'Only the principal or vice-principal can do this.';
  end if;
  if not p_approve then
    update public.staff_requests set status = 'declined', decided_by = auth.uid() where id = p_request;
    return;
  end if;
  if exists (select 1 from public.staff where school_id = r.school_id and user_id = r.user_id) then
    delete from public.staff_requests where id = p_request;
    return;
  end if;
  if r.applied_as = 'vp_academic' and exists (select 1 from public.staff where school_id = r.school_id and head_title = 'vp_academic') then
    raise exception 'This school already has a vice-principal academic. Change their role first.';
  end if;
  if r.applied_as = 'hod' and not exists (select 1 from public.subjects where id = r.subject_ids[1]) then
    raise exception 'The department they chose was deleted. Decline, and ask them to choose again.';
  end if;

  insert into public.staff (school_id, user_id, full_name, role, head_title, subject_id, joined_at)
  values (r.school_id, r.user_id, r.full_name,
          case r.applied_as when 'vp_academic' then 'admin' else r.applied_as end,
          case when r.applied_as = 'vp_academic' then 'vp_academic' end,
          case when r.applied_as = 'hod' then r.subject_ids[1] end,
          now())
  returning id into v_staff;
  -- What they teach (a head of department teaches their department's subject).
  insert into public.staff_subjects (staff_id, subject_id, school_id)
  select v_staff, s.id, r.school_id from public.subjects s where s.id = any(r.subject_ids) and s.school_id = r.school_id;
  delete from public.staff_requests where id = p_request;
end;
$$;

-- ===== Students: straight to their dashboard; a teacher confirms before scores show =====
-- Same words in any order, any spacing or capitals: "OKAFOR  Ada" = "ada okafor".
create function private.name_key(p_name text) returns text
language sql immutable set search_path = '' as $$
  select string_agg(w, ' ' order by w) from regexp_split_to_table(lower(trim(coalesce(p_name, ''))), '\s+') as w where w <> '';
$$;

-- Joins a class. If their name is on the class list (and not taken), it's matched so a teacher
-- only has to tap Confirm.
create function public.join_class(p_school uuid, p_class uuid, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_student uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'You need to be signed in.'; end if;
  if length(v_name) < 2 then raise exception 'Enter your full name.'; end if;
  if not exists (select 1 from public.classes where id = p_class and school_id = p_school) then
    raise exception 'That class was not found.';
  end if;
  if exists (select 1 from public.student_accounts where user_id = v_uid and school_id = p_school and status = 'approved') then
    raise exception 'You are already a student at this school.';
  end if;

  select s.id into v_student from public.students s
  where s.class_id = p_class and private.name_key(s.full_name) = private.name_key(v_name)
    and not exists (select 1 from public.student_accounts a where a.student_id = s.id and a.status = 'approved')
  order by s.created_at
  limit 1;

  insert into public.student_accounts (user_id, school_id, class_id, typed_name, student_id, status)
  values (v_uid, p_school, p_class, v_name, v_student, 'pending')
  on conflict (user_id, school_id) do update
    set class_id = excluded.class_id, typed_name = excluded.typed_name, student_id = excluded.student_id,
        status = 'pending', decided_by = null, decided_at = null, created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- Any teacher at the school can confirm a student whose name isn't on the class list yet:
-- the name is added to the list and the student is confirmed in one step.
create function public.confirm_new_student(p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.student_accounts%rowtype;
  v_student uuid;
begin
  select * into r from public.student_accounts where id = p_request for update;
  if r.id is null or not private.is_member(r.school_id) then
    raise exception 'Only staff of this school can do this.';
  end if;
  insert into public.students (school_id, class_id, full_name) values (r.school_id, r.class_id, r.typed_name)
  returning id into v_student;
  update public.student_accounts
    set status = 'approved', student_id = v_student, decided_by = auth.uid(), decided_at = now()
    where id = p_request;
end;
$$;

revoke all on function public.school_subjects(uuid), public.school_openings(uuid),
  public.request_staff_access(uuid, text, text, uuid[]), public.my_staff_requests(),
  public.school_staff_requests(uuid), public.decide_staff_request(uuid, boolean),
  public.join_class(uuid, uuid, text), public.confirm_new_student(uuid) from public, anon;
grant execute on function public.school_subjects(uuid), public.school_openings(uuid),
  public.request_staff_access(uuid, text, text, uuid[]), public.my_staff_requests(),
  public.school_staff_requests(uuid), public.decide_staff_request(uuid, boolean),
  public.join_class(uuid, uuid, text), public.confirm_new_student(uuid) to authenticated;
revoke all on function private.name_key(text) from public, anon, authenticated;
