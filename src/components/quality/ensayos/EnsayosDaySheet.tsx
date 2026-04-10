'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, CircleDot, Clock, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, cn } from '@/lib/utils'
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

export type EnsayosDaySheetProps = {
  selectedDate: Date | undefined
  muestrasForDay: MuestraWithRelations[]
}

export default function EnsayosDaySheet({ selectedDate, muestrasForDay }: EnsayosDaySheetProps) {
  if (!selectedDate) return null

  const now = new Date()
  const sorted = sortMuestrasByScheduledTime(muestrasForDay, now)
  const title = formatDate(selectedDate, "EEEE d 'de' MMMM, yyyy")

  if (sorted.length === 0) {
    return (
      <Card className="border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="mb-3 h-12 w-12 text-stone-300" />
          <h3 className="text-lg font-medium text-stone-900">Sin ensayos programados</h3>
          <p className="mt-1 max-w-md text-sm text-stone-500">
            No hay ensayos pendientes para {format(selectedDate, 'PPP', { locale: es })}.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
      <CardHeader className="border-b border-stone-100 pb-4">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-stone-900">
          <CircleDot className="h-5 w-5 text-stone-600" />
          <span>Ensayos para {title}</span>
          <Badge variant="outline" className="border-stone-200 bg-stone-50 font-mono text-stone-700">
            {sorted.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-stone-200 bg-stone-50/80 hover:bg-stone-50/80">
                <TableHead className="min-w-[108px] text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                  Hora / ventana
                </TableHead>
                <TableHead className="text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                  Muestra
                </TableHead>
                <TableHead className="w-[100px] text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                  Edad
                </TableHead>
                <TableHead className="text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                  Remisión
                </TableHead>
                <TableHead className="text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                  Receta / f&apos;c
                </TableHead>
                <TableHead className="w-[110px] text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
                  Urgencia
                </TableHead>
                <TableHead className="w-[150px] text-right text-xs font-semibold uppercase tracking-wide text-stone-600">
                  Acción
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((muestra) => {
                const sched = getScheduledDateTime(muestra)
                const pc = getPrimaryScheduledClock(muestra)
                const win = getTestWindow(muestra)
                const tolLabel = win ? formatToleranceLabel(win.toleranceMinutes) : '—'
                const age = computeAge(muestra)
                const { urgency, label: urgencyLabel } = computeUrgency(muestra, now)
                const overdueRow =
                  win && now.getTime() > win.end.getTime()
                    ? 'bg-red-50/30'
                    : ''

                const rem = muestra.muestreo?.remision?.remision_number
                const recipeCode = muestra.muestreo?.remision?.recipe?.recipe_code
                const fc = muestra.muestreo?.remision?.recipe?.strength_fc

                return (
                  <TableRow
                    key={muestra.id}
                    className={cn('border-b border-stone-100', overdueRow)}
                  >
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
                      <Badge
                        variant="outline"
                        className="mt-1 border-stone-200 text-[10px] text-stone-700"
                      >
                        {specimenTypeLabel(muestra.tipo_muestra)}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-center gap-1">
                        {muestra.is_edad_garantia && (
                          <Shield
                            className="h-3.5 w-3.5 shrink-0 text-sky-700"
                            aria-label="Edad garantía"
                          />
                        )}
                        <span className="font-mono text-sm tabular-nums text-stone-800">
                          {age?.label ?? '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="font-mono text-sm font-semibold tabular-nums text-stone-900">
                        {rem ?? muestra.muestreo?.manual_reference ?? '—'}
                      </div>
                      <div className="truncate text-xs text-stone-500 max-w-[140px]" title={recipeCode}>
                        {recipeCode ?? '—'}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="font-semibold text-stone-900">
                        {fc != null ? `${fc} kg/cm²` : '—'}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] font-medium', urgencyBadgeClass(urgency))}
                      >
                        {urgencyLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <Button
                        type="button"
                        asChild
                        className={cn(qualityHubPrimaryButtonClass, 'h-8 px-3 text-xs')}
                      >
                        <Link href={`/quality/ensayos/new?muestra=${muestra.id}`}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Realizar ensayo
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
