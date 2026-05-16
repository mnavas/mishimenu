import type { SupabaseClient } from '@supabase/supabase-js'
import type { DuplicateCheckResult } from '@/lib/types'

export async function checkByImageHash(
  supabase: SupabaseClient,
  imageHash: string,
  excludeOrderId?: string
): Promise<DuplicateCheckResult> {
  const query = supabase
    .from('receipts')
    .select('id, order_id, orders!inner(order_number)')
    .eq('image_hash', imageHash)
    .limit(1)

  if (excludeOrderId) query.neq('order_id', excludeOrderId)

  const { data } = await query.maybeSingle()
  if (!data) return { isDuplicate: false }

  return {
    isDuplicate: true,
    reason: 'image_hash',
    duplicateOrderId: data.order_id,
    duplicateOrderNumber: (data.orders as unknown as { order_number: number }).order_number,
  }
}

export async function checkByTransactionId(
  supabase: SupabaseClient,
  txId: string,
  excludeOrderId?: string
): Promise<DuplicateCheckResult> {
  const query = supabase
    .from('receipts')
    .select('id, order_id, orders!inner(order_number)')
    .eq('extracted_tx_id', txId)
    .limit(1)

  if (excludeOrderId) query.neq('order_id', excludeOrderId)

  const { data } = await query.maybeSingle()
  if (!data) return { isDuplicate: false }

  return {
    isDuplicate: true,
    reason: 'transaction_id',
    duplicateOrderId: data.order_id,
    duplicateOrderNumber: (data.orders as unknown as { order_number: number }).order_number,
  }
}
