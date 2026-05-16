import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import Link from 'next/link'
import { getProfile } from '@/lib/getProfile'
import { createServiceClient } from '@/lib/supabase/server'
import UserManagement from '@/components/dashboard/UserManagement'
import type { StaffProfile } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
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
          } catch { /* */ }
        },
      },
    }
  )

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) redirect('/dashboard/login')

  const profile = await getProfile()
  if (profile && !profile.is_admin) redirect('/dashboard')

  // Fetch all staff + their emails via GoTrue admin API
  const supa_url = process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  const svc_key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY!

  const supabase = createServiceClient()
  const [profilesRes, usersRes] = await Promise.all([
    supabase.from('staff_profiles').select('*').order('created_at'),
    fetch(`${supa_url}/auth/v1/admin/users?per_page=200`, {
      headers: { Authorization: `Bearer ${svc_key}`, apikey: svc_key },
    }),
  ])

  const profiles: StaffProfile[] = profilesRes.data ?? []
  let authUsers: { id: string; email: string }[] = []
  if (usersRes.ok) {
    const body = await usersRes.json()
    authUsers = body.users ?? []
  }
  const emailMap = Object.fromEntries(authUsers.map(u => [u.id, u.email]))
  const staffWithEmail = profiles.map(p => ({ ...p, email: emailMap[p.user_id] ?? '' }))

  return (
    <div>
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700">
          ← Dashboard
        </Link>
      </div>
      <UserManagement initialStaff={staffWithEmail} />
    </div>
  )
}
