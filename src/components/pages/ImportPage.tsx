import { useState } from 'react'
import { Download, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { ensureBrands, ensureCategories, upsertProducts } from '../../lib/catalog'
import { downloadTemplate, parseExcel } from '../../lib/excel'
import type { Brand, Category, ImportRow } from '../../lib/types'
import { useToast } from '../toastContext'
import { Button, Empty } from '../ui'

export function ImportPage({
  brands,
  categories,
  onRefresh,
}: {
  brands: Brand[]
  categories: Category[]
  onRefresh: () => Promise<void>
}) {
  const notify = useToast()
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState('')

  const valid = rows.filter((row) => row.errors.length === 0)
  const invalid = rows.length - valid.length

  async function handleFile(file: File | undefined) {
    if (!file) return
    setLoading(true)
    setResult('')
    try {
      const parsed = await parseExcel(file)
      setRows(parsed)
      setFileName(file.name)
      notify(`${parsed.length} filas leídas de ${file.name}`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo leer el Excel', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!valid.length) return
    setImporting(true)
    try {
      const nextBrands = await ensureBrands(
        valid.map((row) => row.brand),
        brands,
      )
      const nextCategories = await ensureCategories(
        valid.map((row) => row.category),
        categories,
      )
      const payload = valid.map((row) => ({
        sku: row.sku,
        name: row.name,
        brand_id:
          nextBrands.find((brand) => brand.name.trim().toLowerCase() === row.brand.trim().toLowerCase())
            ?.id ?? null,
        category_id:
          nextCategories.find(
            (category) => category.name.trim().toLowerCase() === row.category.trim().toLowerCase(),
          )?.id ?? null,
        description: row.description || null,
        sale_price: row.sale_price,
        stock: row.stock,
        status: row.status,
        image_url: row.image_url,
      }))
      const errors = await upsertProducts(payload)
      setResult(
        errors.length
          ? `${payload.length - errors.length} filas importadas con errores: ${errors.join(' | ')}`
          : `${payload.length} productos importados correctamente`,
      )
      notify('Importación finalizada', errors.length ? 'error' : 'success')
      await onRefresh()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo importar', 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">Importar Excel</h1>
        <p className="text-sm text-muted">
          Sube un archivo .xlsx con las columnas del catálogo. Las marcas y categorías nuevas se crean
          automáticamente.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-line bg-white p-6 sm:grid-cols-2">
        <label className="grid cursor-pointer place-items-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface-2 p-8 text-center hover:border-blue">
          <UploadCloud className="text-blue-bright" size={30} />
          <span className="text-sm font-semibold">
            {loading ? 'Leyendo archivo...' : fileName || 'Seleccionar archivo .xlsx o .xls'}
          </span>
          <input
            className="hidden"
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>
        <div className="grid content-center gap-3">
          <p className="text-sm text-muted">
            Columnas aceptadas: sku, name/nombre, brand/marca, category/categoría, description,
            sale_price/precio, stock, status/estado e image_url. Si el stock está dividido por
            distrito (stock_lima, stock_arequipa...), se suma automáticamente.
          </p>
          <Button variant="secondary" onClick={downloadTemplate} className="justify-self-start">
            <Download size={16} /> Descargar plantilla
          </Button>
          <Button onClick={handleImport} disabled={!valid.length || importing} className="justify-self-start">
            <FileSpreadsheet size={16} />
            {importing ? 'Importando...' : `Importar ${valid.length} filas válidas`}
          </Button>
          {result && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold">{result}</p>}
        </div>
      </div>

      {!!rows.length && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-blue-soft px-3 py-1 font-semibold text-blue-bright">
            {rows.length} filas
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">
            {valid.length} válidas
          </span>
          {!!invalid && (
            <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-600">
              {invalid} con errores
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="border-b border-line bg-surface-2 uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Fila</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Marca</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Validación</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((row) => (
              <tr key={row.row} className="border-b border-line last:border-0">
                <td className="px-4 py-2 text-muted">{row.row}</td>
                <td className="px-4 py-2 font-mono">{row.sku}</td>
                <td className="px-4 py-2 font-semibold">{row.name}</td>
                <td className="px-4 py-2">{row.brand || '—'}</td>
                <td className="px-4 py-2">{row.sale_price ?? '—'}</td>
                <td className="px-4 py-2">{row.stock}</td>
                <td className="px-4 py-2">{row.status}</td>
                <td className="px-4 py-2">
                  {row.errors.length ? (
                    <span className="font-semibold text-red-600">{row.errors.join(', ')}</span>
                  ) : (
                    <span className="font-semibold text-emerald-600">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty text="Selecciona un archivo para previsualizar los productos" />}
        {rows.length > 100 && (
          <p className="px-4 py-3 text-xs text-muted">Mostrando las primeras 100 filas.</p>
        )}
      </div>
    </section>
  )
}
