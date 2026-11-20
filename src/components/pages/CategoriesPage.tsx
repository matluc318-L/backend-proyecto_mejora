import { useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { deleteCategory, saveCategory } from '../../lib/catalog'
import type { Category } from '../../lib/types'
import { useToast } from '../toastContext'
import { Button, Empty, Field, Modal, inputClass } from '../ui'

export function CategoriesPage({
  categories,
  onRefresh,
}: {
  categories: Category[]
  onRefresh: () => Promise<void>
}) {
  const notify = useToast()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [name, setName] = useState('')
  const [order, setOrder] = useState(0)
  const [saving, setSaving] = useState(false)

  const visible = categories.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))

  function openForm(category: Category | 'new') {
    setEditing(category)
    setName(category === 'new' ? '' : category.name)
    setOrder(category === 'new' ? categories.length : category.display_order)
  }

  async function handleSave() {
    if (!name.trim()) {
      notify('El nombre es obligatorio', 'error')
      return
    }
    setSaving(true)
    try {
      await saveCategory({
        id: editing !== 'new' ? editing?.id : undefined,
        name,
        display_order: order,
        description: null,
      })
      notify(editing === 'new' ? 'Categoría creada' : 'Categoría actualizada')
      setEditing(null)
      await onRefresh()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) return
    try {
      await deleteCategory(category.id)
      notify('Categoría eliminada')
      await onRefresh()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo eliminar', 'error')
    }
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Categorías</h1>
          <p className="text-sm text-muted">{categories.length} categorías</p>
        </div>
        <Button onClick={() => openForm('new')}>
          <Plus size={17} /> Nueva categoría
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={17} />
        <input
          className={`${inputClass} pl-10`}
          placeholder="Buscar categoría..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3">Nombre</th>
              <th className="px-5 py-3">Orden</th>
              <th className="px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((category) => (
              <tr key={category.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-semibold">{category.name}</td>
                <td className="px-5 py-3 text-muted">{category.display_order}</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => openForm(category)}>
                      <Pencil size={15} /> Editar
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(category)}>
                      <Trash2 size={15} /> Eliminar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && <Empty text="No hay categorías para mostrar" />}
      </div>

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'Nueva categoría' : 'Editar categoría'}
        onClose={() => setEditing(null)}
      >
        <div className="grid gap-4">
          <Field label="Nombre">
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Audio"
            />
          </Field>
          <Field label="Orden de visualización">
            <input
              className={inputClass}
              type="number"
              value={order}
              onChange={(event) => setOrder(Number(event.target.value))}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
