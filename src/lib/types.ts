export type Status = 'draft' | 'review' | 'published' | 'archived'

export const PRODUCT_IMAGE_COUNT = 4

export type Brand = {
  id: string
  name: string
  image_url: string | null
  created_at?: string
}

export type Category = {
  id: string
  name: string
  description?: string | null
  display_order: number
}

export type Product = {
  id?: string
  sku: string
  name: string
  brand_id: string | null
  category_id: string | null
  description: string | null
  sale_price: number | null
  stock: number
  status: Status
  image_url: string | null
  image_urls: string[] | null
  updated_at?: string
  brand?: { name: string } | null
  category?: { name: string } | null
}

export type AdminPage = 'brands' | 'products' | 'categories' | 'import' | 'audit'

export type AuditLog = {
  id: number
  actor_id: string | null
  actor_email: string | null
  action: string
  target_table: string
  target_id: string | null
  details: Record<string, unknown>
  created_at: string
}

export type ImportRow = {
  row: number
  sku: string
  name: string
  brand: string
  category: string
  description: string
  sale_price: number | null
  stock: number
  status: Status
  image_url: string | null
  image_url_2: string | null
  image_url_3: string | null
  image_url_4: string | null
  errors: string[]
}
