'use client'

import type { Restaurant } from '@/lib/types'

interface Props {
  restaurant: Restaurant
}

export default function SipiPayment({ restaurant }: Props) {
  if (!restaurant.sipi_qr_url && !restaurant.sipi_account_name) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        Sipi no está configurado en este restaurante. Elige otro método de pago.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {restaurant.sipi_qr_url && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white border border-zinc-200 p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Código QR Sipi</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={restaurant.sipi_qr_url}
            alt="QR de pago Sipi"
            className="w-52 h-52 object-contain"
          />
          {restaurant.sipi_account_name && (
            <p className="text-sm font-medium text-zinc-700">{restaurant.sipi_account_name}</p>
          )}
        </div>
      )}

      {!restaurant.sipi_qr_url && restaurant.sipi_account_name && (
        <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4 text-center space-y-1">
          <p className="text-xs text-zinc-500">Cuenta Sipi</p>
          <p className="font-semibold text-zinc-900">{restaurant.sipi_account_name}</p>
        </div>
      )}

      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
        <strong>Pasos:</strong> Abre Sipi → Escanea el QR → Ingresa el monto → Confirma → Comparte el comprobante.
      </div>
    </div>
  )
}
