import type { OrderType } from '@/lib/types'

interface Props {
  value: OrderType
  onChange: (v: OrderType) => void
  tableNumber: string
  onTableChange: (v: string) => void
  tableError?: boolean
}

export default function OrderTypeSelector({ value, onChange, tableNumber, onTableChange, tableError }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['mesa', 'llevar'] as OrderType[]).map(type => (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-medium transition-colors ${
              value === type
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
            }`}
          >
            {type === 'mesa' ? '🪑 En mesa' : '🛍️ Para llevar'}
          </button>
        ))}
      </div>
      {value === 'mesa' && (
        <div>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Número de mesa"
            value={tableNumber}
            onChange={e => onTableChange(e.target.value)}
            aria-label="Número de mesa"
            aria-invalid={tableError}
            className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
              tableError
                ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200'
                : 'border-zinc-300 focus:border-emerald-500 focus:ring-emerald-200'
            }`}
          />
          {tableError && (
            <p className="mt-1 text-xs text-red-600">Ingresa el número de mesa</p>
          )}
        </div>
      )}
    </div>
  )
}
