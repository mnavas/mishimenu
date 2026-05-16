'use client'

import type { Restaurant } from '@/lib/types'

interface Props {
  restaurant: Restaurant
  total: number
}

export default function TransferPayment({ restaurant, total }: Props) {
  if (!restaurant.transfer_bank && !restaurant.transfer_account_number) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        Transferencia bancaria no está configurada. Elige otro método de pago.
      </div>
    )
  }

  function copyField(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4 space-y-3">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Datos para transferencia</p>

        {restaurant.transfer_bank && (
          <Row label="Banco" value={restaurant.transfer_bank} />
        )}
        {restaurant.transfer_account_name && (
          <Row label="Beneficiario" value={restaurant.transfer_account_name} />
        )}
        {restaurant.transfer_account_number && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">N° de cuenta</p>
              <p className="font-mono font-semibold text-zinc-900">{restaurant.transfer_account_number}</p>
            </div>
            <button
              onClick={() => copyField(restaurant.transfer_account_number!)}
              className="text-xs text-emerald-700 hover:underline"
            >
              Copiar
            </button>
          </div>
        )}

        <div className="border-t border-zinc-200 pt-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500">Monto a transferir</p>
            <p className="text-2xl font-bold text-emerald-700">{restaurant.currency_symbol ?? '$'}{Number(total).toFixed(2)}</p>
          </div>
          <button
            onClick={() => copyField(Number(total).toFixed(2))}
            className="text-xs text-emerald-700 hover:underline"
          >
            Copiar monto
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
        Realiza la transferencia y sube el comprobante de pago.
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-medium text-zinc-900">{value}</p>
    </div>
  )
}
