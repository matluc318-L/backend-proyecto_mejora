import * as XLSX from 'xlsx'
import type { ImportRow, Status } from './types'

const aliases: Record<keyof Omit<ImportRow, 'row' | 'errors'>, string[]> = {
  sku: ['sku', 'codigo', 'code'],
  name: ['name', 'nombre', 'producto'],
  brand: ['brand', 'marca'],
  category: ['category', 'categoria'],
  description: ['description', 'descripcion'],
  sale_price: ['sale_price', 'price', 'precio', 'precioventa'],
  stock: ['stock', 'existencia', 'cantidad'],
  status: ['status', 'estado'],
  image_url: ['image_url', 'image', 'imagen', 'ur imagen', 'urlimagen'],
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

function pick(row: Record<string, unknown>, key: keyof typeof aliases): string {
  const wanted = aliases[key]
  for (const rawKey of Object.keys(row)) {
    const clean = normalize(rawKey)
    if (wanted.some((alias) => clean === normalize(alias))) {
      const value = row[rawKey]
      return value === null || value === undefined ? '' : String(value).trim()
    }
  }
  return ''
}

function toNumber(value: string): number | null {
  if (!value) return null
  const parsed = Number(value.replace(/\s/g, '').replace(/^\$/, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function toStatus(value: string): { status: Status; error?: string } {
  const clean = normalize(value)
  if (!clean) return { status: 'draft' }
  const map: Record<string, Status> = {
    draft: 'draft',
    borrador: 'draft',
    review: 'review',
    revision: 'review',
    published: 'published',
    publicado: 'published',
    activo: 'published',
    archived: 'archived',
    archivado: 'archived',
  }
  if (map[clean]) return { status: map[clean] }
  return { status: 'draft', error: `Estado "${value}" no válido` }
}

export async function parseExcel(file: File): Promise<ImportRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error('El archivo no tiene hojas')
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  return records.map((record, index) => {
    const sku = pick(record, 'sku')
    const name = pick(record, 'name')
    const priceRaw = pick(record, 'sale_price')
    const stockRaw = pick(record, 'stock')
    const statusRaw = pick(record, 'status')
    const salePrice = toNumber(priceRaw)
    const stock = toNumber(stockRaw)
    const statusResult = toStatus(statusRaw)
    const errors: string[] = []

    if (!sku) errors.push('Falta SKU')
    if (!name) errors.push('Falta nombre')
    if (priceRaw && salePrice === null) errors.push('Precio no numérico')
    if (salePrice !== null && salePrice < 0) errors.push('Precio negativo')
    if (stockRaw && stock === null) errors.push('Stock no numérico')
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) errors.push('Stock inválido')
    if (statusResult.error) errors.push(statusResult.error)

    return {
      row: index + 2,
      sku,
      name,
      brand: pick(record, 'brand'),
      category: pick(record, 'category'),
      description: pick(record, 'description'),
      sale_price: salePrice,
      stock: stock ?? 0,
      status: statusResult.status,
      image_url: pick(record, 'image_url') || null,
      errors,
    }
  })
}

export function downloadTemplate() {
  const header = [
    'sku',
    'name',
    'brand',
    'category',
    'description',
    'sale_price',
    'stock',
    'status',
    'image_url',
  ]
  const example = [
    'DEMO-001',
    'Producto de ejemplo',
    'Marca ejemplo',
    'Categoría ejemplo',
    'Descripción',
    99.9,
    10,
    'draft',
    '',
  ]
  const sheet = XLSX.utils.aoa_to_sheet([header, example])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Productos')
  XLSX.writeFile(workbook, 'plantilla-productos.xlsx')
}
