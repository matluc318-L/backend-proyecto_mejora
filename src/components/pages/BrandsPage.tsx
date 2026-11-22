import { useState } from 'react'
import { ArrowRight, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react'
import { deleteBrand, saveBrand } from '../../lib/catalog'
import { friendlyError } from '../../lib/errors'
import { uploadImage } from '../../lib/supabase'
import type { Brand } from '../../lib/types'
import { useToast } from '../toastContext'
import { Button, Empty, Field, Modal, inputClass } from '../ui'

export function BrandsPage({
  brands,
  onViewProducts,
  onRefresh,
}: {
  brands: Brand[]
  onViewProducts: (brand: Brand) => void
  onRefresh: () => Promise<void>
}) {
  const notify = useToast()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Brand | 'new' | null>(null)
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const visible = brands.filter((brand) => brand.name.toLowerCase().includes(search.toLowerCase()))

  function openForm(brand: Brand | 'new') {
    setEditing(brand)
    setName(brand === 'new' ? '' : brand.name)
    setImageUrl(brand === 'new' ? '' : (brand.image_url ?? ''))
    setFile(null)
  }

  async function handleSave() {
    if (!name.trim()) {
      notify('El nombre es obligatorio', 'error')
      return
    }
    setSaving(true)
    try {
      const url = file ? await uploadImage(file, 'brands') : imageUrl || null
      await saveBrand({
        id: editing !== 'new' ? editing?.id : undefined,
        name,
        image_url: url,
      })
      notify(editing === 'new' ? 'Marca creada' : 'Marca actualizada')
      setEditing(null)
      await onRefresh()
    } catch (error) {
      notify(friendlyError(error, 'No se pudo guardar'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(brand: Brand) {
    if (!window.confirm(`¿Eliminar la marca "${brand.name}"?`)) return
    try {
      await deleteBrand(brand.id)
      notify('Marca eliminada')
      await onRefresh()
    } catch (error) {
      notify(friendlyError(error, 'No se pudo eliminar'), 'error')
    }
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Marcas</h1>
          <p className="text-sm text-muted">{brands.length} marcas en el catálogo</p>
        </div>
        <Button onClick={() => openForm('new')}>
          <Plus size={17} /> Nueva marca
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={17} />
        <input
          className={`${inputClass} pl-10`}
          placeholder="Buscar marca..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3">Logo</th>
              <th className="px-5 py-3">Nombre</th>
              <th className="px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((brand) => (
              <tr key={brand.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  {brand.image_url ? (
                    <img
                      src={brand.image_url}
                      alt=""
                      className="h-9 w-14 rounded-md object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted">Sin logo</span>
                  )}
                </td>
                <td className="px-5 py-3 font-semibold">{brand.name}</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      className="px-2.5"
                      onClick={() => onViewProducts(brand)}
                      title={`Ver productos de ${brand.name}`}
                      aria-label={`Ver productos de ${brand.name}`}
                    >
                      <ArrowRight size={16} />
                    </Button>
                    <Button variant="secondary" onClick={() => openForm(brand)}>
                      <Pencil size={15} /> Editar
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(brand)}>
                      <Trash2 size={15} /> Eliminar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && <Empty text="No hay marcas para mostrar" />}
      </div>

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'Nueva marca' : 'Editar marca'}
        onClose={() => setEditing(null)}
      >
        <div className="grid gap-4">
          <Field label="Nombre">
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Logitech"
            />
          </Field>
          <Field label="Logo" hint="Sube una imagen o pega una URL">
            <input
              className={inputClass}
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <input
              className={inputClass}
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://..."
            />
          </Field>
          {imageUrl && !file && (
            <img src={imageUrl} alt="Vista previa" className="h-16 object-contain" />
          )}
          <div className="flex justify-end gap-2 pt-2">
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
