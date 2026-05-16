'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'

interface Props {
  orderId: string
  onSubmitted: () => void
}

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX_DIM = 1200
      let { width, height } = img
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM }
        else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compression failed')), 'image/jpeg', 0.85)
    }
    img.onerror = reject
    img.src = url
  })
}

export default function ReceiptUpload({ orderId, onSubmitted }: Props) {
  const searchParams = useSearchParams()
  const isShared = searchParams.get('shared') === '1'
  const inputRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingShared, setLoadingShared] = useState(isShared)

  useEffect(() => {
    if (!isShared) return
    async function fetchStaged() {
      try {
        const res = await fetch(`/api/receipts/staged?orderId=${orderId}`)
        if (!res.ok) throw new Error('No se pudo cargar el comprobante')
        const blob = await res.blob()
        setFile(blob)
        setPreview(URL.createObjectURL(blob))
      } catch (e) {
        showToast({ text: (e as Error).message, type: 'error' })
      } finally {
        setLoadingShared(false)
      }
    }
    fetchStaged()
  }, [isShared, orderId])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!['image/jpeg', 'image/png'].includes(f.type)) {
      showToast({ text: 'Solo se aceptan imágenes JPEG o PNG', type: 'error' }); return
    }
    if (f.size > MAX_SIZE) {
      showToast({ text: 'La imagen no puede superar los 10 MB', type: 'error' }); return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit() {
    if (!file) return
    setLoading(true)
    try {
      const compressed = file instanceof File ? await compressImage(file) : file
      const fd = new FormData()
      fd.append('orderId', orderId)
      fd.append('image', compressed, 'receipt.jpg')
      fd.append('submittedVia', isShared ? 'share_target' : 'upload')

      const res = await fetch('/api/receipts', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar comprobante')

      if (data.isDuplicate) {
        showToast({ text: '⚠️ Comprobante duplicado (orden anterior)', type: 'error' })
      }
      onSubmitted()
    } catch (e) {
      showToast({ text: (e as Error).message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (loadingShared) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-zinc-500 shadow-sm ring-1 ring-zinc-100">
        Cargando comprobante…
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 space-y-4">
      <p className="text-sm font-medium text-zinc-700">
        {isShared ? '¿Enviar este comprobante?' : 'Sube tu comprobante de pago'}
      </p>

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Comprobante" className="w-full rounded-xl object-contain max-h-64" />
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 p-8 text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
        >
          <span className="text-3xl">📸</span>
          <span className="text-sm font-medium">Seleccionar imagen</span>
          <span className="text-xs">JPEG o PNG, máx 10 MB</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFileSelect}
      />

      {preview && !isShared && (
        <button
          onClick={() => { setPreview(null); setFile(null) }}
          className="text-xs text-zinc-400 hover:text-zinc-600 underline"
        >
          Cambiar imagen
        </button>
      )}

      {file && (
        <Button onClick={handleSubmit} loading={loading} className="w-full">
          {isShared ? 'Sí, enviar comprobante' : 'Enviar comprobante'}
        </Button>
      )}
    </div>
  )
}
