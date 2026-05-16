import type { Order } from '@/lib/types'

interface Props { orders: Order[]; currencySymbol: string }

export default function DashboardStats({ orders, currencySymbol }: Props) {
  const today = new Date().toDateString()

  const verifiedToday = orders
    .filter(o => o.status === 'verified' && new Date(o.created_at).toDateString() === today)
    .reduce((s, o) => s + Number(o.total), 0)

  const pendingReview = orders.filter(o =>
    o.status === 'receipt_received' || o.status === 'ocr_processing'
  ).length

  const fraudAlerts = orders.filter(o => o.receipt?.is_duplicate).length

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard label="Cobrado hoy" value={`${currencySymbol}${verifiedToday.toFixed(2)}`} color="emerald" />
      <StatCard label="Por verificar" value={String(pendingReview)} color={pendingReview > 0 ? 'amber' : 'zinc'} />
      <StatCard label="Alertas" value={String(fraudAlerts)} color={fraudAlerts > 0 ? 'red' : 'zinc'} />
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-800',
    amber:   'bg-amber-50 text-amber-800',
    red:     'bg-red-50 text-red-800',
    zinc:    'bg-zinc-50 text-zinc-700',
  }
  return (
    <div className={`rounded-2xl p-3 text-center ${colors[color] ?? colors.zinc}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-75">{label}</p>
    </div>
  )
}
