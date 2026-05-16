import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null)
  if (!formData) return Response.json({ error: 'Invalid form data' }, { status: 400 })

  const orderId = formData.get('orderId') as string | null
  const imageFile = formData.get('image') as File | null
  const submittedVia = (formData.get('submittedVia') as string | null) ?? 'upload'

  if (!orderId || !imageFile) {
    return Response.json({ error: 'Missing orderId or image' }, { status: 400 })
  }

  if (!['image/jpeg', 'image/png'].includes(imageFile.type)) {
    return Response.json({ error: 'Only JPEG and PNG images are accepted' }, { status: 422 })
  }
  if (imageFile.size > 10 * 1024 * 1024) {
    return Response.json({ error: 'Image must be under 10 MB' }, { status: 422 })
  }

  const supabase = createServiceClient()

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, status, total, payment_method')
    .eq('id', orderId)
    .single()

  if (orderErr || !order) return Response.json({ error: 'Order not found' }, { status: 404 })
  if (order.payment_method === 'cash' || order.payment_method === 'card') {
    return Response.json({ error: 'In-person orders do not require a receipt' }, { status: 422 })
  }
  if (order.status !== 'pending_payment') {
    return Response.json({ error: 'Order is not awaiting payment' }, { status: 422 })
  }

  const imageBuffer = await imageFile.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', imageBuffer)
  const hash = Buffer.from(hashBuffer).toString('hex')

  const { data: existing } = await supabase
    .from('receipts')
    .select('id, order_id')
    .eq('image_hash', hash)
    .limit(1)
    .maybeSingle()

  const isDuplicate = !!existing
  const duplicateOrderId = existing?.order_id ?? null

  const storagePath = `receipts/${orderId}/${Date.now()}.jpg`
  const { error: uploadErr } = await supabase.storage
    .from('receipts')
    .upload(storagePath, imageBuffer, { contentType: 'image/jpeg', upsert: true })

  if (uploadErr) return Response.json({ error: 'Upload failed' }, { status: 500 })

  const { data: receipt, error: receiptErr } = await supabase
    .from('receipts')
    .insert({
      order_id: orderId,
      storage_path: storagePath,
      image_hash: hash,
      ocr_status: 'pending',
      is_duplicate: isDuplicate,
      duplicate_of_order_id: duplicateOrderId,
      submitted_via: submittedVia,
    })
    .select('id')
    .single()

  if (receiptErr || !receipt) return Response.json({ error: 'Failed to save receipt' }, { status: 500 })

  await supabase.from('orders').update({ status: 'receipt_received' }).eq('id', orderId)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  fetch(`${appUrl}/api/ocr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OCR_INTERNAL_SECRET}`,
    },
    body: JSON.stringify({ receiptId: receipt.id }),
  }).catch(() => {})

  return Response.json({ receiptId: receipt.id, isDuplicate, duplicateOrderId })
}
