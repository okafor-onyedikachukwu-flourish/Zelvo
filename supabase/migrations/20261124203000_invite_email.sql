-- A join code can be sent to the person's own email. When an email is set, the code only works
-- for an account signed in with that email. Stored with the invite, so only heads of school see it.

alter table public.staff_invites add column email text
  check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

create or replace function private.issue_invite(p_staff_id uuid, p_school_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_code text;
begin
  loop
    begin
      v_code := private.new_invite_code();
      insert into public.staff_invites (staff_id, school_id, code)
      values (p_staff_id, p_school_id, v_code)
      on conflict (staff_id) do update set code = excluded.code, created_at = now();
      return v_code;
    exception when unique_violation then
      null; -- code already in use by someone else; try another
    end;
  end loop;
end;
$$;

create function public.set_invite_email(p_staff_id uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  select school_id into v_school from public.staff_invites where staff_id = p_staff_id;
  if v_school is null or not private.is_admin(v_school) then
    raise exception 'Only the head of school can do this.';
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email address doesn''t look right.';
  end if;
  update public.staff_invites set email = v_email where staff_id = p_staff_id;
end;
$$;
revoke all on function public.set_invite_email(uuid, text) from public, anon;
grant execute on function public.set_invite_email(uuid, text) to authenticated;

create or replace function public.join_school(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_staff uuid;
  v_school uuid;
  v_email text;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.';
  end if;
  select i.staff_id, i.school_id, i.email into v_staff, v_school, v_email
  from public.staff_invites i
  where i.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
  for update;
  if v_staff is null then
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
