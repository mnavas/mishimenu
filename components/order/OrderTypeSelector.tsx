import type { OrderType } from '@/lib/types'

interface Props {
  value: OrderType
  onChange: (v: OrderType) => void
  tableNumber: string
  onTableChange: (v: string) => void
}

export default function OrderTypeSelector({ value, onChange, tableNumber, onTableChange }: Props) {
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
        <input
          type="text"
          inputMode="numeric"
          placeholder="Número de mesa"
          value={tableNumber}
          onChange={e => onTableChange(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
      )}
    </div>
  )
}
