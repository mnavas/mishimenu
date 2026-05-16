type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info'

const classes: Record<Variant, string> = {
  default: 'bg-zinc-100 text-zinc-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger:  'bg-red-100 text-red-700',
  info:    'bg-blue-100 text-blue-700',
}

export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: Variant }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[variant]}`}>
      {children}
    </span>
  )
}
