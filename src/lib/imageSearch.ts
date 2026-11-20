import { supabase } from './supabase'

export type ImageSearchItem = {
  name: string
  includeImage: boolean
  includeTitle: boolean
}

export type ProductImageMatch = {
  image_url: string | null
  title: string | null
}

type SearchResult = {
  index: number
  image_url: string | null
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
  const matches: ProductImageMatch[] = items.map(() => ({ image_url: null, title: null }))
  for (const result of data?.results ?? []) {
    if (result.index < 0 || result.index >= matches.length) continue
    matches[result.index] = { image_url: result.image_url, title: result.title }
  }
  return matches
}
