-- Up to two heads of department per subject in a school (was one).
drop trigger staff_one_hod_per_subject on public.staff;
drop index public.staff_one_hod_per_subject;
drop function private.guard_one_hod();

create function private.guard_hod_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_others text[];
  v_subject text;
begin
  if new.role = 'hod' and new.subject_id is not null then
    -- Lock the subject so two heads saving at the same moment can't both get through.
    select name into v_subject from public.subjects where id = new.subject_id for update;
    select array_agg(full_name order by full_name) into v_others from public.staff
    where school_id = new.school_id and subject_id = new.subject_id and role = 'hod' and id <> new.id;
    if coalesce(array_length(v_others, 1), 0) >= 2 then
      raise exception '% already has 2 heads of department: %. Make one of them a teacher first.',
        v_subject, array_to_string(v_others, ' and ');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_hod_limit() from public;

create trigger staff_hod_limit
  before insert or update of role, subject_id on public.staff
  for each row execute function private.guard_hod_limit();
