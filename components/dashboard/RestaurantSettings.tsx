'use client'

import { useState, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import type { Restaurant, PaymentMethod, PaymentPolicy } from '@/lib/types'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import { calcBreakdown } from '@/lib/pricing'

const ALL_METHODS: { method: PaymentMethod; desc: string }[] = [
  { method: 'deuna',    desc: 'Billetera Pichincha' },
  { method: 'sipi',     desc: 'Billetera digital' },
  { method: 'transfer', desc: 'Transferencia bancaria' },
  { method: 'cash',     desc: 'Efectivo en caja' },
  { method: 'card',     desc: 'Tarjeta / datáfono' },
]

const CURRENCY_PRESETS = ['$', 'S/', 'Q', '€']

type TaxMode = 'none' | 'included' | 'added'
type ServiceFeeMode = 'none' | 'percent' | 'fixed' | 'both'

function initTaxMode(r: Restaurant): TaxMode {
  if (r.tax_rate === 0) return 'none'
  return r.tax_included ? 'included' : 'added'
}

function initServiceFeeMode(r: Restaurant): ServiceFeeMode {
  const hasRate  = r.service_fee_rate > 0
  const hasFixed = (r.service_fee_fixed ?? 0) > 0
  if (!hasRate && !hasFixed) return 'none'
  if (hasRate  && !hasFixed) return 'percent'
  if (!hasRate && hasFixed)  return 'fixed'
  return 'both'
}

interface Props { restaurant: Restaurant }

export default function RestaurantSettings({ restaurant }: Props) {
  const [form, setForm] = useState({
    name:                    restaurant.name,
    address:                 restaurant.address ?? '',
    phone:                   restaurant.phone ?? '',
    ruc:                     restaurant.ruc ?? '',
    currency_symbol:         restaurant.currency_symbol ?? '$',
    show_price_breakdown:    restaurant.show_price_breakdown ?? true,
    kitchen_enabled:         restaurant.kitchen_enabled ?? false,
    payment_policy:          restaurant.payment_policy,
    accepted_payment_methods: restaurant.accepted_payment_methods,
    deuna_qr_url:            restaurant.deuna_qr_url ?? '',
    deuna_account_name:      restaurant.deuna_account_name ?? '',
    sipi_qr_url:             restaurant.sipi_qr_url ?? '',
    sipi_account_name:       restaurant.sipi_account_name ?? '',
    transfer_bank:           restaurant.transfer_bank ?? '',
    transfer_account_number: restaurant.transfer_account_number ?? '',
    transfer_account_name:   restaurant.transfer_account_name ?? '',
    tax_rate:         restaurant.tax_rate === 0 ? '' : String(Math.round(restaurant.tax_rate * 100)),
    service_fee_rate: restaurant.service_fee_rate === 0 ? '' : String(Math.round(restaurant.service_fee_rate * 100)),
    service_fee_fixed: (restaurant.service_fee_fixed ?? 0) === 0 ? '' : String(restaurant.service_fee_fixed),
  })
  const [taxMode, setTaxMode]               = useState<TaxMode>(initTaxMode(restaurant))
  const [serviceFeeMode, setServiceFeeMode] = useState<ServiceFeeMode>(initServiceFeeMode(restaurant))
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
    setErrorMsg('')
  }

  function toggleMethod(method: PaymentMethod) {
    const current = form.accepted_payment_methods
    if (current.includes(method)) {
      if (current.length === 1) return
      set('accepted_payment_methods', current.filter(m => m !== method))
    } else {
      set('accepted_payment_methods', [...current, method])
    }
  }

  const sym = form.currency_symbol || '$'

  // Live preview — recomputes on every keystroke
  const preview = useMemo(() => {
    const taxRate    = taxMode === 'none' ? 0 : (parseFloat(form.tax_rate) || 0) / 100
    const taxIncl    = taxMode === 'included'
    const feeRate    = (serviceFeeMode === 'percent' || serviceFeeMode === 'both') ? (parseFloat(form.service_fee_rate) || 0) / 100 : 0
    const feeFixed   = (serviceFeeMode === 'fixed'   || serviceFeeMode === 'both') ? (parseFloat(form.service_fee_fixed) || 0)       : 0
    const fake = { ...restaurant, tax_rate: taxRate, tax_included: taxIncl, service_fee_rate: feeRate, service_fee_fixed: feeFixed }
    return calcBreakdown(10.00, fake)
  }, [form.tax_rate, form.service_fee_rate, form.service_fee_fixed, taxMode, serviceFeeMode, restaurant])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setErrorMsg('')
    try {
      const taxRate    = taxMode === 'none' ? 0 : (parseFloat(form.tax_rate) || 0) / 100
      const taxIncl    = taxMode === 'included'
      const feeRate    = (serviceFeeMode === 'percent' || serviceFeeMode === 'both') ? (parseFloat(form.service_fee_rate) || 0) / 100 : 0
      const feeFixed   = (serviceFeeMode === 'fixed'   || serviceFeeMode === 'both') ? (parseFloat(form.service_fee_fixed) || 0)       : 0
      const body = {
        ...form,
        address:                 form.address || null,
        phone:                   form.phone || null,
        ruc:                     form.ruc || null,
        deuna_qr_url:            form.deuna_qr_url || null,
        deuna_account_name:      form.deuna_account_name || null,
        sipi_qr_url:             form.sipi_qr_url || null,
        sipi_account_name:       form.sipi_account_name || null,
        transfer_bank:           form.transfer_bank || null,
        transfer_account_number: form.transfer_account_number || null,
        transfer_account_name:   form.transfer_account_name || null,
        tax_rate:         taxRate,
        tax_included:     taxIncl,
        service_fee_rate: feeRate,
        service_fee_fixed: feeFixed,
      }
      const res = await fetch('/api/restaurant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Error al guardar')
      }
      setSaved(true)
    } catch (e) {
      setErrorMsg((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold text-zinc-900">Configuración</h1>
      </div>

      {/* Basic info */}
      <section className="space-y-4">
        <SectionTitle>Información del restaurante</SectionTitle>
        <div className="space-y-3">
          <Field label="Nombre *"   value={form.name}    onChange={v => set('name', v)} />
          <Field label="Dirección"  value={form.address} onChange={v => set('address', v)} />
          <Field label="Teléfono"   value={form.phone}   onChange={v => set('phone', v)} />
          <Field label="RUC"        value={form.ruc}     onChange={v => set('ruc', v)} />
        </div>
      </section>

      {/* Feature toggles */}
      <section className="space-y-3">
        <SectionTitle>Opciones</SectionTitle>
        <ToggleCard
          active={form.show_price_breakdown}
          onClick={() => set('show_price_breakdown', !form.show_price_breakdown)}
          label="Mostrar desglose de precios al cliente"
          desc="Cuando está activo, el cliente ve subtotal + IVA + servicio por separado. Al desactivarlo solo ve el total."
        />
        <ToggleCard
          active={form.kitchen_enabled}
          onClick={() => set('kitchen_enabled', !form.kitchen_enabled)}
          label="Activar dashboard de cocina"
          desc="Habilita una vista para que el equipo de cocina vea y marque los pedidos como listos."
        />
      </section>

      {/* Currency */}
      <section className="space-y-4">
        <SectionTitle>Moneda</SectionTitle>
        <p className="text-sm text-zinc-600">Elige el símbolo que aparecerá junto a los precios.</p>
        <div className="flex flex-wrap gap-2">
          {CURRENCY_PRESETS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => set('currency_symbol', s)}
              className={`rounded-xl border-2 px-4 py-2 text-sm font-bold transition-colors ${
                form.currency_symbol === s
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-zinc-200 text-zinc-700 hover:border-zinc-300'
              }`}
            >
              {s}
            </button>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400">Otro:</span>
            <input
              type="text"
              maxLength={3}
              value={CURRENCY_PRESETS.includes(form.currency_symbol) ? '' : form.currency_symbol}
              onChange={e => { if (e.target.value) set('currency_symbol', e.target.value) }}
              placeholder="…"
              className="w-14 rounded-lg border border-zinc-300 px-2 py-2 text-center text-sm font-bold text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </section>

      {/* Tax */}
      <section className="space-y-3">
        <SectionTitle>IVA (impuesto al valor agregado)</SectionTitle>
        <RadioCard
          active={taxMode === 'none'}
          onClick={() => { setTaxMode('none'); setSaved(false) }}
          label="No cobro IVA"
          desc="Los precios del menú no incluyen IVA y no se cobra al cliente."
        />
        <RadioCard
          active={taxMode === 'included'}
          onClick={() => { setTaxMode('included'); setSaved(false) }}
          label="Los precios del menú ya incluyen el IVA"
          desc="El IVA está dentro del precio. No se agrega nada extra al pagar."
          extra={taxMode === 'included' ? <RateInput label="Tasa de IVA" value={form.tax_rate} onChange={v => set('tax_rate', v)} hint="Ecuador: 15%" /> : undefined}
        />
        <RadioCard
          active={taxMode === 'added'}
          onClick={() => { setTaxMode('added'); setSaved(false) }}
          label="El IVA se suma al precio final"
          desc="Los precios del menú no incluyen IVA. Se calcula y se muestra al cliente al pagar."
          extra={taxMode === 'added' ? <RateInput label="Tasa de IVA" value={form.tax_rate} onChange={v => set('tax_rate', v)} hint="Ecuador: 15%" /> : undefined}
        />
      </section>

      {/* Service fee */}
      <section className="space-y-3">
        <SectionTitle>Cargo por servicio</SectionTitle>
        <RadioCard
          active={serviceFeeMode === 'none'}
          onClick={() => { setServiceFeeMode('none'); setSaved(false) }}
          label="Sin cargo de servicio"
          desc="No se cobra ningún cargo adicional."
        />
        <RadioCard
          active={serviceFeeMode === 'percent'}
          onClick={() => { setServiceFeeMode('percent'); setSaved(false) }}
          label="Porcentaje sobre el subtotal"
          desc="Ej.: 10% de servicio. Típico en restaurantes de Ecuador."
          extra={serviceFeeMode === 'percent' ? <RateInput label="Porcentaje" value={form.service_fee_rate} onChange={v => set('service_fee_rate', v)} /> : undefined}
        />
        <RadioCard
          active={serviceFeeMode === 'fixed'}
          onClick={() => { setServiceFeeMode('fixed'); setSaved(false) }}
          label="Tarifa fija por pedido"
          desc="Un monto fijo por cada pedido, sin importar el total."
          extra={serviceFeeMode === 'fixed' ? <FixedInput sym={sym} value={form.service_fee_fixed} onChange={v => set('service_fee_fixed', v)} /> : undefined}
        />
        <RadioCard
          active={serviceFeeMode === 'both'}
          onClick={() => { setServiceFeeMode('both'); setSaved(false) }}
          label="Porcentaje + tarifa fija"
          desc="Se cobra ambos: un porcentaje del subtotal y una tarifa fija."
          extra={serviceFeeMode === 'both' ? (
            <div className="flex flex-wrap gap-4">
              <RateInput label="Porcentaje" value={form.service_fee_rate} onChange={v => set('service_fee_rate', v)} />
              <FixedInput sym={sym} value={form.service_fee_fixed} onChange={v => set('service_fee_fixed', v)} />
            </div>
          ) : undefined}
        />
      </section>

      {/* Live price preview */}
      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-3">
        <SectionTitle>Ejemplo de precio al cliente</SectionTitle>
        <p className="text-xs text-zinc-500">
          Si un plato cuesta {sym}10.00, el cliente verá esto al pagar:
        </p>
        <div className="space-y-1.5 text-sm">
          <PreviewRow label="Subtotal" value={`${sym}${preview.subtotal.toFixed(2)}`} />
          {taxMode === 'none' && (
            <PreviewRow label="IVA" value="—" muted />
          )}
          {taxMode === 'included' && (
            <PreviewRow label={`IVA ${form.tax_rate || 0}% (ya incluido)`} value="incluido" muted />
          )}
          {taxMode === 'added' && (
            <PreviewRow label={`IVA ${form.tax_rate || 0}%`} value={`+ ${sym}${preview.taxAmount.toFixed(2)}`} />
          )}
          {serviceFeeMode === 'none' && (
            <PreviewRow label="Servicio" value="—" muted />
          )}
          {serviceFeeMode !== 'none' && (
            <PreviewRow
              label={
                serviceFeeMode === 'percent' ? `Servicio ${form.service_fee_rate || 0}%` :
                serviceFeeMode === 'fixed'   ? `Servicio fijo` :
                `Servicio ${form.service_fee_rate || 0}% + fijo`
              }
              value={`+ ${sym}${preview.serviceFeeAmount.toFixed(2)}`}
            />
          )}
          <div className="border-t border-zinc-200 pt-2 mt-1">
            <PreviewRow label="Total" value={`${sym}${preview.total.toFixed(2)}`} bold />
          </div>
        </div>
      </section>

      {/* Payment policy */}
      <section className="space-y-4">
        <SectionTitle>Política de pago</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {(['upfront', 'at_end'] as PaymentPolicy[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => set('payment_policy', p)}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                form.payment_policy === p
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <div className="text-sm font-semibold text-zinc-900">
                {p === 'upfront' ? '🔒 Pago anticipado' : '🍽️ Pago al final'}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                {p === 'upfront'
                  ? 'El cliente paga antes de que la cocina prepare el pedido.'
                  : 'El cliente paga al terminar de comer.'}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Payment methods */}
      <section className="space-y-4">
        <SectionTitle>Métodos de pago aceptados</SectionTitle>
        <div className="space-y-2">
          {ALL_METHODS.map(({ method, desc }) => {
            const active = form.accepted_payment_methods.includes(method)
            return (
              <div key={method} className={`rounded-xl border-2 transition-colors ${active ? 'border-emerald-400' : 'border-zinc-200'}`}>
                <button
                  type="button"
                  onClick={() => toggleMethod(method)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 ${
                    active ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-300'
                  }`}>
                    {active && <span className="text-xs font-bold text-white">✓</span>}
                  </span>
                  <span className="flex-1 font-medium text-zinc-900">{PAYMENT_METHOD_LABELS[method]}</span>
                  <span className="text-xs text-zinc-500">{desc}</span>
                </button>

                {active && method === 'deuna' && (
                  <div className="space-y-3 border-t border-zinc-100 px-4 pb-4 pt-3">
                    <Field label="URL del QR de DeUna" value={form.deuna_qr_url} onChange={v => set('deuna_qr_url', v)} placeholder="https://..." />
                    <Field label="Nombre de cuenta"    value={form.deuna_account_name} onChange={v => set('deuna_account_name', v)} />
                  </div>
                )}
                {active && method === 'sipi' && (
                  <div className="space-y-3 border-t border-zinc-100 px-4 pb-4 pt-3">
                    <Field label="URL del QR de Sipi" value={form.sipi_qr_url} onChange={v => set('sipi_qr_url', v)} placeholder="https://..." />
                    <Field label="Nombre de cuenta"   value={form.sipi_account_name} onChange={v => set('sipi_account_name', v)} />
                  </div>
                )}
                {active && method === 'transfer' && (
                  <div className="space-y-3 border-t border-zinc-100 px-4 pb-4 pt-3">
                    <Field label="Banco"               value={form.transfer_bank} onChange={v => set('transfer_bank', v)} placeholder="Banco Pichincha" />
                    <Field label="Número de cuenta"    value={form.transfer_account_number} onChange={v => set('transfer_account_number', v)} />
                    <Field label="Titular de la cuenta" value={form.transfer_account_name} onChange={v => set('transfer_account_name', v)} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Save */}
      <div className="pt-2">
        {errorMsg && <p className="mb-3 text-sm text-red-600">{errorMsg}</p>}
        {saved    && <p className="mb-3 text-sm text-emerald-600">✓ Cambios guardados</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

// ─── small helpers ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{children}</h2>
  )
}

function RadioCard({ active, onClick, label, desc, extra }: {
  active: boolean; onClick: () => void
  label: string; desc: string; extra?: ReactNode
}) {
  return (
    <div className={`rounded-xl border-2 transition-colors ${active ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200'}`}>
      <button type="button" onClick={onClick} className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
          active ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-300'
        }`}>
          {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <div>
          <div className="text-sm font-semibold text-zinc-900">{label}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{desc}</div>
        </div>
      </button>
      {active && extra && <div className="px-4 pb-4">{extra}</div>}
    </div>
  )
}

function RateInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-600">{label}:</span>
      <div className="relative w-24">
        <input
          type="number" min="0" max="100" step="1"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 pr-8 text-sm text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-zinc-400">%</span>
      </div>
      {hint && <span className="text-xs text-zinc-400">{hint}</span>}
    </div>
  )
}

function FixedInput({ sym, value, onChange }: { sym: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-600">Tarifa fija:</span>
      <div className="relative w-28">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-zinc-400">{sym}</span>
        <input
          type="number" min="0" step="0.01"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="1.00"
          className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 pl-7 text-sm text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
    </div>
  )
}

function ToggleCard({ active, onClick, label, desc }: { active: boolean; onClick: () => void; label: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${active ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200 hover:border-zinc-300'}`}
    >
      <span className={`mt-0.5 flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${active ? 'bg-emerald-500' : 'bg-zinc-300'}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      <div>
        <div className="text-sm font-semibold text-zinc-900">{label}</div>
        <div className="text-xs text-zinc-500 mt-0.5">{desc}</div>
      </div>
    </button>
  )
}

function PreviewRow({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-zinc-900' : muted ? 'text-zinc-400' : 'text-zinc-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  )
}
