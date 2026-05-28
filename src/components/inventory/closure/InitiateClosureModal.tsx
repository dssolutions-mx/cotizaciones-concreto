'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, CalendarRange } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

interface Props {
  plantId: string
  onClose: () => void
  onCreated: (closureId: string) => void
}

function toIso(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

export default function InitiateClosureModal({ plantId, onClose, onCreated }: Props) {
  const lastMonth = subMonths(new Date(), 1)
  const [periodStart, setPeriodStart] = useState(toIso(startOfMonth(lastMonth)))
  const [periodEnd, setPeriodEnd] = useState(toIso(endOfMonth(lastMonth)))
  const [threshold, setThreshold] = useState('2')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant_id: plantId,
          period_start: periodStart,
          period_end: periodEnd,
          variance_threshold_pct: parseFloat(threshold) || 2,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al iniciar cierre')
      onCreated(data.closure.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-[#1B2A4A]" />
            <h2 className="font-semibold text-stone-900">Iniciar cierre de inventario</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-stone-100 transition-colors">
            <X className="h-4 w-4 text-stone-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Inicio del período</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Fin del período</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
                min={periodStart}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">
              Umbral de varianza (%) — requiere justificación si se supera
            </label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              min="0"
              max="100"
              step="0.5"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Contexto, instrucciones especiales..."
              className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-[#1B2A4A] text-white hover:bg-[#243560]" disabled={loading}>
              {loading ? 'Iniciando...' : 'Iniciar cierre'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
