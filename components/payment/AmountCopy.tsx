'use client'

import { useState } from 'react'

export default function AmountCopy({ total, currencySymbol }: { total: number; currencySymbol: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(total.toFixed(2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API blocked — show a select-to-copy fallback
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="w-full rounded-2xl bg-emerald-50 p-5 text-center transition-colors hover:bg-emerald-100 active:bg-emerald-200"
    >
      <p className="text-sm text-emerald-700">Monto a pagar (ya copiado)</p>
      <p className="mt-1 text-4xl font-bold text-emerald-800 tabular-nums select-all">
        {currencySymbol}{total.toFixed(2)}
      </p>
      <p className="mt-2 text-sm font-medium text-emerald-600">
        {copied ? '¡Copiado al portapapeles!' : 'Toca para copiar de nuevo'}
      </p>
    </button>
  )
}
