import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LoaderCircle } from 'lucide-react'
import { AdminLayout } from './components/AdminLayout'
import { Login } from './components/Login'
import { MfaScreen } from './components/MfaScreen'
import { ToastProvider } from './components/Toast'
import { AuditPage } from './components/pages/AuditPage'
import { BrandsPage } from './components/pages/BrandsPage'
import { CategoriesPage } from './components/pages/CategoriesPage'
import { ImportPage } from './components/pages/ImportPage'
import { ProductsPage } from './components/pages/ProductsPage'
import { useToast } from './components/toastContext'
import { fetchBrands, fetchCategories, fetchProducts } from './lib/catalog'
import { friendlyError } from './lib/errors'
import { supabase } from './lib/supabase'
import type { AdminPage, Brand, Category, Product } from './lib/types'

const requireMfa = import.meta.env.VITE_REQUIRE_MFA === 'true'

function Dashboard() {
  const notify = useToast()
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [aal, setAal] = useState<string | null>(null)
  const [page, setPage] = useState<AdminPage>('products')
  const [brands, setBrands] = useState<Brand[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setChecking(false)
      return
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setChecking(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const refreshAal = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setAal(data?.currentLevel ?? 'aal1')
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      setAal(null)
      return
    }
    void refreshAal()
  }, [session, refreshAal])

  useEffect(() => {
    if (!supabase || !session?.user.email) {
      setIsAdmin(false)
      return
    }
    let active = true
    void supabase
      .from('app_admins')
      .select('email')
      .eq('email', session.user.email.toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        if (active) setIsAdmin(Boolean(data))
      })
    return () => {
      active = false
    }
  }, [session])

  const refresh = useCallback(async () => {
    if (!isAdmin || (requireMfa && aal !== 'aal2')) return
    setLoadingData(true)
    try {
      const [nextBrands, nextCategories, nextProducts] = await Promise.all([
        fetchBrands(),
        fetchCategories(),
        fetchProducts(),
      ])
      setBrands(nextBrands)
      setCategories(nextCategories)
      setProducts(nextProducts)
    } catch (error) {
      notify(friendlyError(error, 'No se pudo cargar el catálogo'), 'error')
    } finally {
      setLoadingData(false)
    }
  }, [isAdmin, aal, notify])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!supabase) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface-2 p-6">
        <div className="max-w-md rounded-xl bg-white p-6 text-center shadow">
          <h1 className="text-xl font-bold">Configuración pendiente</h1>
          <p className="mt-2 text-sm text-muted">
            Copia .env.example a .env y completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
          </p>
        </div>
      </main>
    )
  }

  const client = supabase

  if (checking || (requireMfa && session && aal === null)) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface-2">
        <LoaderCircle className="animate-spin text-blue" size={32} />
      </main>
    )
  }

  if (!session) return <Login />

  const email = session.user.email ?? ''

  if (!isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface-2 p-6">
        <div className="grid max-w-md gap-4 rounded-xl bg-white p-6 text-center shadow">
          <h1 className="text-xl font-bold">Sin permisos</h1>
          <p className="text-sm text-muted">
            Tu usuario ({email}) no está autorizado en la tabla app_admins.
          </p>
          <button
            type="button"
            className="font-semibold text-blue-bright"
            onClick={() => void client.auth.signOut()}
          >
            Cerrar sesión
          </button>
        </div>
      </main>
    )
  }

  if (requireMfa && aal !== 'aal2') {
    return (
      <MfaScreen
        onVerified={() => void refreshAal()}
        onLogout={() => void client.auth.signOut()}
      />
    )
  }

  return (
    <AdminLayout
      email={email}
      active={page}
      onNavigate={setPage}
      onLogout={() => void client.auth.signOut()}
    >
      {loadingData ? (
        <div className="grid place-items-center py-20">
          <LoaderCircle className="animate-spin text-blue" size={28} />
        </div>
      ) : (
        <>
          {page === 'products' && (
            <ProductsPage
              products={products}
              brands={brands}
              categories={categories}
              onRefresh={refresh}
            />
          )}
          {page === 'brands' && <BrandsPage brands={brands} onRefresh={refresh} />}
          {page === 'categories' && <CategoriesPage categories={categories} onRefresh={refresh} />}
          {page === 'import' && (
            <ImportPage brands={brands} categories={categories} onRefresh={refresh} />
          )}
          {page === 'audit' && <AuditPage />}
        </>
      )}
    </AdminLayout>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  )
}
