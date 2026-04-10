'use client'

import React from 'react'
import Link from 'next/link'
import { format, isToday, isTomorrow } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn, formatDate } from '@/lib/utils'
import { qualityHubPrimaryButtonClass } from '@/components/quality/qualityHubUi'
import type { MuestraWithRelations } from '@/types/quality'
import {
  computeAge,
  computeUrgency,
  formatTestWindowClockRange,
  formatToleranceLabel,
  getPrimaryScheduledClock,
  getScheduledDateTime,
  getTestWindow,
  sortMuestrasByScheduledTime,
  specimenTypeLabel,
  urgencyBadgeClass,
} from './ensayosHelpers'

export type EnsayosListViewProps = {
  muestras: MuestraWithRelations[]
}

function groupKey(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

function sectionTitle(d: Date): string {
  if (isToday(d)) return `Hoy, ${format(d, 'EEEE d MMMM', { locale: es })}`
  if (isTomorrow(d)) return `Mañana, ${format(d, 'EEEE d MMMM', { locale: es })}`
  return format(d, "EEEE d 'de' MMMM", { locale: es })
}

export default function EnsayosListView({ muestras }: EnsayosListViewProps) {
  const now = new Date()

  const overdue: MuestraWithRelations[] = []
  const noSchedule: MuestraWithRelations[] = []
  const byDay = new Map<string, MuestraWithRelations[]>()

  for (const m of muestras) {
    const w = getTestWindow(m)
    if (w && now.getTime() > w.end.getTime()) {
      overdue.push(m)
      continue
    }
    const sched = getScheduledDateTime(m)
    if (!sched) {
      noSchedule.push(m)
      continue
    }
    const k = groupKey(sched)
    const arr = byDay.get(k) ?? []
    arr.push(m)
    byDay.set(k, arr)
  }

  const sortedOverdue = sortMuestrasByScheduledTime(overdue, now)
  const dayKeys = [...byDay.keys()].sort()

  for (const k of dayKeys) {
    const arr = byDay.get(k)!
    byDay.set(k, sortMuestrasByScheduledTime(arr, now))
  }

  const total = muestras.length

  if (total === 0) {
    return (
      <Card className="border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-stone-500">No hay ensayos pendientes con los filtros actuales.</p>
        </CardContent>
      </Card>
    )
  }

  const renderRow = (muestra: MuestraWithRelations) => {
    const sched = getScheduledDateTime(muestra)
    const pc = getPrimaryScheduledClock(muestra)
    const win = getTestWindow(muestra)
    const tolLabel = win ? formatToleranceLabel(win.toleranceMinutes) : '—'
    const age = computeAge(muestra)
    const { urgency, label: urgencyLabel } = computeUrgency(muestra, now)
    const overdueRow =
      win && now.getTime() > win.end.getTime() ? 'bg-red-50/30' : ''

    const rem = muestra.muestreo?.remision?.remision_number
    const recipeCode = muestra.muestreo?.remision?.recipe?.recipe_code
    const fc = muestra.muestreo?.remision?.recipe?.strength_fc

    return (
      <TableRow key={muestra.id} className={cn('border-b border-stone-100', overdueRow)}>
        <TableCell className="align-top font-mono text-xs tabular-nums text-stone-600">
          {sched ? formatDate(sched, 'dd/MM') : '—'}
          <div className="text-[10px] font-normal text-stone-400">
            {sched ? format(sched, 'EEE', { locale: es }) : ''}
          </div>
        </TableCell>
        <TableCell className="align-top">
          <div className="font-mono text-sm font-semibold tabular-nums text-stone-900">
            {pc?.clock ?? <span className="text-stone-400">--:--</span>}
          </div>
          {pc?.isApprox && (
            <div className="text-[10px] text-amber-700">Aprox. (sin marca exacta)</div>
          )}
          {win && (
            <div className="mt-0.5 font-mono text-[10px] tabular-nums text-stone-700">
              {formatTestWindowClockRange(win, sched ?? undefined)}
            </div>
          )}
          <div className="text-[10px] text-stone-500">
            {win ? `Tolerancia ${tolLabel}` : '—'}
          </div>
        </TableCell>
        <TableCell className="align-top">
          <div className="font-medium text-stone-900">
            {muestra.identificacion?.trim() || muestra.id.substring(0, 8)}
          </div>
          <Badge variant="outline" className="mt-1 border-stone-200 text-[10px] text-stone-700">
            {specimenTypeLabel(muestra.tipo_muestra)}
          </Badge>
        </TableCell>
        <TableCell className="align-top">
          <div className="flex items-center gap-1">
            {muestra.is_edad_garantia && (
              <Shield className="h-3.5 w-3.5 shrink-0 text-sky-700" aria-label="Edad garantía" />
            )}
            <span className="font-mono text-sm tabular-nums text-stone-800">{age?.label ?? '—'}</span>
          </div>
        </TableCell>
        <TableCell className="align-top">
          <div className="font-mono text-sm font-semibold tabular-nums text-stone-900">
            {rem ?? muestra.muestreo?.manual_reference ?? '—'}
          </div>
          <div className="truncate text-xs text-stone-500 max-w-[120px]" title={recipeCode}>
            {recipeCode ?? '—'}
          </div>
        </TableCell>
        <TableCell className="align-top">
          <div className="font-semibold text-stone-900">{fc != null ? `${fc} kg/cm²` : '—'}</div>
        </TableCell>
        <TableCell className="align-top">
          <Badge variant="outline" className={cn('text-[10px] font-medium', urgencyBadgeClass(urgency))}>
            {urgencyLabel}
          </Badge>
        </TableCell>
        <TableCell className="align-top text-right">
          <Button type="button" asChild className={cn(qualityHubPrimaryButtonClass, 'h-8 px-3 text-xs')}>
            <Link href={`/quality/ensayos/new?muestra=${muestra.id}`}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Realizar ensayo
            </Link>
          </Button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm ring-1 ring-stone-950/[0.02] overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-stone-200 bg-stone-50/80 hover:bg-stone-50/80">
              <TableHead className="w-[72px] text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                Fecha
              </TableHead>
              <TableHead className="min-w-[108px] text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                Hora / ventana
              </TableHead>
              <TableHead className="text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                Muestra
              </TableHead>
              <TableHead className="w-[88px] text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                Edad
              </TableHead>
              <TableHead className="text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                Remisión
              </TableHead>
              <TableHead className="text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                f&apos;c
              </TableHead>
              <TableHead className="w-[100px] text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                Urgencia
              </TableHead>
              <TableHead className="w-[150px] text-right text-xs font-semibold uppercase tracking-wide text-stone-600">
                Acción
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedOverdue.length > 0 && (
              <>
                <TableRow className="sticky top-0 z-10 border-b border-red-200 bg-red-50/90 hover:bg-red-50/90">
                  <TableCell colSpan={8} className="py-2 text-xs font-semibold uppercase tracking-wide text-red-900">
                    Atrasados
                  </TableCell>
                </TableRow>
                {sortedOverdue.map((m) => renderRow(m))}
              </>
            )}
            {dayKeys.map((k) => {
              const first = byDay.get(k)![0]
              const d = getScheduledDateTime(first)!
              const isTodayRow = isToday(d)
              return (
                <React.Fragment key={k}>
                  <TableRow
                    className={cn(
                      'sticky top-0 z-10 border-b border-stone-200 hover:bg-stone-50/90',
                      isTodayRow ? 'bg-sky-50/90' : 'bg-stone-50/90'
                    )}
                  >
                    <TableCell
                      colSpan={8}
                      className={cn(
                        'py-2 text-xs font-semibold uppercase tracking-wide',
                        isTodayRow ? 'text-sky-900' : 'text-stone-700'
                      )}
                    >
                      {sectionTitle(d)}
                    </TableCell>
                  </TableRow>
                  {byDay.get(k)!.map((m) => renderRow(m))}
                </React.Fragment>
              )
            })}
            {noSchedule.length > 0 && (
              <>
                <TableRow className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50/90 hover:bg-amber-50/90">
                  <TableCell colSpan={8} className="py-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
                    Sin fecha programada
                  </TableCell>
                </TableRow>
                {noSchedule.map((m) => renderRow(m))}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3">
        <p className="text-sm text-stone-500">
          Mostrando <span className="font-mono font-medium text-stone-800">{total}</span> ensayos pendientes
        </p>
      </div>
    </div>
  )
}
