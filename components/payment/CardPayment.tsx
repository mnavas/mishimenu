'use client'

interface Props {
  orderNumber: number
  total: number
  currencySymbol: string
}

export default function CardPayment({ orderNumber, total, currencySymbol }: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-blue-50 border border-blue-200 p-6 text-center space-y-3">
        <div className="text-4xl">💳</div>
        <p className="text-sm font-medium text-blue-800">Pago con tarjeta</p>
        <div className="text-3xl font-bold text-blue-900">{currencySymbol}{Number(total).toFixed(2)}</div>
      </div>

      <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-5 space-y-3 text-center">
        <p className="text-sm text-zinc-500">Tu número de pedido</p>
        <p className="text-5xl font-black text-zinc-900">#{orderNumber}</p>
        <p className="text-sm text-zinc-600">
          Acércate a la caja o espera al mesero.<br />
          El personal procesará el pago con tarjeta.
        </p>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 text-center">
        Tu pedido será confirmado una vez procesado el pago.
      </div>
    </div>
  )
}
