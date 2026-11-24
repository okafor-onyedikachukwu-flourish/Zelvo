-- Each subject has at most one head of department in a school.
create function private.guard_one_hod() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_other text;
  v_subject text;
begin
  if new.role = 'hod' and new.subject_id is not null then
    select full_name into v_other from public.staff
    where school_id = new.school_id and subject_id = new.subject_id and role = 'hod' and id <> new.id
    limit 1;
    if v_other is not null then
      select name into v_subject from public.subjects where id = new.subject_id;
      raise exception '% already has a head of department: %. Make them a teacher first.', v_subject, v_other;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_one_hod() from public;

create trigger staff_one_hod_per_subject
  before insert or update of role, subject_id on public.staff
  for each row execute function private.guard_one_hod();

-- Backstop if two heads save at the same moment.
create unique index staff_one_hod_per_subject on public.staff (school_id, subject_id) where role = 'hod';
