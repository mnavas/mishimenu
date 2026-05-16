import type { ParsedReceipt } from '@/lib/types'
import type { PaymentMethod } from '@/lib/types'

// DeUna: DEU-1234-12345678
const TX_DEUNA = /DEU-\d{4}-\d{4,8}/i

// Sipi: SIP-123456789
const TX_SIPI = /SIP-\d{4,12}/i

// Generic reference (transfer + fallback)
const TX_GENERIC = /(comprobante|referencia|c[oó]digo|transacci[oó]n|txid)[:\s#]+([A-Z0-9\-]{6,30})/i

export const AMOUNT_PATTERNS = {
  labeled: /(total|monto|pagado|valor|pagaste)[:\s]*\$?\s*(\d{1,4}[.,]\d{2})/i,
  any: /\$\s*(\d{1,4}[.,]\d{2})/g,
}

export const SENDER_PATTERN =
  /(pagado por|de:|cliente)[:\s]+([A-ZÀ-ÿ][a-zÀ-ÿ]+(?:\s[A-ZÀ-ÿ][a-zÀ-ÿ]+)+)/i

function normalizeAmount(s: string): number {
  return parseFloat(s.replace(',', '.'))
}

function extractTxId(rawText: string, method: PaymentMethod): string | null {
  if (method === 'deuna') {
    const m = rawText.match(TX_DEUNA)
    if (m) return m[0]
  }
  if (method === 'sipi') {
    const m = rawText.match(TX_SIPI)
    if (m) return m[0]
  }
  // For transfer or as fallback for any method
  const m = rawText.match(TX_GENERIC)
  return m ? m[2] : null
}

export function parseReceipt(rawText: string, method: PaymentMethod = 'deuna'): ParsedReceipt {
  const txId = extractTxId(rawText, method)

  // Amount — prefer labeled, fall back to largest unlabeled
  let amount: number | null = null
  const labeled = rawText.match(AMOUNT_PATTERNS.labeled)
  if (labeled) {
    amount = normalizeAmount(labeled[2])
  } else {
    const all = [...rawText.matchAll(AMOUNT_PATTERNS.any)]
      .map(m => normalizeAmount(m[1]))
      .filter(n => !isNaN(n) && n > 0)
    if (all.length) amount = Math.max(...all)
  }

  const senderMatch = rawText.match(SENDER_PATTERN)
  const sender = senderMatch ? senderMatch[2].trim() : null

  return { txId, amount, sender, rawText }
}
