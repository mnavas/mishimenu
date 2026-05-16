import type { Restaurant } from './types'

export interface PriceBreakdown {
  subtotal: number
  taxAmount: number
  serviceFeeAmount: number
  total: number
}

export function calcBreakdown(subtotal: number, restaurant: Restaurant): PriceBreakdown {
  const taxAmount = restaurant.tax_included ? 0 : r2(subtotal * restaurant.tax_rate)
  const serviceFeeAmount = r2(subtotal * restaurant.service_fee_rate + (restaurant.service_fee_fixed ?? 0))
  return {
    subtotal,
    taxAmount,
    serviceFeeAmount,
    total: r2(subtotal + taxAmount + serviceFeeAmount),
  }
}

function r2(n: number): number {
  return Math.round(n * 100) / 100
}
