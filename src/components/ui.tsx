import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Status } from '../lib/types'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-blue text-white hover:bg-blue-bright',
  secondary: 'bg-blue-soft text-blue-bright hover:bg-blue/15',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  ghost: 'bg-transparent text-muted hover:bg-surface-2',
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/15'

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/60 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-surface-2"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const statusLabels: Record<Status, string> = {
  draft: 'Borrador',
  review: 'Revisión',
  published: 'Publicado',
  archived: 'Archivado',
}

const statusClasses: Record<Status, string> = {
  draft: 'bg-slate-100 text-slate-600',
  review: 'bg-amber-100 text-amber-700',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-rose-100 text-rose-700',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  )
}

export function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-muted">{text}</p>
}
