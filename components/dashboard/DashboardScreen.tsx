'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Order, Restaurant, StaffProfile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import DashboardStats from './DashboardStats'
import OrderCard from './OrderCard'
import FraudAlert from './FraudAlert'
import { showToast } from '@/components/ui/Toast'

interface Props {
  restaurant: Restaurant
  initialOrders: Order[]
  profile: StaffProfile | null
}

export default function DashboardScreen({ restaurant, initialOrders, profile }: Props) {
  const isAdmin = !profile || profile.is_admin
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
  const supabase = createClient()
  const policy = restaurant.payment_policy

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-orders')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
      }, payload => {
        if (payload.eventType === 'INSERT') {
          const incoming = payload.new as Order
          setOrders(prev => [incoming, ...prev])
          setNewOrderIds(prev => new Set(prev).add(incoming.id))
          setTimeout(() => setNewOrderIds(prev => { const n = new Set(prev); n.delete(incoming.id); return n }), 2000)
        } else if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...(payload.new as Order) } : o))
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'receipts',
      }, payload => {
        const updated = payload.new as { order_id: string } & Record<string, unknown>
        setOrders(prev => prev.map(o =>
          o.id === updated.order_id ? { ...o, receipt: updated as unknown as Order['receipt'] } : o
        ))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const scrollToOrder = useCallback((orderId: string) => {
    const el = document.getElementById(`order-${orderId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  async function handleVerify(orderId: string, overrideReason?: string) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'verified', ...(overrideReason ? { overrideReason } : {}) }),
    })
    if (!res.ok) {
      const d = await res.json()
      showToast({ text: d.error ?? 'Error al verificar', type: 'error' })
    }
  }

  async function handleReject(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    })
    if (!res.ok) {
      const d = await res.json()
      showToast({ text: d.error ?? 'Error al rechazar', type: 'error' })
    }
  }

  const active = orders.filter(o => o.status !== 'expired' && o.status !== 'completed')

  // Upfront: two sections — pending verification (must act before kitchen), then verified (in kitchen)
  // At-end: one section — all active orders (kitchen started at order time, collect payment later)
  const verificationQueue = active.filter(
    o => o.status === 'receipt_received' ||
         o.status === 'ocr_processing' ||
         (o.status === 'pending_payment' && o.payment_method === 'cash') ||
         (policy === 'upfront' && o.status === 'pending_payment' && o.payment_method !== 'cash')
  )

  const kitchenQueue = policy === 'upfront'
    ? active.filter(o => o.status === 'verified')
    : active.filter(o => o.status !== 'rejected')

  const renderCard = (order: Order) => (
    <OrderCard
      key={order.id}
      order={order}
      policy={policy}
      currencySymbol={restaurant.currency_symbol ?? '$'}
      isNew={newOrderIds.has(order.id)}
      onVerify={handleVerify}
      onReject={handleReject}
    />
  )

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">{restaurant.name}</h1>
          <p className="text-sm text-zinc-500">Panel de órdenes</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
            policy === 'upfront'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {policy === 'upfront' ? '🔒 Pago anticipado' : '🍽️ Pago al final'}
          </span>
          {(isAdmin || profile?.can_kitchen) && restaurant.kitchen_enabled && (
            <Link
              href="/dashboard/kitchen"
              className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-zinc-100 px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-200 hover:text-zinc-800"
              title="Cocina"
            >
              👨‍🍳 Cocina
            </Link>
          )}
          {(isAdmin || profile?.can_menu) && (
            <Link
              href="/dashboard/menu"
              className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-zinc-100 px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-200 hover:text-zinc-800"
              title="Editar carta"
            >
              🍽️ Carta
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/dashboard/users"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
              title="Usuarios"
            >
              👥
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/dashboard/settings"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
              title="Configuración"
            >
              ⚙️
            </Link>
          )}
        </div>
      </div>

      <DashboardStats orders={active} currencySymbol={restaurant.currency_symbol ?? '$'} />
      <FraudAlert orders={active} onScrollTo={scrollToOrder} />

      {active.length === 0 && (
        <p className="text-center text-zinc-400 py-10">No hay órdenes activas.</p>
      )}

      {policy === 'upfront' ? (
        <>
          {verificationQueue.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
                Pendientes de verificación
              </h2>
              {verificationQueue.map(renderCard)}
            </section>
          )}
          {kitchenQueue.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
                En cocina
              </h2>
              {kitchenQueue.map(renderCard)}
            </section>
          )}
        </>
      ) : (
        /* at_end: single list, all active. Badges show per-card payment status. */
        kitchenQueue.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
              Órdenes activas
            </h2>
            {kitchenQueue.map(renderCard)}
          </section>
        )
      )}
    </div>
  )
}
