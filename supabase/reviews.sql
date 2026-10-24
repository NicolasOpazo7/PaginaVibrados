-- Run once in this project's Supabase SQL Editor as the project owner.
-- No service_role/secret key belongs in the website.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table if not exists public.review_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.review_admins enable row level security;
revoke all on public.review_admins from public, anon, authenticated;
grant select(user_id) on public.review_admins to authenticated;
drop policy if exists review_admin_self on public.review_admins;
create policy review_admin_self on public.review_admins for select to authenticated using (user_id=(select auth.uid()));

create or replace function private.is_review_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.review_admins a where a.user_id=(select auth.uid()));
$$;
revoke all on function private.is_review_admin() from public;
grant execute on function private.is_review_admin() to anon, authenticated;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Anónimo' check(char_length(name) between 1 and 100),
  rating integer not null check(rating between 1 and 5),
  comment text not null check(char_length(comment) between 10 and 2000),
  image_path text,
  created timestamptz not null default now(),
  status text not null default 'draft' check(status in ('draft','pending','approved','rejected')),
  response text not null default '' check(char_length(response)<=2000),
  upload_token uuid
);
create index if not exists reviews_status_created_idx on public.reviews(status,created desc);
alter table public.reviews enable row level security;
revoke all on public.reviews from public, anon, authenticated;
grant select(id,name,rating,comment,image_path,created,status,response) on public.reviews to anon, authenticated;
grant update(status,response),delete on public.reviews to authenticated;
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select to anon, authenticated
  using(status='approved' or (select private.is_review_admin()));
drop policy if exists reviews_moderate on public.reviews;
create policy reviews_moderate on public.reviews for update to authenticated
  using((select private.is_review_admin())) with check((select private.is_review_admin()) and status in ('pending','approved','rejected'));
drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews for delete to authenticated using((select private.is_review_admin()));

-- Public submissions go through a bounded function, never direct table writes.
-- A draft becomes pending only after its optional image was actually uploaded.
create or replace function public.submit_review(p_name text,p_rating integer,p_comment text,p_image_extension text default null,p_consent boolean default false)
returns table(review_id uuid,image_path text,upload_token uuid)
language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid := gen_random_uuid();
  new_token uuid := gen_random_uuid();
  new_path text;
  clean_name text := coalesce(nullif(btrim(p_name),''),'Anónimo');
begin
  if p_consent is distinct from true then raise exception 'Debes aceptar la autorización de publicación.'; end if;
  if char_length(clean_name)>100 or p_rating is null or p_rating not between 1 and 5
     or p_comment is null or char_length(btrim(p_comment)) not between 10 and 2000
     or (p_image_extension is not null and p_image_extension not in ('jpg','png','webp')) then
    raise exception 'Revisa el nombre, la calificación, la descripción y la imagen.';
  end if;
  perform pg_advisory_xact_lock(749103624);
  -- Global ceilings limit anonymous abuse on this small business site.
  if (select count(*) from public.reviews r where r.created>now()-interval '1 minute')>=5
     or (select count(*) from public.reviews r where r.created>now()-interval '1 day')>=100
     or (select count(*) from public.reviews r where r.status in ('draft','pending'))>=100 then
    raise exception 'El envío está temporalmente limitado. Inténtalo más tarde.';
  end if;
  if p_image_extension is not null then
    new_path:=new_id::text||'/'||gen_random_uuid()::text||'.'||p_image_extension;
  end if;
  insert into public.reviews(id,name,rating,comment,image_path,status,upload_token)
    values(new_id,clean_name,p_rating,btrim(p_comment),new_path,'draft',new_token);
  return query select new_id,new_path,new_token;
end;
$$;
revoke all on function public.submit_review(text,integer,text,text,boolean) from public;
grant execute on function public.submit_review(text,integer,text,text,boolean) to anon, authenticated;

create or replace function public.complete_review(p_id uuid,p_upload_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare draft public.reviews%rowtype;
begin
  select r.* into draft from public.reviews r
    where r.id=p_id and r.upload_token=p_upload_token and r.status='draft'
      and r.created>now()-interval '15 minutes' for update;
  if not found then raise exception 'No se pudo confirmar el envío. Inténtalo de nuevo.'; end if;
  if draft.image_path is not null and not exists(
    select 1 from storage.objects o where o.bucket_id='review-images' and o.name=draft.image_path
  ) then raise exception 'La imagen aún no se ha recibido. Intenta enviarla nuevamente.'; end if;
  update public.reviews set status='pending',upload_token=null where id=p_id;
end;
$$;
revoke all on function public.complete_review(uuid,uuid) from public;
grant execute on function public.complete_review(uuid,uuid) to anon, authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('review-images','review-images',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function private.review_image_upload_allowed(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.reviews r where r.image_path=object_name and r.status='draft' and r.created>now()-interval '15 minutes');
$$;
create or replace function private.review_image_read_allowed(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_review_admin() or exists(select 1 from public.reviews r where r.image_path=object_name and r.status='approved');
$$;
revoke all on function private.review_image_upload_allowed(text),private.review_image_read_allowed(text) from public;
grant execute on function private.review_image_upload_allowed(text),private.review_image_read_allowed(text) to anon, authenticated;
drop policy if exists review_images_upload on storage.objects;
create policy review_images_upload on storage.objects for insert to anon, authenticated
  with check(bucket_id='review-images' and private.review_image_upload_allowed(name));
drop policy if exists review_images_read on storage.objects;
create policy review_images_read on storage.objects for select to anon, authenticated
  using(bucket_id='review-images' and private.review_image_read_allowed(name));
drop policy if exists review_images_delete on storage.objects;
create policy review_images_delete on storage.objects for delete to authenticated
  using(bucket_id='review-images' and (select private.is_review_admin()));
notify pgrst,'reload schema';
commit;
