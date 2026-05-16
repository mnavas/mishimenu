'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Category, MenuItem } from '@/lib/types'

interface Props {
  initialCategories: Category[]
  initialItems: MenuItem[]
}

type EditingItem = {
  id: string | null // null = new
  category_id: string | null
  name: string
  description: string
  price: string
  emoji: string
  available: boolean
}

const EMPTY_ITEM: EditingItem = {
  id: null,
  category_id: null,
  name: '',
  description: '',
  price: '',
  emoji: '',
  available: true,
}

export default function MenuEditor({ initialCategories, initialItems }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [items, setItems]           = useState<MenuItem[]>(initialItems)

  // Category inline editing
  const [editingCatId, setEditingCatId]   = useState<string | 'new' | null>(null)
  const [catNameDraft, setCatNameDraft]   = useState('')

  // Item form
  const [editingItem, setEditingItem]     = useState<EditingItem | null>(null)

  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')
  const [uploadingImg, setUploadingImg] = useState(false)

  const catInputRef  = useRef<HTMLInputElement>(null)
  const itemNameRef  = useRef<HTMLInputElement>(null)
  const imageFileRef = useRef<HTMLInputElement>(null)

  // ─── Category actions ────────────────────────────────────────

  function startNewCat() {
    setEditingCatId('new')
    setCatNameDraft('')
    setTimeout(() => catInputRef.current?.focus(), 0)
  }

  function startEditCat(cat: Category) {
    setEditingCatId(cat.id)
    setCatNameDraft(cat.name)
    setTimeout(() => catInputRef.current?.focus(), 0)
  }

  async function saveCat() {
    const name = catNameDraft.trim()
    if (!name) { setEditingCatId(null); return }
    setBusy(true)
    setError('')
    try {
      if (editingCatId === 'new') {
        const res = await fetch('/api/menu/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, sort_order: categories.length }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        const created: Category = await res.json()
        setCategories(prev => [...prev, created])
      } else {
        const res = await fetch(`/api/menu/categories/${editingCatId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        const updated: Category = await res.json()
        setCategories(prev => prev.map(c => c.id === updated.id ? updated : c))
      }
      setEditingCatId(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteCat(cat: Category) {
    const count = items.filter(i => i.category_id === cat.id).length
    const msg = count > 0
      ? `¿Eliminar la categoría "${cat.name}"? Los ${count} plato(s) quedarán sin categoría.`
      : `¿Eliminar la categoría "${cat.name}"?`
    if (!confirm(msg)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/menu/categories/${cat.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setCategories(prev => prev.filter(c => c.id !== cat.id))
      setItems(prev => prev.map(i => i.category_id === cat.id ? { ...i, category_id: null } : i))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // ─── Item actions ────────────────────────────────────────────

  function startNewItem(categoryId: string | null) {
    setEditingItem({ ...EMPTY_ITEM, category_id: categoryId })
    setTimeout(() => itemNameRef.current?.focus(), 0)
  }

  function startEditItem(item: MenuItem) {
    setEditingItem({
      id:          item.id,
      category_id: item.category_id,
      name:        item.name,
      description: item.description ?? '',
      price:       String(item.price),
      emoji:       item.emoji ?? '',
      available:   item.available,
    })
    setTimeout(() => itemNameRef.current?.focus(), 0)
  }

  async function saveItem() {
    if (!editingItem) return
    const name  = editingItem.name.trim()
    const price = parseFloat(editingItem.price)
    if (!name) { setError('El nombre es requerido.'); return }
    if (isNaN(price) || price < 0) { setError('Ingresa un precio válido.'); return }

    setBusy(true)
    setError('')
    try {
      const payload = {
        category_id: editingItem.category_id,
        name,
        description: editingItem.description.trim() || null,
        price,
        emoji:       editingItem.emoji.trim() || null,
        available:   editingItem.available,
      }
      if (editingItem.id) {
        const res = await fetch(`/api/menu/items/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        const updated: MenuItem = await res.json()
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
      } else {
        const res = await fetch('/api/menu/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, sort_order: items.filter(i => i.category_id === editingItem.category_id).length }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        const created: MenuItem = await res.json()
        setItems(prev => [...prev, created])
      }
      setEditingItem(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleAvailable(item: MenuItem) {
    const res = await fetch(`/api/menu/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: !item.available }),
    })
    if (res.ok) {
      const updated: MenuItem = await res.json()
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
    }
  }

  async function deleteItem(item: MenuItem) {
    if (!confirm(`¿Eliminar "${item.name}"?`)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/menu/items/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setItems(prev => prev.filter(i => i.id !== item.id))
      if (editingItem?.id === item.id) setEditingItem(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // ─── Image actions ───────────────────────────────────────────

  async function uploadImage(itemId: string, file: File) {
    setUploadingImg(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch(`/api/menu/items/${itemId}/image`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error)
      const { image_url }: { image_url: string } = await res.json()
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, image_url } : i))
      // Keep editingItem in sync so the preview updates immediately
      setEditingItem(prev => prev && prev.id === itemId ? { ...prev } : prev)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploadingImg(false)
    }
  }

  async function removeImage(itemId: string) {
    setUploadingImg(true)
    setError('')
    try {
      const res = await fetch(`/api/menu/items/${itemId}/image`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, image_url: null } : i))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploadingImg(false)
    }
  }

  // ─── Render helpers ──────────────────────────────────────────

  function renderItemForm() {
    if (!editingItem) return null
    return (
      <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-4 space-y-3">
        <div className="flex gap-2">
          <div className="w-14">
            <label className="text-xs font-medium text-zinc-500">Emoji</label>
            <input
              type="text"
              value={editingItem.emoji}
              onChange={e => setEditingItem(prev => prev && ({ ...prev, emoji: e.target.value }))}
              placeholder="🍕"
              maxLength={4}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-center text-lg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-zinc-500">Nombre *</label>
            <input
              ref={itemNameRef}
              type="text"
              value={editingItem.name}
              onChange={e => setEditingItem(prev => prev && ({ ...prev, name: e.target.value }))}
              placeholder="Ceviche de camarón"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="w-24">
            <label className="text-xs font-medium text-zinc-500">Precio *</label>
            <div className="relative mt-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-zinc-400">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editingItem.price}
                onChange={e => setEditingItem(prev => prev && ({ ...prev, price: e.target.value }))}
                placeholder="0.00"
                className="w-full rounded-lg border border-zinc-300 py-2 pl-6 pr-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-500">Descripción</label>
          <textarea
            value={editingItem.description}
            onChange={e => setEditingItem(prev => prev && ({ ...prev, description: e.target.value }))}
            placeholder="Descripción corta (opcional)"
            rows={2}
            className="mt-1 w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditingItem(prev => prev && ({ ...prev, available: !prev.available }))}
            className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
              editingItem.available
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                : 'border-zinc-300 text-zinc-400'
            }`}
          >
            <span className={`h-4 w-4 rounded-full border-2 ${editingItem.available ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-300'}`} />
            {editingItem.available ? 'Disponible' : 'No disponible'}
          </button>
        </div>

        {/* Image upload — only shown when editing an existing (saved) item */}
        {editingItem.id && (() => {
          const savedItem = items.find(i => i.id === editingItem.id)
          const currentImage = savedItem?.image_url ?? null
          return (
            <div className="space-y-2 border-t border-zinc-200 pt-3">
              <p className="text-xs font-medium text-zinc-500">Imagen del plato</p>
              {currentImage && (
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-zinc-200">
                    <Image src={currentImage} alt="foto del plato" fill className="object-cover" unoptimized />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(editingItem.id!)}
                    disabled={uploadingImg}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    {uploadingImg ? 'Eliminando…' : 'Quitar imagen'}
                  </button>
                </div>
              )}
              <div>
                <input
                  ref={imageFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file && editingItem.id) uploadImage(editingItem.id, file)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => imageFileRef.current?.click()}
                  disabled={uploadingImg}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {uploadingImg ? 'Subiendo…' : currentImage ? '📷 Cambiar imagen' : '📷 Subir imagen'}
                </button>
              </div>
            </div>
          )
        })()}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={saveItem}
            disabled={busy}
            className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => { setEditingItem(null); setError('') }}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  function renderCategorySection(catId: string | null, catName: string, cat?: Category) {
    const sectionItems = items.filter(i => i.category_id === catId)
    const isEditingThisCat = editingCatId === (catId ?? '')
    const isAddingItemHere = editingItem !== null && editingItem.id === null && editingItem.category_id === catId
    const isEditingItemHere = editingItem !== null && editingItem.id !== null && sectionItems.some(i => i.id === editingItem.id)

    return (
      <section key={catId ?? 'uncategorized'} className="space-y-2">
        {/* Category header */}
        <div className="flex items-center gap-2">
          {isEditingThisCat ? (
            <>
              <input
                ref={catInputRef}
                type="text"
                value={catNameDraft}
                onChange={e => setCatNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveCat(); if (e.key === 'Escape') setEditingCatId(null) }}
                placeholder="Nombre de categoría"
                className="flex-1 rounded-lg border-2 border-emerald-400 px-3 py-1.5 text-sm font-semibold focus:outline-none"
              />
              <button
                onClick={saveCat}
                disabled={busy}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? '…' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditingCatId(null)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <h2 className="flex-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {catName}
              </h2>
              {cat && (
                <>
                  <button
                    onClick={() => startEditCat(cat)}
                    title="Renombrar"
                    className="rounded p-1 text-zinc-400 hover:text-zinc-700"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deleteCat(cat)}
                    title="Eliminar categoría"
                    className="rounded p-1 text-zinc-400 hover:text-red-500"
                  >
                    🗑️
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Items */}
        <div className="space-y-1.5">
          {sectionItems.map(item => {
            const isEditingThisItem = editingItem?.id === item.id

            if (isEditingThisItem) {
              return <div key={item.id}>{renderItemForm()}</div>
            }

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5"
              >
                {item.image_url ? (
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-zinc-100">
                    <Image src={item.image_url} alt={item.name} fill className="object-cover" unoptimized />
                  </div>
                ) : item.emoji ? (
                  <span className="text-xl leading-none">{item.emoji}</span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${item.available ? 'text-zinc-900' : 'text-zinc-400 line-through'}`}>
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="truncate text-xs text-zinc-400">{item.description}</p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold text-zinc-700">
                  ${Number(item.price).toFixed(2)}
                </span>
                <button
                  onClick={() => toggleAvailable(item)}
                  title={item.available ? 'Marcar no disponible' : 'Marcar disponible'}
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                    item.available
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                  }`}
                >
                  {item.available ? 'Activo' : 'Oculto'}
                </button>
                <button
                  onClick={() => startEditItem(item)}
                  title="Editar"
                  className="shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-700"
                >
                  ✏️
                </button>
                <button
                  onClick={() => deleteItem(item)}
                  title="Eliminar"
                  className="shrink-0 rounded p-1 text-zinc-400 hover:text-red-500"
                >
                  🗑️
                </button>
              </div>
            )
          })}

          {/* New item form shown inline at bottom of section */}
          {isAddingItemHere && !isEditingItemHere && renderItemForm()}

          {/* Add item button */}
          {!isAddingItemHere && (
            <button
              onClick={() => {
                setEditingItem(null)
                setTimeout(() => startNewItem(catId), 0)
              }}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-400 hover:border-emerald-400 hover:text-emerald-600"
            >
              <span className="text-lg leading-none">+</span>
              Añadir plato
            </button>
          )}
        </div>
      </section>
    )
  }

  const uncategorized = items.filter(i => i.category_id === null)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-bold text-zinc-900">Carta</h1>
        </div>
        <button
          onClick={startNewCat}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          + Categoría
        </button>
      </div>

      {/* New category form */}
      {editingCatId === 'new' && (
        <div className="flex items-center gap-2">
          <input
            ref={catInputRef}
            type="text"
            value={catNameDraft}
            onChange={e => setCatNameDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveCat(); if (e.key === 'Escape') setEditingCatId(null) }}
            placeholder="Nombre de la categoría"
            className="flex-1 rounded-xl border-2 border-emerald-400 px-4 py-2.5 text-sm font-semibold focus:outline-none"
          />
          <button
            onClick={saveCat}
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? '…' : 'Guardar'}
          </button>
          <button
            onClick={() => setEditingCatId(null)}
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Global error (non-item-form) */}
      {error && !editingItem && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* Empty state */}
      {categories.length === 0 && uncategorized.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 py-16 text-center">
          <p className="text-zinc-400">La carta está vacía.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Empieza creando una categoría como &quot;Entradas&quot; o &quot;Platos fuertes&quot;.
          </p>
        </div>
      )}

      {/* Category sections */}
      {categories.map(cat => renderCategorySection(cat.id, cat.name, cat))}

      {/* Uncategorized */}
      {(uncategorized.length > 0 || (editingItem?.category_id === null && editingItem?.id === null)) &&
        renderCategorySection(null, 'Sin categoría')}
    </div>
  )
}
