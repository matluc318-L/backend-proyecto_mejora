create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text,
  action text not null,
  target_table text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

revoke all on public.admin_audit_log from public, anon, authenticated;
grant select on public.admin_audit_log to authenticated;

drop policy if exists "admin_read_audit" on public.admin_audit_log;
create policy "admin_read_audit" on public.admin_audit_log
  for select to authenticated
  using (public.is_app_admin());

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
begin
  if not public.is_app_admin() then
    raise exception 'No autorizado';
  end if;

  insert into public.admin_audit_log (actor_id, actor_email, action, target_table, target_id, details)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    left(p_action, 80),
    left(p_target_table, 80),
    case when p_target_id is null then null else left(p_target_id, 200) end,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_admin_action(text, text, text, jsonb) from public, anon;
grant execute on function public.log_admin_action(text, text, text, jsonb) to authenticated;
