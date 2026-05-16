import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import type { StaffProfile } from './types'

// Returns the staff profile for the currently authenticated user.
// Users with no row in staff_profiles are treated as admins (install-time accounts).
export async function getProfile(): Promise<StaffProfile | null> {
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
  if (!user) return null

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!data) {
    // No profile row → original install user → treat as admin
    return {
      id: '',
      user_id: user.id,
      name: user.email ?? '',
      can_menu: true,
      can_payment: true,
      can_kitchen: true,
      is_admin: true,
      created_at: '',
      email: user.email,
    }
  }

  return { ...data, email: user.email } as StaffProfile
}

export function isAdmin(profile: StaffProfile | null): boolean {
  return profile === null || profile.is_admin
}
