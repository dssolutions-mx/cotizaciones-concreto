'use client'

import React, { useCallback, useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  consumosAccountingExcelFilename,
  type ConsumosAccountingExcelPayload,
} from '@/lib/procurement/consumosAccountingExcelExport'
import { buildConsumosMaterialesExcel } from '@/lib/reports/consumosMaterialesExcel'
import { FileSpreadsheet } from 'lucide-react'

/** Keep in sync with GET /api/procurement/consumos/rango/contable */
const MAX_RANGE_DAYS = 366

function monthBounds() {
  const d = new Date()
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  return {
    from: start.toISOString().slice(0, 10),
    to: d.toISOString().slice(0, 10),
  }
}

function daysBetweenInclusive(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime()
  const b = new Date(`${to}T12:00:00Z`).getTime()
  return Math.floor((b - a) / 86400000) + 1
}

export default function PlantConsumosAccountingExport({ plantId }: { plantId: string | null }) {
  const mb = useMemo(() => monthBounds(), [])
  const [singleDate, setSingleDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dateFrom, setDateFrom] = useState(mb.from)
  const [dateTo, setDateTo] = useState(mb.to)
  const [exportingDay, setExportingDay] = useState(false)
  const [exportingRange, setExportingRange] = useState(false)

  const exportDayExcel = useCallback(async () => {
    if (!plantId) {
      toast.error('Seleccione una planta')
      return
    }
    setExportingDay(true)
    try {
      const res = await fetch(
        `/api/procurement/consumos?date=${encodeURIComponent(singleDate)}&plant_id=${encodeURIComponent(plantId)}`
      )
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'No se pudo cargar consumos del día')
      }
      const payload = json.data as ConsumosAccountingExcelPayload | undefined
      if (!payload) {
        throw new Error('Respuesta inválida')
      }
      const buf = await buildConsumosMaterialesExcel(payload)
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = consumosAccountingExcelFilename(payload)
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('Reporte Excel generado (formato contabilidad)')
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Error al exportar')
    } finally {
      setExportingDay(false)
    }
  }, [plantId, singleDate])

  const exportRangeExcel = useCallback(async () => {
    if (!plantId) {
      toast.error('Seleccione una planta')
      return
    }
    if (!dateFrom || !dateTo) return
    if (dateFrom > dateTo) {
      toast.error('La fecha inicial no puede ser mayor que la final')
      return
    }
    const span = daysBetweenInclusive(dateFrom, dateTo)
    if (span > MAX_RANGE_DAYS) {
      toast.error(`El rango máximo es ${MAX_RANGE_DAYS} días`)
      return
    }
    setExportingRange(true)
    try {
      const p = new URLSearchParams({
        plant_id: plantId,
        date_from: dateFrom,
        date_to: dateTo,
      })
      const res = await fetch(`/api/procurement/consumos/rango/contable?${p}`)
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'No se pudo generar el detalle contable')
      }
      const payload = json.data as ConsumosAccountingExcelPayload | undefined
      if (!payload || payload.mode !== 'range') {
        throw new Error('Respuesta inválida del servidor')
      }
      const buf = await buildConsumosMaterialesExcel(payload)
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = consumosAccountingExcelFilename(payload)
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success(
        payload.days.length === 0
          ? 'Reporte Excel generado (sin movimientos en el período)'
          : `Reporte Excel generado (${payload.days.length} día(s) con movimiento)`
      )
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Error al exportar')
    } finally {
      setExportingRange(false)
    }
  }, [plantId, dateFrom, dateTo])

  if (!plantId) {
    return null
  }

  return (
    <Card className="rounded-lg border border-stone-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-sky-800" aria-hidden />
          Export contable (mismo formato que Compras → Consumos)
        </CardTitle>
        <CardDescription className="text-xs text-stone-500">
          Descargue el mismo Excel que usa contabilidad para validar movimientos por día o por período antes de cierre.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 items-end rounded-md border border-stone-100 bg-stone-50/60 p-4">
          <div className="space-y-2">
            <Label htmlFor="pc-single-date" className="text-stone-700">
              Día (consumo diario)
            </Label>
            <Input
              id="pc-single-date"
              type="date"
              value={singleDate}
              onChange={(e) => setSingleDate(e.target.value)}
              className="w-[200px] border-stone-300 bg-white"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-stone-300"
            disabled={exportingDay}
            onClick={() => void exportDayExcel()}
          >
            {exportingDay ? 'Generando…' : 'Excel (formato contabilidad)'}
          </Button>
        </div>

        <div className="flex flex-col xl:flex-row flex-wrap gap-4 items-end rounded-md border border-stone-100 bg-stone-50/60 p-4">
          <div className="space-y-2">
            <Label htmlFor="pc-from" className="text-stone-700">
              Desde
            </Label>
            <Input
              id="pc-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[160px] border-stone-300 bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pc-to" className="text-stone-700">
              Hasta
            </Label>
            <Input
              id="pc-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[160px] border-stone-300 bg-white"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-stone-300"
            disabled={exportingRange}
            onClick={() => void exportRangeExcel()}
          >
            {exportingRange ? 'Generando…' : 'Excel período (formato contabilidad)'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
