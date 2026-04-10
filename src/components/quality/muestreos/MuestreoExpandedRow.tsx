'use client'

import React from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { Circle, Square, RectangleHorizontal, Star, ExternalLink } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { Ensayo, MuestreoWithRelations, MuestraWithRelations } from '@/types/quality'
import {
  computeResistanceCompliance,
  resistanceComplianceClass,
} from '@/components/quality/muestreos/muestreosListHelpers'

function TipoIcon({ tipo }: { tipo: string }) {
  if (tipo === 'CILINDRO') return <Circle className="h-3.5 w-3.5 text-stone-500" />
  if (tipo === 'CUBO') return <Square className="h-3.5 w-3.5 text-stone-500" />
  if (tipo === 'VIGA') return <RectangleHorizontal className="h-3.5 w-3.5 text-stone-500" />
  return <Circle className="h-3.5 w-3.5 text-stone-400" />
}

function edadLabel(m: MuestraWithRelations, fechaMuestreo: string | undefined): string {
  if (!fechaMuestreo) return '—'
  const d0 = new Date(fechaMuestreo).getTime()
  const d1 = new Date(m.fecha_programada_ensayo).getTime()
  const days = Math.round((d1 - d0) / (1000 * 60 * 60 * 24))
  return `${days}d`
}

/** Same ordering as muestreo [id] page "Ver ensayo" — oldest ensayo first */
function primaryEnsayoIdForView(muestra: MuestraWithRelations): string | null {
  if (!muestra.ensayos?.length) return null
  const sorted = [...muestra.ensayos].sort((a: Ensayo, b: Ensayo) => {
    const at = (a as { fecha_ensayo_ts?: string }).fecha_ensayo_ts || a.fecha_ensayo || ''
    const bt = (b as { fecha_ensayo_ts?: string }).fecha_ensayo_ts || b.fecha_ensayo || ''
    return new Date(at).getTime() - new Date(bt).getTime()
  })
  return sorted[0]?.id ?? null
}

type Props = {
  muestreo: MuestreoWithRelations
  colSpan: number
}

export default function MuestreoExpandedRow({ muestreo, colSpan }: Props) {
  const muestras = [...(muestreo.muestras || [])].sort(
    (a, b) =>
      new Date(a.fecha_programada_ensayo).getTime() - new Date(b.fecha_programada_ensayo).getTime()
  )
  const fc = muestreo.remision?.recipe?.strength_fc ?? null

  return (
    <TableRow className="bg-stone-50 hover:bg-stone-50 border-t border-stone-200">
      <TableCell colSpan={colSpan} className="p-4 align-top">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
          {muestras.map((m) => {
            const ensayo =
              m.ensayos && m.ensayos.length > 0
                ? [...m.ensayos].sort(
                    (a, b) =>
                      new Date(b.fecha_ensayo).getTime() - new Date(a.fecha_ensayo).getTime()
                  )[0]
                : undefined
            const resistencia = ensayo?.resistencia_calculada
            const pct = ensayo?.porcentaje_cumplimiento
            const compliance =
              resistencia != null && fc != null && fc > 0
                ? computeResistanceCompliance(Math.round(resistencia * 0.92), fc)
                : ('none' as const)

            const ensayoViewId = primaryEnsayoIdForView(m)
            const isDiscarded = m.estado === 'DESCARTADO'
            const isNoRealizado = m.estado === 'NO_REALIZADO'
            const isPending = m.estado === 'PENDIENTE'
            const isTested = m.estado === 'ENSAYADO'

            const tileInner = (
              <>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-semibold text-stone-900 truncate flex items-center gap-1">
                    <TipoIcon tipo={m.tipo_muestra} />
                    {m.identificacion || m.id.slice(0, 8)}
                    {m.is_edad_garantia && (
                      <span title="Edad garantía">
                        <Star className="h-3 w-3 text-amber-500 fill-amber-200 shrink-0" />
                      </span>
                    )}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 py-0 shrink-0',
                      m.estado === 'ENSAYADO' && 'border-emerald-200 text-emerald-800 bg-emerald-50',
                      m.estado === 'PENDIENTE' && 'border-amber-200 text-amber-800 bg-amber-50',
                      m.estado === 'DESCARTADO' && 'border-stone-200 text-stone-600 bg-stone-100',
                      m.estado === 'NO_REALIZADO' &&
                        'border-stone-300 text-stone-800 bg-stone-200'
                    )}
                  >
                    {m.estado === 'ENSAYADO'
                      ? 'Ensayado'
                      : m.estado === 'PENDIENTE'
                        ? 'Pendiente'
                        : m.estado === 'NO_REALIZADO'
                          ? 'No realizado'
                          : 'Descartado'}
                  </Badge>
                </div>
                <div className="text-[10px] text-stone-500 mb-1">
                  {edadLabel(m, muestreo.fecha_muestreo)} ·{' '}
                  {formatDate(m.fecha_programada_ensayo, 'dd/MM/yyyy')}
                </div>
                {m.estado === 'ENSAYADO' && resistencia != null && (
                  <div className="space-y-0.5">
                    <span
                      className={cn(
                        'inline-flex text-xs font-mono tabular-nums rounded px-1.5 py-0.5',
                        resistanceComplianceClass(compliance)
                      )}
                    >
                      {Math.round(resistencia * 0.92)} / {fc ?? '—'} kg/cm²
                    </span>
                    {pct != null && (
                      <div className="text-[10px] text-stone-500">{pct.toFixed(0)}% cumpl.</div>
                    )}
                  </div>
                )}
                {m.estado === 'PENDIENTE' && (
                  <div className="text-[10px] text-stone-600">
                    Programado: {formatDate(m.fecha_programada_ensayo, 'dd/MM/yyyy')}
                  </div>
                )}
                {!isDiscarded && isPending && (
                  <div className="mt-2 text-[10px] font-medium text-sky-700">Registrar ensayo →</div>
                )}
                {!isDiscarded && isTested && ensayoViewId && (
                  <div className="mt-2 text-[10px] font-medium text-stone-600">Ver ensayo →</div>
                )}
                {!isDiscarded && isTested && !ensayoViewId && (
                  <div className="mt-2 text-[10px] text-stone-400">Sin ensayo vinculado</div>
                )}
              </>
            )

            const baseTile =
              'rounded-lg border bg-white p-2.5 text-left shadow-sm transition-all'
            if (isDiscarded) {
              return (
                <div
                  key={m.id}
                  className={cn(baseTile, 'border-stone-200 cursor-default opacity-60')}
                >
                  {tileInner}
                </div>
              )
            }
            if (isNoRealizado) {
              return (
                <div
                  key={m.id}
                  className={cn(baseTile, 'border-stone-200 cursor-default opacity-80')}
                >
                  {tileInner}
                </div>
              )
            }
            if (isPending) {
              return (
                <Link
                  key={m.id}
                  href={`/quality/ensayos/new?muestra=${m.id}`}
                  className={cn(
                    baseTile,
                    'border-stone-200 block cursor-pointer hover:border-sky-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500'
                  )}
                >
                  {tileInner}
                </Link>
              )
            }
            if (isTested && ensayoViewId) {
              return (
                <Link
                  key={m.id}
                  href={`/quality/ensayos/${ensayoViewId}`}
                  className={cn(
                    baseTile,
                    'border-stone-200 block cursor-pointer hover:border-stone-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400'
                  )}
                >
                  {tileInner}
                </Link>
              )
            }
            return (
              <div key={m.id} className={cn(baseTile, 'border-stone-200')}>
                {tileInner}
              </div>
            )
          })}
        </div>

        {fc != null && fc > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3" aria-hidden>
            {muestras
              .filter((m) => m.estado === 'ENSAYADO' && m.ensayos?.length)
              .map((m) => {
                const latest = [...(m.ensayos || [])].sort(
                  (a, b) =>
                    new Date(b.fecha_ensayo).getTime() - new Date(a.fecha_ensayo).getTime()
                )[0]
                const raw = latest?.resistencia_calculada
                if (raw == null) return null
                const adj = Math.round(raw * 0.92)
                const pct = Math.min(100, Math.round((adj / fc) * 100))
                const barColor =
                  adj >= fc ? 'bg-emerald-500' : adj >= fc * 0.85 ? 'bg-amber-500' : 'bg-red-500'
                return (
                  <div
                    key={m.id}
                    className="h-1.5 flex-1 min-w-[48px] max-w-[120px] rounded-full bg-stone-200 overflow-hidden"
                    title={`${m.identificacion ?? m.id.slice(0, 6)}: ${adj}/${fc}`}
                  >
                    <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                  </div>
                )
              })}
          </div>
        )}

        <div className="flex justify-end pt-1 border-t border-stone-200">
          <Link
            href={`/quality/muestreos/${muestreo.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900 hover:underline underline-offset-2"
          >
            Ver detalle completo
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </TableCell>
    </TableRow>
  )
}
