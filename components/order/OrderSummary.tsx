'use client'

import { useState } from 'react'
import type { Restaurant, CartItem, OrderType, PaymentMethod } from '@/lib/types'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import { calcBreakdown } from '@/lib/pricing'
import { Button } from '@/components/ui/Button'
import OrderTypeSelector from './OrderTypeSelector'
import { getOrCreateSessionId } from '@/lib/session'
import { showToast } from '@/components/ui/Toast'

const METHOD_ICONS: Record<PaymentMethod, string> = {
  deuna:    '🟢',
  sipi:     '📱',
  transfer: '🏦',
  cash:     '💵',
  card:     '💳',
}

const METHOD_DESC: Record<PaymentMethod, string> = {
  deuna:    'Billetera Pichincha',
  sipi:     'Billetera digital',
  transfer: 'Transferencia bancaria',
  cash:     'Pago en caja',
  card:     'Datáfono / terminal',
}

interface Props {
  restaurant: Restaurant
  cart: CartItem[]
  onClose: () => void
  onOrderCreated: (orderId: string) => void
}

export default function OrderSummary({ restaurant, cart, onClose, onOrderCreated }: Props) {
  const [orderType, setOrderType] = useState<OrderType>('mesa')
  const [tableNumber, setTableNumber] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    restaurant.accepted_payment_methods[0] ?? 'cash'
  )
  const [loading, setLoading] = useState(false)

  const rawSubtotal = cart.reduce((s, c) => s + Number(c.price) * c.quantity, 0)
  const { subtotal, taxAmount, serviceFeeAmount, total } = calcBreakdown(rawSubtotal, restaurant)
  const methods = restaurant.accepted_payment_methods

  async function handleSubmit() {
    if (orderType === 'mesa' && !tableNumber.trim()) {
      showToast({ text: 'Ingresa el número de mesa', type: 'error' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: getOrCreateSessionId(),
          orderType,
          tableNumber: orderType === 'mesa' ? tableNumber.trim() : undefined,
          paymentMethod,
          items: cart.map(c => ({ menuItemId: c.id, quantity: c.quantity })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear pedido')
      onOrderCreated(data.orderId)
    } catch (err) {
      showToast({ text: (err as Error).message, type: 'error' })
      setLoading(false)
    }
  }

  const sym = restaurant.currency_symbol ?? '$'
  const isInPersonPayment = paymentMethod === 'cash' || paymentMethod === 'card'
  const submitLabel = isInPersonPayment
    ? `Confirmar — ${paymentMethod === 'card' ? 'Pagar con tarjeta' : 'Pagar en caja'} ${sym}${total.toFixed(2)}`
    : `Confirmar — ${sym}${total.toFixed(2)}`

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900">
          ← Volver
        </button>
        <h2 className="flex-1 text-center font-semibold text-zinc-900">Tu pedido</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Items */}
        <div className="space-y-2">
          {cart.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-zinc-700">{item.quantity}× {item.name}</span>
              <span className="font-medium text-zinc-900">{sym}{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-100 pt-3 space-y-1.5">
          {restaurant.show_price_breakdown && (taxAmount > 0 || serviceFeeAmount > 0) && (
            <div className="flex justify-between text-sm text-zinc-500">
              <span>Subtotal</span>
              <span>{sym}{subtotal.toFixed(2)}</span>
            </div>
          )}
          {restaurant.show_price_breakdown && taxAmount > 0 && (
            <div className="flex justify-between text-sm text-zinc-500">
              <span>IVA ({Math.round(restaurant.tax_rate * 100)}%)</span>
              <span>{sym}{taxAmount.toFixed(2)}</span>
            </div>
          )}
          {restaurant.show_price_breakdown && serviceFeeAmount > 0 && (
            <div className="flex justify-between text-sm text-zinc-500">
              <span>Servicio ({Math.round(restaurant.service_fee_rate * 100)}%)</span>
              <span>{sym}{serviceFeeAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold pt-1 border-t border-zinc-100">
            <span>Total</span>
            <span className="text-emerald-700">{sym}{total.toFixed(2)}</span>
          </div>
        </div>

        {/* Order type */}
        <OrderTypeSelector
          value={orderType}
          onChange={setOrderType}
          tableNumber={tableNumber}
          onTableChange={setTableNumber}
        />

        {/* Payment method */}
        {methods.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-700">Método de pago</p>
            <div className="grid grid-cols-2 gap-2">
              {methods.map(m => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                    paymentMethod === m
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  <span className="text-lg">{METHOD_ICONS[m]}</span>
                  <div>
                    <p className="font-medium leading-tight">{PAYMENT_METHOD_LABELS[m]}</p>
                    <p className="text-xs text-zinc-500 leading-tight">{METHOD_DESC[m]}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-8 pt-3 border-t border-zinc-100">
        <Button
          onClick={handleSubmit}
          loading={loading}
          size="lg"
          className="w-full"
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
