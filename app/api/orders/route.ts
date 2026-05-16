import { createServiceClient } from '@/lib/supabase/server'
import { getRestaurant } from '@/lib/restaurant'
import { calcBreakdown } from '@/lib/pricing'
import type { PaymentMethod } from '@/lib/types'
import { NextRequest } from 'next/server'

const VALID_PAYMENT_METHODS: PaymentMethod[] = ['deuna', 'sipi', 'transfer', 'cash', 'card']

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 })

  const { sessionId, orderType, tableNumber, paymentMethod, items } = body

  if (!sessionId || !orderType || !paymentMethod || !Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!['mesa', 'llevar'].includes(orderType)) {
    return Response.json({ error: 'Invalid orderType' }, { status: 400 })
  }
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    return Response.json({ error: 'Invalid paymentMethod' }, { status: 400 })
  }

  const restaurant = await getRestaurant()
  if (!restaurant.accepted_payment_methods.includes(paymentMethod)) {
    return Response.json({ error: 'Payment method not accepted by this restaurant' }, { status: 422 })
  }

  const supabase = createServiceClient()

  const menuItemIds: string[] = items.map((i: { menuItemId: string }) => i.menuItemId)
  const { data: dbItems, error: itemsErr } = await supabase
    .from('menu_items')
    .select('id, price, name, available')
    .in('id', menuItemIds)
    .eq('available', true)

  if (itemsErr || !dbItems) {
    return Response.json({ error: 'Failed to fetch menu items' }, { status: 500 })
  }

  if (dbItems.length !== menuItemIds.length) {
    return Response.json({ error: 'One or more items are unavailable or invalid' }, { status: 422 })
  }

  const priceMap = new Map(dbItems.map(i => [i.id, i]))

  let rawSubtotal = 0
  const orderItems = items.map((i: { menuItemId: string; quantity: number }) => {
    const item = priceMap.get(i.menuItemId)!
    const lineTotal = item.price * i.quantity
    rawSubtotal += lineTotal
    return {
      menu_item_id: i.menuItemId,
      name: item.name,
      price: item.price,
      quantity: i.quantity,
      subtotal: lineTotal,
    }
  })

  const { subtotal, taxAmount, serviceFeeAmount, total } = calcBreakdown(rawSubtotal, restaurant)

  // In-person payments (cash/card) get 4-hour expiry — customer is physically present
  const isInPerson = paymentMethod === 'cash' || paymentMethod === 'card'
  const expiresAt = isInPerson
    ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
    : undefined

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      session_id: sessionId,
      order_type: orderType,
      table_number: orderType === 'mesa' ? tableNumber ?? null : null,
      payment_method: paymentMethod,
      status: 'pending_payment',
      subtotal,
      tax_amount: taxAmount,
      service_fee_amount: serviceFeeAmount,
      total,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    })
    .select('id, order_number, total, expires_at')
    .single()

  if (orderErr || !order) {
    return Response.json({ error: 'Failed to create order' }, { status: 500 })
  }

  const { error: lineErr } = await supabase
    .from('order_items')
    .insert(orderItems.map(li => ({ ...li, order_id: order.id })))

  if (lineErr) {
    await supabase.from('orders').delete().eq('id', order.id)
    return Response.json({ error: 'Failed to save order items' }, { status: 500 })
  }

  return Response.json({
    orderId: order.id,
    orderNumber: order.order_number,
    total: order.total,
    expiresAt: order.expires_at,
  })
}
