'use client'

import { useEffect, useState } from 'react'

export type ToastMessage = { id: string; text: string; type?: 'success' | 'error' }

let _show: ((msg: Omit<ToastMessage, 'id'>) => void) | null = null

export function showToast(msg: Omit<ToastMessage, 'id'>) {
  _show?.(msg)
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    _show = (msg) => {
      const id = crypto.randomUUID()
      setToasts(t => [...t, { ...msg, id }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
    }
    return () => { _show = null }
  }, [])

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all ${
            t.type === 'error' ? 'bg-red-600' : 'bg-zinc-900'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
