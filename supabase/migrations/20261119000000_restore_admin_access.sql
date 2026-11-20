create table if not exists public.app_admins (
  email text primary key,
  user_id uuid unique,
  created_at timestamptz not null default now()
);

alter table public.app_admins add column if not exists user_id uuid;

update public.app_admins a
set user_id = u.id
from auth.users u
where a.user_id is null and lower(u.email) = lower(a.email);

alter table public.app_admins enable row level security;

drop policy if exists "admin_read_self" on public.app_admins;
create policy "admin_read_self" on public.app_admins
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins
    where user_id = auth.uid()
  );
$$;

grant execute on function public.is_app_admin() to anon, authenticated;

grant insert, update, delete on public.brands, public.categories, public.products to authenticated;

drop policy if exists "admin_insert_brands" on public.brands;
create policy "admin_insert_brands" on public.brands for insert to authenticated
  with check (public.is_app_admin());
drop policy if exists "admin_update_brands" on public.brands;
create policy "admin_update_brands" on public.brands for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "admin_delete_brands" on public.brands;
create policy "admin_delete_brands" on public.brands for delete to authenticated
  using (public.is_app_admin());

drop policy if exists "admin_insert_categories" on public.categories;
create policy "admin_insert_categories" on public.categories for insert to authenticated
  with check (public.is_app_admin());
drop policy if exists "admin_update_categories" on public.categories;
create policy "admin_update_categories" on public.categories for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "admin_delete_categories" on public.categories;
create policy "admin_delete_categories" on public.categories for delete to authenticated
  using (public.is_app_admin());

drop policy if exists "admin_select_products" on public.products;
create policy "admin_select_products" on public.products for select to authenticated
  using (public.is_app_admin());
drop policy if exists "admin_insert_products" on public.products;
create policy "admin_insert_products" on public.products for insert to authenticated
  with check (public.is_app_admin());
drop policy if exists "admin_update_products" on public.products;
create policy "admin_update_products" on public.products for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "admin_delete_products" on public.products;
create policy "admin_delete_products" on public.products for delete to authenticated
  using (public.is_app_admin());

insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', true)
on conflict (id) do nothing;

drop policy if exists "catalog_images_public_read" on storage.objects;
create policy "catalog_images_public_read" on storage.objects
  for select using (bucket_id = 'catalog-images');
drop policy if exists "catalog_images_admin_insert" on storage.objects;
create policy "catalog_images_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog-images' and public.is_app_admin());
drop policy if exists "catalog_images_admin_update" on storage.objects;
create policy "catalog_images_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'catalog-images' and public.is_app_admin())
  with check (bucket_id = 'catalog-images' and public.is_app_admin());
drop policy if exists "catalog_images_admin_delete" on storage.objects;
create policy "catalog_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'catalog-images' and public.is_app_admin());
