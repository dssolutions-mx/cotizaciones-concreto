'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertTriangle, ExternalLink, Factory, MoreHorizontal, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/types/supabase'
import {
  procurementConsumosUrl,
  procurementEntriesUrl,
  productionNewEntryUrl,
} from '@/lib/procurement/navigation'
import { cn } from '@/lib/utils'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'

type GapRow = Database['public']['Functions']['fn_fifo_operational_gaps']['Returns'][number]

type ApiPayload = {
  from: string
  to: string
  rows: GapRow[]
  summary: {
    total_lines: number
    gap_lines: number
    allocated_lines: number
    distinct_plant_material_gaps: number
    gap_by_reason: Record<string, number>
  }
}

const FIFO_ALLOCATE_ROLES = [
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'DOSIFICADOR',
  'PLANT_MANAGER',
  'CREDIT_VALIDATOR',
] as const

function fmtKg(n: number | null | undefined) {
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(
    Number(n ?? 0)
  )
}

function reasonBadgeClass(code: string): string {
  switch (code) {
    case 'FIRST_RECEIPT_AFTER_POUR_DATE':
      return 'bg-amber-100 text-amber-950 border-amber-300'
    case 'NO_RECEIPTS_IN_SYSTEM':
      return 'bg-red-100 text-red-950 border-red-300'
    case 'INSUFFICIENT_STOCK_SNAPSHOT':
      return 'bg-orange-100 text-orange-950 border-orange-300'
    case 'UNKNOWN_ELSE':
      return 'bg-violet-100 text-violet-950 border-violet-300'
    default:
      return 'bg-stone-100 text-stone-800 border-stone-300'
  }
}

function formatDayLabel(isoDate: string) {
  try {
    return format(parseISO(isoDate), "EEEE d MMM yyyy", { locale: es })
  } catch {
    return isoDate
  }
}

function GapRowActions({
  row,
  canAllocateFifo,
  allocatingRemisionId,
  onAllocateFifo,
}: {
  row: GapRow
  canAllocateFifo: boolean
  allocatingRemisionId: string | null
  onAllocateFifo: (remisionId: string) => void
}) {
  const fecha = String(row.remision_fecha)
  const busy = allocatingRemisionId === row.remision_id

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 border-stone-300"
          aria-label="Acciones para atender hueco FIFO"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link
            href={procurementEntriesUrl({
              plantId: row.plant_id,
              materialId: row.material_id,
            })}
            className="cursor-pointer"
          >
            Entradas (este material)
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={procurementConsumosUrl({ plantId: row.plant_id, date: fecha })}
            className="cursor-pointer"
          >
            Consumos del día
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={productionNewEntryUrl({ plantId: row.plant_id, materialId: row.material_id })}
            className="cursor-pointer"
          >
            Nueva recepción (plantas)
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canAllocateFifo || busy}
          onClick={() => {
            if (!canAllocateFifo || busy) return
            onAllocateFifo(row.remision_id)
          }}
        >
          {busy ? 'Re-asignando FIFO…' : 'Re-asignar FIFO (remisión)'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function FifoCostingGapsView({ workspacePlantId }: { workspacePlantId: string }) {
  const searchParams = useSearchParams()
  const plantIdFromUrl = searchParams.get('plant_id') || ''
  const { profile } = useAuthSelectors()
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<ApiPayload | null>(null)
  const [allocatingRemisionId, setAllocatingRemisionId] = useState<string | null>(null)

  const canAllocateFifo = Boolean(
    profile?.role && (FIFO_ALLOCATE_ROLES as readonly string[]).includes(profile.role)
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ month })
      const plant = workspacePlantId || plantIdFromUrl
      if (plant) params.set('plant_id', plant)
      const res = await fetch(`/api/procurement/fifo-gaps?${params}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        setPayload(null)
        setError(json.error || 'No se pudo cargar')
        return
      }
      setPayload(json.data as ApiPayload)
    } catch {
      setPayload(null)
      setError('Error de red')
    } finally {
      setLoading(false)
    }
  }, [month, workspacePlantId, plantIdFromUrl])

  useEffect(() => {
    void load()
  }, [load])

  const runAllocateFifo = useCallback(
    async (remisionId: string) => {
      setAllocatingRemisionId(remisionId)
      try {
        const res = await fetch(`/api/remisiones/${remisionId}/allocate-fifo`, { method: 'POST' })
        const json = (await res.json()) as {
          success?: boolean
          error?: string
          allocationsCreated?: number
          skipped?: unknown[]
          errors?: unknown[]
        }
        if (!res.ok) {
          toast.error(typeof json.error === 'string' ? json.error : 'Error al asignar FIFO')
          return
        }
        if (json.success) {
          toast.success(`FIFO actualizado (${json.allocationsCreated ?? 0} línea(s) con costo)`)
          void load()
        } else {
          toast.message('FIFO parcial u omitido', {
            description:
              (json.skipped?.length ?? 0) > 0 || (json.errors?.length ?? 0) > 0
                ? `${json.skipped?.length ?? 0} omitida(s) · ${json.errors?.length ?? 0} error(es)`
                : 'Revise entradas y vuelva a intentar',
          })
          void load()
        }
      } catch {
        toast.error('Error de red')
      } finally {
        setAllocatingRemisionId(null)
      }
    },
    [load]
  )

  const gaps = useMemo(() => (payload?.rows ?? []).filter((r) => !r.is_allocated), [payload])

  const dayPlantGroups = useMemo(() => {
    const map = new Map<
      string,
      { fecha: string; plant_code: string; plant_id: string; lines: GapRow[] }
    >()
    for (const r of gaps) {
      const key = `${r.remision_fecha}|${r.plant_id}`
      if (!map.has(key)) {
        map.set(key, {
          fecha: String(r.remision_fecha),
          plant_code: r.plant_code ?? '—',
          plant_id: r.plant_id,
          lines: [],
        })
      }
      map.get(key)!.lines.push(r)
    }
    const arr = Array.from(map.values())
    arr.sort((a, b) => {
      if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
      return a.plant_code.localeCompare(b.plant_code, 'es')
    })
    return arr
  }, [gaps])

  const reasonSummary = payload?.summary.gap_by_reason ?? {}

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Costeo FIFO incompleto</p>
            <p className="text-amber-950/90 leading-snug">
              Use el menú <strong className="font-semibold">⋯</strong> en cada fila: abre entradas filtradas por
              material, el día en Consumos, recepción en plantas, o re-ejecuta FIFO para toda la remisión después de
              corregir datos.
            </p>
            <p className="text-amber-950/90 leading-snug pt-1">
              Muchas líneas pueden repetir el mismo material; priorice <strong className="font-semibold">planta + material</strong>{' '}
              y corrija <strong className="font-semibold">entry_date</strong> cuando el motivo sea{' '}
              <span className="font-mono text-xs">FIRST_RECEIPT_AFTER_POUR_DATE</span>.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fifo-gap-month" className="text-xs font-semibold uppercase tracking-wide text-stone-600">
            Mes
          </Label>
          <Input
            id="fifo-gap-month"
            type="month"
            className="w-[160px] h-9 border-stone-300 bg-white"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <Button type="button" variant="outline" size="sm" className="h-9 border-stone-300" onClick={() => void load()}>
          <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {!loading && payload && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-stone-200 bg-white">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Líneas sin costeo
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-mono font-semibold text-red-800 tabular-nums">{payload.summary.gap_lines}</p>
                <p className="text-[11px] text-stone-500 mt-1">de {payload.summary.total_lines} líneas CONCRETO</p>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-white">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Planta × material (huecos)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-mono font-semibold text-stone-900 tabular-nums">
                  {payload.summary.distinct_plant_material_gaps}
                </p>
                <p className="text-[11px] text-stone-500 mt-1">combinaciones distintas afectadas</p>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-white lg:col-span-2">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Motivos (líneas)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 flex flex-wrap gap-2">
                {Object.keys(reasonSummary).length === 0 ? (
                  <span className="text-sm text-emerald-700 font-medium">Sin huecos en el período.</span>
                ) : (
                  Object.entries(reasonSummary)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => (
                      <Badge key={k} variant="outline" className={cn('font-mono text-[11px]', reasonBadgeClass(k))}>
                        {k}: {v}
                      </Badge>
                    ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-stone-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Factory className="h-5 w-5 text-sky-800" />
                Por día y planta
              </CardTitle>
              <CardDescription>
                Periodo {payload.from} — {payload.to}. Expanda un día para ver remisiones y materiales.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dayPlantGroups.length === 0 ? (
                <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3">
                  No hay líneas sin costeo en este mes{workspacePlantId ? ' para la planta seleccionada' : ''}.
                </p>
              ) : (
                <Accordion type="multiple" className="space-y-2">
                  {dayPlantGroups.map((g) => {
                    const remisiones = new Set(g.lines.map((l) => l.remision_id)).size
                    const key = `${g.fecha}|${g.plant_id}`
                    return (
                      <AccordionItem key={key} value={key} className="border border-stone-200 rounded-lg px-2 bg-stone-50/40">
                        <AccordionTrigger className="hover:no-underline py-3 px-2 text-left">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 w-full pr-2">
                            <span className="font-medium text-stone-900 capitalize">{formatDayLabel(g.fecha)}</span>
                            <span className="text-sm text-stone-600">
                              <strong className="font-mono text-stone-900">{g.plant_code}</strong>
                              <span className="mx-2 text-stone-400">·</span>
                              {g.lines.length} líneas sin costeo
                              <span className="mx-2 text-stone-400">·</span>
                              {remisiones} remisiones
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-3 px-1">
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Button variant="outline" size="sm" className="h-8 text-xs border-stone-300" asChild>
                              <Link href={procurementEntriesUrl({ plantId: g.plant_id })}>
                                Entradas de compras (planta)
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </Link>
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 text-xs border-stone-300" asChild>
                              <Link href={procurementConsumosUrl({ plantId: g.plant_id, date: g.fecha })}>
                                Consumos del día (vista diaria)
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </Link>
                            </Button>
                          </div>
                          <div className="rounded-md border border-stone-200 overflow-x-auto bg-white">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-stone-50">
                                  <TableHead className="whitespace-nowrap w-[52px] text-center">Atender</TableHead>
                                  <TableHead className="whitespace-nowrap">Remisión</TableHead>
                                  <TableHead>Pedido</TableHead>
                                  <TableHead className="whitespace-nowrap">FIFO</TableHead>
                                  <TableHead>Material</TableHead>
                                  <TableHead className="text-right">Kg</TableHead>
                                  <TableHead>Motivo</TableHead>
                                  <TableHead className="whitespace-nowrap">Sig. entrada</TableHead>
                                  <TableHead className="text-right whitespace-nowrap">Kg posteriores</TableHead>
                                  <TableHead className="min-w-[200px]">Detalle</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {g.lines.map((row) => (
                                  <TableRow key={row.remision_material_id}>
                                    <TableCell className="text-center p-1">
                                      <GapRowActions
                                        row={row}
                                        canAllocateFifo={canAllocateFifo}
                                        allocatingRemisionId={allocatingRemisionId}
                                        onAllocateFifo={runAllocateFifo}
                                      />
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">
                                      {row.remision_number ?? '—'}
                                    </TableCell>
                                    <TableCell>
                                      {row.order_id ? (
                                        <Link
                                          href={`/orders/${row.order_id}`}
                                          className="text-sky-800 hover:underline text-sm font-mono inline-flex items-center gap-0.5"
                                        >
                                          Ver
                                          <ExternalLink className="h-3 w-3" />
                                        </Link>
                                      ) : (
                                        <span className="text-stone-400">—</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs font-mono">{row.fifo_status ?? '—'}</TableCell>
                                    <TableCell className="max-w-[220px]">
                                      <span className="text-sm leading-snug">{row.material_name}</span>
                                    </TableCell>
                                    <TableCell className="text-right font-mono tabular-nums">{fmtKg(row.cantidad_kg)}</TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className={cn('text-[10px] font-mono font-normal', reasonBadgeClass(row.reason_code))}
                                      >
                                        {row.reason_code}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs font-mono whitespace-nowrap">
                                      {row.next_receipt_after_pour ?? '—'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs tabular-nums">
                                      {fmtKg(row.kg_received_after_pour)}
                                    </TableCell>
                                    <TableCell className="text-xs text-stone-600 max-w-md">
                                      <span title={row.detail}>{row.detail}</span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
