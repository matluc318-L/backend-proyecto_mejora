import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { fetchAuditLogs } from '../../lib/catalog'
import { friendlyError } from '../../lib/errors'
import type { AuditLog } from '../../lib/types'
import { useToast } from '../toastContext'
import { Button, Empty } from '../ui'

export function AuditPage() {
  const notify = useToast()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLogs(await fetchAuditLogs())
    } catch (error) {
      notify(friendlyError(error, 'No se pudo cargar la auditoría'), 'error')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Auditoría</h1>
          <p className="text-sm text-muted">Últimas 100 acciones administrativas</p>
        </div>
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} /> Actualizar
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3">Fecha</th>
              <th className="px-5 py-3">Usuario</th>
              <th className="px-5 py-3">Acción</th>
              <th className="px-5 py-3">Registro</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3 text-muted">
                  {new Date(log.created_at).toLocaleString('es-PE')}
                </td>
                <td className="px-5 py-3 font-semibold">{log.actor_email ?? '—'}</td>
                <td className="px-5 py-3 font-mono text-xs">{log.action}</td>
                <td className="px-5 py-3 text-muted">{log.target_id ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !logs.length && <Empty text="No hay acciones registradas" />}
      </div>
    </section>
  )
}
