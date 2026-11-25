-- Stage 4: the school timetable.
-- The vice-principal academic (and the principal) set the bell times and enter the lessons,
-- by tapping them in or uploading a spreadsheet. Bell times are the same every school day and the
-- timetable repeats every week. All staff can see it; students see their class's lessons.

-- Which days the school opens: 1 = Monday ... 7 = Sunday.
alter table public.schools add column school_days smallint[] not null default '{1,2,3,4,5}'
  check (cardinality(school_days) between 1 and 7 and school_days <@ '{1,2,3,4,5,6,7}'::smallint[]);
grant update (school_days) on public.schools to authenticated;

-- ===== Bell times =====
create table public.periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  position smallint not null check (position between 1 and 30),
  label text not null check (length(trim(label)) between 1 and 40),
  starts_at time not null,
  ends_at time not null,
  is_break boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, position),
  unique (id, school_id),
  check (ends_at > starts_at)
);
alter table public.periods enable row level security;
create policy "Members can view bell times" on public.periods
  for select to authenticated using (private.is_member(school_id));
revoke all on public.periods from anon, authenticated;
grant select on public.periods to authenticated;

-- Replaces the bell times in one go. Periods are kept by position, so lessons in a period that
-- still exists stay put; lessons in a period that's removed (or becomes a break) are removed.
-- p_periods: [{"label": "Period 1", "starts_at": "08:00", "ends_at": "08:40", "is_break": false}, ...]
create function public.set_bell_times(p_school uuid, p_periods jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n int := coalesce(jsonb_array_length(p_periods), 0);
  r record;
  v_prev_end time;
  v_prev_label text;
begin
  if not private.is_admin(p_school) then
    raise exception 'Only the principal or vice-principal can change the bell times.';
  end if;
  if n = 0 then raise exception 'Add at least one period.'; end if;
  if n > 30 then raise exception 'A school day can have at most 30 periods.'; end if;

  drop table if exists _p;
  create temp table _p on commit drop as
  select (row_number() over (order by (e->>'starts_at')::time))::smallint as position,
         left(trim(coalesce(e->>'label', '')), 40) as label,
         (e->>'starts_at')::time as starts_at,
         (e->>'ends_at')::time as ends_at,
         coalesce((e->>'is_break')::boolean, false) as is_break
  from jsonb_array_elements(p_periods) e;

  for r in select * from _p order by position loop
    if r.label = '' then raise exception 'Every period needs a name.'; end if;
    if r.ends_at <= r.starts_at then
      raise exception '% must end after it starts.', r.label;
    end if;
    if v_prev_end is not null and r.starts_at < v_prev_end then
      raise exception '% overlaps with %.', r.label, v_prev_label;
    end if;
    v_prev_end := r.ends_at;
    v_prev_label := r.label;
  end loop;

  -- Lessons can't sit in a break or in a period that's going away.
  delete from public.lessons l using public.periods p
  where l.period_id = p.id and p.school_id = p_school
    and (p.position > n or exists (select 1 from _p where _p.position = p.position and _p.is_break));
  delete from public.periods where school_id = p_school and position > n;
  insert into public.periods (school_id, position, label, starts_at, ends_at, is_break)
  select p_school, position, label, starts_at, ends_at, is_break from _p
  on conflict (school_id, position) do update
    set label = excluded.label, starts_at = excluded.starts_at, ends_at = excluded.ends_at, is_break = excluded.is_break;
end;
$$;

-- ===== Lessons =====
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  day smallint not null check (day between 1 and 7),
  period_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  teacher_id uuid,
  room text check (room is null or length(room) <= 40),
  created_at timestamptz not null default now(),
  foreign key (period_id, school_id) references public.periods(id, school_id) on delete cascade,
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade,
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete cascade,
  foreign key (teacher_id, school_id) references public.staff(id, school_id) on delete set null (teacher_id),
  -- A class has one lesson at a time; a teacher teaches one class at a time.
  constraint lessons_class_slot unique (class_id, day, period_id),
  constraint lessons_teacher_slot unique (teacher_id, day, period_id)
);
create index lessons_school_idx on public.lessons(school_id, day);
create index lessons_period_idx on public.lessons(period_id, school_id);
create index lessons_subject_idx on public.lessons(subject_id, school_id);
create index lessons_teacher_idx on public.lessons(teacher_id, school_id);

create function private.guard_lesson() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select is_break from public.periods where id = new.period_id) then
    raise exception 'That time is a break. Choose a lesson period.';
  end if;
  if not exists (select 1 from public.schools where id = new.school_id and new.day = any(school_days)) then
    raise exception 'The school is closed that day. Add it under Bell times first.';
  end if;
  new.room := nullif(trim(coalesce(new.room, '')), '');
  return new;
end;
$$;
revoke all on function private.guard_lesson() from public;
create trigger lessons_guard before insert or update on public.lessons
  for each row execute function private.guard_lesson();

alter table public.lessons enable row level security;
create policy "Members can view lessons" on public.lessons
  for select to authenticated using (private.is_member(school_id));
create policy "Heads can add lessons" on public.lessons
  for insert to authenticated with check (private.is_admin(school_id));
create policy "Heads can change lessons" on public.lessons
  for update to authenticated using (private.is_admin(school_id)) with check (private.is_admin(school_id));
create policy "Heads can remove lessons" on public.lessons
  for delete to authenticated using (private.is_admin(school_id));
revoke all on public.lessons from anon, authenticated;
grant select, delete on public.lessons to authenticated;
grant insert (school_id, day, period_id, class_id, subject_id, teacher_id, room) on public.lessons to authenticated;
grant update (day, period_id, class_id, subject_id, teacher_id, room) on public.lessons to authenticated;

-- Adds many lessons at once (from a spreadsheet). With p_replace, the whole timetable is replaced.
-- All or nothing: a clash anywhere stops the whole upload.
-- p_lessons: [{"day": 1, "period_id": "...", "class_id": "...", "subject_id": "...", "teacher_id": "..." | null, "room": "..." | null}]
create function public.import_lessons(p_school uuid, p_lessons jsonb, p_replace boolean) returns int
language plpgsql security invoker set search_path = '' as $$
declare
  n int;
begin
  if not private.is_admin(p_school) then
    raise exception 'Only the principal or vice-principal can change the timetable.';
  end if;
  if p_replace then
    delete from public.lessons where school_id = p_school;
  end if;
  insert into public.lessons (school_id, day, period_id, class_id, subject_id, teacher_id, room)
  select p_school, (e->>'day')::smallint, (e->>'period_id')::uuid, (e->>'class_id')::uuid, (e->>'subject_id')::uuid,
         nullif(e->>'teacher_id', '')::uuid, nullif(e->>'room', '')
  from jsonb_array_elements(coalesce(p_lessons, '[]')) e;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Closing a day (e.g. no more Saturday school) removes that day's lessons.
create function private.drop_closed_day_lessons() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.lessons where school_id = new.id and not (day = any(new.school_days));
  return new;
end;
$$;
revoke all on function private.drop_closed_day_lessons() from public;
create trigger schools_drop_closed_day_lessons after update of school_days on public.schools
  for each row execute function private.drop_closed_day_lessons();

-- ===== Students: their class's timetable =====
create function public.my_timetable()
returns table (school_id uuid, class_id uuid, day smallint, period_no smallint, label text,
               starts_at time, ends_at time, is_break boolean, subject text, teacher text, room text)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select distinct a.school_id, a.class_id from public.student_accounts a
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

revoke all on function public.set_bell_times(uuid, jsonb), public.import_lessons(uuid, jsonb, boolean), public.my_timetable() from public, anon;
grant execute on function public.set_bell_times(uuid, jsonb), public.import_lessons(uuid, jsonb, boolean), public.my_timetable() to authenticated;
