import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import MenuEditor from '@/components/dashboard/MenuEditor'
import type { Category, MenuItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function MenuPage() {
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

  const supabase = createServiceClient()
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order').order('name'),
    supabase.from('menu_items').select('*').order('sort_order').order('name'),
  ])

  return (
    <MenuEditor
      initialCategories={(categories ?? []) as Category[]}
      initialItems={(items ?? []) as MenuItem[]}
    />
  )
}
