import { createClient } from 'npm:@supabase/supabase-js@2'

const maxNames = 10
const maxImagesPerProduct = 4
const bucket = 'catalog-images'
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean)

type SearchItem = {
  name: string
  includeImage: boolean
  includeTitle: boolean
}

type SearchResult = {
  index: number
  image_url: string | null
  image_urls: (string | null)[]
  title: string | null
  error?: string
}

type Candidate = {
  url: string
  title: string
  width: number
  height: number
}

function normalizeOrigin(origin: string | null) {
  return origin?.trim().replace(/\/+$/, '') || null
}

function isAllowedOrigin(origin: string | null) {
  const normalized = normalizeOrigin(origin)
  if (!normalized) return false
  if (allowedOrigins.includes(normalized)) return true
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)
}

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  const normalized = normalizeOrigin(origin)
  if (isAllowedOrigin(normalized)) headers['Access-Control-Allow-Origin'] = normalized
  return headers
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

type AuthResult = { ok: true } | { ok: false; reason: string }

async function isAuthorizedAdmin(req: Request): Promise<AuthResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const authorization = req.headers.get('authorization')
  if (!supabaseUrl || !anonKey) return { ok: false, reason: 'supabase sin configurar' }
  if (!authorization?.startsWith('Bearer ')) return { ok: false, reason: 'sin token' }
  const token = authorization.slice('Bearer '.length).trim()
  if (!token) return { ok: false, reason: 'token vacío' }

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData, error: userError } = await client.auth.getUser(token)
  if (userError || !userData.user) {
    return { ok: false, reason: `usuario inválido: ${userError?.message ?? 'sin usuario'}` }
  }
  const { data, error } = await client.rpc('is_app_admin')
  if (error || data !== true) return { ok: false, reason: 'usuario no autorizado' }
  return { ok: true }
}

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withProtocol)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'producto'
  )
}

function extensionOf(contentType: string, url: string) {
  const byType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  if (byType[contentType]) return byType[contentType]
  const match = url.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i)
  return match ? match[1].toLowerCase() : 'jpg'
}

function emptyImageUrls(): (string | null)[] {
  return Array.from({ length: maxImagesPerProduct }, () => null)
}

function candidateKey(url: string) {
  const parsed = new URL(url)
  return `${parsed.hostname}${parsed.pathname.replace(/(_\d+x\d+)?\.(jpe?g|png|webp|gif)$/i, '')}`
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (!allowedOrigins.length) return json({ error: 'ALLOWED_ORIGINS no configurado' }, 500, origin)
  if (!isAllowedOrigin(origin)) return json({ error: 'Origen no permitido' }, 403, origin)
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin)
  const auth = await isAuthorizedAdmin(req)
  if (!auth.ok) {
    console.warn('search-product-images rechazado:', auth.reason)
    return json({ error: 'No autorizado' }, 401, origin)
  }

  const serperKey = Deno.env.get('SERPER_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serperKey) return json({ error: 'SERPER_API_KEY no configurado' }, 500, origin)

  let payload: { items?: unknown }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400, origin)
  }

  const items = (Array.isArray(payload.items) ? payload.items : [])
    .filter(
      (item): item is SearchItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.name === 'string' &&
        item.name.trim().length > 0 &&
        typeof item.includeImage === 'boolean' &&
        typeof item.includeTitle === 'boolean',
    )
    .slice(0, maxNames)
    .map((item) => ({
      name: item.name.trim(),
      includeImage: item.includeImage,
      includeTitle: item.includeTitle,
    }))
  if (!items.length) return json({ results: [] }, 200, origin)

  const results: SearchResult[] = []

  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    if (!item.includeImage && !item.includeTitle) {
      results.push({ index, image_url: null, image_urls: emptyImageUrls(), title: null })
      continue
    }

    try {
      const searchResponse = await fetch('https://google.serper.dev/images', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: item.name, gl: 'pe', hl: 'es', num: 10 }),
      })
      if (!searchResponse.ok) throw new Error(`Serper respondió ${searchResponse.status}`)
      const searchData = await searchResponse.json()
      const candidates: Candidate[] = (searchData.images ?? [])
        .map(
          (image: {
            imageUrl?: string
            title?: string
            imageWidth?: number
            imageHeight?: number
          }): { url: string | null; title: string; width: number; height: number } => ({
            url: normalizeUrl(image.imageUrl ?? ''),
            title: (image.title ?? '').trim(),
            width: image.imageWidth ?? 0,
            height: image.imageHeight ?? 0,
          }),
        )
        .filter(
          (image): image is Candidate =>
            image.url !== null && image.width >= 200 && image.height >= 200,
        )

      const imageUrls: string[] = []
      let imageTitle: string | null = null
      if (item.includeTitle && candidates.length) imageTitle = candidates[0]?.title || null

      if (item.includeImage) {
        if (!supabaseUrl || !serviceKey) throw new Error('Supabase no configurado')
        const storage = createClient(supabaseUrl, serviceKey).storage.from(bucket)
        const seen = new Set<string>()
        for (const candidate of candidates) {
          if (imageUrls.length >= maxImagesPerProduct) break
          const key = candidateKey(candidate.url)
          if (seen.has(key)) continue
          seen.add(key)
          try {
            const imageResponse = await fetch(candidate.url, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
            })
            if (!imageResponse.ok) continue
            const contentType = imageResponse.headers.get('content-type') ?? ''
            if (!contentType.startsWith('image/')) continue
            const bytes = new Uint8Array(await imageResponse.arrayBuffer())
            if (bytes.byteLength > 5 * 1024 * 1024) continue
            const path = `products/auto-${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${slugify(item.name)}.${extensionOf(contentType, candidate.url)}`
            const { error } = await storage.upload(path, bytes, { contentType, upsert: false })
            if (error) continue
            const { data } = storage.getPublicUrl(path)
            imageUrls.push(data.publicUrl)
            if (item.includeTitle && !imageTitle) imageTitle = candidate.title || null
          } catch {
            continue
          }
        }
      }

      const imageSlots = emptyImageUrls()
      imageUrls.forEach((url, slot) => {
        imageSlots[slot] = url
      })
      const missing = item.includeImage ? !imageUrls.length : !imageTitle
      results.push({
        index,
        image_url: imageUrls[0] ?? null,
        image_urls: imageSlots,
        title: imageTitle,
        ...(missing
          ? { error: item.includeImage ? 'No se encontraron imágenes válidas' : 'No se encontró un título' }
          : {}),
      })
    } catch {
      results.push({
        index,
        image_url: null,
        image_urls: emptyImageUrls(),
        title: null,
        error: 'Error al buscar',
      })
    }
  }

  return json({ results }, 200, origin)
})
