'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Stamp, Upload, Lock, AlertTriangle } from 'lucide-react'
import type { InventoryClosureMaterial } from '@/types/inventoryClosure'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

function fmtKg(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg'
}

const BUCKET = 'inventory-closure-evidence'

interface Props {
  closureId: string
  materials: InventoryClosureMaterial[]
  onSealed: () => void
}

export default function SealStep({ closureId, materials, onSealed }: Props) {
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null)
  const [sealing, setSealing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const supabase = createClientComponentClient()

  function handleSignatureFile(file: File) {
    setSignatureFile(file)
    const url = URL.createObjectURL(file)
    setSignaturePreview(url)
  }

  async function handleSeal() {
    if (!signatureFile) { setError('Adjunta la firma antes de sellar'); return }
    if (!confirmed) { setError('Confirma que los datos son correctos'); return }

    setError(null)
    setSealing(true)
    try {
      // Upload signature to storage
      const sanitized = signatureFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${closureId}/signatures/${Date.now()}_${sanitized}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, signatureFile, { cacheControl: '31536000', upsert: true })

      if (uploadError) throw new Error(`Error al subir firma: ${uploadError.message}`)

      // Store the path — the service generates signed URLs on demand so they never expire
      // Seal the closure
      const res = await fetch(`/api/inventory/closures/${closureId}/seal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signed_by: (await supabase.auth.getUser()).data.user?.id ?? '',
          signature_image_url: storagePath,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al sellar')
      onSealed()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSealing(false)
    }
  }

  const withVariance = materials.filter((m) => Math.abs(m.variance_kg ?? 0) > 0.001)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">Acción irreversible</p>
            <p>
              Al sellar el cierre, se crearán {withVariance.length} ajuste(s) de tipo "conteo físico"
              en el sistema. El inventario quedará actualizado y no podrá modificarse sin cancelar el cierre.
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">
          Resumen de ajustes a crear
        </p>
        {withVariance.length === 0 ? (
          <p className="text-sm text-stone-600">Sin varianzas — no se crearán ajustes.</p>
        ) : (
          <div className="space-y-1.5">
            {withVariance.map((m) => (
              <div key={m.material_id} className="flex items-center justify-between text-sm">
                <span className="text-stone-800">{m.material?.material_name ?? m.material_id}</span>
                <span className={m.variance_kg! > 0 ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                  {m.variance_kg! > 0 ? '+' : ''}{fmtKg(m.variance_kg)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Signature upload */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Stamp className="h-4 w-4 text-[#1B2A4A]" />
          <p className="text-sm font-medium text-stone-800">Firma del responsable</p>
        </div>
        {signaturePreview ? (
          <div className="relative w-48 h-24 rounded-lg border border-stone-200 overflow-hidden bg-white">
            <img src={signaturePreview} alt="Firma" className="w-full h-full object-contain" />
            <button
              type="button"
              onClick={() => { setSignatureFile(null); setSignaturePreview(null) }}
              className="absolute top-1 right-1 rounded-full bg-white border border-stone-200 p-0.5 text-stone-500 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 py-6 hover:border-stone-400 hover:bg-stone-100 transition-colors">
            <Upload className="h-5 w-5 text-stone-400 mb-2" />
            <p className="text-sm text-stone-600">Subir imagen de firma</p>
            <p className="text-xs text-stone-400 mt-0.5">PNG, JPG — máx. 5 MB</p>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSignatureFile(f) }}
            />
          </label>
        )}
      </div>

      {/* Final confirmation checkbox */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-stone-300 accent-[#1B2A4A]"
        />
        <span className="text-sm text-stone-700">
          Confirmo que he revisado todos los datos, los conteos físicos son correctos y autorizo el cierre
          definitivo del inventario para este período.
        </span>
      </label>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleSeal}
          disabled={sealing || !confirmed || !signatureFile}
          className="gap-2 bg-[#1B2A4A] text-white hover:bg-[#243560]"
        >
          <Lock className="h-4 w-4" />
          {sealing ? 'Sellando cierre...' : 'Sellar cierre definitivamente'}
        </Button>
      </div>
    </div>
  )
}
