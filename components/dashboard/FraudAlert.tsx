'use client'

import { useState } from 'react'
import type { Order } from '@/lib/types'

interface Props {
  orders: Order[]
  onScrollTo: (orderId: string) => void
}

export default function FraudAlert({ orders, onScrollTo }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const flagged = orders.filter(o => o.receipt?.is_duplicate)
  if (flagged.length === 0 || dismissed) return null
  const latest = flagged[0]

  return (
    <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-red-800 text-sm">
            ⚠️ {flagged.length} alerta{flagged.length > 1 ? 's' : ''} de comprobante duplicado
          </p>
          <p className="text-xs text-red-600 mt-0.5">
            Última: Orden #{latest.order_number} — comprobante ya usado anteriormente
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-red-400 hover:text-red-600 text-lg leading-none"
          aria-label="Descartar alerta"
        >
          ×
        </button>
      </div>
      <button
        onClick={() => onScrollTo(latest.id)}
        className="text-xs font-medium text-red-700 underline hover:text-red-900"
      >
        Ver orden #{latest.order_number}
      </button>
    </div>
  )
}
