import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { ToastContext } from './toastContext'
import type { ToastKind } from './toastContext'

type Toast = { id: number; message: string; kind: ToastKind }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, kind }])
    window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 4500)
  }, [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="fixed bottom-6 right-6 z-[60] grid w-full max-w-sm gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.kind === 'error' ? 'bg-red-600 text-white' : 'bg-navy text-white'
            }`}
          >
            {toast.kind === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}
              aria-label="Cerrar aviso"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
