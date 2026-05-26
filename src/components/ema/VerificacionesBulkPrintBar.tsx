'use client'

import React from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EMA_BULK_VERIFICACION_PRINT_MAX } from '@/lib/ema/bulkVerificacionPrint'

const CLOSED_ESTADOS = new Set(['cerrado', 'firmado_operador', 'firmado_revisor'])

export type VerificacionSelectableRow = {
  id: string
  estado: string
}

type Props = {
  rows: VerificacionSelectableRow[]
  selectedIds: Set<string>
  onSelectedIdsChange: (next: Set<string>) => void
  onPrint: () => void
  printError?: string | null
}

export function VerificacionesBulkPrintBar({
  rows,
  selectedIds,
  onSelectedIdsChange,
  onPrint,
  printError,
}: Props) {
  const allIds = rows.map((r) => r.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const someSelected = selectedIds.size > 0

  const toggleAll = () => {
    if (allSelected) {
      onSelectedIdsChange(new Set())
    } else {
      onSelectedIdsChange(new Set(allIds))
    }
  }

  const selectClosed = () => {
    const closed = rows.filter((r) => CLOSED_ESTADOS.has(r.estado)).map((r) => r.id)
    onSelectedIdsChange(new Set(closed))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-stone-100 bg-stone-50/80">
        <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label="Seleccionar todas las verificaciones visibles"
          />
          Seleccionar todas
        </label>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={selectClosed}>
          Seleccionar cerradas
        </Button>
        {someSelected && (
          <>
            <span className="text-xs text-stone-500">
              {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
              {selectedIds.size > EMA_BULK_VERIFICACION_PRINT_MAX && (
                <span className="text-red-600 ml-1">(máx. {EMA_BULK_VERIFICACION_PRINT_MAX})</span>
              )}
            </span>
            <Button
              type="button"
              size="sm"
              className="h-7 gap-1 text-xs bg-[#1B365D] hover:bg-[#142848] text-white ml-auto"
              disabled={selectedIds.size > EMA_BULK_VERIFICACION_PRINT_MAX}
              onClick={onPrint}
            >
              <FileDown className="h-3 w-3" />
              Generar informe PDF ({selectedIds.size})
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onSelectedIdsChange(new Set())}
            >
              Limpiar
            </Button>
          </>
        )}
      </div>
      {printError && (
        <p className="px-4 text-xs text-red-700 bg-red-50 border-b border-red-100 py-2">{printError}</p>
      )}
    </div>
  )
}

export function VerificacionRowCheckbox({
  id,
  selected,
  onToggle,
}: {
  id: string
  selected: boolean
  onToggle: (id: string, checked: boolean) => void
}) {
  return (
    <Checkbox
      checked={selected}
      onCheckedChange={(checked) => onToggle(id, checked === true)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Seleccionar verificación ${id.slice(0, 8)}`}
      className="shrink-0"
    />
  )
}
