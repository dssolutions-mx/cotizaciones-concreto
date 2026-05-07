'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Activity, Factory, FileSpreadsheet, Package, Scale, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  consumosAccountingExcelFilename,
  type ConsumosAccountingExcelPayload,
  type ConsumosAccountingMaterialBlock,
  type ConsumosAccountingSummary,
} from '@/lib/procurement/consumosAccountingExcelExport'
import { buildConsumosMaterialesExcel } from '@/lib/reports/consumosMaterialesExcel'
import { adjustmentTypeLabelEs, formatSignedKg } from '@/lib/inventory/adjustmentModel'
import { adjustmentDisplayForConsumos } from '@/lib/procurement/openingConsumosMerge'
import { cn } from '@/lib/utils'

type MaterialBlock = ConsumosAccountingMaterialBlock

type Summary = ConsumosAccountingSummary

type ApiResponse = { success: boolean; data?: ConsumosAccountingExcelPayload; error?: string }

const fmtKg = (n: number) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n)

function PlantSection({
  plantName,
  summary,
  materials,
}: {
  plantName: string
  summary: Summary
  materials: MaterialBlock[]
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-stone-800">
        <Factory className="h-5 w-5 text-sky-800 shrink-0" aria-hidden />
        <h2 className="text-lg font-semibold">{plantName}</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card className="border-stone-200 bg-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" />
              Consumo (remisiones)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-xl font-mono font-semibold tabular-nums text-stone-900">
              {fmtKg(summary.total_consumption_kg)} kg
            </p>
          </CardContent>
        </Card>
        <Card className="border-stone-200 bg-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Desperdicio Arkik
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-xl font-mono font-semibold tabular-nums text-stone-900">
              {fmtKg(summary.total_waste_arkik_kg)} kg
            </p>
          </CardContent>
        </Card>
        <Card className="border-stone-200 bg-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5 opacity-70" />
              Merma inventario
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-xl font-mono font-semibold tabular-nums text-stone-900">
              {fmtKg(summary.total_merma_inventario_kg)} kg
            </p>
          </CardContent>
        </Card>
        <Card className="border-stone-200 bg-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Entradas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-xl font-mono font-semibold tabular-nums text-stone-900">
              {fmtKg(summary.total_entries_kg)} kg
            </p>
          </CardContent>
        </Card>
        <Card className="border-stone-200 bg-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Ajustes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-0.5">
            <p className="text-xl font-mono font-semibold tabular-nums text-stone-900">
              {fmtKg(summary.total_adjustments_kg)} kg
            </p>
            <p className="text-[10px] text-stone-500 leading-tight">
              Magnitud por línea para cuadrar: en aperturas de saldo coincide con «valor reportado»; en otros movimientos,
              |efecto en inventario|.
            </p>
            <p className="text-sm font-mono font-medium tabular-nums text-stone-800 pt-0.5">
              Neto inventario: {formatSignedKg(summary.total_adjustments_net_effect_kg)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-stone-200 bg-white">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Remisiones
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-xl font-mono font-semibold tabular-nums text-stone-900">
              {summary.remision_count}
            </p>
          </CardContent>
        </Card>
      </div>

      {materials.length === 0 ? (
        <p className="text-sm text-stone-500 py-6 text-center border border-dashed border-stone-200 rounded-lg bg-stone-50/80">
          Sin movimientos de inventario este día en esta planta.
        </p>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {materials.map((m) => (
            <AccordionItem
              key={`${plantName}-${m.material_id}`}
              value={`${plantName}-${m.material_id}`}
              className="border border-stone-200 rounded-lg bg-white px-2"
            >
              <AccordionTrigger className="text-left hover:no-underline py-3 px-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 w-full pr-2">
                  <span className="font-medium text-stone-900">{m.material_name}</span>
                  <span className="text-sm font-mono text-stone-600 tabular-nums">
                    Consumo remisiones: <strong className="text-stone-900">{fmtKg(m.total_consumed_kg)} kg</strong>
                    {m.entries.length > 0 && (
                      <span className="text-stone-500">
                        {' '}
                        · Entradas: {m.entries.length}
                      </span>
                    )}
                    {m.total_waste_arkik_kg > 1e-9 && (
                      <span className="text-stone-500">
                        {' '}
                        · Arkik: {fmtKg(m.total_waste_arkik_kg)} kg
                      </span>
                    )}
                    {m.total_merma_inventario_kg > 1e-9 && (
                      <span className="text-stone-500">
                        {' '}
                        · Merma: {fmtKg(m.total_merma_inventario_kg)} kg
                      </span>
                    )}
                    {m.adjustments.length > 0 && (
                      <span className="text-stone-500">
                        {' '}
                        · Ajustes: {m.adjustments.length}
                      </span>
                    )}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 px-2 space-y-6">
                {m.consumptions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-stone-800 mb-2">Consumos por remisión</h4>
                    <div className="rounded-md border border-stone-200 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-stone-50">
                            <TableHead className="whitespace-nowrap">Remisión</TableHead>
                            <TableHead className="whitespace-nowrap">Cliente / obra</TableHead>
                            <TableHead className="whitespace-nowrap">Receta</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Teórico</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Real</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Ajuste</TableHead>
                            <TableHead className="whitespace-nowrap">Hora</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {m.consumptions.map((c, i) => (
                            <TableRow key={`${c.remision_id}-${i}`}>
                              <TableCell className="font-mono text-sm">{c.remision_number}</TableCell>
                              <TableCell className="text-sm max-w-[200px]">
                                <div className="truncate" title={c.client_name || c.construction_site || ''}>
                                  {c.client_name || '—'}
                                </div>
                                {c.construction_site ? (
                                  <div className="text-xs text-stone-500 truncate">{c.construction_site}</div>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-sm whitespace-nowrap">
                                {c.recipe_code || '—'}
                                {c.strength_fc != null ? (
                                  <span className="text-stone-500"> · fc{c.strength_fc}</span>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm tabular-nums">
                                {fmtKg(c.cantidad_teorica)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm tabular-nums font-medium">
                                {fmtKg(c.cantidad_real)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm tabular-nums">
                                {fmtKg(c.ajuste)}
                              </TableCell>
                              <TableCell className="font-mono text-sm whitespace-nowrap">
                                {c.hora_carga || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {m.entries.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-stone-800 mb-2">Entradas</h4>
                    <div className="rounded-md border border-stone-200 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-stone-50">
                            <TableHead>Entrada</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead>Factura / doc.</TableHead>
                            <TableHead className="text-right">Cantidad (kg)</TableHead>
                            <TableHead>Hora</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {m.entries.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className="font-mono text-sm">{e.entry_number}</TableCell>
                              <TableCell className="text-sm">{e.supplier_name || '—'}</TableCell>
                              <TableCell className="font-mono text-sm">{e.supplier_invoice || '—'}</TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {fmtKg(e.quantity_received)}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{e.entry_time || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {m.waste_arkik.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-stone-800 mb-2">
                      Desperdicio Arkik (waste_materials)
                    </h4>
                    <div className="rounded-md border border-stone-200 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-stone-50">
                            <TableHead className="whitespace-nowrap">Remisión / ticket</TableHead>
                            <TableHead className="whitespace-nowrap">Código material</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Cantidad (kg)</TableHead>
                            <TableHead>Motivo</TableHead>
                            <TableHead>Notas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {m.waste_arkik.map((w) => (
                            <TableRow key={w.id}>
                              <TableCell className="font-mono text-sm">{w.remision_number}</TableCell>
                              <TableCell className="font-mono text-sm">{w.material_code || '—'}</TableCell>
                              <TableCell className="text-right font-mono tabular-nums">{fmtKg(w.waste_amount)}</TableCell>
                              <TableCell className="text-sm">{w.waste_reason}</TableCell>
                              <TableCell className="text-sm max-w-[220px] truncate" title={w.notes || ''}>
                                {w.notes || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {m.adjustments.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-stone-800 mb-2">Ajustes</h4>
                    <div className="rounded-md border border-stone-200 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-stone-50">
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Magnitud (kg)</TableHead>
                            <TableHead className="text-right">Efecto en stock (kg)</TableHead>
                            <TableHead>Notas</TableHead>
                            <TableHead>Hora</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {m.adjustments.map((a) => {
                            const disp = adjustmentDisplayForConsumos(a)
                            return (
                            <TableRow key={a.id}>
                              <TableCell className="text-sm">{adjustmentTypeLabelEs(a.adjustment_type)}</TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-stone-600">
                                {fmtKg(disp.magnitudeKg)}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-right font-mono tabular-nums text-sm',
                                  disp.effectSignedKg >= 0 ? 'text-emerald-800' : 'text-red-800'
                                )}
                              >
                                {formatSignedKg(disp.effectSignedKg)}
                              </TableCell>
                              <TableCell className="text-sm max-w-[240px] truncate" title={a.reference_notes || ''}>
                                {a.reference_notes || '—'}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{a.adjustment_time || '—'}</TableCell>
                            </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  )
}

type Props = {
  /** From procurement header; empty = todas las plantas (roles globales) */
  workspacePlantId: string
}

export default function DailyConsumptionsView({ workspacePlantId }: Props) {
  const searchParams = useSearchParams()
  const consumosDateFromUrl = searchParams.get('consumos_date')
  const plantIdFromUrl = searchParams.get('plant_id') || ''
  const [date, setDate] = useState(() => {
    const fromUrl = consumosDateFromUrl
    if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) return fromUrl
    return new Date().toISOString().slice(0, 10)
  })

  useEffect(() => {
    if (consumosDateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(consumosDateFromUrl)) {
      setDate((d) => (d === consumosDateFromUrl ? d : consumosDateFromUrl))
    }
  }, [consumosDateFromUrl])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<ConsumosAccountingExcelPayload | null>(null)
  const [exporting, setExporting] = useState(false)

  const params = useMemo(() => {
    const p = new URLSearchParams({ date })
    const plant = workspacePlantId || plantIdFromUrl
    if (plant) p.set('plant_id', plant)
    return p.toString()
  }, [date, workspacePlantId, plantIdFromUrl])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/procurement/consumos?${params}`)
      const json = (await res.json()) as ApiResponse
      if (!res.ok) {
        setPayload(null)
        setError(json.error || 'No se pudo cargar')
        return
      }
      if (json.success && json.data) {
        setPayload(json.data)
      } else {
        setPayload(null)
        setError('Respuesta inválida')
      }
    } catch {
      setPayload(null)
      setError('Error de red')
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    void load()
  }, [load])

  const periodoHref = useMemo(() => {
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const params = new URLSearchParams({
      date_from: start.toISOString().slice(0, 10),
      date_to: d.toISOString().slice(0, 10),
    })
    const plant = workspacePlantId || plantIdFromUrl
    if (plant) params.set('plant_id', plant)
    return `/finanzas/procurement/consumos-periodo?${params.toString()}`
  }, [workspacePlantId, plantIdFromUrl])

  const exportAccountingExcel = useCallback(async () => {
    if (!payload) {
      toast.error('No hay datos cargados para exportar')
      return
    }
    setExporting(true)
    try {
      const buf = await buildConsumosMaterialesExcel(payload)
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = consumosAccountingExcelFilename(payload)
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('Reporte Excel generado (Resumen + detalle por hoja)')
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el Excel')
    } finally {
      setExporting(false)
    }
  }, [payload])

  const canExport = Boolean(payload && !loading && !error)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <Link
          href={periodoHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-sky-800 hover:text-sky-950 border border-sky-200 bg-sky-50/80 rounded-lg px-3 py-2 w-fit"
        >
          Consumo por período (rango / mes)
        </Link>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 flex-1">
          <div className="space-y-2">
            <Label htmlFor="consumos-date" className="text-stone-700">
              Fecha
            </Label>
            <Input
              id="consumos-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[200px] border-stone-300 bg-white"
            />
          </div>
          <p className="text-sm text-stone-600 pb-1">
            {workspacePlantId
              ? 'Datos de la planta seleccionada en el encabezado.'
              : 'Todas las plantas activas (resumen por planta).'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-stone-300 bg-white shrink-0 gap-2"
          disabled={!canExport || exporting}
          onClick={() => void exportAccountingExcel()}
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          {exporting ? 'Generando…' : 'Excel (formato contabilidad)'}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-40 rounded-lg" />
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="pt-6 text-sm text-red-800">{error}</CardContent>
        </Card>
      ) : payload?.mode === 'single' ? (
        <PlantSection
          plantName={payload.plant_name}
          summary={payload.summary}
          materials={payload.materials}
        />
      ) : payload?.mode === 'all' ? (
        <div className="space-y-10">
          {payload.plants.map((p) => (
            <PlantSection
              key={p.plant_id}
              plantName={p.plant_name}
              summary={p.summary}
              materials={p.materials}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
