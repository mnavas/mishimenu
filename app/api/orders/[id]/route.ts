import { createServiceClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const ALLOWED_STATUSES = ['verified', 'rejected', 'completed']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 })

  const { status } = body
  if (!ALLOWED_STATUSES.includes(status)) {
    return Response.json({ error: `Status must be one of: ${ALLOWED_STATUSES.join(', ')}` }, { status: 422 })
  }

  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { /* */ }
        },
      },
    }
  )

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, payment_method, receipt:receipts(*)')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })

  const receipt = order.receipt as { is_duplicate?: boolean } | null
  const isInPersonPayment = order.payment_method === 'cash' || order.payment_method === 'card'

  if (status === 'verified') {
    if (!isInPersonPayment && order.status === 'pending_payment') {
      return Response.json({ error: 'Cannot verify a digital order without a receipt' }, { status: 422 })
    }
    if (receipt?.is_duplicate && !body.overrideReason) {
      return Response.json({ error: 'Override reason required for duplicate receipts' }, { status: 422 })
    }
  }

  if (status === 'completed' && order.status !== 'verified') {
    return Response.json({ error: 'Only verified orders can be completed' }, { status: 422 })
  }

  const updatePayload: Record<string, unknown> = { status }
  if (status === 'verified') {
    updatePayload.verified_by = user.id
  }

  const { data: updated, error } = await supabase
    .from('orders')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: 'Failed to update order' }, { status: 500 })
  return Response.json(updated)
}
