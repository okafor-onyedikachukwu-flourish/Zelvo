-- Stage 2: exams and answer keys.
-- An exam is visible only to the teacher who created it and to the school's admins.

alter table public.subjects add constraint subjects_id_school_key unique (id, school_id);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  title text not null check (length(trim(title)) between 2 and 120),
  exam_date date,
  question_count integer not null check (question_count between 1 and 1000),
  option_count integer not null default 4 check (option_count between 2 and 6),
  mark_per_question numeric(6,2) not null default 1 check (mark_per_question > 0),
  -- One character per question: a letter (correct option), '?' (not set yet) or '*' (free mark for everyone).
  answer_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete restrict,
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete restrict,
  constraint exams_answer_key_valid check (
    length(answer_key) = question_count
    and answer_key !~ ('[^' || substr('ABCDEF', 1, option_count) || '?*]')
  )
);
create index exams_school_id_idx on public.exams(school_id);
create index exams_class_school_idx on public.exams(class_id, school_id);
create index exams_subject_school_idx on public.exams(subject_id, school_id);
create index exams_created_by_idx on public.exams(created_by);

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public;
create trigger exams_touch before update on public.exams
  for each row execute function private.touch_updated_at();

alter table public.exams enable row level security;

create policy "Creators and admins can view exams" on public.exams
  for select to authenticated using (
    private.is_admin(school_id)
    or (created_by = (select auth.uid()) and private.is_member(school_id))
  );
create policy "Members can create their own exams" on public.exams
  for insert to authenticated with check (
    created_by = (select auth.uid()) and private.is_member(school_id)
  );
create policy "Creators and admins can update exams" on public.exams
  for update to authenticated
  using (private.is_admin(school_id) or (created_by = (select auth.uid()) and private.is_member(school_id)))
  with check (private.is_admin(school_id) or (created_by = (select auth.uid()) and private.is_member(school_id)));
create policy "Creators and admins can delete exams" on public.exams
  for delete to authenticated using (
    private.is_admin(school_id)
    or (created_by = (select auth.uid()) and private.is_member(school_id))
  );

revoke all on public.exams from anon, authenticated;
grant select, delete on public.exams to authenticated;
grant insert (school_id, class_id, subject_id, title, exam_date, question_count, option_count, mark_per_question, answer_key)
  on public.exams to authenticated;
grant update (class_id, subject_id, title, exam_date, question_count, option_count, mark_per_question, answer_key)
  on public.exams to authenticated;
