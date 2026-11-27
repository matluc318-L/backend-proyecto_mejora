import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import { deleteProduct, saveProduct } from '../../lib/catalog'
import type { ProductInput } from '../../lib/catalog'
import { friendlyError } from '../../lib/errors'
import { uploadImage } from '../../lib/supabase'
import { PRODUCT_IMAGE_COUNT, type Brand, type Category, type Product, type Status } from '../../lib/types'
import { useToast } from '../toastContext'
import { Button, Empty, Field, Modal, StatusBadge, inputClass } from '../ui'

type ProductForm = Omit<ProductInput, 'image_url' | 'image_urls'> & {
  images: (string | null)[]
}

const blankImages = () => Array.from({ length: PRODUCT_IMAGE_COUNT }, () => null)

const blank: ProductForm = {
  sku: '',
  name: '',
  brand_id: null,
  category_id: null,
  description: '',
  sale_price: null,
  stock: 0,
  status: 'draft',
  images: blankImages(),
}

export function ProductsPage({
  products,
  brands,
  categories,
  brandFilter,
  onClearBrandFilter,
  onRefresh,
}: {
  products: Product[]
  brands: Brand[]
  categories: Category[]
  brandFilter?: { id: string; name: string } | null
  onClearBrandFilter?: () => void
  onRefresh: () => Promise<void>
}) {
  const notify = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [form, setForm] = useState<ProductForm>(blank)
  const [files, setFiles] = useState<(File | null)[]>(blankImages)
  const [saving, setSaving] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const pageSize = 15

  const visible = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase())
    const matchesBrand = !brandFilter || product.brand_id === brandFilter.id
    return matchesBrand && matchesSearch && (status === 'all' || product.status === status)
  })

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const currentPage = Math.min(pageNumber, totalPages)
  const pageProducts = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageWindow = Math.min(5, totalPages)
  const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - pageWindow + 1))
  const pageNumbers = Array.from({ length: pageWindow }, (_, index) => firstPage + index)

  useEffect(() => {
    setPageNumber(1)
  }, [search, status, brandFilter?.id])

  function openForm(product: Product | 'new') {
    setEditing(product)
    setFiles(blankImages())
    if (product === 'new') {
      setForm(blank)
      return
    }
    setForm({
      sku: product.sku,
      name: product.name,
      brand_id: product.brand_id,
      category_id: product.category_id,
      description: product.description ?? '',
      sale_price: product.sale_price,
      stock: product.stock,
      status: product.status,
      images: Array.from({ length: PRODUCT_IMAGE_COUNT }, (_, index) =>
        index === 0 ? product.image_url : (product.image_urls?.[index - 1] ?? null),
      ),
    })
  }

  async function handleSave() {
    if (!form.sku.trim() || !form.name.trim()) {
      notify('SKU y nombre son obligatorios', 'error')
      return
    }
    setSaving(true)
    try {
      const { images, ...fields } = form
      const imageUrls = [...images]
      for (let index = 0; index < files.length; index++) {
        const file = files[index]
        if (!file) continue
        imageUrls[index] = await uploadImage(file, 'products')
      }
      await saveProduct({
        ...fields,
        id: editing !== 'new' ? editing?.id : undefined,
        image_url: imageUrls[0] ?? null,
        image_urls: imageUrls.slice(1).filter((url): url is string => Boolean(url)),
      })
      notify(editing === 'new' ? 'Producto creado' : 'Producto actualizado')
      setEditing(null)
      await onRefresh()
    } catch (error) {
      notify(friendlyError(error, 'No se pudo guardar'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`¿Eliminar el producto "${product.name}"?`)) return
    try {
      await deleteProduct(product.id!)
      notify('Producto eliminado')
      await onRefresh()
    } catch (error) {
      notify(friendlyError(error, 'No se pudo eliminar'), 'error')
    }
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">
            {brandFilter ? `Productos · ${brandFilter.name}` : 'Productos'}
          </h1>
          <p className="text-sm text-muted">
            {brandFilter
              ? `${visible.length} productos de ${brandFilter.name}`
              : `${products.length} productos en el catálogo`}
          </p>
        </div>
        <Button onClick={() => openForm('new')}>
          <Plus size={17} /> Nuevo producto
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={17} />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="review">Revisión</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
        </select>
      </div>

      {brandFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue/20 bg-blue-soft px-4 py-3 text-sm">
          <span className="font-semibold text-blue-bright">
            Mostrando solo productos de {brandFilter.name}
          </span>
          {onClearBrandFilter && (
            <Button variant="ghost" onClick={onClearBrandFilter}>
              <X size={15} /> Ver todos
            </Button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3">SKU</th>
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3">Marca</th>
              <th className="px-5 py-3">Precio</th>
              <th className="px-5 py-3">Stock</th>
              <th className="px-5 py-3">Estado</th>
              <th className="px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pageProducts.map((product) => (
              <tr key={product.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-mono text-xs text-muted">{product.sku}</td>
                <td className="px-5 py-3 font-semibold">{product.name}</td>
                <td className="px-5 py-3 text-muted">{product.brand?.name ?? '—'}</td>
                <td className="px-5 py-3">{product.sale_price ?? '—'}</td>
                <td className="px-5 py-3">{product.stock}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={product.status} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openForm(product)}>
                      <Pencil size={15} /> Editar
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(product)}>
                      <Trash2 size={15} /> Eliminar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && <Empty text="No hay productos para mostrar" />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {visible.length
            ? `Mostrando ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, visible.length)} de ${visible.length}`
            : '0 productos'}
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => setPageNumber(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={16} /> Anterior
          </Button>
          <div className="flex items-center gap-1">
            {pageNumbers.map((number) => (
              <Button
                key={number}
                variant={number === currentPage ? 'primary' : 'secondary'}
                className="min-w-9 px-3"
                onClick={() => setPageNumber(number)}
                aria-current={number === currentPage ? 'page' : undefined}
              >
                {number}
              </Button>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => setPageNumber(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Siguiente <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'Nuevo producto' : 'Editar producto'}
        onClose={() => setEditing(null)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU">
            <input
              className={inputClass}
              value={form.sku}
              onChange={(event) => setForm({ ...form, sku: event.target.value })}
            />
          </Field>
          <Field label="Nombre">
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Marca">
            <select
              className={inputClass}
              value={form.brand_id ?? ''}
              onChange={(event) => setForm({ ...form, brand_id: event.target.value || null })}
            >
              <option value="">Sin marca</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Categoría">
            <select
              className={inputClass}
              value={form.category_id ?? ''}
              onChange={(event) => setForm({ ...form, category_id: event.target.value || null })}
            >
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Precio de venta">
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.01"
              value={form.sale_price ?? ''}
              onChange={(event) =>
                setForm({ ...form, sale_price: event.target.value === '' ? null : Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Stock">
            <input
              className={inputClass}
              type="number"
              min="0"
              value={form.stock}
              onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })}
            />
          </Field>
          <Field label="Estado">
            <select
              className={inputClass}
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as Status })}
            >
              <option value="draft">Borrador</option>
              <option value="review">Revisión</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select>
          </Field>
          {form.images.map((url, index) => (
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2" key={index}>
              <Field label={`Imagen ${index + 1} · archivo`}>
                <input
                  className={inputClass}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const next = [...files]
                    next[index] = event.target.files?.[0] ?? null
                    setFiles(next)
                  }}
                />
              </Field>
              <Field label={`Imagen ${index + 1} · URL`} hint="Pega una URL o sube un archivo">
                <input
                  className={inputClass}
                  value={url ?? ''}
                  onChange={(event) => {
                    const next = [...form.images]
                    next[index] = event.target.value || null
                    setForm({ ...form, images: next })
                  }}
                  placeholder="https://..."
                />
              </Field>
            </div>
          ))}
          <div className="sm:col-span-2">
            <Field label="Descripción">
              <textarea
                className={inputClass}
                rows={3}
                value={form.description ?? ''}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Upload size={16} /> {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
