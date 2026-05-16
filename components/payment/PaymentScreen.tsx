'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Restaurant, Order } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import DeUnaQR from './DeUnaQR'
import SipiPayment from './SipiPayment'
import TransferPayment from './TransferPayment'
import CashPayment from './CashPayment'
import CardPayment from './CardPayment'
import AmountCopy from './AmountCopy'
import ReceiptUpload from './ReceiptUpload'
import OrderStatusTimeline from './OrderStatusTimeline'

interface Props {
  restaurant: Restaurant
  order: Order
}

export default function PaymentScreen({ restaurant, order: initialOrder }: Props) {
  const [order, setOrder] = useState<Order>(initialOrder)
  const sym = restaurant.currency_symbol ?? '$'
  const [submitted, setSubmitted] = useState(
    initialOrder.status !== 'pending_payment'
  )
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  // Cash and card are both in-person payments: no receipt, no countdown
  const isInPersonPayment = order.payment_method === 'cash' || order.payment_method === 'card'

  // Auto-copy amount to clipboard for digital payment methods
  useEffect(() => {
    if (!isInPersonPayment) {
      navigator.clipboard.writeText(order.total.toFixed(2)).catch(() => {})
    }
  }, [order.total, isInPersonPayment])

  useEffect(() => {
    if (isInPersonPayment) return // in-person orders don't show a countdown
    const expiresAt = new Date(order.expires_at).getTime()
    function tick() {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      setTimeLeft(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [order.expires_at, isInPersonPayment])

  const supabase = createClient()
  useEffect(() => {
    const channel = supabase
      .channel(`order-${order.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        payload => setOrder(payload.new as Order)
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [order.id, supabase])

  const handleReceiptSubmitted = useCallback(() => setSubmitted(true), [])

  const expired = !isInPersonPayment && (order.status === 'expired' || (timeLeft !== null && timeLeft === 0 && !submitted))
  const warnExpiry = !isInPersonPayment && timeLeft !== null && timeLeft <= 120 && timeLeft > 0 && !submitted

  if (expired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="text-4xl">⏰</span>
        <h1 className="text-xl font-bold text-zinc-900">Pedido expirado</h1>
        <p className="text-zinc-500">No se recibió el comprobante a tiempo.</p>
        <a
          href="/"
          className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Volver al menú
        </a>
      </div>
    )
  }

  const isVerifiedOrRejected = order.status === 'verified' || order.status === 'rejected'

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-6">
      <div className="text-center">
        <h1 className="text-lg font-bold text-zinc-900">{restaurant.name}</h1>
        <p className="text-sm text-zinc-500">Pedido #{order.order_number}</p>
      </div>

      {warnExpiry && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 text-center border border-amber-200">
          ⚠️ El pedido expira en {Math.floor(timeLeft! / 60)}:{String(timeLeft! % 60).padStart(2, '0')}
        </div>
      )}

      {/* Show payment UI until verified/rejected, then show timeline only */}
      {!isVerifiedOrRejected && !submitted && (
        <>
          {order.payment_method === 'deuna' && (
            <>
              <DeUnaQR restaurant={restaurant} />
              <AmountCopy total={order.total} currencySymbol={sym} />
            </>
          )}
          {order.payment_method === 'sipi' && (
            <>
              <SipiPayment restaurant={restaurant} />
              <AmountCopy total={order.total} currencySymbol={sym} />
            </>
          )}
          {order.payment_method === 'transfer' && (
            <TransferPayment restaurant={restaurant} total={order.total} />
          )}
          {order.payment_method === 'cash' && (
            <CashPayment orderNumber={order.order_number} total={order.total} currencySymbol={sym} />
          )}
          {order.payment_method === 'card' && (
            <CardPayment orderNumber={order.order_number} total={order.total} currencySymbol={sym} />
          )}

          {/* Receipt upload for digital methods only */}
          {!isInPersonPayment && (
            <ReceiptUpload
              orderId={order.id}
              onSubmitted={handleReceiptSubmitted}
            />
          )}
        </>
      )}

      {/* Status timeline — shown after submission or once order has moved past pending */}
      {(submitted || order.status !== 'pending_payment') && (
        <OrderStatusTimeline order={order} />
      )}
    </div>
  )
}
