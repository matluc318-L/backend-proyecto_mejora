import { useState } from 'react'
import { Download, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { ensureBrands, ensureCategories, upsertProducts } from '../../lib/catalog'
import { downloadTemplate, parseExcel } from '../../lib/excel'
import { searchProductImages, type ImageSearchItem } from '../../lib/imageSearch'
import type { Brand, Category, ImportRow, Status } from '../../lib/types'
import { useToast } from '../toastContext'
import { Button, Empty, Field, Modal, inputClass } from '../ui'

const statusOptions: { value: Status; label: string }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'review', label: 'Revisión' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived', label: 'Archivado' },
]

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
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [importStatus, setImportStatus] = useState<Status>('draft')
  const [searchImages, setSearchImages] = useState(true)
  const [useApiTitle, setUseApiTitle] = useState(true)
  const [imageStatus, setImageStatus] = useState('')

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
    setImportStatus('draft')
    setShowStatusModal(true)
  }

  async function confirmImport() {
    setShowStatusModal(false)
    setImporting(true)
    try {
      const imagesByRow = new Map<number, string | null>()
      const namesByRow = new Map<number, string>()
      const targets: { row: ImportRow; item: ImageSearchItem }[] = []
      for (const row of valid) {
        if (!row.name) continue
        const includeImage = searchImages && !row.image_url
        if (!includeImage && !useApiTitle) continue
        targets.push({ row, item: { name: row.name, includeImage, includeTitle: useApiTitle } })
      }
      if (targets.length) {
        const label =
          searchImages && useApiTitle ? 'imágenes y títulos' : searchImages ? 'imágenes' : 'títulos'
        setImageStatus(`Buscando ${label} (0/${targets.length})...`)
        try {
          for (let offset = 0; offset < targets.length; offset += 10) {
            const batch = targets.slice(offset, offset + 10)
            const matches = await searchProductImages(batch.map((target) => target.item))
            batch.forEach((target, index) => {
              const match = matches[index]
              if (!match) return
              if (target.item.includeImage && match.image_url) {
                imagesByRow.set(target.row.row, match.image_url)
              }
              if (target.item.includeTitle && match.title) {
                namesByRow.set(target.row.row, match.title)
              }
            })
            setImageStatus(
              `Buscando ${label} (${Math.min(offset + batch.length, targets.length)}/${targets.length})...`,
            )
          }
        } catch (error) {
          notify(error instanceof Error ? error.message : 'No se pudo completar la búsqueda', 'error')
        } finally {
          setImageStatus('')
        }
      }
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
        name: namesByRow.get(row.row) ?? row.name,
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
        status: importStatus,
        image_url: imagesByRow.get(row.row) ?? row.image_url,
      }))
      const errors = await upsertProducts(payload)
      const withImage = payload.filter((row) => row.image_url).length
      setResult(
        errors.length
          ? `${payload.length - errors.length} filas importadas con errores: ${errors.join(' | ')}`
          : `${payload.length} productos importados correctamente (${withImage} con imagen)`,
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
            sale_price/precio, stock, status/estado e image_url. Los precios se leen en dólares y
            se convierten a soles (x3.46). Si el stock está dividido por distrito (stock_lima,
            stock_arequipa...), se suma automáticamente.
          </p>
          <Button variant="secondary" onClick={downloadTemplate} className="justify-self-start">
            <Download size={16} /> Descargar plantilla
          </Button>
          <Button
            onClick={handleImport}
            disabled={!valid.length || importing}
            className="justify-self-start"
          >
            <FileSpreadsheet size={16} />
            {importing ? 'Importando...' : `Importar ${valid.length} filas válidas`}
          </Button>
          {imageStatus && <p className="text-sm font-semibold text-blue-bright">{imageStatus}</p>}
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

      <Modal
        open={showStatusModal}
        title="Estado de la importación"
        onClose={() => setShowStatusModal(false)}
      >
        <div className="grid gap-5">
          <p className="text-sm text-muted">
            Selecciona el estado con el que se importarán las {valid.length} filas válidas.
          </p>
          <Field label="Estado">
            <select
              className={inputClass}
              value={importStatus}
              onChange={(event) => setImportStatus(event.target.value as Status)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-2">
            <label className="flex items-start gap-3 rounded-lg bg-surface-2 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={searchImages}
                onChange={(event) => setSearchImages(event.target.checked)}
              />
              <span>
                Buscar imagen con Serper. Solo se buscarán filas sin imagen en el Excel y la imagen
                encontrada se subirá a Supabase.
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg bg-surface-2 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={useApiTitle}
                onChange={(event) => setUseApiTitle(event.target.checked)}
              />
              <span>Usar el título que devuelve Serper como nombre del producto.</span>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowStatusModal(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmImport}>
              <FileSpreadsheet size={16} /> Importar {valid.length} filas
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
