import type { Restaurant } from '@/lib/types'

export default function DeUnaQR({ restaurant }: { restaurant: Restaurant }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 text-center space-y-3">
      <p className="text-sm font-medium text-zinc-500">Escanea el QR con DeUna</p>
      {restaurant.deuna_qr_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={restaurant.deuna_qr_url}
          alt="DeUna QR"
          className="mx-auto h-52 w-52 rounded-xl object-contain"
        />
      ) : (
        <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 text-sm">
          QR no configurado
        </div>
      )}
      {restaurant.deuna_account_name && (
        <p className="text-sm font-semibold text-zinc-900">{restaurant.deuna_account_name}</p>
      )}
      <p className="text-xs text-zinc-400">
        Abre DeUna → Escanear QR → Pega el monto exacto → Paga
      </p>
    </div>
  )
}
