import * as XLSX from 'xlsx'
import { PublicError } from './errors'
import type { ImportRow, Status } from './types'

const USD_TO_PEN = 3.46

function toSoles(value: number | null): number | null {
  if (value === null) return null
  return Math.round(value * USD_TO_PEN * 100) / 100
}

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
  image_url_2: ['image_url_2', 'image_2', 'imagen_2', 'imagen2', 'url_imagen_2'],
  image_url_3: ['image_url_3', 'image_3', 'imagen_3', 'imagen3', 'url_imagen_3'],
  image_url_4: ['image_url_4', 'image_4', 'imagen_4', 'imagen4', 'url_imagen_4'],
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

const stockAliases = ['stock', 'existencia', 'cantidad']

function pickStock(row: Record<string, unknown>): { stock: number | null; error?: string } {
  const matches = Object.keys(row)
    .map((key) => ({ key, clean: normalize(key) }))
    .filter(({ clean }) => stockAliases.some((alias) => clean === alias || clean.startsWith(alias)))
  const exact = matches.find(({ key, clean }) =>
    stockAliases.includes(clean) && String(row[key] ?? '').trim() !== '',
  )
  const sources = exact ? [exact] : matches.filter(({ clean }) => !stockAliases.includes(clean))

  let stock = 0
  for (const { key } of sources) {
    const value = row[key]
    const text = value === null || value === undefined ? '' : String(value).trim()
    if (!text) continue
    const parsed = toNumber(text)
    if (parsed === null) return { stock: null, error: `Stock no numérico en "${key}"` }
    stock += parsed
  }
  return { stock }
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
  if (!sheet) throw new PublicError('El archivo no tiene hojas')
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  return records.map((record, index) => {
    const sku = pick(record, 'sku')
    const name = pick(record, 'name')
    const priceRaw = pick(record, 'sale_price')
    const statusRaw = pick(record, 'status')
    const salePrice = toNumber(priceRaw)
    const stockResult = pickStock(record)
    const stock = stockResult.stock
    const statusResult = toStatus(statusRaw)
    const errors: string[] = []

    if (!sku) errors.push('Falta SKU')
    if (!name) errors.push('Falta nombre')
    if (priceRaw && salePrice === null) errors.push('Precio no numérico')
    if (salePrice !== null && salePrice < 0) errors.push('Precio negativo')
    if (stockResult.error) errors.push(stockResult.error)
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) errors.push('Stock inválido')
    if (statusResult.error) errors.push(statusResult.error)

    return {
      row: index + 2,
      sku,
      name,
      brand: pick(record, 'brand'),
      category: pick(record, 'category'),
      description: pick(record, 'description'),
      sale_price: toSoles(salePrice),
      stock: stock ?? 0,
      status: statusResult.status,
      image_url: pick(record, 'image_url') || null,
      image_url_2: pick(record, 'image_url_2') || null,
      image_url_3: pick(record, 'image_url_3') || null,
      image_url_4: pick(record, 'image_url_4') || null,
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
    'image_url_2',
    'image_url_3',
    'image_url_4',
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
    '',
    '',
    '',
  ]
  const sheet = XLSX.utils.aoa_to_sheet([header, example])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Productos')
  XLSX.writeFile(workbook, 'plantilla-productos.xlsx')
}
