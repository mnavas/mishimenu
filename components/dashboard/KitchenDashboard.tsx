'use client'

import { useEffect, useState } from 'react'
import type { Order, Restaurant } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { showToast } from '@/components/ui/Toast'

interface Props {
  restaurant: Restaurant
  initialOrders: Order[]
}

export default function KitchenDashboard({ restaurant, initialOrders }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        const o = payload.new as Order
        if (o.status === 'verified') {
          setOrders(prev => [o, ...prev])
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        const o = payload.new as Order
        if (o.status === 'completed' || o.status === 'rejected') {
          setOrders(prev => prev.filter(x => x.id !== o.id))
        } else if (o.status === 'verified') {
          setOrders(prev => {
            const exists = prev.find(x => x.id === o.id)
            return exists ? prev.map(x => x.id === o.id ? { ...x, ...o } : x) : [o, ...prev]
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  async function handleDone(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    if (res.ok) {
      setOrders(prev => prev.filter(o => o.id !== orderId))
    } else {
      const d = await res.json()
      showToast({ text: d.error ?? 'Error', type: 'error' })
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">{restaurant.name}</h1>
            <p className="text-sm text-zinc-400">Cocina</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${orders.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-zinc-600'}`} />
            <span className="text-sm text-zinc-400">
              {orders.length === 0 ? 'Sin pedidos' : `${orders.length} pedido${orders.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <span className="text-5xl mb-4">🍳</span>
            <p className="text-lg">Sin pedidos en cocina</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <KitchenCard key={order.id} order={order} onDone={handleDone} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KitchenCard({ order, onDone }: { order: Order; onDone: (id: string) => void }) {
  const [loading, setLoading] = useState(false)
  const waitMinutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)

  async function handleClick() {
    setLoading(true)
    await onDone(order.id)
    setLoading(false)
  }

  return (
    <div className="rounded-2xl bg-zinc-800 border border-zinc-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-black text-white">#{order.order_number}</span>
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              {order.order_type === 'mesa' ? `Mesa ${order.table_number}` : 'Para llevar'}
            </p>
            <p className="text-xs text-zinc-400">
              {waitMinutes === 0 ? 'Ahora mismo' : `Hace ${waitMinutes} min`}
            </p>
          </div>
        </div>
        <button
          onClick={handleClick}
          disabled={loading}
          className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50"
        >
          {loading ? '…' : '✓ Listo'}
        </button>
      </div>
      <ul className="px-5 py-4 space-y-2">
        {(order.order_items ?? []).map(item => (
          <li key={item.id} className="flex items-baseline gap-3">
            <span className="text-2xl font-black text-amber-400 w-7 text-right flex-shrink-0">
              {item.quantity}×
            </span>
            <span className="text-base font-medium text-zinc-100">{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
