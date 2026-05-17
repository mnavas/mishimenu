'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'reset' | 'reset_sent'>('login')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      showToast({ text: 'Correo o contraseña incorrectos', type: 'error' })
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { showToast({ text: 'Ingresa tu correo', type: 'error' }); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    setLoading(false)
    if (error) {
      showToast({ text: error.message, type: 'error' })
    } else {
      setMode('reset_sent')
    }
  }

  if (mode === 'reset_sent') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-3xl">📬</p>
          <h1 className="text-xl font-bold text-zinc-900">Revisa tu correo</h1>
          <p className="text-sm text-zinc-500">
            Si <strong>{email}</strong> está registrado, recibirás un enlace para restablecer tu contraseña.
          </p>
          <button onClick={() => setMode('login')} className="text-sm text-emerald-600 hover:underline">
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'reset') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-900">Recuperar contraseña</h1>
            <p className="mt-1 text-sm text-zinc-500">Te enviaremos un enlace por correo</p>
          </div>
          <form onSubmit={handleReset} className="space-y-4">
            <input
              type="email"
              required
              placeholder="Correo electrónico"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <Button type="submit" loading={loading} className="w-full">
              Enviar enlace de recuperación
            </Button>
          </form>
          <p className="text-center">
            <button onClick={() => setMode('login')} className="text-sm text-zinc-500 hover:text-zinc-700 underline">
              Volver al inicio de sesión
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Acceso restaurante</h1>
          <p className="mt-1 text-sm text-zinc-500">Panel del propietario</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Correo electrónico"
            aria-label="Correo electrónico"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <input
            type="password"
            required
            placeholder="Contraseña"
            aria-label="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <Button type="submit" loading={loading} className="w-full">
            Ingresar
          </Button>
        </form>
        <p className="text-center">
          <button onClick={() => setMode('reset')} className="text-sm text-zinc-500 hover:text-zinc-700 underline">
            ¿Olvidaste tu contraseña?
          </button>
        </p>
      </div>
    </div>
  )
}
