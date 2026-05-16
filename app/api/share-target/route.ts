import { createServiceClient } from '@/lib/supabase/server'
import { getSessionIdFromCookie } from '@/lib/session'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null)
  if (!formData) return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=bad_request`, 303)

  const files = formData.getAll('files') as File[]
  const image = files.find(f => f.type.startsWith('image/'))

  if (!image) return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=no_image`, 303)

  const sessionId = getSessionIdFromCookie(req.headers.get('cookie'))
  if (!sessionId) return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=no_session`, 303)

  const supabase = createServiceClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'pending_payment')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order) {
    return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=no_pending_order`, 303)
  }

  const imageBuffer = await image.arrayBuffer()
  const stagingPath = `receipts/staging/${order.id}/${Date.now()}.jpg`
  const { error: uploadErr } = await supabase.storage
    .from('receipts')
    .upload(stagingPath, imageBuffer, { contentType: 'image/jpeg' })

  if (uploadErr) {
    return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=upload_failed`, 303)
  }

  await supabase.from('orders').update({ notes: `staged:${stagingPath}` }).eq('id', order.id)

  return Response.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/pay/${order.id}?shared=1`,
    303
  )
}
