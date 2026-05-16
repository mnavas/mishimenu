import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'

async function requireAdmin(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const supabaseAuth = createServerClient(
    process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return null
  const supabase = createServiceClient()
  const { data: profile } = await supabase.from('staff_profiles').select('is_admin').eq('user_id', user.id).single()
  // No profile row = original install user = admin
  if (profile && !profile.is_admin) return null
  return user
}

export async function GET() {
  const cookieStore = await cookies()
  const user = await requireAdmin(cookieStore)
  if (!user) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  const supa_url = process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  const svc_key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY!

  // Fetch profiles + GoTrue users in parallel
  const [profilesRes, usersRes] = await Promise.all([
    supabase.from('staff_profiles').select('*').order('created_at'),
    fetch(`${supa_url}/auth/v1/admin/users?per_page=200`, {
      headers: { Authorization: `Bearer ${svc_key}`, apikey: svc_key },
    }),
  ])

  const profiles: Record<string, unknown>[] = profilesRes.data ?? []
  let authUsers: { id: string; email: string }[] = []
  if (usersRes.ok) {
    const body = await usersRes.json()
    authUsers = body.users ?? []
  }

  const emailMap = Object.fromEntries(authUsers.map(u => [u.id, u.email]))
  const merged = profiles.map(p => ({ ...p, email: emailMap[p.user_id as string] ?? '' }))

  return Response.json(merged)
}

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const admin = await requireAdmin(cookieStore)
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password, can_menu, can_payment, can_kitchen } = await req.json()
  if (!email || !password) return Response.json({ error: 'Email and password are required' }, { status: 422 })

  const supa_url = process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  const svc_key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY!

  // Create GoTrue user
  const createRes = await fetch(`${supa_url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${svc_key}`,
      apikey: svc_key,
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  if (!createRes.ok) {
    const e = await createRes.json()
    return Response.json({ error: e.msg ?? e.message ?? 'Failed to create user' }, { status: 400 })
  }
  const newUser = await createRes.json()

  // Create staff_profiles row
  const supabase = createServiceClient()
  const { data: profile, error } = await supabase
    .from('staff_profiles')
    .insert({ user_id: newUser.id, name: name ?? email, can_menu: !!can_menu, can_payment: !!can_payment, can_kitchen: !!can_kitchen, is_admin: false })
    .select()
    .single()

  if (error) return Response.json({ error: 'User created but profile insert failed: ' + error.message }, { status: 500 })
  return Response.json({ ...profile, email })
}
