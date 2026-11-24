-- Stage 1: schools, staff (admins and teachers), join codes, classes, subjects and class lists.
-- Already applied to the Zelvo Supabase project. Kept here as the record of the schema.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ============ Tables ============

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  country text,
  timezone text not null default 'UTC',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index schools_created_by_idx on public.schools(created_by);

-- Everyone who works in a school: admins and teachers.
-- A row with user_id = null is a person the admin has added who hasn't joined yet.
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  role text not null default 'teacher' check (role in ('admin', 'teacher')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);
create index staff_user_id_idx on public.staff(user_id);

-- One join code per staff member who hasn't joined yet. Only admins can see these.
create table public.staff_invites (
  staff_id uuid primary key references public.staff(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
create index staff_invites_school_id_idx on public.staff_invites(school_id);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (id, school_id)
);
create unique index classes_school_name_key on public.classes (school_id, lower(trim(name)));

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create unique index subjects_school_name_key on public.subjects (school_id, lower(trim(name)));

-- Optional class lists, used to match handwritten names on scripts.
create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  created_at timestamptz not null default now(),
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade
);
create index students_class_school_idx on public.students(class_id, school_id);
create index students_school_id_idx on public.students(school_id);

-- ============ Helper functions (not exposed through the API) ============

create function private.is_member(p_school uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.school_id = p_school and s.user_id = (select auth.uid())
  );
$$;

create function private.is_admin(p_school uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.school_id = p_school and s.user_id = (select auth.uid()) and s.role = 'admin'
  );
$$;

-- 8-character code without look-alike characters (no 0/O, 1/I).
create function private.new_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

create function private.issue_invite(p_staff_id uuid, p_school_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_code text;
begin
  delete from public.staff_invites where staff_id = p_staff_id;
  loop
    begin
      v_code := private.new_invite_code();
      insert into public.staff_invites (staff_id, school_id, code)
      values (p_staff_id, p_school_id, v_code);
      return v_code;
    exception when unique_violation then
      null; -- code already in use; try another
    end;
  end loop;
end;
$$;

revoke all on function private.is_member(uuid), private.is_admin(uuid),
  private.new_invite_code(), private.issue_invite(uuid, uuid) from public;
grant execute on function private.is_member(uuid), private.is_admin(uuid) to authenticated;

-- ============ Triggers ============

-- New staff member who hasn't joined yet gets a join code automatically.
create function private.on_staff_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is null then
    perform private.issue_invite(new.id, new.school_id);
  end if;
  return new;
end;
$$;
create trigger staff_issue_invite after insert on public.staff
  for each row execute function private.on_staff_insert();

-- A school must always keep at least one admin who has joined.
create function private.guard_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old); -- cascades (school or account deleted)
  end if;
  if old.role = 'admin' and old.user_id is not null
     and (tg_op = 'DELETE' or new.role <> 'admin') then
    if not exists (
      select 1 from public.staff s
      where s.school_id = old.school_id and s.role = 'admin'
        and s.user_id is not null and s.id <> old.id
    ) then
      raise exception 'A school needs at least one admin. Make someone else an admin first.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger staff_guard_last_admin before update or delete on public.staff
  for each row execute function private.guard_last_admin();

revoke all on function private.on_staff_insert(), private.guard_last_admin() from public;

-- ============ App functions (called from the app) ============

create function public.create_school(
  p_name text, p_admin_name text, p_country text default null, p_timezone text default 'UTC'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_school uuid;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.';
  end if;
  insert into public.schools (name, country, timezone, created_by)
  values (trim(p_name), nullif(trim(p_country), ''), coalesce(nullif(trim(p_timezone), ''), 'UTC'), v_uid)
  returning id into v_school;
  insert into public.staff (school_id, user_id, full_name, role, joined_at)
  values (v_school, v_uid, trim(p_admin_name), 'admin', now());
  return v_school;
end;
$$;

create function public.join_school(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_staff uuid;
  v_school uuid;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.';
  end if;
  select i.staff_id, i.school_id into v_staff, v_school
  from public.staff_invites i
  where i.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
  for update;
  if v_staff is null then
    raise exception 'That join code is not valid. Check it with your school admin.';
  end if;
  if exists (select 1 from public.staff where school_id = v_school and user_id = v_uid) then
    raise exception 'You are already a member of this school.';
  end if;
  update public.staff set user_id = v_uid, joined_at = now() where id = v_staff and user_id is null;
  delete from public.staff_invites where staff_id = v_staff;
  return v_school;
end;
$$;

create function public.regenerate_invite(p_staff_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_school uuid;
  v_user uuid;
begin
  select school_id, user_id into v_school, v_user from public.staff where id = p_staff_id;
  if v_school is null or not private.is_admin(v_school) then
    raise exception 'Only a school admin can do this.';
  end if;
  if v_user is not null then
    raise exception 'This person has already joined.';
  end if;
  return private.issue_invite(p_staff_id, v_school);
end;
$$;

revoke all on function public.create_school(text, text, text, text),
  public.join_school(text), public.regenerate_invite(uuid) from public, anon;
grant execute on function public.create_school(text, text, text, text),
  public.join_school(text), public.regenerate_invite(uuid) to authenticated;

-- ============ Row level security ============

alter table public.schools enable row level security;
alter table public.staff enable row level security;
alter table public.staff_invites enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.students enable row level security;

create policy "Members can view their school" on public.schools
  for select to authenticated using (private.is_member(id));
create policy "Admins can update their school" on public.schools
  for update to authenticated using (private.is_admin(id)) with check (private.is_admin(id));

create policy "Members can view staff" on public.staff
  for select to authenticated using (private.is_member(school_id));
create policy "Admins can add staff" on public.staff
  for insert to authenticated with check (private.is_admin(school_id));
create policy "Admins can update staff" on public.staff
  for update to authenticated using (private.is_admin(school_id)) with check (private.is_admin(school_id));
create policy "Admins can remove staff" on public.staff
  for delete to authenticated using (private.is_admin(school_id));

create policy "Admins can view join codes" on public.staff_invites
  for select to authenticated using (private.is_admin(school_id));

create policy "Members can view classes" on public.classes
  for select to authenticated using (private.is_member(school_id));
create policy "Admins can add classes" on public.classes
  for insert to authenticated with check (private.is_admin(school_id));
create policy "Admins can update classes" on public.classes
  for update to authenticated using (private.is_admin(school_id)) with check (private.is_admin(school_id));
create policy "Admins can delete classes" on public.classes
  for delete to authenticated using (private.is_admin(school_id));

create policy "Members can view subjects" on public.subjects
  for select to authenticated using (private.is_member(school_id));
create policy "Admins can add subjects" on public.subjects
  for insert to authenticated with check (private.is_admin(school_id));
create policy "Admins can update subjects" on public.subjects
  for update to authenticated using (private.is_admin(school_id)) with check (private.is_admin(school_id));
create policy "Admins can delete subjects" on public.subjects
  for delete to authenticated using (private.is_admin(school_id));

create policy "Members can view students" on public.students
  for select to authenticated using (private.is_member(school_id));
create policy "Admins can add students" on public.students
  for insert to authenticated with check (private.is_admin(school_id));
create policy "Admins can update students" on public.students
  for update to authenticated using (private.is_admin(school_id)) with check (private.is_admin(school_id));
create policy "Admins can delete students" on public.students
  for delete to authenticated using (private.is_admin(school_id));

-- ============ Column-level permissions ============
-- Stops anyone writing columns they shouldn't (e.g. linking another person's account).

revoke all on public.schools, public.staff, public.staff_invites,
  public.classes, public.subjects, public.students from anon, authenticated;

grant select on public.schools, public.staff, public.staff_invites,
  public.classes, public.subjects, public.students to authenticated;

grant update (name, country, timezone) on public.schools to authenticated;
grant insert (school_id, full_name, role), update (full_name, role), delete on public.staff to authenticated;
grant insert (school_id, name), update (name), delete on public.classes to authenticated;
grant insert (school_id, name), update (name), delete on public.subjects to authenticated;
grant insert (school_id, class_id, full_name), update (class_id, full_name), delete on public.students to authenticated;
