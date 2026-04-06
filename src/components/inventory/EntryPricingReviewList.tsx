'use client'

import React from 'react'
import { MaterialEntry } from '@/types/inventory'
import { format } from 'date-fns'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatReceivedQuantity } from '@/lib/inventory/entryReceivedDisplay'

interface EntryPricingReviewListProps {
  entries: MaterialEntry[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading?: boolean
}

export default function EntryPricingReviewList({
  entries,
  selectedId,
  onSelect,
  loading = false,
}: EntryPricingReviewListProps) {
  if (loading) {
    return (
      <div className="space-y-0">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse border-b border-stone-100 px-3 py-3">
            <div className="h-3 bg-stone-200 rounded w-1/3 mb-2" />
            <div className="h-4 bg-stone-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="rounded-full bg-emerald-100 p-3 mb-3">
          <Check className="h-6 w-6 text-emerald-600" />
        </div>
        <h3 className="text-sm font-semibold text-stone-800 mb-1">Cola despejada</h3>
        <p className="text-xs text-stone-500">Todas las entradas han sido revisadas</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Sticky queue header */}
      <div className="sticky top-0 z-10 px-3 py-2 border-b border-stone-200 bg-stone-50/95 backdrop-blur-sm">
        <span className="text-xs font-medium text-stone-600">
          {entries.length} pendiente{entries.length !== 1 ? 's' : ''} · últimos 30 días
        </span>
      </div>

      {/* Queue rows */}
      {entries.map((entry) => {
        const isSelected = selectedId === entry.id
        const hasNoPo = !entry.po_id && !entry.fleet_po_id
        const hasNoEvidence = (entry.document_count ?? 0) === 0
        let timeLabel = ''
        try {
          const dt = new Date(`${entry.entry_date}T${entry.entry_time || '12:00:00'}`)
          timeLabel = format(dt, 'HH:mm')
        } catch {
          timeLabel = ''
        }
        const qtyLabel = formatReceivedQuantity(entry)

        return (
          <button
            key={entry.id}
            type="button"
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 border-b border-stone-100',
              'text-left transition-colors',
              isSelected
                ? 'bg-sky-50 border-l-[3px] border-l-sky-600'
                : 'hover:bg-stone-50 border-l-[3px] border-l-transparent'
            )}
            onClick={() => onSelect(entry.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-medium text-stone-800">
                  {entry.entry_number || entry.id.slice(0, 8)}
                </span>
                <span className="text-stone-400">{timeLabel}</span>
                <div className="flex items-center gap-1 ml-auto">
                  {hasNoPo && (
                    <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" title="Sin OC" />
                  )}
                  {hasNoEvidence && (
                    <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" title="Sin evidencia" />
                  )}
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-2 mt-0.5">
                <span className="text-sm text-stone-700 truncate">
                  {entry.material?.material_name || 'Material'}
                </span>
                <span className="text-xs tabular-nums text-stone-500 shrink-0">{qtyLabel}</span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
