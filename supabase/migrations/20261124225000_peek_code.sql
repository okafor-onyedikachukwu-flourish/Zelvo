-- Shows who a join code is for, before the person signs up, so they can check it's them
-- and so the sign-up form can fill in their name and the email the code is locked to.
create function public.peek_code(p_code text)
returns table (kind text, school_name text, person_name text, role text, subject_name text, class_name text, email text)
language sql stable security definer set search_path = '' as $$
  with c as (select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) as code)
  select 'staff', sc.name, st.full_name, st.role, su.name, null::text, i.email
  from c
  join public.staff_invites i on i.code = c.code
  join public.staff st on st.id = i.staff_id
  join public.schools sc on sc.id = i.school_id
  left join public.subjects su on su.id = st.subject_id
  where length(c.code) = 8
  union all
  select 'student', sc.name, s.full_name, 'student', null::text, cl.name, i.email
  from c
  join public.student_invites i on i.code = c.code
  join public.students s on s.id = i.student_id
  join public.schools sc on sc.id = i.school_id
  join public.classes cl on cl.id = s.class_id
  where length(c.code) = 8;
$$;
revoke all on function public.peek_code(text) from public;
grant execute on function public.peek_code(text) to anon, authenticated;
