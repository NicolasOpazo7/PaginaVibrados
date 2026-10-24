-- Create your administrator in Supabase -> Authentication -> Users first.
-- Replace TU_CORREO with that account's email. Never include its password here.
do $$
declare admin_id uuid;
begin
  select id into admin_id from auth.users
    where lower(email)=lower('TU_CORREO') and email_confirmed_at is not null;
  if admin_id is null then
    raise exception 'Primero crea y confirma la cuenta administradora en Authentication > Users.';
  end if;
  insert into public.review_admins(user_id) values(admin_id) on conflict(user_id) do nothing;
end;
$$;
