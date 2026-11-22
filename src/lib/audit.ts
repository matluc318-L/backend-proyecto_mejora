import { supabase } from './supabase'

export function logAdminAction(
  action: string,
  targetTable: string,
  targetId?: string | null,
  details?: Record<string, unknown>,
) {
  if (!supabase) return
  void supabase
    .rpc('log_admin_action', {
      p_action: action,
      p_target_table: targetTable,
      p_target_id: targetId ?? null,
      p_details: details ?? {},
    })
    .then(({ error }) => {
      if (error) console.error('No se pudo registrar la auditoría', error)
    })
}
