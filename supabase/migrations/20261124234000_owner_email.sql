-- The owner of Zelvo uses vynkcontact01@gmail.com; flourishokafor13@gmail.com becomes an ordinary
-- (student) account. The owner account doesn't exist yet, so it is made owner automatically
-- the moment it signs up (email and password, or Google).

create table private.owner_emails (email text primary key check (email = lower(email)));
insert into private.owner_emails (email) values ('vynkcontact01@gmail.com');

create function private.make_owner_on_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.owner_emails where email = lower(new.email)) then
    insert into public.platform_admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.make_owner_on_signup() from public, anon, authenticated;

create trigger zelvo_make_owner_on_signup
  after insert on auth.users
  for each row execute function private.make_owner_on_signup();

-- In case the account already exists by the time this runs.
insert into public.platform_admins (user_id)
select id from auth.users where lower(email) in (select email from private.owner_emails)
on conflict do nothing;

delete from public.platform_admins
where user_id in (select id from auth.users where lower(email) = 'flourishokafor13@gmail.com');
