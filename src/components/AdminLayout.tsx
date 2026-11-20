import type { ReactNode } from 'react'
import { FileSpreadsheet, LayoutDashboard, LogOut, Package, Tags, Layers3 } from 'lucide-react'
import type { AdminPage } from '../lib/types'

const items: { id: AdminPage; label: string; icon: typeof Package }[] = [
  { id: 'products', label: 'Productos', icon: Package },
  { id: 'brands', label: 'Marcas', icon: Tags },
  { id: 'categories', label: 'Categorías', icon: Layers3 },
  { id: 'import', label: 'Importar Excel', icon: FileSpreadsheet },
]

export function AdminLayout({
  email,
  active,
  onNavigate,
  onLogout,
  children,
}: {
  email: string
  active: AdminPage
  onNavigate: (page: AdminPage) => void
  onLogout: () => void
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface-2 lg:flex">
      <aside className="bg-navy p-5 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col">
        <div className="mb-8 flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue text-lg font-extrabold">
            D
          </span>
          <div>
            <p className="text-base font-extrabold leading-tight">D'Lu Admin</p>
            <p className="text-xs text-white/50">Panel de catálogo</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                active === id ? 'bg-blue text-white' : 'text-white/65 hover:bg-white/10'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-white/10 pt-4 lg:block">
          <p className="truncate px-2 text-xs text-white/50">{email}</p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-white/65 hover:bg-white/10"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-line bg-white px-5 py-4 lg:px-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted">
            <LayoutDashboard size={17} />
            Panel administrativo
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </header>
        <main className="mx-auto w-full max-w-6xl p-5 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
