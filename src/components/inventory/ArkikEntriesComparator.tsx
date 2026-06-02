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
import type { ArkikComparisonResult } from '@/lib/inventory/arkikEntriesComparator'
import { FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const [result, setResult] = useState<ArkikComparisonResult | null>(null)
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
      setResult(json.data as ArkikComparisonResult)
      setLastFileName(json.file_name ?? file.name)
      toast.success('Comparación completada')
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Error al comparar')
    } finally {
      setComparing(false)
    }
  }, [currentPlant?.id, file, dateFrom, dateTo])

  const summaryRows = useMemo(() => {
    if (!result) return []
    return Object.entries(result.summary).sort(([a], [b]) => a.localeCompare(b))
  }, [result])

  if (plantLoading) {
    return <div className="text-sm text-stone-500 py-8">Cargando…</div>
  }

  if (isGlobalAdmin && !currentPlant) {
    return (
      <div className="space-y-4">
        <InventoryBreadcrumb />
        <p className="text-stone-700">
          Seleccione una planta en el selector superior para conciliar entradas con Arkik.
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

  const matchedCount = result?.matched.length ?? 0
  const onlyExcelCount = result?.only_excel.length ?? 0
  const onlyDbCount = result?.only_db.length ?? 0
  const allOk = result != null && onlyExcelCount === 0 && onlyDbCount === 0

  return (
    <div className="space-y-6">
      <InventoryBreadcrumb />

      <div>
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
          Conciliar entradas con Arkik
        </h1>
        <p className="text-sm text-stone-600 mt-1 max-w-2xl">
          Cargue el export <strong>Movimientos de Material</strong> de Arkik (solo movimientos tipo
          Entrada) y compárelo con las entradas registradas en el sistema por material y remisión.
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
              'Comparar con entradas del sistema'
            )}
          </Button>
        </CardContent>
      </Card>

      {result ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="pt-4 pb-4">
                <div className="text-sm text-stone-600">Coincidencias</div>
                <div className="text-2xl font-semibold text-emerald-900 tabular-nums">
                  {matchedCount}
                </div>
                <div className="text-xs text-stone-500 mt-1">
                  {result.meta.excel_entrada_count} entradas en Excel ·{' '}
                  {result.meta.db_entry_count} en sistema
                </div>
              </CardContent>
            </Card>
            <Card
              className={cn(
                'border-amber-200',
                onlyExcelCount > 0 ? 'bg-amber-50/60' : 'bg-white'
              )}
            >
              <CardContent className="pt-4 pb-4">
                <div className="text-sm text-stone-600">Solo en Arkik</div>
                <div className="text-2xl font-semibold text-amber-900 tabular-nums">
                  {onlyExcelCount}
                </div>
                <div className="text-xs text-stone-500 mt-1">Faltan en el sistema</div>
              </CardContent>
            </Card>
            <Card
              className={cn(
                'border-amber-200',
                onlyDbCount > 0 ? 'bg-amber-50/60' : 'bg-white'
              )}
            >
              <CardContent className="pt-4 pb-4">
                <div className="text-sm text-stone-600">Solo en sistema</div>
                <div className="text-2xl font-semibold text-amber-900 tabular-nums">
                  {onlyDbCount}
                </div>
                <div className="text-xs text-stone-500 mt-1">No aparecen en el Excel</div>
              </CardContent>
            </Card>
          </div>

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
                <p className="font-medium">Todo conciliado para el período seleccionado.</p>
              ) : (
                <p className="font-medium">
                  Hay diferencias entre Arkik y las entradas registradas. Revise las pestañas de
                  detalle.
                </p>
              )}
              {lastFileName ? (
                <p className="text-xs mt-1 opacity-80">Archivo: {lastFileName}</p>
              ) : null}
            </div>
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

          <Tabs defaultValue="only_excel" className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="only_excel">
                Solo Arkik ({onlyExcelCount})
              </TabsTrigger>
              <TabsTrigger value="only_db">Solo sistema ({onlyDbCount})</TabsTrigger>
              <TabsTrigger value="matched">Coincidencias ({matchedCount})</TabsTrigger>
            </TabsList>

            <TabsContent value="only_excel" className="mt-4">
              <DetailTable
                empty="No hay entradas en Arkik sin registro en el sistema."
                rows={result.only_excel.map((r) => ({
                  key: `${r.material}-${r.remision}-${r.fecha}`,
                  cells: [
                    r.material,
                    r.remision,
                    r.fecha ?? '—',
                    fmtQty(r.cantidad),
                    r.proveedor,
                    '—',
                  ],
                })}
                headers={['Material', 'Remisión', 'Fecha', 'Cantidad', 'Proveedor (Arkik)', 'Entrada']}
              />
              {onlyExcelCount > 0 ? (
                <p className="text-xs text-stone-500 mt-2">
                  <Link
                    href="/production-control/entries?tab=new"
                    className="text-sky-700 hover:underline"
                  >
                    Registrar entrada
                  </Link>{' '}
                  para los movimientos faltantes.
                </p>
              ) : null}
            </TabsContent>

            <TabsContent value="only_db" className="mt-4">
              <DetailTable
                empty="No hay entradas en el sistema ausentes del Excel."
                rows={result.only_db.map((r) => ({
                  key: r.entry_number,
                  cells: [
                    r.material,
                    r.remision,
                    r.fecha,
                    fmtQty(r.cantidad),
                    r.supplier,
                    r.entry_number,
                  ],
                })}
                headers={[
                  'Material',
                  'Remisión',
                  'Fecha',
                  'Cantidad',
                  'Proveedor',
                  'Nº entrada',
                ]}
              />
            </TabsContent>

            <TabsContent value="matched" className="mt-4">
              <DetailTable
                empty="No hay coincidencias en este período."
                rows={result.matched.map((r, i) => ({
                  key: `${r.entry_number}-${i}`,
                  cells: [
                    r.material,
                    r.remision,
                    r.fecha_excel ?? '—',
                    fmtQty(r.cantidad_excel),
                    r.fecha_db,
                    fmtQty(r.cantidad_db),
                    r.entry_number,
                  ],
                })}
                headers={[
                  'Material',
                  'Remisión',
                  'Fecha Arkik',
                  'Cant. Arkik',
                  'Fecha sistema',
                  'Cant. sistema',
                  'Nº entrada',
                ]}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
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
                    i >= 3 && i <= 5 ? 'tabular-nums text-right' : ''
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
