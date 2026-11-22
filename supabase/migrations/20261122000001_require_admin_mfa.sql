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
  )
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
