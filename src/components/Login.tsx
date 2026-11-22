import { useState } from 'react'
import type { FormEvent } from 'react'
import { LockKeyhole } from 'lucide-react'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { Button, Field, inputClass } from './ui'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) {
      setError('Faltan las variables de entorno de Supabase')
      return
    }
    setLoading(true)
    setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError(friendlyError(signInError, 'No se pudo iniciar sesión'))
    setLoading(false)
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-navy-deep via-navy to-[#123a6b] p-5">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
      >
        <div className="mb-7 grid justify-items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-soft text-blue-bright">
            <LockKeyhole size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">D'Lu Admin</h1>
            <p className="mt-1 text-sm text-muted">Gestión del catálogo</p>
          </div>
        </div>
        <div className="grid gap-4">
          <Field label="Correo">
            <input
              className={inputClass}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@ejemplo.com"
            />
          </Field>
          <Field label="Contraseña">
            <input
              className={inputClass}
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </div>
      </form>
    </main>
  )
}
