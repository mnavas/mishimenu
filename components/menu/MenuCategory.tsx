import Image from 'next/image'
import type { Category, MenuItem, Restaurant } from '@/lib/types'

interface Props {
  category: Category
  items: MenuItem[]
  restaurant: Restaurant
  getQty: (id: string) => number
  onAdd: (item: MenuItem) => void
  onRemove: (id: string) => void
}

export default function MenuCategory({ category, items, restaurant, getQty, onAdd, onRemove }: Props) {
  const taxLabel = restaurant.show_price_breakdown && restaurant.tax_rate > 0
    ? restaurant.tax_included
      ? 'IVA incl.'
      : `+${Math.round(restaurant.tax_rate * 100)}% IVA`
    : null

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-zinc-500 uppercase tracking-wider">
        {category.name}
      </h2>
      <div className="space-y-2">
        {items.map(item => {
          const qty = getQty(item.id)
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-100"
            >
              {item.image_url ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                  <Image src={item.image_url} alt={item.name} fill className="object-cover" unoptimized />
                </div>
              ) : item.emoji ? (
                <span className="text-2xl shrink-0">{item.emoji}</span>
              ) : null}

              <div className="flex-1 min-w-0">
                <p className="font-medium text-zinc-900 truncate">{item.name}</p>
                {item.description && (
                  <p className="text-sm text-zinc-500 truncate">{item.description}</p>
                )}
                <p className="mt-0.5 flex items-baseline gap-1.5 text-sm font-semibold text-emerald-700">
                  ${Number(item.price).toFixed(2)}
                  {taxLabel && (
                    <span className="text-xs font-normal text-zinc-400">{taxLabel}</span>
                  )}
                </p>
              </div>

              {qty === 0 ? (
                <button
                  onClick={() => onAdd(item)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-lg font-bold hover:bg-emerald-700 transition-colors"
                >
                  +
                </button>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => onRemove(item.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 text-lg font-bold hover:bg-zinc-200 transition-colors"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-semibold text-zinc-900">{qty}</span>
                  <button
                    onClick={() => onAdd(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white text-lg font-bold hover:bg-emerald-700 transition-colors"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
