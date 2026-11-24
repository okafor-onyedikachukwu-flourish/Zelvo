-- Roles: Head of school ('admin'), Head of department ('hod', for one subject), Teacher.
-- HODs can view every exam in their subject; only an exam's creator or the head of school can change it.
-- (Applied as two migrations: hod_role_and_performance and record_scan_owner_check.)

alter table public.staff drop constraint staff_role_check;
alter table public.staff add constraint staff_role_check check (role in ('admin', 'hod', 'teacher'));
alter table public.staff add column subject_id uuid;
alter table public.staff add constraint staff_subject_school_fkey
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete set null (subject_id);
create index staff_subject_school_idx on public.staff(subject_id, school_id);
grant insert (subject_id), update (subject_id) on public.staff to authenticated;

create function private.is_hod_for(p_school uuid, p_subject uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.school_id = p_school and s.user_id = (select auth.uid()) and s.role = 'hod' and s.subject_id = p_subject
  );
$$;
revoke all on function private.is_hod_for(uuid, uuid) from public;
grant execute on function private.is_hod_for(uuid, uuid) to authenticated;

drop policy "Creators and admins can view exams" on public.exams;
create policy "Creators, admins and the subject's HOD can view exams" on public.exams
  for select to authenticated using (
    private.is_admin(school_id)
    or private.is_hod_for(school_id, subject_id)
    or (created_by = (select auth.uid()) and private.is_member(school_id))
  );

drop policy "Exam owners and admins can add scripts" on public.scripts;
drop policy "Exam owners and admins can update scripts" on public.scripts;
drop policy "Exam owners and admins can delete scripts" on public.scripts;
create policy "Exam owners and admins can add scripts" on public.scripts
  for insert to authenticated with check (exists (
    select 1 from public.exams e where e.id = exam_id and (private.is_admin(e.school_id) or e.created_by = (select auth.uid()))
  ));
create policy "Exam owners and admins can update scripts" on public.scripts
  for update to authenticated
  using (exists (select 1 from public.exams e where e.id = exam_id and (private.is_admin(e.school_id) or e.created_by = (select auth.uid()))))
  with check (exists (select 1 from public.exams e where e.id = exam_id and (private.is_admin(e.school_id) or e.created_by = (select auth.uid()))));
create policy "Exam owners and admins can delete scripts" on public.scripts
  for delete to authenticated using (exists (
    select 1 from public.exams e where e.id = exam_id and (private.is_admin(e.school_id) or e.created_by = (select auth.uid()))
  ));

drop policy "Script images: add" on storage.objects;
drop policy "Script images: replace" on storage.objects;
drop policy "Script images: delete" on storage.objects;
create policy "Script images: add" on storage.objects for insert to authenticated with check (
  bucket_id = 'scripts' and exists (
    select 1 from public.exams e
    where e.school_id::text = (storage.foldername(name))[1] and e.id::text = (storage.foldername(name))[2]
      and (private.is_admin(e.school_id) or e.created_by = (select auth.uid()))
  )
);
create policy "Script images: replace" on storage.objects for update to authenticated using (
  bucket_id = 'scripts' and exists (
    select 1 from public.exams e
    where e.school_id::text = (storage.foldername(name))[1] and e.id::text = (storage.foldername(name))[2]
      and (private.is_admin(e.school_id) or e.created_by = (select auth.uid()))
  )
);
create policy "Script images: delete" on storage.objects for delete to authenticated using (
  bucket_id = 'scripts' and exists (
    select 1 from public.exams e
    where e.school_id::text = (storage.foldername(name))[1] and e.id::text = (storage.foldername(name))[2]
      and (private.is_admin(e.school_id) or e.created_by = (select auth.uid()))
  )
);

create function private.script_percent(p_answers text, p_key text) returns numeric
language sql immutable set search_path = '' as $$
  select case when count(*) filter (where k <> '?') = 0 then null
    else round(100.0 * count(*) filter (where k <> '?' and (k = '*' or upper(coalesce(a, '')) = k))
               / count(*) filter (where k <> '?'), 1) end
  from (select substr(p_key, i, 1) as k, substr(p_answers, i, 1) as a
        from generate_series(1, length(p_key)) as i) q;
$$;
revoke all on function private.script_percent(text, text) from public;
grant execute on function private.script_percent(text, text) to authenticated;

-- Averages per exam, limited by the caller's permissions (head: everything; HOD: their subject; teacher: own exams).
create function public.exam_performance(p_school uuid)
returns table (exam_id uuid, title text, exam_date date, created_at timestamptz,
               class_id uuid, class_name text, subject_id uuid, subject_name text,
               scripts integer, average numeric, highest numeric, lowest numeric)
language sql stable security invoker set search_path = '' as $$
  select e.id, e.title, e.exam_date, e.created_at, e.class_id, c.name, e.subject_id, s.name,
         count(sc.id)::integer, round(avg(p.pct), 1), max(p.pct), min(p.pct)
  from public.exams e
  join public.classes c on c.id = e.class_id
  join public.subjects s on s.id = e.subject_id
  left join public.scripts sc on sc.exam_id = e.id
  left join lateral (select private.script_percent(sc.answers, e.answer_key) as pct) p on true
  where e.school_id = p_school
  group by e.id, c.name, s.name
  order by c.name, s.name, e.created_at;
$$;
revoke all on function public.exam_performance(uuid) from public, anon;
grant execute on function public.exam_performance(uuid) to authenticated;

-- record_scan: only the exam's creator or the head of school may scan (added check at the start).
create or replace function public.record_scan(
  p_script_id uuid, p_exam_id uuid, p_student_id uuid, p_student_name text,
  p_page integer, p_first integer, p_answers text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_exam record;
  v_id uuid;
  v_answers text;
  v_pages integer[];
  v_name text := nullif(trim(coalesce(p_student_name, '')), '');
begin
  select id, school_id, question_count, created_by into v_exam from public.exams where id = p_exam_id;
  if v_exam.id is null then
    raise exception 'This exam was not found, or you can''t see it.';
  end if;
  if not (private.is_admin(v_exam.school_id) or v_exam.created_by = auth.uid()) then
    raise exception 'Only the teacher who created this exam, or the head of school, can scan its scripts.';
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

-- Clearer wording for the "last head of school" rule (migration last_head_message).
create or replace function private.guard_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if old.role = 'admin' and old.user_id is not null
     and (tg_op = 'DELETE' or new.role <> 'admin') then
    if not exists (
      select 1 from public.staff s
      where s.school_id = old.school_id and s.role = 'admin'
        and s.user_id is not null and s.id <> old.id
    ) then
      raise exception 'A school needs at least one head of school. Make someone else head of school first.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
