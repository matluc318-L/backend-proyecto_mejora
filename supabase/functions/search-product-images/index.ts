import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const maxNames = 10
const bucket = 'catalog-images'

type SearchItem = {
  name: string
  includeImage: boolean
  includeTitle: boolean
}

type SearchResult = {
  index: number
  image_url: string | null
  title: string | null
  error?: string
}

type Candidate = {
  url: string
  title: string
  width: number
  height: number
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const serperKey = Deno.env.get('SERPER_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serperKey) return json({ error: 'SERPER_API_KEY no configurado' }, 500)

  let payload: { items?: unknown }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400)
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
  if (!items.length) return json({ results: [] })

  const results: SearchResult[] = []

  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    if (!item.includeImage && !item.includeTitle) {
      results.push({ index, image_url: null, title: null })
      continue
    }

    try {
      const searchResponse = await fetch('https://google.serper.dev/images', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: item.name, gl: 'pe', hl: 'es', num: 5 }),
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

      let imageUrl: string | null = null
      let imageTitle: string | null = null
      if (item.includeTitle && candidates.length) imageTitle = candidates[0]?.title || null

      if (item.includeImage) {
        if (!supabaseUrl || !serviceKey) throw new Error('Supabase no configurado')
        const storage = createClient(supabaseUrl, serviceKey).storage.from(bucket)
        for (const candidate of candidates) {
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
            imageUrl = data.publicUrl
            if (item.includeTitle) imageTitle = candidate.title || null
            break
          } catch {
            continue
          }
        }
      }

      const missing = item.includeImage ? !imageUrl : !imageTitle
      results.push({
        index,
        image_url: imageUrl,
        title: imageTitle,
        ...(missing
          ? { error: item.includeImage ? 'No se encontró una imagen válida' : 'No se encontró un título' }
          : {}),
      })
    } catch (error) {
      results.push({
        index,
        image_url: null,
        title: null,
        error: error instanceof Error ? error.message : 'Error al buscar',
      })
    }
  }

  return json({ results })
})
