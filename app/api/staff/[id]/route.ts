import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

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
  if (profile && !profile.is_admin) return null
  return user
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const admin = await requireAdmin(cookieStore)
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed = ['name', 'can_menu', 'can_payment', 'can_kitchen', 'is_admin']
  const update = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('staff_profiles')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const admin = await requireAdmin(cookieStore)
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()

  // Get user_id from profile
  const { data: profile } = await supabase.from('staff_profiles').select('user_id').eq('id', id).single()
  if (!profile) return Response.json({ error: 'Not found' }, { status: 404 })

  // Delete from GoTrue
  const supa_url = process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  const svc_key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY!
  await fetch(`${supa_url}/auth/v1/admin/users/${profile.user_id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${svc_key}`, apikey: svc_key },
  })

  // Delete profile (cascade will clean up if FK added later)
  await supabase.from('staff_profiles').delete().eq('id', id)

  return Response.json({ ok: true })
}
