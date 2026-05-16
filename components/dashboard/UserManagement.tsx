'use client'

import { useState } from 'react'
import type { StaffProfile } from '@/lib/types'

interface Props { initialStaff: StaffProfile[] }

const ROLE_LABELS = [
  { key: 'can_menu',    label: 'Menú',   desc: 'Puede editar el menú y precios' },
  { key: 'can_payment', label: 'Pagos',  desc: 'Puede verificar y rechazar pagos' },
  { key: 'can_kitchen', label: 'Cocina', desc: 'Acceso al dashboard de cocina' },
]

export default function UserManagement({ initialStaff }: Props) {
  const [staff, setStaff]       = useState<StaffProfile[]>(initialStaff)
  const [showAdd, setShowAdd]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading]   = useState<string | null>(null)
  const [error, setError]       = useState('')

  // ── Add form state ─────────────────────────────────────────────────────────
  const [addForm, setAddForm] = useState({
    name: '', email: '', password: '',
    can_menu: false, can_payment: true, can_kitchen: false,
  })

  function setAdd(field: string, value: unknown) {
    setAddForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleAdd() {
    setError('')
    if (!addForm.email || !addForm.password) { setError('Email y contraseña requeridos'); return }
    setLoading('add')
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear usuario')
      setStaff(prev => [...prev, data])
      setShowAdd(false)
      setAddForm({ name: '', email: '', password: '', can_menu: false, can_payment: true, can_kitchen: false })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  async function handleUpdate(profile: StaffProfile, patch: Partial<StaffProfile>) {
    setLoading(profile.id)
    try {
      const res = await fetch(`/api/staff/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al actualizar')
      setStaff(prev => prev.map(s => s.id === profile.id ? { ...s, ...data } : s))
      setEditingId(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(profile: StaffProfile) {
    if (!confirm(`¿Eliminar el usuario ${profile.email ?? profile.name}? Esta acción no se puede deshacer.`)) return
    setLoading(profile.id)
    try {
      const res = await fetch(`/api/staff/${profile.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Error') }
      setStaff(prev => prev.filter(s => s.id !== profile.id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Usuarios</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Acceso al sistema para tu equipo</p>
        </div>
        <button
          onClick={() => { setShowAdd(!showAdd); setError('') }}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Añadir usuario
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Add form */}
      {showAdd && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-emerald-800">Nuevo usuario</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre" value={addForm.name} onChange={v => setAdd('name', v)} placeholder="Ej: Juan" />
            <Field label="Email *" value={addForm.email} onChange={v => setAdd('email', v)} placeholder="juan@restaurante.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Contraseña *</label>
            <input
              type="password"
              value={addForm.password}
              onChange={e => setAdd('password', e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">Acceso que tendrá:</p>
            <div className="space-y-2">
              {ROLE_LABELS.map(({ key, label, desc }) => (
                <RoleCheckbox
                  key={key}
                  label={label}
                  desc={desc}
                  checked={addForm[key as keyof typeof addForm] as boolean}
                  onChange={v => setAdd(key, v)}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={loading === 'add'}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading === 'add' ? 'Creando…' : 'Crear usuario'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setError('') }}
              className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Staff list */}
      {staff.length === 0 && !showAdd ? (
        <div className="rounded-2xl border border-zinc-200 p-8 text-center text-zinc-400">
          <p className="text-lg mb-1">Sin usuarios de equipo</p>
          <p className="text-sm">Añade miembros del equipo y asígnales acceso a las secciones que necesiten.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map(profile => (
            <StaffCard
              key={profile.id}
              profile={profile}
              isEditing={editingId === profile.id}
              isLoading={loading === profile.id}
              onEdit={() => setEditingId(profile.id)}
              onSave={patch => handleUpdate(profile, patch)}
              onCancel={() => setEditingId(null)}
              onDelete={() => handleDelete(profile)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── StaffCard ─────────────────────────────────────────────────────────────────

function StaffCard({
  profile, isEditing, isLoading, onEdit, onSave, onCancel, onDelete
}: {
  profile: StaffProfile
  isEditing: boolean
  isLoading: boolean
  onEdit: () => void
  onSave: (patch: Partial<StaffProfile>) => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [editRoles, setEditRoles] = useState({
    can_menu: profile.can_menu,
    can_payment: profile.can_payment,
    can_kitchen: profile.can_kitchen,
  })

  function toggleRole(key: keyof typeof editRoles) {
    setEditRoles(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const activeRoles = ROLE_LABELS.filter(r => profile[r.key as keyof StaffProfile])

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-900 truncate">{profile.name || profile.email}</p>
          {profile.name && <p className="text-xs text-zinc-500 truncate">{profile.email}</p>}
        </div>
        {!isEditing && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {profile.is_admin ? (
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">Admin</span>
            ) : activeRoles.length === 0 ? (
              <span className="text-xs text-zinc-400">Sin acceso</span>
            ) : (
              activeRoles.map(r => (
                <span key={r.key} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">{r.label}</span>
              ))
            )}
          </div>
        )}
        {!profile.is_admin && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isEditing && (
              <button onClick={onEdit} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 text-xs">
                ✏️
              </button>
            )}
            <button onClick={onDelete} disabled={isLoading} className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 text-xs disabled:opacity-40">
              🗑
            </button>
          </div>
        )}
      </div>

      {isEditing && (
        <div className="border-t border-zinc-100 px-5 pb-5 pt-4 space-y-3">
          <p className="text-sm font-medium text-zinc-700">Acceso:</p>
          <div className="space-y-2">
            {ROLE_LABELS.map(({ key, label, desc }) => (
              <RoleCheckbox
                key={key}
                label={label}
                desc={desc}
                checked={editRoles[key as keyof typeof editRoles]}
                onChange={() => toggleRole(key as keyof typeof editRoles)}
              />
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onSave(editRoles)}
              disabled={isLoading}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isLoading ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={onCancel} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── small helpers ─────────────────────────────────────────────────────────────

function RoleCheckbox({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 hover:bg-zinc-50">
      <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 ${checked ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-300'}`}>
        {checked && <span className="text-xs font-bold text-white">✓</span>}
      </span>
      <span onClick={() => onChange(!checked)} className="flex-1 select-none">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="block text-sm font-medium text-zinc-900">{label}</span>
        <span className="block text-xs text-zinc-500 mt-0.5">{desc}</span>
      </span>
    </label>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  )
}
