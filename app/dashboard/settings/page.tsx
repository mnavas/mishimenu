import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getRestaurant } from '@/lib/restaurant'
import RestaurantSettings from '@/components/dashboard/RestaurantSettings'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch { /* headers already sent */ }
        },
      },
    }
  )

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) redirect('/dashboard/login')

  const restaurant = await getRestaurant()
  return <RestaurantSettings restaurant={restaurant} />
}
