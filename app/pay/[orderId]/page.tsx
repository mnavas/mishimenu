import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getRestaurant } from '@/lib/restaurant'
import PaymentScreen from '@/components/payment/PaymentScreen'

export const dynamic = 'force-dynamic'

export default async function PayPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const [restaurant, supabase] = [await getRestaurant(), createServiceClient()]

  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(*), receipt:receipts(*)')
    .eq('id', orderId)
    .single()

  if (!order) notFound()

  if (order.status === 'expired') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="text-4xl">⏰</span>
        <h1 className="text-xl font-bold text-zinc-900">Pedido expirado</h1>
        <p className="text-zinc-500">Este pedido ya no está disponible.</p>
        <a
          href="/"
          className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Volver al menú
        </a>
      </div>
    )
  }

  return <PaymentScreen restaurant={restaurant} order={order} />
}
