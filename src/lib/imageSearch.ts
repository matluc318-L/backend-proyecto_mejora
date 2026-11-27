import { supabase } from './supabase'
import { PRODUCT_IMAGE_COUNT } from './types'

export type ImageSearchItem = {
  name: string
  includeImage: boolean
  includeTitle: boolean
}

export type ProductImageMatch = {
  image_urls: (string | null)[]
  title: string | null
}

type SearchResult = {
  index: number
  image_url?: string | null
  image_urls?: (string | null)[]
  title: string | null
  error?: string
}

export async function searchProductImages(items: ImageSearchItem[]): Promise<ProductImageMatch[]> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data, error } = await supabase.functions.invoke<{ results: SearchResult[] }>(
    'search-product-images',
    { body: { items } },
  )
  if (error) throw error
  const matches: ProductImageMatch[] = items.map(() => ({
    image_urls: Array.from({ length: PRODUCT_IMAGE_COUNT }, () => null),
    title: null,
  }))
  for (const result of data?.results ?? []) {
    if (result.index < 0 || result.index >= matches.length) continue
    const slots = result.image_urls ?? [result.image_url ?? null]
    matches[result.index] = {
      image_urls: Array.from({ length: PRODUCT_IMAGE_COUNT }, (_, index) => slots[index] ?? null),
      title: result.title,
    }
  }
  return matches
}
