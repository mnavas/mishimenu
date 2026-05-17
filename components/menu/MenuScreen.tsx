'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Restaurant, Category, MenuItem, CartItem } from '@/lib/types'
import MenuCategory from './MenuCategory'
import CartBar from './CartBar'
import OrderSummary from '@/components/order/OrderSummary'

interface Props {
  restaurant: Restaurant
  categories: Category[]
  menuItems: MenuItem[]
}

export default function MenuScreen({ restaurant, categories, menuItems }: Props) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [showSummary, setShowSummary] = useState(false)
  const router = useRouter()

  function addItem(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { ...item, quantity: 1 }]
    })
  }

  function removeItem(itemId: string) {
    setCart(prev => {
      const existing = prev.find(c => c.id === itemId)
      if (!existing) return prev
      if (existing.quantity === 1) return prev.filter(c => c.id !== itemId)
      return prev.map(c => c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  function getQty(itemId: string) {
    return cart.find(c => c.id === itemId)?.quantity ?? 0
  }

  async function handleOrderCreated(orderId: string) {
    setShowSummary(false)
    router.push(`/pay/${orderId}`)
  }

  const itemsByCategory = categories.map(cat => ({
    category: cat,
    items: menuItems.filter(item => item.category_id === cat.id),
  })).filter(g => g.items.length > 0)

  const uncategorized = menuItems.filter(item => !item.category_id)

  return (
    <div className="mx-auto max-w-2xl pb-32">
      <div className="sticky top-0 z-10 bg-white/90 px-4 py-3 backdrop-blur-sm shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">{restaurant.name}</h1>
        {restaurant.address && (
          <p className="text-sm text-zinc-500">{restaurant.address}</p>
        )}
      </div>

      <div className="px-4 pt-4 space-y-6">
        {itemsByCategory.length === 0 && uncategorized.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <span className="text-5xl">🍽️</span>
            <p className="font-semibold text-zinc-700">La carta está siendo preparada</p>
            <p className="text-sm text-zinc-400">En breve estará disponible. Pide al personal si necesitas ayuda.</p>
          </div>
        ) : (
          <>
            {itemsByCategory.map(({ category, items }) => (
              <MenuCategory
                key={category.id}
                category={category}
                items={items}
                restaurant={restaurant}
                getQty={getQty}
                onAdd={addItem}
                onRemove={removeItem}
              />
            ))}
            {uncategorized.length > 0 && (
              <MenuCategory
                category={{ id: 'uncategorized', name: 'Otros', sort_order: 99 }}
                items={uncategorized}
                restaurant={restaurant}
                getQty={getQty}
                onAdd={addItem}
                onRemove={removeItem}
              />
            )}
          </>
        )}
      </div>

      {cart.length > 0 && (
        <CartBar cart={cart} restaurant={restaurant} onOpen={() => setShowSummary(true)} />
      )}

      {showSummary && (
        <OrderSummary
          restaurant={restaurant}
          cart={cart}
          onClose={() => setShowSummary(false)}
          onOrderCreated={handleOrderCreated}
        />
      )}
    </div>
  )
}
