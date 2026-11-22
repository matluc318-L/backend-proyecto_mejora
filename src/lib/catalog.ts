import { logAdminAction } from './audit'
import { friendlyError } from './errors'
import { supabase } from './supabase'
import type { AuditLog, Brand, Category, Product } from './types'

function db() {
  if (!supabase) throw new Error('Supabase no está configurado. Revisa el archivo .env')
  return supabase
}

export async function fetchBrands(): Promise<Brand[]> {
  const { data, error } = await db().from('brands').select('*').order('name')
  if (error) throw error
  return (data ?? []) as Brand[]
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await db().from('categories').select('*').order('display_order')
  if (error) throw error
  return (data ?? []) as Category[]
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await db()
    .from('products')
    .select('*, brand:brands(name), category:categories(name)')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Product[]
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await db()
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as AuditLog[]
}

export async function saveBrand(input: { id?: string; name: string; image_url: string | null }) {
  const payload = { name: input.name.trim(), image_url: input.image_url }
  const { error } = input.id
    ? await db().from('brands').update(payload).eq('id', input.id)
    : await db().from('brands').insert(payload)
  if (error) throw error
  logAdminAction(input.id ? 'brand.update' : 'brand.create', 'brands', input.id ?? null, {
    name: payload.name,
  })
}

export async function deleteBrand(id: string) {
  const { error } = await db().from('brands').delete().eq('id', id)
  if (error) throw error
  logAdminAction('brand.delete', 'brands', id)
}

export async function saveCategory(input: {
  id?: string
  name: string
  display_order: number
  description?: string | null
}) {
  const payload = {
    name: input.name.trim(),
    display_order: input.display_order,
    description: input.description?.trim() || null,
  }
  const { error } = input.id
    ? await db().from('categories').update(payload).eq('id', input.id)
    : await db().from('categories').insert(payload)
  if (error) throw error
  logAdminAction(input.id ? 'category.update' : 'category.create', 'categories', input.id ?? null, {
    name: payload.name,
  })
}

export async function deleteCategory(id: string) {
  const { error } = await db().from('categories').delete().eq('id', id)
  if (error) throw error
  logAdminAction('category.delete', 'categories', id)
}

export type ProductInput = Omit<Product, 'brand' | 'category' | 'updated_at'>

function productPayload(input: ProductInput) {
  return {
    sku: input.sku.trim(),
    name: input.name.trim(),
    brand_id: input.brand_id || null,
    category_id: input.category_id || null,
    description: input.description?.trim() || null,
    sale_price: input.sale_price,
    stock: input.stock,
    status: input.status,
    image_url: input.image_url || null,
  }
}

export async function saveProduct(input: ProductInput) {
  const payload = productPayload(input)
  const { error } = input.id
    ? await db().from('products').update(payload).eq('id', input.id)
    : await db().from('products').insert(payload)
  if (error) throw error
  logAdminAction(input.id ? 'product.update' : 'product.create', 'products', input.id ?? input.sku, {
    sku: payload.sku,
  })
}

export async function deleteProduct(id: string) {
  const { error } = await db().from('products').delete().eq('id', id)
  if (error) throw error
  logAdminAction('product.delete', 'products', id)
}

export async function ensureBrands(names: string[], existing: Brand[]): Promise<Brand[]> {
  const known = new Set(existing.map((brand) => brand.name.trim().toLowerCase()))
  const missing = [...new Set(names.map((name) => name.trim()).filter(Boolean))].filter(
    (name) => !known.has(name.toLowerCase()),
  )
  if (missing.length) {
    const { error } = await db()
      .from('brands')
      .insert(missing.map((name) => ({ name, image_url: null })))
    if (error) throw error
    logAdminAction('brand.import', 'brands', null, { count: missing.length })
  }
  return missing.length ? fetchBrands() : existing
}

export async function ensureCategories(names: string[], existing: Category[]): Promise<Category[]> {
  const known = new Set(existing.map((category) => category.name.trim().toLowerCase()))
  const missing = [...new Set(names.map((name) => name.trim()).filter(Boolean))].filter(
    (name) => !known.has(name.toLowerCase()),
  )
  if (missing.length) {
    const { error } = await db()
      .from('categories')
      .insert(
        missing.map((name, index) => ({
          name,
          display_order: existing.length + index,
          description: null,
        })),
      )
    if (error) throw error
    logAdminAction('category.import', 'categories', null, { count: missing.length })
  }
  return missing.length ? fetchCategories() : existing
}

export async function upsertProducts(rows: ProductInput[]): Promise<string[]> {
  const errors: string[] = []
  for (let index = 0; index < rows.length; index += 100) {
    const chunk = rows.slice(index, index + 100).map(productPayload)
    const { error } = await db().from('products').insert(chunk)
    if (!error) continue
    if (error.code !== '23505') {
      errors.push(`Filas ${index + 1}-${index + chunk.length}: ${friendlyError(error, 'No se pudo guardar')}`)
      continue
    }
    for (const row of chunk) {
      const { error: updateError } = await db()
        .from('products')
        .update(row)
        .eq('sku', row.sku)
      if (updateError) errors.push(`SKU ${row.sku}: ${friendlyError(updateError, 'No se pudo guardar')}`)
    }
  }
  logAdminAction('product.import', 'products', null, {
    rows: rows.length,
    errors: errors.length,
  })
  return errors
}
