import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { Button, Field, inputClass } from './ui'

type Mode = 'loading' | 'challenge' | 'enroll'

export function MfaScreen({
  onVerified,
  onLogout,
}: {
  onVerified: () => void
  onLogout: () => void
}) {
  const [mode, setMode] = useState<Mode>('loading')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [secret, setSecret] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (!supabase || started.current) return
    started.current = true
    const client = supabase

    void (async () => {
      try {
        const { data, error: listError } = await client.auth.mfa.listFactors()
        if (listError) throw listError
        const verified = data.totp.find((factor) => factor.status === 'verified')
        if (verified) {
          setFactorId(verified.id)
          setMode('challenge')
          return
        }
        await Promise.all(
          data.totp
            .filter((factor) => factor.status !== 'verified')
            .map((factor) => client.auth.mfa.unenroll({ factorId: factor.id })),
        )
        const { data: enrollment, error: enrollError } = await client.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'D Lu Admin',
        })
        if (enrollError) throw enrollError
        setFactorId(enrollment.id)
        setSecret(enrollment.totp.secret)
        setQrCode(enrollment.totp.qr_code)
        setMode('enroll')
      } catch (cause) {
        setError(friendlyError(cause, 'No se pudo configurar el segundo factor'))
        setMode('challenge')
      }
    })()
  }, [])

  async function handleVerify(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !factorId || !code.trim()) return
    setBusy(true)
    setError('')
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      })
      if (verifyError) throw verifyError
      onVerified()
    } catch (cause) {
      setError(friendlyError(cause, 'El código no es válido. Intenta de nuevo'))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-navy-deep via-navy to-[#123a6b] p-5">
      <form
        onSubmit={handleVerify}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
      >
        <div className="mb-7 grid justify-items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-soft text-blue-bright">
            <ShieldCheck size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Verificación en dos pasos</h1>
            <p className="mt-1 text-sm text-muted">
              {mode === 'enroll'
                ? 'Configura tu app de autenticación para continuar'
                : 'Ingresa el código de 6 dígitos de tu app'}
            </p>
          </div>
        </div>

        {mode === 'enroll' && (
          <div className="mb-5 grid justify-items-center gap-3">
            {qrCode && <img src={`data:image/svg+xml;utf-8,${qrCode}`} alt="Código QR de MFA" className="h-40 w-40" />}
            <p className="break-all rounded-lg bg-surface-2 px-3 py-2 text-center font-mono text-xs">
              {secret}
            </p>
          </div>
        )}

        <div className="grid gap-4">
          <Field label="Código de verificación">
            <input
              className={inputClass}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              placeholder="000000"
            />
          </Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy || mode === 'loading' || !factorId} className="w-full">
            {busy ? 'Verificando...' : 'Verificar'}
          </Button>
          <button
            type="button"
            className="text-sm font-semibold text-muted hover:text-blue-bright"
            onClick={onLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </form>
    </main>
  )
}
