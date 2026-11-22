export class PublicError extends Error {}

const knownErrors: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos',
  email_not_confirmed: 'Confirma tu correo antes de ingresar',
  too_many_requests: 'Demasiados intentos. Espera unos minutos',
  '23505': 'Ya existe un registro con ese valor',
  '23503': 'El registro está relacionado con otros datos',
  '23514': 'Uno de los valores no es válido',
  '42501': 'No tienes permisos para realizar esta acción',
  PGRST301: 'Tu sesión expiró. Vuelve a ingresar',
}

export function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof PublicError) return error.message
  if (!(error instanceof Error)) return fallback

  const code = (error as Error & { code?: unknown }).code
  if (typeof code === 'string' && knownErrors[code]) return knownErrors[code]

  const message = error.message.toLowerCase()
  if (message.includes('jwt') || message.includes('expired') || message.includes('refresh token')) {
    return 'Tu sesión expiró. Vuelve a ingresar'
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'No se pudo conectar. Revisa tu conexión'
  }
  return fallback
}
