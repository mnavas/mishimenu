import type { Order, OrderStatus } from '@/lib/types'

const steps: { label: string; statuses: OrderStatus[] }[] = [
  { label: 'Pedido recibido',       statuses: ['pending_payment', 'receipt_received', 'ocr_processing', 'verified'] },
  { label: 'Comprobante enviado',   statuses: ['receipt_received', 'ocr_processing', 'verified'] },
  { label: 'Verificando pago',      statuses: ['ocr_processing', 'verified'] },
  { label: 'En preparación',        statuses: ['verified'] },
]

function stepState(status: OrderStatus, stepStatuses: OrderStatus[]): 'done' | 'active' | 'pending' {
  if (status === 'rejected') return 'pending'
  const idx = steps.findIndex(s => s.statuses.includes(status))
  const stepIdx = steps.findIndex(s => s.statuses === stepStatuses)
  if (idx > stepIdx) return 'done'
  if (idx === stepIdx) return 'active'
  return 'pending'
}

export default function OrderStatusTimeline({ order }: { order: Order }) {
  const rejected = order.status === 'rejected'
  const verified = order.status === 'verified'

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 space-y-4">
      <h3 className="font-semibold text-zinc-900 text-center">Estado de tu pedido</h3>

      {rejected ? (
        <div className="rounded-xl bg-red-50 p-4 text-center text-red-700">
          <p className="font-semibold">Pago rechazado</p>
          <p className="text-sm mt-1">Contacta al restaurante para más información.</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {steps.map((step, i) => {
            const state = stepState(order.status, step.statuses)
            return (
              <li key={i} className="flex items-center gap-3">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  state === 'done'   ? 'bg-emerald-600 text-white' :
                  state === 'active' ? 'bg-amber-400 text-white animate-pulse' :
                                       'bg-zinc-100 text-zinc-400'
                }`}>
                  {state === 'done' ? '✓' : i + 1}
                </div>
                <span className={`text-sm ${state === 'pending' ? 'text-zinc-400' : 'text-zinc-900 font-medium'}`}>
                  {step.label}
                </span>
                {state === 'active' && order.status === 'ocr_processing' && i === 2 && (
                  <span className="text-xs text-amber-600 ml-auto">Procesando…</span>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {verified && (
        <div className="rounded-xl bg-emerald-50 p-3 text-center text-sm text-emerald-700 font-medium">
          ✅ ¡Pago confirmado! Tu pedido está en camino.
        </div>
      )}
    </div>
  )
}
