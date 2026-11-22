import { useState } from 'react'
import { Pencil, Plus, Search, Trash2, Upload } from 'lucide-react'
import { deleteProduct, saveProduct } from '../../lib/catalog'
import type { ProductInput } from '../../lib/catalog'
import { friendlyError } from '../../lib/errors'
import { uploadImage } from '../../lib/supabase'
import type { Brand, Category, Product, Status } from '../../lib/types'
import { useToast } from '../toastContext'
import { Button, Empty, Field, Modal, StatusBadge, inputClass } from '../ui'

const blank: ProductInput = {
  sku: '',
  name: '',
  brand_id: null,
  category_id: null,
  description: '',
  sale_price: null,
  stock: 0,
  status: 'draft',
  image_url: null,
}

export function ProductsPage({
  products,
  brands,
  categories,
  onRefresh,
}: {
  products: Product[]
  brands: Brand[]
  categories: Category[]
  onRefresh: () => Promise<void>
}) {
  const notify = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [form, setForm] = useState<ProductInput>(blank)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const visible = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (status === 'all' || product.status === status)
  })

  function openForm(product: Product | 'new') {
    setEditing(product)
    setFile(null)
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
      image_url: product.image_url,
    })
  }

  async function handleSave() {
    if (!form.sku.trim() || !form.name.trim()) {
      notify('SKU y nombre son obligatorios', 'error')
      return
    }
    setSaving(true)
    try {
      const imageUrl = file ? await uploadImage(file, 'products') : form.image_url
      await saveProduct({
        ...form,
        id: editing !== 'new' ? editing?.id : undefined,
        image_url: imageUrl,
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
          <h1 className="text-2xl font-extrabold">Productos</h1>
          <p className="text-sm text-muted">{products.length} productos en el catálogo</p>
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
            {visible.map((product) => (
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
          <Field label="Imagen" hint="Sube un archivo o pega una URL">
            <input
              className={inputClass}
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="URL de imagen">
              <input
                className={inputClass}
                value={form.image_url ?? ''}
                onChange={(event) => setForm({ ...form, image_url: event.target.value || null })}
                placeholder="https://..."
              />
            </Field>
          </div>
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
