create or replace function public.log_admin_action(
  p_action text,
  p_target_table text,
  p_target_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();

  if v_email is null or not exists (
    select 1 from public.app_admins
    where user_id = auth.uid() or lower(email) = lower(v_email)
  ) then
    raise exception 'No autorizado';
  end if;

  insert into public.admin_audit_log (actor_id, actor_email, action, target_table, target_id, details)
  values (
    auth.uid(),
    v_email,
    left(p_action, 80),
    left(p_target_table, 80),
    case when p_target_id is null then null else left(p_target_id, 200) end,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_admin_action(text, text, text, jsonb) from public, anon;
grant execute on function public.log_admin_action(text, text, text, jsonb) to authenticated;
