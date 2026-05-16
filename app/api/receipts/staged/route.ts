import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!orderId) return Response.json({ error: 'Missing orderId' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: order } = await supabase
    .from('orders')
    .select('notes')
    .eq('id', orderId)
    .single()

  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })

  const stagedPath = order.notes?.startsWith('staged:') ? order.notes.slice(7) : null
  if (!stagedPath) return Response.json({ error: 'No staged receipt' }, { status: 404 })

  const { data: fileData, error } = await supabase.storage.from('receipts').download(stagedPath)
  if (error || !fileData) return Response.json({ error: 'Failed to load staged receipt' }, { status: 500 })

  const buffer = await fileData.arrayBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store',
    },
  })
}
