'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, CheckCircle2, ExternalLink } from 'lucide-react'
import type { InventoryClosure } from '@/types/inventoryClosure'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

function fmtDate(d: string) {
  try { return format(parseISO(d), "d 'de' MMMM yyyy", { locale: es }) } catch { return d }
}

interface Props {
  closure: InventoryClosure
}

export default function ExportStep({ closure }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/closures/${closure.id}/export`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Error al generar Excel')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Cierre_Inventario_${closure.period_start}_${closure.period_end}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-2">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
        <p className="text-lg font-semibold text-emerald-900">¡Cierre sellado exitosamente!</p>
        <p className="text-sm text-emerald-700">
          Período {fmtDate(closure.period_start)} — {fmtDate(closure.period_end)}
        </p>
        {closure.signed_at && (
          <p className="text-xs text-emerald-600">
            Sellado el {fmtDate(closure.signed_at)}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-4">
        <p className="text-sm font-medium text-stone-800">Reporte de cierre para contabilidad y producción</p>
        <p className="text-sm text-stone-500">
          Descarga el Excel definitivo con el detalle completo: puente teórico, conciliación, consumos por
          remisión, entradas, ajustes y evidencia. Durante el proceso también pudiste generar un Excel
          preliminar desde el encabezado del cierre.
        </p>
        <div className="flex gap-3">
          <Button
            onClick={handleDownload}
            disabled={loading}
            className="gap-2 bg-[#1B2A4A] text-white hover:bg-[#243560]"
          >
            <Download className="h-4 w-4" />
            {loading ? 'Generando Excel...' : 'Descargar Excel de cierre'}
          </Button>
          <Button variant="outline" asChild>
            <a href="/production-control/inventory-closure" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Ver todos los cierres
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
