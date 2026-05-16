import type { CartItem, Restaurant } from '@/lib/types'
import { calcBreakdown } from '@/lib/pricing'
import { Button } from '@/components/ui/Button'

interface Props {
  cart: CartItem[]
  restaurant: Restaurant
  onOpen: () => void
}

export default function CartBar({ cart, restaurant, onOpen }: Props) {
  const totalItems = cart.reduce((s, c) => s + c.quantity, 0)
  const subtotal   = cart.reduce((s, c) => s + Number(c.price) * c.quantity, 0)
  const { total }  = calcBreakdown(subtotal, restaurant)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-6">
      <Button
        onClick={onOpen}
        size="lg"
        className="w-full max-w-2xl mx-auto flex justify-between shadow-xl"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
          {totalItems}
        </span>
        <span>Ver pedido</span>
        <span>{restaurant.currency_symbol ?? '$'}{total.toFixed(2)}</span>
      </Button>
    </div>
  )
}
