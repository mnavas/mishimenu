import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import { getRestaurant, clearRestaurantCache } from '@/lib/restaurant'

export async function GET() {
  const restaurant = await getRestaurant()
  return Response.json(restaurant)
}

export async function PATCH(req: Request) {
  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('restaurant')
    .update(body)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  clearRestaurantCache()
  return Response.json(data)
}
