'use client'

import { format, isToday, isTomorrow } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import Link from 'next/link'
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
import type { ProgramaCalibacionConInstrumento, ProgramaComplianceGaps, InstrumentoCard } from '@/types/ema'
import {
  ESTADO_STYLE,
  TIPO_EVENTO_LABEL,
  daysUntil,
  isProgramaRowOverdue,
  monthLabel,
  programaDateKey,
} from './programaHelpers'

export type ProgramaListViewProps = {
  entries: ProgramaCalibacionConInstrumento[]
  gaps: ProgramaComplianceGaps | null
  onOpenInstrument: (id: string) => void
}

function sectionTitleFromKey(dayKey: string): string {
  const d = new Date(dayKey + 'T12:00:00')
  if (isToday(d)) return `Hoy, ${format(d, 'EEEE d MMMM', { locale: es })}`
  if (isTomorrow(d)) return `Mañana, ${format(d, 'EEEE d MMMM', { locale: es })}`
  return format(d, "EEEE d 'de' MMMM yyyy", { locale: es })
}

export default function ProgramaListView({ entries, gaps, onOpenInstrument }: ProgramaListViewProps) {
  const overduePrograma = entries.filter(isProgramaRowOverdue)
  const scheduled = entries.filter((e) => !isProgramaRowOverdue(e))

  const byDay = new Map<string, ProgramaCalibacionConInstrumento[]>()
  for (const e of scheduled) {
    const k = programaDateKey(e.fecha_programada)
    const arr = byDay.get(k) ?? []
    arr.push(e)
    byDay.set(k, arr)
  }
  const dayKeys = [...byDay.keys()].sort()

  const hasGaps = gaps && (gaps.fecha_vencidas.length > 0 || gaps.sin_programacion.length > 0)

  if (entries.length === 0 && !hasGaps) {
    return (
      <Card className="border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-stone-500">No hay eventos ni brechas con los filtros actuales.</p>
        </CardContent>
      </Card>
    )
  }

  const renderProgramaRow = (e: ProgramaCalibacionConInstrumento) => {
    const inst = e.instrumento
    const cfg = ESTADO_STYLE[e.estado]
    const d = daysUntil(e.fecha_programada)
    const overdueRow = isProgramaRowOverdue(e) ? 'bg-red-50/30' : ''

    return (
      <TableRow key={e.id} className={cn('border-b border-stone-100', overdueRow)}>
        <TableCell className="align-top font-mono text-xs tabular-nums text-stone-600">
          {formatDate(new Date(programaDateKey(e.fecha_programada) + 'T12:00:00'), 'dd/MM')}
          <div className="text-[10px] font-normal text-stone-400">
            {format(new Date(programaDateKey(e.fecha_programada) + 'T12:00:00'), 'EEE', { locale: es })}
          </div>
        </TableCell>
        <TableCell className="align-top">
          <div className="font-medium text-stone-900">{inst?.nombre ?? '—'}</div>
          <div className="font-mono text-xs text-stone-500">{inst?.codigo ?? '—'}</div>
        </TableCell>
        <TableCell className="align-top text-sm text-stone-700">
          {TIPO_EVENTO_LABEL[e.tipo_evento] ?? e.tipo_evento}
        </TableCell>
        <TableCell className="align-top">
          <Badge variant="outline" className={cn('text-[10px] font-medium', cfg.pill)}>
            {cfg.label}
          </Badge>
        </TableCell>
        <TableCell className="align-top font-mono text-xs text-stone-600">
          {e.estado === 'pendiente' && d < 0 ? `${Math.abs(d)}d vencido` : e.estado === 'pendiente' && d === 0 ? 'Hoy' : e.estado === 'pendiente' ? `en ${d}d` : '—'}
        </TableCell>
        <TableCell className="align-top text-right">
          {inst?.id && (
            <Button type="button" asChild size="sm" className={cn(qualityHubPrimaryButtonClass, 'h-8 px-3 text-xs')}>
              <Link href={`/quality/instrumentos/${inst.id}`}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Ver
              </Link>
            </Button>
          )}
        </TableCell>
      </TableRow>
    )
  }

  const gapBlock = (title: string, items: InstrumentoCard[], tone: 'red' | 'amber') => (
    <div className="space-y-2">
      <div
        className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          tone === 'red' && 'text-red-800',
          tone === 'amber' && 'text-amber-900',
        )}
      >
        {title} ({items.length})
      </div>
      <div className="space-y-1.5">
        {items.map((inst) => (
          <button
            key={inst.id}
            type="button"
            onClick={() => onOpenInstrument(inst.id)}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
              tone === 'red' && 'border-red-200 bg-red-50/60 hover:bg-red-50',
              tone === 'amber' && 'border-amber-200 bg-amber-50/60 hover:bg-amber-50',
            )}
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-stone-900">{inst.nombre}</div>
              <div className="truncate font-mono text-xs text-stone-600">
                {inst.codigo}
                {inst.fecha_proximo_evento ? ` · próx. ${inst.fecha_proximo_evento}` : ' · sin fecha próxima'}
              </div>
            </div>
            <span className="shrink-0 text-xs text-stone-500">Abrir →</span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {hasGaps && gaps && (
        <Card className="border border-amber-200/80 bg-amber-50/20 shadow-sm ring-1 ring-stone-950/[0.02]">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h2 className="text-sm font-semibold text-stone-900">Brechas (fuera del programa)</h2>
                <p className="mt-0.5 text-xs text-stone-600">
                  Para cargar fechas masivas desde inventario CSV revisado, use{' '}
                  <code className="rounded bg-white px-1 py-0.5 text-[10px]">POST /api/ema/admin/schedule-backfill</code>{' '}
                  (admin) — ver <code className="rounded bg-white px-1 py-0.5 text-[10px]">scripts/ema/README.md</code>.
                </p>
              </div>
            </div>
            {gaps.fecha_vencidas.length > 0 && gapBlock('Fecha próxima vencida (instrumento)', gaps.fecha_vencidas, 'red')}
            {gaps.sin_programacion.length > 0 &&
              gapBlock('Sin programación (requiere servicio, sin fecha)', gaps.sin_programacion, 'amber')}
          </CardContent>
        </Card>
      )}

      {overduePrograma.length > 0 && (
        <Card className="overflow-hidden border border-red-200/80 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
          <div className="border-b border-red-100 bg-red-50/80 px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-red-900">
              Eventos de programa vencidos ({overduePrograma.length})
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-stone-200 bg-stone-50/80 hover:bg-stone-50/80">
                  <TableHead className="w-[72px] text-xs font-semibold text-stone-600">Fecha</TableHead>
                  <TableHead className="text-xs font-semibold text-stone-600">Instrumento</TableHead>
                  <TableHead className="text-xs font-semibold text-stone-600">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold text-stone-600">Estado</TableHead>
                  <TableHead className="text-xs font-semibold text-stone-600">Plazo</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-stone-600">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{overduePrograma.map(renderProgramaRow)}</TableBody>
            </Table>
          </div>
        </Card>
      )}

      {dayKeys.map((k) => {
        const items = byDay.get(k) ?? []
        return (
          <Card key={k} className="overflow-hidden border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/80 px-4 py-2">
              <span className="text-xs font-semibold capitalize text-stone-800">{sectionTitleFromKey(k)}</span>
              <Badge variant="outline" className="border-stone-200 text-[10px] text-stone-600">
                {monthLabel(k.slice(0, 7))}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-stone-200 bg-stone-50/80 hover:bg-stone-50/80">
                    <TableHead className="w-[72px] text-xs font-semibold text-stone-600">Fecha</TableHead>
                    <TableHead className="text-xs font-semibold text-stone-600">Instrumento</TableHead>
                    <TableHead className="text-xs font-semibold text-stone-600">Tipo</TableHead>
                    <TableHead className="text-xs font-semibold text-stone-600">Estado</TableHead>
                    <TableHead className="text-xs font-semibold text-stone-600">Plazo</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-stone-600">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{items.map(renderProgramaRow)}</TableBody>
              </Table>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
