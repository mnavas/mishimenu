export const runtime = 'nodejs' // Tesseract.js requires Node.js runtime

import { createServiceClient } from '@/lib/supabase/server'
import { runOcr } from '@/lib/ocr/tesseract'
import { parseReceipt } from '@/lib/ocr/parser'
import { checkByTransactionId } from '@/lib/fraud/detection'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.OCR_INTERNAL_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const { receiptId } = body ?? {}
  if (!receiptId) return Response.json({ error: 'Missing receiptId' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: receipt } = await supabase
    .from('receipts')
    .select('*, orders!inner(id, total, payment_method)')
    .eq('id', receiptId)
    .single()

  if (!receipt) return Response.json({ error: 'Receipt not found' }, { status: 404 })

  await supabase.from('receipts').update({ ocr_status: 'processing' }).eq('id', receiptId)
  await supabase.from('orders').update({ status: 'ocr_processing' }).eq('id', receipt.order_id)

  try {
    const { data: imageData, error: downloadErr } = await supabase.storage
      .from('receipts')
      .download(receipt.storage_path)

    if (downloadErr || !imageData) throw new Error('Failed to download receipt image')

    const imageBuffer = Buffer.from(await imageData.arrayBuffer())

    const rawText = await runOcr(imageBuffer)
    const order = receipt.orders as { id: string; total: number; payment_method: string }
    const parsed = parseReceipt(rawText, order.payment_method as import('@/lib/types').PaymentMethod)

    let isDuplicate = receipt.is_duplicate
    let duplicateOrderId = receipt.duplicate_of_order_id
    if (parsed.txId) {
      const txCheck = await checkByTransactionId(supabase, parsed.txId, receipt.order_id)
      if (txCheck.isDuplicate) {
        isDuplicate = true
        duplicateOrderId = txCheck.duplicateOrderId ?? null
      }
    }

    const amountMatch =
      parsed.amount !== null && Math.abs(parsed.amount - order.total) <= 0.01

    await supabase.from('receipts').update({
      ocr_raw_text: rawText,
      extracted_tx_id: parsed.txId,
      extracted_amount: parsed.amount,
      extracted_sender: parsed.sender,
      ocr_status: 'done',
      is_duplicate: isDuplicate,
      duplicate_of_order_id: duplicateOrderId,
    }).eq('id', receiptId)

    await supabase.from('orders').update({ status: 'receipt_received' }).eq('id', receipt.order_id)

    return Response.json({ success: true, amountMatch, txId: parsed.txId })
  } catch (err) {
    console.error('[OCR] failed:', err)
    await supabase.from('receipts').update({ ocr_status: 'failed' }).eq('id', receiptId)
    await supabase.from('orders').update({ status: 'receipt_received' }).eq('id', receipt.order_id)
    return Response.json({ error: 'OCR failed' }, { status: 500 })
  }
}
