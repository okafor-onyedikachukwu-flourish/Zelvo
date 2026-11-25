-- The owner's dashboard: activity, growth, app versions, school details, suspending a school,
-- and announcements shown to everyone. The owner still sees no scores, answers or student names.

-- ===== Suspending a school =====
alter table public.schools add column suspended_at timestamptz,
  add column suspended_reason text check (suspended_reason is null or length(suspended_reason) <= 300);

create function private.is_suspended(p_school uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.schools where id = p_school and suspended_at is not null);
$$;

-- Staff of a suspended school lose access to all of its data.
create or replace function private.is_member(p_school uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.school_id = p_school and s.user_id = (select auth.uid())
  ) and not private.is_suspended(p_school);
$$;
create or replace function private.is_admin(p_school uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.school_id = p_school and s.user_id = (select auth.uid()) and s.role = 'admin'
  ) and not private.is_suspended(p_school);
$$;
create or replace function private.is_hod_for(p_school uuid, p_subject uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.school_id = p_school and s.user_id = (select auth.uid()) and s.role = 'hod' and s.subject_id = p_subject
  ) and not private.is_suspended(p_school);
$$;

-- People can still see the school row and their own staff row, so the app can say it's suspended.
create function private.belongs_to(p_school uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where school_id = p_school and user_id = (select auth.uid()))
      or exists (select 1 from public.student_accounts where school_id = p_school and user_id = (select auth.uid()));
$$;
create policy "People see the schools they belong to" on public.schools
  for select to authenticated using (private.belongs_to(id));
create policy "People see their own staff rows" on public.staff
  for select to authenticated using (user_id = (select auth.uid()));

-- Nobody can ask to join a suspended school.
create function private.guard_open_school() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.is_suspended(new.school_id) then
    raise exception 'This school is suspended on Zelvo.';
  end if;
  return new;
end;
$$;
create trigger staff_requests_open_school before insert or update on public.staff_requests
  for each row execute function private.guard_open_school();
create trigger student_accounts_open_school before insert or update on public.student_accounts
  for each row execute function private.guard_open_school();

create or replace function public.find_schools(p_query text)
returns table (id uuid, name text, country text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.country from public.schools s
  where (select auth.uid()) is not null and length(trim(coalesce(p_query, ''))) >= 2
    and s.suspended_at is null
    and s.name ilike '%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%'
  order by s.name limit 20;
$$;

create or replace function public.my_results()
returns table (exam_id uuid, school_id uuid, title text, subject text, exam_date date,
               question_count integer, option_count integer, mark_per_question numeric,
               record_out_of numeric, answer_key text, answers text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.id, e.school_id, e.title, sub.name, e.exam_date, e.question_count, e.option_count,
         e.mark_per_question, e.record_out_of, e.answer_key, sc.answers, sc.updated_at
  from public.student_accounts a
  join public.schools sch on sch.id = a.school_id and sch.suspended_at is null
  join public.scripts sc on sc.student_id = a.student_id
  join public.exams e on e.id = sc.exam_id and e.results_released
  join public.subjects sub on sub.id = e.subject_id
  where a.user_id = (select auth.uid()) and a.status = 'approved'
  order by coalesce(e.exam_date, e.created_at::date) desc, e.created_at desc;
$$;

create or replace function public.my_timetable()
returns table (school_id uuid, class_id uuid, day smallint, period_no smallint, label text,
               starts_at time, ends_at time, is_break boolean, subject text, teacher text, room text)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select distinct a.school_id, a.class_id from public.student_accounts a
    join public.schools sch on sch.id = a.school_id and sch.suspended_at is null
    where a.user_id = (select auth.uid()) and a.status in ('approved', 'pending')
  )
  select m.school_id, m.class_id, l.day, p.position, p.label, p.starts_at, p.ends_at, p.is_break,
         s.name, st.full_name, l.room
  from mine m
  join public.lessons l on l.class_id = m.class_id and l.school_id = m.school_id
  join public.periods p on p.id = l.period_id
  join public.subjects s on s.id = l.subject_id
  left join public.staff st on st.id = l.teacher_id
  order by l.day, p.position;
$$;

drop function public.my_student_accounts();
create function public.my_student_accounts()
returns table (id uuid, school_id uuid, school_name text, class_id uuid, class_name text,
               typed_name text, student_name text, status text, school_suspended boolean)
language sql stable security definer set search_path = '' as $$
  select a.id, a.school_id, s.name, a.class_id, c.name, a.typed_name, st.full_name, a.status, s.suspended_at is not null
  from public.student_accounts a
  join public.schools s on s.id = a.school_id
  join public.classes c on c.id = a.class_id
  left join public.students st on st.id = a.student_id
  where a.user_id = (select auth.uid())
  order by a.created_at desc;
$$;

-- ===== Daily use (for active users and app versions) =====
create table public.app_activity (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  build integer check (build is null or build between 0 and 100000),
  platform text check (platform is null or length(platform) <= 20),
  primary key (user_id, day)
);
alter table public.app_activity enable row level security;
revoke all on public.app_activity from anon, authenticated;

-- The app calls this once a day: "this account used Zelvo today, on this build".
create function public.record_activity(p_build integer, p_platform text) returns void
language sql security definer set search_path = '' as $$
  insert into public.app_activity (user_id, day, build, platform)
  select auth.uid(), (now() at time zone 'utc')::date, p_build, left(p_platform, 20)
  where auth.uid() is not null
  on conflict (user_id, day) do update
    set build = greatest(coalesce(excluded.build, 0), coalesce(public.app_activity.build, 0)), platform = excluded.platform;
$$;

create function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

-- Everything the owner's dashboard shows, in one call.
create function public.owner_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  w0 date := date_trunc('week', now())::date;  -- this week's Monday
  v jsonb;
begin
  if not private.is_owner() then raise exception 'Only the owner of Zelvo can see this.'; end if;
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'schools', (select count(*) from public.schools),
      'suspended', (select count(*) from public.schools where suspended_at is not null),
      'accounts', (select count(*) from auth.users),
      'staff', (select count(*) from public.staff where user_id is not null),
      'students', (select count(*) from public.students),
      'student_accounts', (select count(*) from public.student_accounts where status = 'approved'),
      'exams', (select count(*) from public.exams),
      'scripts', (select count(*) from public.scripts),
      'lessons', (select count(*) from public.lessons)),
    'active', jsonb_build_object(
      'today', (select count(*) from public.app_activity where day = (now() at time zone 'utc')::date),
      'week', (select count(distinct user_id) from public.app_activity where day > (now() at time zone 'utc')::date - 7),
      'month', (select count(distinct user_id) from public.app_activity where day > (now() at time zone 'utc')::date - 30)),
    'weekly', (
      select jsonb_agg(jsonb_build_object(
        'week', w,
        'schools', (select count(*) from public.schools where created_at >= w and created_at < w + 7),
        'accounts', (select count(*) from auth.users where created_at >= w and created_at < w + 7),
        'exams', (select count(*) from public.exams where created_at >= w and created_at < w + 7),
        'scripts', (select count(*) from public.scripts where created_at >= w and created_at < w + 7),
        'active', (select count(distinct user_id) from public.app_activity where day >= w and day < w + 7)
      ) order by w)
      from generate_series(w0 - 7 * 11, w0, interval '7 days') as g(ts), lateral (select g.ts::date as w) x),
    'builds', coalesce((
      select jsonb_agg(jsonb_build_object('build', build, 'users', users) order by build desc)
      from (
        select latest.build, count(*) as users from (
          select distinct on (user_id) user_id, build from public.app_activity
          where day > (now() at time zone 'utc')::date - 30 and build is not null
          order by user_id, day desc
        ) latest group by latest.build
      ) b), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

-- One school, for the owner: size, setup progress, contacts and last activity. No scores or student names.
create function public.owner_school(p_school uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if not private.is_owner() then raise exception 'Only the owner of Zelvo can see this.'; end if;
  with members as (
    select user_id from public.staff where school_id = p_school and user_id is not null
    union select user_id from public.student_accounts where school_id = p_school
  )
  select jsonb_build_object(
    'id', s.id, 'name', s.name, 'country', s.country, 'timezone', s.timezone, 'created_at', s.created_at,
    'suspended_at', s.suspended_at, 'suspended_reason', s.suspended_reason,
    'heads', coalesce((select jsonb_agg(jsonb_build_object('name', st.full_name, 'title', st.head_title, 'email', u.email) order by st.head_title)
              from public.staff st join auth.users u on u.id = st.user_id
              where st.school_id = s.id and st.role = 'admin'), '[]'::jsonb),
    'counts', jsonb_build_object(
      'classes', (select count(*) from public.classes where school_id = s.id),
      'departments', (select count(*) from public.subjects where school_id = s.id),
      'staff', (select count(*) from public.staff where school_id = s.id and user_id is not null),
      'staff_requests', (select count(*) from public.staff_requests where school_id = s.id and status = 'pending'),
      'students', (select count(*) from public.students where school_id = s.id),
      'student_accounts', (select count(*) from public.student_accounts where school_id = s.id and status = 'approved'),
      'pending_students', (select count(*) from public.student_accounts where school_id = s.id and status = 'pending'),
      'exams', (select count(*) from public.exams where school_id = s.id),
      'scripts', (select count(*) from public.scripts where school_id = s.id),
      'periods', (select count(*) from public.periods where school_id = s.id and not is_break),
      'lessons', (select count(*) from public.lessons where school_id = s.id)),
    'last_active', (select max(day) from public.app_activity where user_id in (select user_id from members)),
    'active_week', (select count(distinct user_id) from public.app_activity
                    where user_id in (select user_id from members) and day > (now() at time zone 'utc')::date - 7)
  ) into v
  from public.schools s where s.id = p_school;
  if v is null then raise exception 'That school was not found.'; end if;
  return v;
end;
$$;

-- The owner's list of schools gets each school's suspension and last activity too.
drop function public.platform_overview();
create function public.platform_overview()
returns table (school_id uuid, name text, country text, created_at timestamptz,
               staff integer, staff_joined integer, students integer, student_accounts integer,
               exams integer, scripts integer, suspended boolean, last_active date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_owner() then
    raise exception 'Only the owner of Zelvo can see this.';
  end if;
  return query
  select s.id, s.name, s.country, s.created_at,
    (select count(*)::integer from public.staff x where x.school_id = s.id),
    (select count(*)::integer from public.staff x where x.school_id = s.id and x.user_id is not null),
    (select count(*)::integer from public.students x where x.school_id = s.id),
    (select count(*)::integer from public.student_accounts x where x.school_id = s.id and x.status = 'approved'),
    (select count(*)::integer from public.exams x where x.school_id = s.id),
    (select count(*)::integer from public.scripts x where x.school_id = s.id),
    s.suspended_at is not null,
    (select max(a.day) from public.app_activity a where a.user_id in (
       select x.user_id from public.staff x where x.school_id = s.id and x.user_id is not null
       union select x.user_id from public.student_accounts x where x.school_id = s.id))
  from public.schools s
  order by s.created_at desc;
end;
$$;

create function public.set_school_suspended(p_school uuid, p_suspend boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner() then raise exception 'Only the owner of Zelvo can do this.'; end if;
  update public.schools
    set suspended_at = case when p_suspend then coalesce(suspended_at, now()) end,
        suspended_reason = case when p_suspend then nullif(left(trim(coalesce(p_reason, '')), 300), '') end
    where id = p_school;
  if not found then raise exception 'That school was not found.'; end if;
end;
$$;

-- ===== Announcements from the owner, shown on everyone's Home =====
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 80),
  body text not null default '' check (length(body) <= 600),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  ends_at timestamptz,
  stopped_at timestamptz
);
create index announcements_created_by_idx on public.announcements(created_by);
alter table public.announcements enable row level security;
create policy "Everyone sees live announcements; the owner sees all" on public.announcements
  for select to authenticated using (
    (stopped_at is null and (ends_at is null or ends_at > now())) or private.is_owner()
  );
create policy "The owner writes announcements" on public.announcements
  for insert to authenticated with check (private.is_owner());
create policy "The owner changes announcements" on public.announcements
  for update to authenticated using (private.is_owner()) with check (private.is_owner());
revoke all on public.announcements from anon, authenticated;
grant select on public.announcements to authenticated;
grant insert (title, body, ends_at) on public.announcements to authenticated;
grant update (title, body, ends_at, stopped_at) on public.announcements to authenticated;

revoke all on function public.record_activity(integer, text), public.owner_stats(), public.owner_school(uuid),
  public.platform_overview(), public.set_school_suspended(uuid, boolean, text), public.my_student_accounts() from public, anon;
grant execute on function public.record_activity(integer, text), public.owner_stats(), public.owner_school(uuid),
  public.platform_overview(), public.set_school_suspended(uuid, boolean, text), public.my_student_accounts() to authenticated;
revoke all on function private.is_suspended(uuid), private.belongs_to(uuid), private.guard_open_school() from public;
grant execute on function private.is_suspended(uuid), private.belongs_to(uuid), private.is_owner() to authenticated;
