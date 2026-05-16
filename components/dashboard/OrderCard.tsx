'use client'

import { useState } from 'react'
import type { Order, Receipt, PaymentMethod, PaymentPolicy } from '@/lib/types'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'

interface Props {
  order: Order
  policy: PaymentPolicy
  currencySymbol: string
  onVerify: (id: string, overrideReason?: string) => void
  onReject: (id: string) => void
}

const METHOD_ICONS: Record<PaymentMethod, string> = {
  deuna:    '🟢',
  sipi:     '📱',
  transfer: '🏦',
  cash:     '💵',
  card:     '💳',
}

const borderColors: Record<string, string> = {
  pending_payment:  'border-l-zinc-300',
  receipt_received: 'border-l-amber-400',
  ocr_processing:   'border-l-amber-400',
  verified:         'border-l-emerald-500',
  rejected:         'border-l-red-500',
  fraud:            'border-l-red-600',
}

export default function OrderCard({ order, policy, currencySymbol, onVerify, onReject }: Props) {
  const sym = currencySymbol || '$'
  const receipt = order.receipt as Receipt | undefined
  const isDuplicate = receipt?.is_duplicate
  const borderClass = isDuplicate ? borderColors.fraud : (borderColors[order.status] ?? 'border-l-zinc-300')
  const [overrideInput, setOverrideInput] = useState('')
  const [showOverride, setShowOverride] = useState(false)
  const [loading, setLoading] = useState(false)

  // Cash and card are both in-person: no receipt, staff verifies after collecting payment
  const isInPersonPayment = order.payment_method === 'cash' || order.payment_method === 'card'

  const canVerify =
    (isInPersonPayment && order.status === 'pending_payment') ||
    order.status === 'receipt_received' ||
    order.status === 'ocr_processing'

  const canReject = canVerify

  const amountMatch =
    receipt?.extracted_amount !== null &&
    receipt?.extracted_amount !== undefined &&
    Math.abs(Number(receipt.extracted_amount) - Number(order.total)) <= 0.01

  async function handleVerify() {
    if (isDuplicate && !showOverride) { setShowOverride(true); return }
    if (isDuplicate && !overrideInput.trim()) {
      showToast({ text: 'Escribe el motivo para sobrepasar la alerta', type: 'error' }); return
    }
    setLoading(true)
    onVerify(order.id, isDuplicate ? overrideInput : undefined)
    setLoading(false)
    setShowOverride(false)
  }

  async function handleReject() {
    setLoading(true)
    onReject(order.id)
    setLoading(false)
  }

  // In at_end mode, flag orders still needing payment
  const needsPaymentAtEnd = policy === 'at_end' && order.status === 'pending_payment' && !isInPersonPayment

  return (
    <div
      id={`order-${order.id}`}
      className={`rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100 border-l-4 overflow-hidden ${borderClass}`}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-900">#{order.order_number}</span>
              <span className="text-sm text-zinc-500">
                {order.order_type === 'mesa' ? `Mesa ${order.table_number}` : 'Para llevar'}
              </span>
            </div>
            {order.payment_method && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                {METHOD_ICONS[order.payment_method]} {PAYMENT_METHOD_LABELS[order.payment_method]}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 justify-end">
            <OrderStatusBadge status={order.status} paymentMethod={order.payment_method} />
            {isDuplicate && <Badge variant="danger">Duplicado</Badge>}
            {needsPaymentAtEnd && (
              <Badge variant="warning">Por cobrar</Badge>
            )}
          </div>
        </div>

        {/* Items */}
        <ul className="text-sm text-zinc-600 space-y-0.5">
          {(order.order_items ?? []).map(item => (
            <li key={item.id} className="flex justify-between">
              <span>{item.quantity}× {item.name}</span>
              <span>{sym}{(Number(item.price) * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-between font-semibold text-sm">
          <span>Total pedido</span>
          <span>{sym}{Number(order.total).toFixed(2)}</span>
        </div>

        {/* OCR results (digital methods only) */}
        {receipt && receipt.ocr_status === 'done' && (
          <div className="rounded-xl bg-zinc-50 p-3 space-y-1 text-xs">
            {receipt.extracted_tx_id && (
              <p className="text-zinc-600">🔑 TX: <span className="font-mono font-medium">{receipt.extracted_tx_id}</span></p>
            )}
            {receipt.extracted_amount !== null && (
              <p className={amountMatch ? 'text-emerald-700' : 'text-red-600'}>
                💰 Monto comprobante: {sym}{Number(receipt.extracted_amount).toFixed(2)}
                {amountMatch ? ' ✓' : ' ⚠️ No coincide'}
              </p>
            )}
            {receipt.extracted_sender && (
              <p className="text-zinc-600">👤 {receipt.extracted_sender}</p>
            )}
          </div>
        )}
        {receipt && receipt.ocr_status === 'processing' && (
          <p className="text-xs text-amber-600 animate-pulse">Procesando comprobante…</p>
        )}
        {receipt && receipt.ocr_status === 'failed' && (
          <p className="text-xs text-red-500">OCR falló — verificar imagen manualmente</p>
        )}

        {/* Fraud duplicate info */}
        {isDuplicate && receipt?.duplicate_of_order_id && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            Comprobante ya usado en orden #{receipt.duplicate_of_order_id.slice(0, 8)}…
          </div>
        )}

        {/* Override confirm */}
        {showOverride && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-red-700">Motivo para aprobar (obligatorio):</p>
            <input
              type="text"
              value={overrideInput}
              onChange={e => setOverrideInput(e.target.value)}
              placeholder="Ej: cliente pagó dos veces"
              className="w-full rounded-xl border border-red-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
        )}

        {/* Actions */}
        {canVerify && (
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleVerify}
              loading={loading}
              size="sm"
              variant={isDuplicate ? 'danger' : 'primary'}
              className="flex-1"
            >
              {order.payment_method === 'cash'
                ? '💵 Cobrar en efectivo'
                : order.payment_method === 'card'
                  ? '💳 Cobrar con tarjeta'
                  : isDuplicate && !showOverride
                    ? '⚠️ Sobrepasar'
                    : '✓ Verificar y a cocina'
              }
            </Button>
            <Button
              onClick={handleReject}
              loading={loading}
              size="sm"
              variant="secondary"
              className="flex-1"
            >
              Rechazar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function OrderStatusBadge({ status, paymentMethod }: { status: string; paymentMethod: PaymentMethod | null }) {
  let pendingLabel = 'Esperando pago'
  if (paymentMethod === 'cash') pendingLabel = 'Efectivo pendiente'
  else if (paymentMethod === 'card') pendingLabel = 'Tarjeta pendiente'

  const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
    pending_payment:  { label: pendingLabel,     variant: 'default' },
    receipt_received: { label: 'Por verificar',  variant: 'warning' },
    ocr_processing:   { label: 'Procesando',     variant: 'info' },
    verified:         { label: 'Verificado',      variant: 'success' },
    rejected:         { label: 'Rechazado',       variant: 'danger' },
  }
  const config = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
