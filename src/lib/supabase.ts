import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && anonKey ? createClient(url, anonKey) : null

export const BUCKET = 'catalog-images'

export async function uploadImage(file: File, folder: string): Promise<string> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${folder}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
