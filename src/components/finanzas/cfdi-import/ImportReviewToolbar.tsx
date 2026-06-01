'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

export type ImportReviewFilter = 'all' | 'ready' | 'attention'

type Props = {
  filter: ImportReviewFilter
  onFilterChange: (f: ImportReviewFilter) => void
  counts: { all: number; ready: number; attention: number }
  search: string
  onSearchChange: (v: string) => void
  groupByRfc: boolean
  onGroupByRfcChange: (v: boolean) => void
}

export default function ImportReviewToolbar({
  filter,
  onFilterChange,
  counts,
  search,
  onSearchChange,
  groupByRfc,
  onGroupByRfcChange,
}: Props) {
  const tabs: { id: ImportReviewFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Todos', count: counts.all },
    { id: 'ready', label: 'Listos', count: counts.ready },
    { id: 'attention', label: 'Revisar', count: counts.attention },
  ]

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onFilterChange(t.id)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              filter === t.id
                ? 'bg-stone-800 text-white border-stone-800'
                : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50',
            )}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar RFC, folio, UUID…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 text-xs w-full sm:w-52"
        />
        <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={groupByRfc}
            onChange={(e) => onGroupByRfcChange(e.target.checked)}
            className="rounded border-stone-300"
          />
          Agrupar por RFC proveedor
        </label>
      </div>
    </div>
  )
}
