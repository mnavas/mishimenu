import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import { getRestaurant } from '@/lib/restaurant'
import { getProfile } from '@/lib/getProfile'
import DashboardScreen from '@/components/dashboard/DashboardScreen'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
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

  const [restaurant, profile] = await Promise.all([getRestaurant(), getProfile()])

  // Redirect kitchen-only users to the kitchen dashboard
  if (profile && !profile.is_admin && !profile.can_payment && profile.can_kitchen) {
    redirect('/dashboard/kitchen')
  }

  const supabase = createServiceClient()
  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*), receipt:receipts(*)')
    .not('status', 'in', '("expired","completed")')
    .order('created_at', { ascending: false })

  return <DashboardScreen restaurant={restaurant} initialOrders={orders ?? []} profile={profile} />
}
