-- Students can join two ways:
--   1. Ask to join (school, class, name) and wait for a teacher to approve (unchanged).
--   2. A teacher sends a student their own code by email. The code only works for an account
--      made with that email, and it joins the student straight away, linked to their name.

create table public.student_invites (
  student_id uuid primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  code text not null unique,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete cascade
);
create index student_invites_school_idx on public.student_invites(school_id);
create index student_invites_created_by_idx on public.student_invites(created_by);

alter table public.student_invites enable row level security;
create policy "Staff see their school's student codes" on public.student_invites
  for select to authenticated using (private.is_member(school_id));
revoke all on public.student_invites from anon, authenticated;
grant select on public.student_invites to authenticated;

-- True when no staff or student code uses this code.
create function private.code_is_free(p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.staff_invites where code = p_code)
     and not exists (select 1 from public.student_invites where code = p_code);
$$;

-- Staff codes now also avoid student codes.
create or replace function private.issue_invite(p_staff_id uuid, p_school_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_code text;
begin
  loop
    v_code := private.new_invite_code();
    continue when not private.code_is_free(v_code);
    begin
      insert into public.staff_invites (staff_id, school_id, code)
      values (p_staff_id, p_school_id, v_code)
      on conflict (staff_id) do update set code = excluded.code, created_at = now();
      return v_code;
    exception when unique_violation then
      null; -- taken at the same moment; try another
    end;
  end loop;
end;
$$;

-- Any staff member of the school can send a student their code (same people who approve requests).
-- Keeps the existing code unless p_new is true, so a resent email still shows the same code.
create function public.send_student_code(p_student uuid, p_email text, p_new boolean default false)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_code text;
begin
  select school_id into v_school from public.students where id = p_student;
  if v_school is null or not private.is_member(v_school) then
    raise exception 'Only staff of this school can do this.';
  end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter the student''s email, e.g. name@gmail.com.';
  end if;
  if exists (select 1 from public.student_accounts where student_id = p_student and status = 'approved') then
    raise exception 'This student has already joined Zelvo.';
  end if;

  select code into v_code from public.student_invites where student_id = p_student;
  if v_code is not null and not p_new then
    update public.student_invites set email = v_email, created_by = auth.uid(), created_at = now()
    where student_id = p_student;
    return v_code;
  end if;

  loop
    v_code := private.new_invite_code();
    continue when not private.code_is_free(v_code);
    begin
      insert into public.student_invites (student_id, school_id, code, email)
      values (p_student, v_school, v_code, v_email)
      on conflict (student_id) do update
        set code = excluded.code, email = excluded.email, created_by = auth.uid(), created_at = now();
      return v_code;
    exception when unique_violation then
      null;
    end;
  end loop;
end;
$$;

-- The student enters their code. Returns the school id.
create function public.join_as_student(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_inv public.student_invites%rowtype;
  v_student public.students%rowtype;
begin
  if v_uid is null then raise exception 'You need to be signed in.'; end if;
  select * into v_inv from public.student_invites where code = v_code for update;
  if v_inv.student_id is null then
    if exists (select 1 from public.staff_invites where code = v_code) then
      raise exception 'That is a staff code. Go back and tap "I''m a teacher with a code".';
    end if;
    raise exception 'That code is not valid. Check it with your teacher.';
  end if;
  if v_inv.email <> (select lower(email) from auth.users where id = v_uid) then
    raise exception 'This code was sent to %. Log in with that email to use it.', v_inv.email;
  end if;
  if exists (select 1 from public.student_accounts
             where student_id = v_inv.student_id and status = 'approved' and user_id <> v_uid) then
    raise exception 'This student has already joined with another account. Ask your teacher.';
  end if;

  select * into v_student from public.students where id = v_inv.student_id;
  insert into public.student_accounts (user_id, school_id, class_id, typed_name, student_id, status, decided_by, decided_at)
  values (v_uid, v_student.school_id, v_student.class_id, v_student.full_name, v_student.id, 'approved', v_inv.created_by, now())
  on conflict (user_id, school_id) do update
    set class_id = excluded.class_id, typed_name = excluded.typed_name, student_id = excluded.student_id,
        status = 'approved', decided_by = excluded.decided_by, decided_at = now();
  delete from public.student_invites where student_id = v_inv.student_id;
  return v_student.school_id;
end;
$$;

-- A student code typed into the staff screen gets a clear message.
create or replace function public.join_school(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_staff uuid;
  v_school uuid;
  v_email text;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.';
  end if;
  select i.staff_id, i.school_id, i.email into v_staff, v_school, v_email
  from public.staff_invites i
  where i.code = v_clean
  for update;
  if v_staff is null then
    if exists (select 1 from public.student_invites where code = v_clean) then
      raise exception 'That is a student code. Go back and tap "I''m a student".';
    end if;
    raise exception 'That join code is not valid. Check it with your head of school.';
  end if;
  if v_email is not null and v_email <> (select lower(email) from auth.users where id = v_uid) then
    raise exception 'This code was sent to %. Log in with that email to use it.', v_email;
  end if;
  if exists (select 1 from public.staff where school_id = v_school and user_id = v_uid) then
    raise exception 'You are already a member of this school.';
  end if;
  update public.staff set user_id = v_uid, joined_at = now() where id = v_staff and user_id is null;
  delete from public.staff_invites where staff_id = v_staff;
  return v_school;
end;
$$;

revoke all on function public.send_student_code(uuid, text, boolean), public.join_as_student(text) from public, anon;
grant execute on function public.send_student_code(uuid, text, boolean), public.join_as_student(text) to authenticated;
revoke all on function private.code_is_free(text) from public, anon, authenticated;
