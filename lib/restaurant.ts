import { createServiceClient } from './supabase/server'
import type { Restaurant } from './types'

let _cached: Restaurant | null = null

export async function getRestaurant(): Promise<Restaurant> {
  if (_cached) return _cached
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('restaurant').select('*').single()
  if (error || !data) throw new Error('Restaurant not configured. Run ./mishimenu install first.')
  _cached = data as Restaurant
  return _cached
}

export function clearRestaurantCache(): void {
  _cached = null
}
