import { getRestaurant } from '@/lib/restaurant'

export async function GET() {
  const restaurant = await getRestaurant()
  return Response.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address,
    // Payment config — used by native app to show correct payment UI
    payment_policy: restaurant.payment_policy,
    accepted_payment_methods: restaurant.accepted_payment_methods,
    // DeUna
    deuna_qr_url: restaurant.deuna_qr_url,
    deuna_account_name: restaurant.deuna_account_name,
    // Sipi
    sipi_qr_url: restaurant.sipi_qr_url,
    sipi_account_name: restaurant.sipi_account_name,
    // Bank transfer
    transfer_bank: restaurant.transfer_bank,
    transfer_account_number: restaurant.transfer_account_number,
    transfer_account_name: restaurant.transfer_account_name,
  })
}
