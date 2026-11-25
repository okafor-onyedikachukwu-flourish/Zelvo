-- Stage 5: the exam timetable.
-- The vice-principal academic (or the principal) sets up exam periods ("First term exams",
-- 1–12 December) and enters each paper: date, time, subject, class and invigilator.
-- All staff can see it; students see their class's papers. On the phone, lesson alarms pause during
-- an exam period (unless the period says lessons carry on, e.g. SS3 mocks) and invigilators get an
-- alarm before each paper they supervise. Alarms themselves live on the phone and need no tables.

-- ===== Exam periods =====
create table public.exam_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 60),
  starts_on date not null,
  ends_on date not null,
  -- true: normal lessons stop on these days, so lesson alarms pause.
  lessons_stop boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, school_id),
  check (ends_on >= starts_on and ends_on - starts_on <= 62)
);
create index exam_periods_school_idx on public.exam_periods(school_id, ends_on);

-- ===== Exam papers =====
-- One row per class. A paper written by several classes at once is several rows with the same
-- date, time and subject (the app shows them together as one sitting).
create table public.exam_papers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  exam_period_id uuid not null,
  day date not null,
  starts_at time not null,
  ends_at time not null,
  subject_id uuid not null,
  class_id uuid not null,
  paper text check (paper is null or length(paper) <= 40),
  invigilator_id uuid,
  room text check (room is null or length(room) <= 40),
  created_at timestamptz not null default now(),
  foreign key (exam_period_id, school_id) references public.exam_periods(id, school_id) on delete cascade,
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade,
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete cascade,
  foreign key (invigilator_id, school_id) references public.staff(id, school_id) on delete set null (invigilator_id)
);
create index exam_papers_period_idx on public.exam_papers(exam_period_id, school_id);
create index exam_papers_school_day_idx on public.exam_papers(school_id, day);
create index exam_papers_class_idx on public.exam_papers(class_id, school_id);
create index exam_papers_subject_idx on public.exam_papers(subject_id, school_id);
create index exam_papers_invigilator_idx on public.exam_papers(invigilator_id, school_id);

create function private.clock(t time) returns text
language sql immutable set search_path = '' as $$
  select lower(to_char(t, 'FMHH12:MI AM'));
$$;
revoke all on function private.clock(time) from public;

-- Checks each paper: inside its exam period, ends after it starts, and no clashes.
-- A class can't write two papers at once. An invigilator can't be in two rooms at once
-- (several classes in the same room, or with no room given, is one sitting and is fine).
create function private.guard_exam_paper() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_period public.exam_periods%rowtype;
  v_class text;
  v_subject text;
  v_other_start time;
  v_other_end time;
  v_other_room text;
  v_name text;
begin
  new.paper := nullif(trim(coalesce(new.paper, '')), '');
  new.room := nullif(trim(coalesce(new.room, '')), '');
  if new.ends_at <= new.starts_at then
    raise exception 'The paper must end after it starts.';
  end if;

  select * into v_period from public.exam_periods where id = new.exam_period_id;
  if new.day < v_period.starts_on or new.day > v_period.ends_on then
    raise exception '% runs from % to %. Choose a date in that range.',
      v_period.name, to_char(v_period.starts_on, 'FMDD Mon'), to_char(v_period.ends_on, 'FMDD Mon YYYY');
  end if;

  -- One change at a time per school, so two people can't create the same clash together.
  perform pg_advisory_xact_lock(hashtext('exam_papers:' || new.school_id::text));

  select c.name, s.name, p.starts_at, p.ends_at into v_class, v_subject, v_other_start, v_other_end
  from public.exam_papers p
  join public.classes c on c.id = p.class_id
  join public.subjects s on s.id = p.subject_id
  where p.class_id = new.class_id and p.day = new.day and p.id <> new.id
    and p.starts_at < new.ends_at and p.ends_at > new.starts_at
  limit 1;
  if found then
    raise exception '% already writes % from % to % that day.',
      v_class, v_subject, private.clock(v_other_start), private.clock(v_other_end);
  end if;

  if new.invigilator_id is not null then
    select st.full_name, s.name, p.room, p.starts_at into v_name, v_subject, v_other_room, v_other_start
    from public.exam_papers p
    join public.staff st on st.id = p.invigilator_id
    join public.subjects s on s.id = p.subject_id
    where p.invigilator_id = new.invigilator_id and p.day = new.day and p.id <> new.id
      and p.starts_at < new.ends_at and p.ends_at > new.starts_at
      and lower(coalesce(p.room, '')) <> lower(coalesce(new.room, ''))
    limit 1;
    if found then
      raise exception '% is invigilating % in % from % that day. One person can''t be in two rooms at once.',
        v_name, v_subject, coalesce(v_other_room, 'another room'), private.clock(v_other_start);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_exam_paper() from public;
create trigger exam_papers_guard before insert or update on public.exam_papers
  for each row execute function private.guard_exam_paper();

-- Changing an exam period's dates can't leave papers outside it.
create function private.guard_exam_period() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.name := trim(new.name);
  if exists (select 1 from public.exam_papers p where p.exam_period_id = new.id
             and (p.day < new.starts_on or p.day > new.ends_on)) then
    raise exception 'Some papers are on dates outside the new range. Move or remove them first.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_exam_period() from public;
create trigger exam_periods_guard before insert or update on public.exam_periods
  for each row execute function private.guard_exam_period();

alter table public.exam_periods enable row level security;
create policy "Members can view exam periods" on public.exam_periods
  for select to authenticated using (private.is_member(school_id));
create policy "Heads can add exam periods" on public.exam_periods
  for insert to authenticated with check (private.is_admin(school_id));
create policy "Heads can change exam periods" on public.exam_periods
  for update to authenticated using (private.is_admin(school_id)) with check (private.is_admin(school_id));
create policy "Heads can remove exam periods" on public.exam_periods
  for delete to authenticated using (private.is_admin(school_id));
revoke all on public.exam_periods from anon, authenticated;
grant select, delete on public.exam_periods to authenticated;
grant insert (school_id, name, starts_on, ends_on, lessons_stop) on public.exam_periods to authenticated;
grant update (name, starts_on, ends_on, lessons_stop) on public.exam_periods to authenticated;

alter table public.exam_papers enable row level security;
create policy "Members can view exam papers" on public.exam_papers
  for select to authenticated using (private.is_member(school_id));
create policy "Heads can add exam papers" on public.exam_papers
  for insert to authenticated with check (private.is_admin(school_id));
create policy "Heads can change exam papers" on public.exam_papers
  for update to authenticated using (private.is_admin(school_id)) with check (private.is_admin(school_id));
create policy "Heads can remove exam papers" on public.exam_papers
  for delete to authenticated using (private.is_admin(school_id));
revoke all on public.exam_papers from anon, authenticated;
grant select, delete on public.exam_papers to authenticated;
grant insert (school_id, exam_period_id, day, starts_at, ends_at, subject_id, class_id, paper, invigilator_id, room)
  on public.exam_papers to authenticated;
grant update (day, starts_at, ends_at, subject_id, class_id, paper, invigilator_id, room)
  on public.exam_papers to authenticated;

-- Saves one sitting (a paper for one or more classes) in one go, replacing the rows it had before.
-- All or nothing: a clash for any class stops the whole save.
-- p_sitting: {"day": "2026-12-01", "starts_at": "09:00", "ends_at": "11:00", "subject_id": "...",
--             "paper": "Paper 1" | null, "invigilator_id": "..." | null, "room": "Hall A" | null}
create function public.save_exam_sitting(p_school uuid, p_period uuid, p_replace uuid[], p_sitting jsonb, p_classes uuid[])
returns int
language plpgsql security invoker set search_path = '' as $$
declare
  n int;
begin
  if not private.is_admin(p_school) then
    raise exception 'Only the principal or vice-principal can change the exam timetable.';
  end if;
  if coalesce(cardinality(p_classes), 0) = 0 then
    raise exception 'Choose at least one class.';
  end if;
  if cardinality(p_classes) > 80 then
    raise exception 'Choose at most 80 classes for one paper.';
  end if;
  if not exists (select 1 from public.exam_periods where id = p_period and school_id = p_school) then
    raise exception 'That exam period no longer exists.';
  end if;
  delete from public.exam_papers
  where school_id = p_school and exam_period_id = p_period and id = any(coalesce(p_replace, '{}'));
  insert into public.exam_papers (school_id, exam_period_id, day, starts_at, ends_at, subject_id, class_id, paper, invigilator_id, room)
  select p_school, p_period, (p_sitting->>'day')::date, (p_sitting->>'starts_at')::time, (p_sitting->>'ends_at')::time,
         (p_sitting->>'subject_id')::uuid, c, nullif(p_sitting->>'paper', ''),
         nullif(p_sitting->>'invigilator_id', '')::uuid, nullif(p_sitting->>'room', '')
  from (select distinct unnest(p_classes) as c) x;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ===== Students: their class's exam papers =====
create function public.my_exam_papers()
returns table (school_id uuid, class_id uuid, period_name text, day date, starts_at time, ends_at time,
               subject text, paper text, room text)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select distinct a.school_id, a.class_id from public.student_accounts a
    join public.schools sch on sch.id = a.school_id and sch.suspended_at is null
    where a.user_id = (select auth.uid()) and a.status in ('approved', 'pending')
  )
  select m.school_id, m.class_id, ep.name, p.day, p.starts_at, p.ends_at, s.name, p.paper, p.room
  from mine m
  join public.exam_papers p on p.class_id = m.class_id and p.school_id = m.school_id
  join public.exam_periods ep on ep.id = p.exam_period_id
  join public.subjects s on s.id = p.subject_id
  where ep.ends_on >= current_date - 14
  order by p.day, p.starts_at;
$$;

revoke all on function public.save_exam_sitting(uuid, uuid, uuid[], jsonb, uuid[]), public.my_exam_papers() from public, anon;
grant execute on function public.save_exam_sitting(uuid, uuid, uuid[], jsonb, uuid[]), public.my_exam_papers() to authenticated;
