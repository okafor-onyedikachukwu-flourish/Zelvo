-- Number of students on each class list. Runs with the caller's permissions,
-- so the usual "members only" rule on students applies.
create function public.class_student_counts(p_school uuid)
returns table (class_id uuid, students integer)
language sql stable security invoker set search_path = '' as $$
  select s.class_id, count(*)::integer
  from public.students s
  where s.school_id = p_school
  group by s.class_id;
$$;

revoke all on function public.class_student_counts(uuid) from public, anon;
grant execute on function public.class_student_counts(uuid) to authenticated;
