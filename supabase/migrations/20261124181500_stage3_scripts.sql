-- Stage 3: scanned scripts, their answers and page images.

alter table public.exams add column record_out_of numeric(7,2)
  check (record_out_of is null or record_out_of > 0);
grant insert (record_out_of), update (record_out_of) on public.exams to authenticated;

alter table public.exams add constraint exams_id_school_key unique (id, school_id);
alter table public.students add constraint students_id_school_key unique (id, school_id);

-- One row per student's script for an exam. Answers: one character per question
-- (A–F answer, a–f answer to check, '-' blank, '#' more than one shaded, '?' page not scanned).
create table public.scripts (
  id uuid primary key, -- made on the phone, so a scan saved offline can be sent again safely
  school_id uuid not null references public.schools(id) on delete cascade,
  exam_id uuid not null,
  student_id uuid,
  student_name text check (student_name is null or length(trim(student_name)) between 1 and 120),
  answers text not null check (answers ~ '^[A-Fa-f?#-]*$'),
  pages_scanned integer[] not null default '{}',
  scanned_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (exam_id, school_id) references public.exams(id, school_id) on delete cascade,
  foreign key (student_id, school_id) references public.students(id, school_id) on delete set null (student_id),
  unique (exam_id, student_id)
);
create index scripts_exam_school_idx on public.scripts(exam_id, school_id);
create index scripts_student_school_idx on public.scripts(student_id, school_id);
create index scripts_school_id_idx on public.scripts(school_id);
create index scripts_scanned_by_idx on public.scripts(scanned_by);

create trigger scripts_touch before update on public.scripts
  for each row execute function private.touch_updated_at();

alter table public.scripts enable row level security;

-- Whoever can see the exam (its creator and the school's admins) can see and change its scripts.
create policy "Exam owners and admins can view scripts" on public.scripts
  for select to authenticated using (exists (select 1 from public.exams e where e.id = exam_id));
create policy "Exam owners and admins can add scripts" on public.scripts
  for insert to authenticated with check (exists (select 1 from public.exams e where e.id = exam_id));
create policy "Exam owners and admins can update scripts" on public.scripts
  for update to authenticated
  using (exists (select 1 from public.exams e where e.id = exam_id))
  with check (exists (select 1 from public.exams e where e.id = exam_id));
create policy "Exam owners and admins can delete scripts" on public.scripts
  for delete to authenticated using (exists (select 1 from public.exams e where e.id = exam_id));

revoke all on public.scripts from anon, authenticated;
grant select, delete on public.scripts to authenticated;
grant insert (id, school_id, exam_id, student_id, student_name, answers, pages_scanned) on public.scripts to authenticated;
grant update (student_id, student_name, answers, pages_scanned) on public.scripts to authenticated;

-- Saves one scanned page: finds (or starts) the student's script and writes this page's answers into it.
-- Runs with the caller's permissions, so the rules above still apply.
create function public.record_scan(
  p_script_id uuid,
  p_exam_id uuid,
  p_student_id uuid,
  p_student_name text,
  p_page integer,
  p_first integer,
  p_answers text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_exam record;
  v_id uuid;
  v_answers text;
  v_pages integer[];
  v_name text := nullif(trim(coalesce(p_student_name, '')), '');
begin
  select id, school_id, question_count into v_exam from public.exams where id = p_exam_id;
  if v_exam.id is null then
    raise exception 'This exam was not found, or you can''t see it.';
  end if;
  if p_first < 1 or p_first + length(p_answers) - 1 > v_exam.question_count then
    raise exception 'This sheet doesn''t match the exam''s number of questions. Print new sheets.';
  end if;

  if p_student_id is not null then
    select id into v_id from public.scripts where exam_id = p_exam_id and student_id = p_student_id;
  elsif v_name is not null then
    select id into v_id from public.scripts
    where exam_id = p_exam_id and student_id is null and lower(student_name) = lower(v_name)
    order by created_at limit 1;
  end if;
  if v_id is null then
    select id into v_id from public.scripts where id = p_script_id;
  end if;

  if v_id is null then
    insert into public.scripts (id, school_id, exam_id, student_id, student_name, answers)
    values (p_script_id, v_exam.school_id, p_exam_id, p_student_id, v_name, repeat('?', v_exam.question_count))
    returning id into v_id;
  end if;

  select answers, pages_scanned into v_answers, v_pages from public.scripts where id = v_id;
  v_answers := left(rpad(v_answers, v_exam.question_count, '?'), v_exam.question_count);
  v_answers := overlay(v_answers placing p_answers from p_first for length(p_answers));
  update public.scripts set
    answers = v_answers,
    pages_scanned = (select array_agg(distinct p order by p) from unnest(v_pages || p_page) as p),
    student_name = coalesce(v_name, student_name)
  where id = v_id;
  return v_id;
end;
$$;
revoke all on function public.record_scan(uuid, uuid, uuid, text, integer, integer, text) from public, anon;
grant execute on function public.record_scan(uuid, uuid, uuid, text, integer, integer, text) to authenticated;

-- Page images: scripts/<school>/<exam>/<script>/p<page>.jpg, visible to whoever can see the exam.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scripts', 'scripts', false, 2097152, array['image/jpeg']);

create policy "Script images: view" on storage.objects for select to authenticated using (
  bucket_id = 'scripts' and exists (
    select 1 from public.exams e
    where e.school_id::text = (storage.foldername(name))[1] and e.id::text = (storage.foldername(name))[2]
  )
);
create policy "Script images: add" on storage.objects for insert to authenticated with check (
  bucket_id = 'scripts' and exists (
    select 1 from public.exams e
    where e.school_id::text = (storage.foldername(name))[1] and e.id::text = (storage.foldername(name))[2]
  )
);
create policy "Script images: replace" on storage.objects for update to authenticated using (
  bucket_id = 'scripts' and exists (
    select 1 from public.exams e
    where e.school_id::text = (storage.foldername(name))[1] and e.id::text = (storage.foldername(name))[2]
  )
);
create policy "Script images: delete" on storage.objects for delete to authenticated using (
  bucket_id = 'scripts' and exists (
    select 1 from public.exams e
    where e.school_id::text = (storage.foldername(name))[1] and e.id::text = (storage.foldername(name))[2]
  )
);
