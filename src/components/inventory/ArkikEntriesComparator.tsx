'use client'

import React, { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { usePlantContext } from '@/contexts/PlantContext'
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb'
import type {
  ArkikComparisonResult,
  ArkikReconciliationResult,
  ArkikSystemSource,
} from '@/lib/inventory/arkikEntriesComparator'
import type { ArkikConsumoComparisonResult } from '@/lib/inventory/arkikConsumoComparator'
import type { ArkikRegresoComparisonResult } from '@/lib/inventory/arkikRegresoProveedorComparator'
import { formatArkikQtyWithKg } from '@/lib/inventory/arkikUnitConversion'
import { adjustmentTypeLabelEs } from '@/lib/inventory/adjustmentModel'
import { FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

function sourceLabel(source: ArkikSystemSource) {
  return source === 'entry' ? 'Entrada' : 'Ajuste'
}

function regresoMatchKindLabel(kind: 'remision' | 'fecha_cantidad' | 'notas') {
  if (kind === 'remision') return 'Remisión'
  if (kind === 'fecha_cantidad') return 'Fecha + kg'
  return 'Notas'
}

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

function fmtQty(n: number) {
  return n.toLocaleString('es-MX', { maximumFractionDigits: 2 })
}

export default function ArkikEntriesComparator() {
  const { currentPlant, isGlobalAdmin, isLoading: plantLoading } = usePlantContext()
  const mb = useMemo(() => monthBounds(), [])
  const [file, setFile] = useState<File | null>(null)
  const [dateFrom, setDateFrom] = useState(mb.from)
  const [dateTo, setDateTo] = useState(mb.to)
  const [comparing, setComparing] = useState(false)
  const [result, setResult] = useState<ArkikReconciliationResult | null>(null)
  const [lastFileName, setLastFileName] = useState<string | null>(null)

  const runComparison = useCallback(async () => {
    if (!currentPlant?.id) {
      toast.error('Seleccione una planta')
      return
    }
    if (!file) {
      toast.error('Seleccione el archivo de movimientos Arkik')
      return
    }
    if (!dateFrom || !dateTo) return
    if (dateFrom > dateTo) {
      toast.error('La fecha inicial no puede ser mayor que la final')
      return
    }
    if (daysBetweenInclusive(dateFrom, dateTo) > MAX_RANGE_DAYS) {
      toast.error(`El rango máximo es ${MAX_RANGE_DAYS} días`)
      return
    }

    setComparing(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.set('arkik_file', file)
      fd.set('plant_id', currentPlant.id)
      fd.set('date_from', dateFrom)
      fd.set('date_to', dateTo)

      const res = await fetch('/api/production-control/arkik-entries-comparison', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Error al comparar')
      }
      setResult(json.data as ArkikReconciliationResult)
      setLastFileName(json.file_name ?? file.name)
      toast.success('Comparación completada')
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Error al comparar')
    } finally {
      setComparing(false)
    }
  }, [currentPlant?.id, file, dateFrom, dateTo])

  const rem = result?.con_remision ?? null
  const consumo = result?.consumo_sin_remision ?? null
  const regreso = result?.regreso_proveedor ?? null

  const remSummaryRows = useMemo(() => {
    if (!rem) return []
    return Object.entries(rem.summary).sort(([a], [b]) => a.localeCompare(b))
  }, [rem])

  const consumoSummaryRows = useMemo(() => {
    if (!consumo) return []
    return Object.entries(consumo.summary).sort(([a], [b]) => a.localeCompare(b))
  }, [consumo])

  const regresoSummaryRows = useMemo(() => {
    if (!regreso) return []
    return Object.entries(regreso.summary).sort(([a], [b]) => a.localeCompare(b))
  }, [regreso])

  if (plantLoading) {
    return <div className="text-sm text-stone-500 py-8">Cargando…</div>
  }

  if (isGlobalAdmin && !currentPlant) {
    return (
      <div className="space-y-4">
        <InventoryBreadcrumb />
        <p className="text-stone-700">
          Seleccione una planta en el selector superior para conciliar movimientos Arkik.
        </p>
      </div>
    )
  }

  if (!currentPlant) {
    return (
      <div className="space-y-4">
        <InventoryBreadcrumb />
        <p className="text-stone-700">No hay planta asignada a su perfil.</p>
      </div>
    )
  }

  const remOk =
    rem != null &&
    rem.only_excel.length === 0 &&
    rem.only_db.length === 0 &&
    rem.adjustments_without_remision.length === 0
  const consumoOk =
    consumo != null &&
    consumo.only_excel.length === 0 &&
    consumo.only_db.length === 0 &&
    consumo.negative_with_remision.length === 0
  const regresoOnlyDbCount = regreso?.only_db.length ?? 0
  const regresoOk =
    regreso != null &&
    regreso.only_excel.length === 0 &&
    regresoOnlyDbCount === 0 &&
    regreso.db_regreso_notes_review.length === 0
  const allOk = result != null && remOk && consumoOk && regresoOk

  return (
    <div className="space-y-6">
      <InventoryBreadcrumb />

      <div>
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
          Conciliar movimientos Arkik
        </h1>
        <p className="text-sm text-stone-600 mt-1 max-w-2xl">
          Cargue <strong>Movimientos de Material</strong> de Arkik. Incluye entradas{' '}
          <strong>con y sin remisión</strong> (el comentario junto a la fecha se muestra en tablas),
          consumos, y regreso a proveedor. Las cantidades Arkik usan la unidad del bloque (p. ej.{' '}
          <strong>T</strong> → kg) antes de comparar.
        </p>
        <p className="text-xs text-stone-500 mt-1">
          Planta: {currentPlant.name}
          {currentPlant.code ? ` (${currentPlant.code})` : ''}
        </p>
      </div>

      <Card className="border-stone-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-violet-700" />
            Archivo y período
          </CardTitle>
          <CardDescription>
            El rango de fechas debe coincidir con el período del reporte Arkik.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="arkik-mov-file">Archivo (.xls, .xlsx)</Label>
              <Input
                id="arkik-mov-file"
                type="file"
                accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arkik-date-from">Desde</Label>
              <Input
                id="arkik-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arkik-date-to">Hasta</Label>
              <Input
                id="arkik-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={runComparison} disabled={comparing || !file}>
            {comparing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Comparando…
              </>
            ) : (
              'Comparar con sistema'
            )}
          </Button>
        </CardContent>
      </Card>

      {result && rem && consumo && regreso ? (
        <>
          <div
            className={cn(
              'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
              allOk
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-950'
            )}
          >
            {allOk ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" />
            )}
            <div>
              {allOk ? (
                <p className="font-medium">Todo conciliado en las tres vías para el período.</p>
              ) : (
                <p className="font-medium">
                  Hay diferencias en entradas, consumos o regresos a proveedor. Revise cada pestaña
                  (en regresos, priorice las notas).
                </p>
              )}
              {lastFileName ? (
                <p className="text-xs mt-1 opacity-80">Archivo: {lastFileName}</p>
              ) : null}
            </div>
          </div>

          <Tabs defaultValue="remision" className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
              <TabsTrigger value="remision">Con remisión (entradas)</TabsTrigger>
              <TabsTrigger value="consumo">Consumos sin remisión</TabsTrigger>
              <TabsTrigger value="regreso">
                Regreso a proveedor ({regreso.meta.excel_regreso_count})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="remision" className="space-y-6 mt-0">
              <RemisionReconciliationPanel rem={rem} summaryRows={remSummaryRows} />
            </TabsContent>

            <TabsContent value="consumo" className="space-y-6 mt-0">
              <ConsumoReconciliationPanel consumo={consumo} summaryRows={consumoSummaryRows} />
            </TabsContent>

            <TabsContent value="regreso" className="space-y-6 mt-0">
              <RegresoProveedorPanel regreso={regreso} summaryRows={regresoSummaryRows} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  )
}

function RemisionReconciliationPanel({
  rem,
  summaryRows,
}: {
  rem: ArkikComparisonResult
  summaryRows: [string, { matched: number; only_excel: number; only_db: number }][]
}) {
  const matchedCount = rem.matched.length
  const onlyExcelCount = rem.only_excel.length
  const onlyDbCount = rem.only_db.length
  const adjNoRemCount = rem.adjustments_without_remision.length
  const sinRem = rem.entradas_sin_remision
  const sinRemMatched = sinRem.matched.length
  const sinRemExcelOnly = sinRem.only_excel.length
  const sinRemDbOnly = sinRem.only_db.length
  const sinRemTotal = sinRemMatched + sinRemExcelOnly + sinRemDbOnly

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-stone-600">Coincidencias</div>
            <div className="text-2xl font-semibold text-emerald-900 tabular-nums">{matchedCount}</div>
            <div className="text-xs text-stone-500 mt-1">
              Con remisión: {rem.meta.excel_entrada_count} Arkik / {rem.meta.db_entry_count} sistema
              · Sin remisión: {rem.meta.excel_entrada_sin_remision_count} Arkik /{' '}
              {rem.meta.db_entry_sin_remision_count} sistema
            </div>
          </CardContent>
        </Card>
        <Card className={cn('border-amber-200', onlyExcelCount > 0 ? 'bg-amber-50/60' : 'bg-white')}>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-stone-600">Solo en Arkik</div>
            <div className="text-2xl font-semibold text-amber-900 tabular-nums">{onlyExcelCount}</div>
          </CardContent>
        </Card>
        <Card className={cn('border-amber-200', onlyDbCount > 0 ? 'bg-amber-50/60' : 'bg-white')}>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-stone-600">Solo en sistema</div>
            <div className="text-2xl font-semibold text-amber-900 tabular-nums">{onlyDbCount}</div>
          </CardContent>
        </Card>
      </div>

          {summaryRows.length > 0 ? (
            <Card className="border-stone-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Resumen por material</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Coinciden</TableHead>
                      <TableHead className="text-right">Solo Arkik</TableHead>
                      <TableHead className="text-right">Solo sistema</TableHead>
                      <TableHead className="w-[100px]">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryRows.map(([mat, counts]) => {
                      const ok = counts.only_excel === 0 && counts.only_db === 0
                      return (
                        <TableRow key={mat}>
                          <TableCell className="font-mono text-sm">{mat}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {counts.matched}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {counts.only_excel}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {counts.only_db}
                          </TableCell>
                          <TableCell>
                            {ok ? (
                              <Badge variant="outline" className="border-emerald-300 text-emerald-800">
                                OK
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-300 text-amber-900">
                                Revisar
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {rem.meta.excel_entrada_count === 0 &&
          rem.meta.excel_entrada_sin_remision_count === 0 ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No se detectaron filas <strong>Entrada</strong> en el Excel. Verifique el archivo o el
              rango de fechas.
            </p>
          ) : null}

          <Tabs
            defaultValue={matchedCount > 0 ? 'matched' : 'only_excel'}
            className="w-full"
          >
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="matched">Coincidencias ({matchedCount})</TabsTrigger>
              <TabsTrigger value="only_excel">
                Solo Arkik ({onlyExcelCount})
              </TabsTrigger>
              <TabsTrigger value="only_db">Solo sistema ({onlyDbCount})</TabsTrigger>
              {sinRemTotal > 0 ? (
                <TabsTrigger value="entrada_sin_rem">
                  Entradas sin remisión ({sinRemTotal})
                </TabsTrigger>
              ) : null}
              {adjNoRemCount > 0 ? (
                <TabsTrigger value="adj_no_rem">
                  Ajustes sin remisión ({adjNoRemCount})
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="only_excel" className="mt-4">
              <DetailTable
                empty="No hay entradas en Arkik sin registro en el sistema."
                rows={rem.only_excel.map((r) => ({
                  key: `${r.material}-${r.remision}-${r.fecha}`,
                  cells: [
                    r.material,
                    r.remision,
                    r.fecha ?? '—',
                    r.notas || '—',
                    formatArkikQtyWithKg(r.cantidad, r.unit_arkik, r.cantidad_kg),
                    r.proveedor,
                    '—',
                  ],
                }))}
                headers={[
                  'Material',
                  'Remisión',
                  'Fecha',
                  'Comentario Arkik',
                  'Cantidad Arkik',
                  'Proveedor (Arkik)',
                  'Entrada',
                ]}
              />
              {onlyExcelCount > 0 ? (
                <p className="text-xs text-stone-500 mt-2">
                  <Link
                    href="/production-control/entries?tab=new"
                    className="text-sky-700 hover:underline"
                  >
                    Registrar entrada
                  </Link>{' '}
                  o{' '}
                  <Link
                    href="/production-control/adjustments"
                    className="text-sky-700 hover:underline"
                  >
                    registrar ajuste positivo
                  </Link>{' '}
                  si aplica.
                </p>
              ) : null}
            </TabsContent>

            <TabsContent value="only_db" className="mt-4">
              <DetailTable
                empty="No hay registros en el sistema ausentes del Excel."
                rows={rem.only_db.map((r) => ({
                  key: `${r.system_source}-${r.record_number}`,
                  cells: [
                    r.material,
                    r.remision,
                    sourceLabel(r.system_source),
                    r.fecha,
                    r.system_source === 'entry'
                      ? `${fmtQty(r.cantidad)} kg`
                      : `${fmtQty(r.cantidad)} kg`,
                    r.adjustment_type
                      ? adjustmentTypeLabelEs(r.adjustment_type)
                      : r.detail,
                    r.record_number,
                  ],
                }))}
                headers={[
                  'Material',
                  'Remisión',
                  'Tipo',
                  'Fecha',
                  'Cantidad',
                  'Detalle',
                  'Folio',
                ]}
              />
            </TabsContent>

            <TabsContent value="matched" className="mt-4">
              <DetailTable
                empty="No hay coincidencias en este período."
                rows={rem.matched.map((r, i) => ({
                  key: `${r.system_source}-${r.record_number}-${i}`,
                  cells: [
                    r.material,
                    r.remision,
                    r.notas_excel || '—',
                    sourceLabel(r.system_source),
                    r.fecha_excel ?? '—',
                    formatArkikQtyWithKg(r.cantidad_excel, r.unit_arkik, r.cantidad_excel_kg),
                    r.fecha_db,
                    `${fmtQty(r.cantidad_db)} kg`,
                    r.record_number,
                  ],
                }))}
                headers={[
                  'Material',
                  'Remisión',
                  'Comentario Arkik',
                  'En sistema',
                  'Fecha Arkik',
                  'Cant. Arkik (→ kg)',
                  'Fecha sistema',
                  'Cant. sistema (kg)',
                  'Folio',
                ]}
              />
            </TabsContent>

            {sinRemTotal > 0 ? (
              <TabsContent value="entrada_sin_rem" className="mt-4">
                <p className="text-sm text-stone-600 mb-3">
                  Entradas Arkik <strong>sin remisión</strong> en columna 14, frente a entradas de
                  sistema sin factura/remisión. Se intenta empatar por material + fecha + cantidad
                  (kg). Revise el <strong>comentario</strong> junto a la fecha en Arkik.
                </p>
                <Tabs defaultValue={sinRemMatched > 0 ? 'sr_matched' : 'sr_excel'} className="w-full">
                  <TabsList className="flex flex-wrap h-auto gap-1 mb-3">
                    <TabsTrigger value="sr_matched">Coincidencias ({sinRemMatched})</TabsTrigger>
                    <TabsTrigger value="sr_excel">Solo Arkik ({sinRemExcelOnly})</TabsTrigger>
                    <TabsTrigger value="sr_db">Solo sistema ({sinRemDbOnly})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="sr_matched">
                    <DetailTable
                      empty="Sin coincidencias por fecha y cantidad."
                      rows={sinRem.matched.map((r, i) => ({
                        key: `${r.entry_number}-${i}`,
                        cells: [
                          r.material,
                          r.fecha_excel ?? '—',
                          r.notas_excel || '—',
                          formatArkikQtyWithKg(r.cantidad_excel, r.unit_arkik, r.cantidad_excel_kg),
                          r.fecha_db,
                          `${fmtQty(r.cantidad_db)} kg`,
                          (r.notes_db ?? '').slice(0, 80) || '—',
                          r.entry_number,
                        ],
                      }))}
                      headers={[
                        'Material',
                        'Fecha Arkik',
                        'Comentario Arkik',
                        'Cant. Arkik',
                        'Fecha sistema',
                        'Cant. sistema',
                        'Notas entrada',
                        'Folio',
                      ]}
                    />
                  </TabsContent>
                  <TabsContent value="sr_excel">
                    <DetailTable
                      empty=""
                      rows={sinRem.only_excel.map((r) => ({
                        key: `${r.material}-${r.fecha}-${r.cantidad_kg}`,
                        cells: [
                          r.material,
                          r.fecha ?? '—',
                          r.notas || '—',
                          formatArkikQtyWithKg(r.cantidad, r.unit_arkik, r.cantidad_kg),
                          r.proveedor,
                        ],
                      }))}
                      headers={['Material', 'Fecha', 'Comentario Arkik', 'Cantidad', 'Proveedor']}
                    />
                  </TabsContent>
                  <TabsContent value="sr_db">
                    <DetailTable
                      empty=""
                      rows={sinRem.only_db.map((r) => ({
                        key: r.entry_number,
                        cells: [
                          r.material,
                          r.fecha,
                          (r.notes ?? '').slice(0, 80) || '—',
                          `${fmtQty(r.cantidad)} kg`,
                          r.supplier_name,
                          r.entry_number,
                        ],
                      }))}
                      headers={[
                        'Material',
                        'Fecha',
                        'Notas entrada',
                        'Cantidad',
                        'Proveedor',
                        'Folio',
                      ]}
                    />
                  </TabsContent>
                </Tabs>
              </TabsContent>
            ) : null}

            {adjNoRemCount > 0 ? (
              <TabsContent value="adj_no_rem" className="mt-4">
                <p className="text-sm text-stone-600 mb-3">
                  Ajustes positivos del período sin remisión identificable en referencia. Revise si
                  alguno corresponde a un movimiento Arkik y complete el tipo de referencia o las
                  notas con el folio.
                </p>
                <DetailTable
                  empty=""
                  rows={rem.adjustments_without_remision.map((r) => ({
                    key: r.adjustment_number,
                    cells: [
                      r.material_code,
                      adjustmentTypeLabelEs(r.adjustment_type),
                      r.adjustment_date,
                      fmtQty(r.quantity_adjusted),
                      r.reference_type ?? '—',
                      (r.reference_notes ?? '').slice(0, 80),
                      r.adjustment_number,
                    ],
                  }))}
                  headers={[
                    'Material',
                    'Tipo ajuste',
                    'Fecha',
                    'Cantidad',
                    'Ref. tipo',
                    'Notas',
                    'Folio',
                  ]}
                />
                <p className="text-xs text-stone-500 mt-2">
                  <Link
                    href="/production-control/adjustments"
                    className="text-sky-700 hover:underline"
                  >
                    Ir a ajustes de inventario
                  </Link>
                </p>
              </TabsContent>
            ) : null}
          </Tabs>
    </>
  )
}

function ConsumoReconciliationPanel({
  consumo,
  summaryRows,
}: {
  consumo: ArkikConsumoComparisonResult
  summaryRows: [string, { matched: number; only_excel: number; only_db: number }][]
}) {
  const matchedCount = consumo.matched.length
  const onlyExcelCount = consumo.only_excel.length
  const onlyDbCount = consumo.only_db.length
  const negWithRem = consumo.negative_with_remision.length

  return (
    <>
      <p className="text-sm text-stone-600">
        Movimientos Arkik tipo <strong>Consumo</strong> (u otros de salida) <em>sin remisión</em>,
        comparados con <strong>ajustes negativos</strong> del sistema que tampoco tienen remisión
        en referencia. Clave: material + fecha + cantidad en <strong>kg</strong> (Arkik convertido
        desde T, kg, etc.).
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-stone-600">Coincidencias</div>
            <div className="text-2xl font-semibold text-emerald-900 tabular-nums">{matchedCount}</div>
            <div className="text-xs text-stone-500 mt-1">
              Excel consumos: {consumo.meta.excel_consumo_count} · Ajustes − sin remisión:{' '}
              {consumo.meta.db_negative_without_remision_count}
            </div>
          </CardContent>
        </Card>
        <Card className={cn('border-amber-200', onlyExcelCount > 0 ? 'bg-amber-50/60' : 'bg-white')}>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-stone-600">Solo en Arkik</div>
            <div className="text-2xl font-semibold text-amber-900 tabular-nums">{onlyExcelCount}</div>
            <div className="text-xs text-stone-500 mt-1">Falta ajuste negativo</div>
          </CardContent>
        </Card>
        <Card className={cn('border-amber-200', onlyDbCount > 0 ? 'bg-amber-50/60' : 'bg-white')}>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-stone-600">Solo en sistema</div>
            <div className="text-2xl font-semibold text-amber-900 tabular-nums">{onlyDbCount}</div>
            <div className="text-xs text-stone-500 mt-1">No está en el Excel</div>
          </CardContent>
        </Card>
      </div>

      {summaryRows.length > 0 ? (
        <Card className="border-stone-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resumen por material</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Coinciden</TableHead>
                  <TableHead className="text-right">Solo Arkik</TableHead>
                  <TableHead className="text-right">Solo sistema</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryRows.map(([mat, counts]) => (
                  <TableRow key={mat}>
                    <TableCell className="font-mono text-sm">{mat}</TableCell>
                    <TableCell className="text-right tabular-nums">{counts.matched}</TableCell>
                    <TableCell className="text-right tabular-nums">{counts.only_excel}</TableCell>
                    <TableCell className="text-right tabular-nums">{counts.only_db}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Tabs
        defaultValue={matchedCount > 0 ? 'matched' : 'only_excel'}
        className="w-full"
      >
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="matched">Coincidencias ({matchedCount})</TabsTrigger>
          <TabsTrigger value="only_excel">Solo Arkik ({onlyExcelCount})</TabsTrigger>
          <TabsTrigger value="only_db">Solo sistema ({onlyDbCount})</TabsTrigger>
          {negWithRem > 0 ? (
            <TabsTrigger value="neg_rem">Ajustes − con remisión ({negWithRem})</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="only_excel" className="mt-4">
          <DetailTable
            empty="No hay consumos Arkik sin ajuste en el sistema."
            rows={consumo.only_excel.map((r) => ({
              key: `${r.material}-${r.fecha}-${r.cantidad}`,
              cells: [
                r.material,
                r.fecha ?? '—',
                r.notas || '—',
                r.movement_type,
                formatArkikQtyWithKg(r.cantidad, r.unit_arkik, r.cantidad_kg),
                r.proveedor,
              ],
            }))}
            headers={['Material', 'Fecha', 'Comentario Arkik', 'Tipo Arkik', 'Cantidad Arkik', 'Proveedor']}
          />
          {onlyExcelCount > 0 ? (
            <p className="text-xs text-stone-500 mt-2">
              <Link href="/production-control/adjustments" className="text-sky-700 hover:underline">
                Registrar ajuste negativo
              </Link>{' '}
              (consumo, merma, etc.) con la misma fecha y cantidad.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="only_db" className="mt-4">
          <DetailTable
            empty="No hay ajustes negativos sin remisión ausentes del Excel."
            rows={consumo.only_db.map((r) => ({
              key: r.adjustment_number,
              cells: [
                r.material,
                r.fecha,
                adjustmentTypeLabelEs(r.adjustment_type),
                fmtQty(r.cantidad),
                r.detail,
                r.adjustment_number,
              ],
            }))}
            headers={['Material', 'Fecha', 'Tipo', 'Cantidad', 'Detalle', 'Folio']}
          />
        </TabsContent>

        <TabsContent value="matched" className="mt-4">
          <DetailTable
            empty="No hay coincidencias por material/fecha/cantidad."
            rows={consumo.matched.map((r, i) => ({
              key: `${r.adjustment_number}-${i}`,
              cells: [
                r.material,
                r.fecha_excel ?? r.fecha_db,
                r.notas_excel || '—',
                r.movement_type_excel,
                formatArkikQtyWithKg(r.cantidad_excel, r.unit_arkik, r.cantidad_excel_kg),
                adjustmentTypeLabelEs(r.adjustment_type),
                `${fmtQty(r.cantidad_db)} kg`,
                r.adjustment_number,
              ],
            }))}
            headers={[
              'Material',
              'Fecha',
              'Comentario Arkik',
              'Tipo Arkik',
              'Cant. Arkik (→ kg)',
              'Tipo ajuste',
              'Cant. sistema (kg)',
              'Folio',
            ]}
          />
        </TabsContent>

        {negWithRem > 0 ? (
          <TabsContent value="neg_rem" className="mt-4">
            <p className="text-sm text-stone-600 mb-3">
              Ajustes negativos con remisión en referencia: no entran en esta vía (sin remisión).
              Revíselos en la pestaña &quot;Con remisión&quot; si aplica.
            </p>
            <DetailTable
              empty=""
              rows={consumo.negative_with_remision.map((r) => ({
                key: r.adjustment_number,
                cells: [
                  r.material_code,
                  r.remision,
                  r.adjustment_date,
                  adjustmentTypeLabelEs(r.adjustment_type),
                  fmtQty(r.quantity_adjusted),
                  r.adjustment_number,
                ],
              }))}
              headers={['Material', 'Remisión', 'Fecha', 'Tipo', 'Cantidad', 'Folio']}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  )
}

function RegresoProveedorPanel({
  regreso,
  summaryRows,
}: {
  regreso: ArkikRegresoComparisonResult
  summaryRows: [string, { matched: number; only_excel: number; only_db: number }][]
}) {
  const matchedCount = regreso.matched.length
  const onlyExcelCount = regreso.only_excel.length
  const onlyDbCount = regreso.only_db.length
  const reviewCount = regreso.db_regreso_notes_review.length

  return (
    <>
      <p className="text-sm text-stone-600">
        Movimientos Arkik <strong>Regreso a proveedor</strong> frente a <strong>ajustes negativos</strong>.
        Se intenta empatar por remisión, por fecha + cantidad (kg), o por similitud de{' '}
        <strong>notas</strong> entre Excel y el ajuste. Revise siempre la columna de notas.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-stone-600">Coincidencias</div>
            <div className="text-2xl font-semibold text-emerald-900 tabular-nums">{matchedCount}</div>
            <div className="text-xs text-stone-500 mt-1">
              Por remisión: {regreso.meta.matched_by_remision} · Fecha/kg:{' '}
              {regreso.meta.matched_by_fecha_cantidad} · Notas: {regreso.meta.matched_by_notas}
            </div>
          </CardContent>
        </Card>
        <Card className={cn('border-amber-200', onlyExcelCount > 0 ? 'bg-amber-50/60' : 'bg-white')}>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-stone-600">Solo en Arkik</div>
            <div className="text-2xl font-semibold text-amber-900 tabular-nums">{onlyExcelCount}</div>
          </CardContent>
        </Card>
        <Card className={cn('border-rose-200', onlyDbCount > 0 ? 'bg-rose-50/60' : 'bg-white')}>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-stone-600">Solo en sistema</div>
            <div className="text-2xl font-semibold text-rose-900 tabular-nums">{onlyDbCount}</div>
          </CardContent>
        </Card>
        <Card className={cn('border-violet-200', reviewCount > 0 ? 'bg-violet-50/60' : 'bg-white')}>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-stone-600">Nota de regreso (revisar)</div>
            <div className="text-2xl font-semibold text-violet-900 tabular-nums">{reviewCount}</div>
            <div className="text-xs text-stone-500 mt-1">Mención en referencia, sin fila Arkik</div>
          </CardContent>
        </Card>
      </div>

      {summaryRows.length > 0 ? (
        <Card className="border-stone-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resumen por material</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Coinciden</TableHead>
                  <TableHead className="text-right">Solo Arkik</TableHead>
                  <TableHead className="text-right">Revisar / solo sistema</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryRows.map(([mat, counts]) => (
                  <TableRow key={mat}>
                    <TableCell className="font-mono text-sm">{mat}</TableCell>
                    <TableCell className="text-right tabular-nums">{counts.matched}</TableCell>
                    <TableCell className="text-right tabular-nums">{counts.only_excel}</TableCell>
                    <TableCell className="text-right tabular-nums">{counts.only_db}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Tabs
        defaultValue={
          matchedCount > 0 ? 'matched' : reviewCount > 0 ? 'review_notes' : 'only_excel'
        }
        className="w-full"
      >
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="matched">Coincidencias ({matchedCount})</TabsTrigger>
          <TabsTrigger value="review_notes">
            Revisar notas ({reviewCount})
          </TabsTrigger>
          <TabsTrigger value="only_excel">Solo Arkik ({onlyExcelCount})</TabsTrigger>
          <TabsTrigger value="only_db">Solo sistema ({onlyDbCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="review_notes" className="mt-4">
          <p className="text-sm text-stone-600 mb-3">
            Ajustes negativos cuya referencia menciona regreso/devolución a proveedor y no
            coincidieron con una fila del Excel. Valide contra Arkik o registre el ajuste.
          </p>
          <DetailTable
            empty="No hay ajustes pendientes con nota de regreso."
            rows={regreso.db_regreso_notes_review.map((r) => ({
              key: r.adjustment_number,
              cells: [
                r.material,
                r.remision ?? '—',
                r.fecha,
                adjustmentTypeLabelEs(r.adjustment_type),
                `${fmtQty(r.cantidad)} kg`,
                r.notas.slice(0, 120),
                r.adjustment_number,
              ],
            }))}
            headers={['Material', 'Remisión', 'Fecha', 'Tipo', 'Cantidad', 'Notas ajuste', 'Folio']}
          />
        </TabsContent>

        <TabsContent value="only_db" className="mt-4">
          <p className="text-sm text-stone-600 mb-3">
            Ajustes negativos del período sin pareja en Arkik (sin mención explícita de regreso en
            notas).
          </p>
          <DetailTable
            empty="No hay ajustes negativos huérfanos."
            rows={regreso.only_db.map((r) => ({
              key: r.adjustment_number,
              cells: [
                r.material,
                r.remision ?? '—',
                r.fecha,
                adjustmentTypeLabelEs(r.adjustment_type),
                `${fmtQty(r.cantidad)} kg`,
                r.notas.slice(0, 120) || '—',
                r.adjustment_number,
              ],
            }))}
            headers={['Material', 'Remisión', 'Fecha', 'Tipo', 'Cantidad', 'Notas ajuste', 'Folio']}
          />
        </TabsContent>

        <TabsContent value="only_excel" className="mt-4">
          <DetailTable
            empty="No hay regresos en Arkik sin ajuste."
            rows={regreso.only_excel.map((r) => ({
              key: `${r.material}-${r.fecha}-${r.cantidad_kg}`,
              cells: [
                r.material,
                r.remision ?? '—',
                r.fecha ?? '—',
                formatArkikQtyWithKg(r.cantidad, r.unit_arkik, r.cantidad_kg),
                r.notas || '—',
                r.proveedor,
              ],
            }))}
            headers={['Material', 'Remisión', 'Fecha', 'Cantidad', 'Notas Arkik', 'Proveedor']}
          />
          {onlyExcelCount > 0 ? (
            <p className="text-xs text-stone-500 mt-2">
              <Link href="/production-control/adjustments" className="text-sky-700 hover:underline">
                Registrar ajuste negativo
              </Link>{' '}
              y copie las notas del Excel en la referencia.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="matched" className="mt-4">
          <DetailTable
            empty="No hay coincidencias."
            rows={regreso.matched.map((r, i) => ({
              key: `${r.adjustment_number}-${i}`,
              cells: [
                r.material,
                regresoMatchKindLabel(r.match_kind),
                r.remision ?? '—',
                formatArkikQtyWithKg(r.cantidad_excel, r.unit_arkik, r.cantidad_excel_kg),
                r.notas_excel || '—',
                r.notas_db || '—',
                adjustmentTypeLabelEs(r.adjustment_type),
                r.adjustment_number,
              ],
            }))}
            headers={[
              'Material',
              'Criterio',
              'Remisión',
              'Cant. Arkik',
              'Notas Arkik',
              'Notas ajuste',
              'Tipo',
              'Folio',
            ]}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}

function DetailTable({
  headers,
  rows,
  empty,
}: {
  headers: string[]
  rows: { key: string; cells: string[] }[]
  empty: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-stone-500 py-4">{empty}</p>
  }
  return (
    <div className="rounded-lg border border-stone-200 overflow-x-auto bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              {row.cells.map((cell, i) => (
                <TableCell
                  key={i}
                  className={cn(
                    i <= 1 ? 'font-mono text-sm' : '',
                    i >= 3 && i <= 5 ? 'tabular-nums text-right' : '',
                    cell.length > 24 ? 'max-w-[220px] text-xs whitespace-normal' : ''
                  )}
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
