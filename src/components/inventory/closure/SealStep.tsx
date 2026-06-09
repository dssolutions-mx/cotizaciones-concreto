'use client'

import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Stamp, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { InventoryClosureMaterial } from '@/types/inventoryClosure'
import SignaturePad from '@/components/inventory/closure/SignaturePad'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

function fmtKg(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg'
}

interface SealInfo {
  signatureImageUrl?: string | null
  signedByName?: string | null
  signedAt?: string | null
}

interface Props {
  closureId: string
  materials: InventoryClosureMaterial[]
  onSealed: () => void
  readOnly?: boolean
  sealedInfo?: SealInfo
}

function fmtSealDate(d: string) {
  try {
    return format(parseISO(d), "d 'de' MMMM yyyy, HH:mm", { locale: es })
  } catch {
    return d
  }
}

export default function SealStep({
  closureId,
  materials,
  onSealed,
  readOnly = false,
  sealedInfo,
}: Props) {
  const [hasSignature, setHasSignature] = useState(false)
  const [sealing, setSealing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const exportSignatureRef = useRef<(() => Promise<Blob | null>) | null>(null)

  async function handleSeal() {
    if (!hasSignature) { setError('Dibuja tu firma antes de sellar'); return }
    if (!confirmed) { setError('Confirma que los datos son correctos'); return }

    setError(null)
    setSealing(true)
    try {
      const exportPng = exportSignatureRef.current
      if (!exportPng) throw new Error('No se pudo capturar la firma')
      const blob = await exportPng()
      if (!blob) throw new Error('Dibuja tu firma antes de sellar')

      const fd = new FormData()
      fd.append('file', blob, 'signature.png')

      const uploadRes = await fetch(`/api/inventory/closures/${closureId}/signature`, {
        method: 'POST',
        body: fd,
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) {
        throw new Error(uploadData.error ?? 'Error al subir firma')
      }

      const storagePath = uploadData.storage_path as string

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesión expirada — vuelve a iniciar sesión')

      const res = await fetch(`/api/inventory/closures/${closureId}/seal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signed_by: user.id,
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
      {!sealedInfo && (
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
      )}

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

      {readOnly && sealedInfo?.signatureImageUrl && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-900">Cierre sellado</p>
          </div>
          {(sealedInfo.signedByName || sealedInfo.signedAt) && (
            <p className="text-sm text-emerald-800">
              {sealedInfo.signedByName && <>Firmado por <strong>{sealedInfo.signedByName}</strong></>}
              {sealedInfo.signedByName && sealedInfo.signedAt && ' · '}
              {sealedInfo.signedAt && <>el {fmtSealDate(sealedInfo.signedAt)}</>}
            </p>
          )}
          <div className="rounded-lg border border-emerald-200 bg-white p-3 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sealedInfo.signatureImageUrl}
              alt="Firma del responsable"
              className="max-h-28 max-w-full object-contain"
            />
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          {/* Signature pad */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Stamp className="h-4 w-4 text-[#1B2A4A]" />
              <p className="text-sm font-medium text-stone-800">Firma del responsable</p>
            </div>
            <SignaturePad
              exportRef={exportSignatureRef}
              onChange={setHasSignature}
            />
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
              disabled={sealing || !confirmed || !hasSignature}
              className="gap-2 bg-[#1B2A4A] text-white hover:bg-[#243560]"
            >
              <Lock className="h-4 w-4" />
              {sealing ? 'Sellando cierre...' : 'Sellar cierre definitivamente'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
