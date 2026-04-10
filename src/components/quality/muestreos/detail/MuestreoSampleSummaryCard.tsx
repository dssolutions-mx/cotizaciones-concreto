'use client'

import React from 'react'
import Link from 'next/link'
import { Beaker, CheckCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { MuestreoWithRelations } from '@/types/quality'
import { cn, createSafeDate, formatDate } from '@/lib/utils'
import { qualityHubOutlineNeutralClass, qualityHubPrimaryButtonClass } from '../../qualityHubUi'

type Props = {
  muestreo: MuestreoWithRelations
  cilindros: number
  vigas: number
  cubos: number
  cilindrosEnsayados: number
  vigasEnsayadas: number
  cubosEnsayados: number
  firstEnsayoId: string | undefined
}

export default function MuestreoSampleSummaryCard({
  muestreo,
  cilindros,
  vigas,
  cubos,
  cilindrosEnsayados,
  vigasEnsayadas,
  cubosEnsayados,
  firstEnsayoId,
}: Props) {
  const pending = muestreo.muestras?.filter((m) => m.estado === 'PENDIENTE') ?? []
  const hasEnsayado = muestreo.muestras?.some((m) => m.estado === 'ENSAYADO') ?? false
  const allNoRealizado =
    (muestreo.muestras?.length ?? 0) > 0 &&
    muestreo.muestras!.every((m) => m.estado === 'NO_REALIZADO')
  const asDate = (d?: string) => (d ? createSafeDate(d) : null)
  const nextDate = (() => {
    if (pending.length === 0) return null
    const dates = pending
      .map((m) => {
        const ts = (m as { fecha_programada_ensayo_ts?: string }).fecha_programada_ensayo_ts
        const dstr = ts || m.fecha_programada_ensayo
        return asDate(dstr || undefined)
      })
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())
    return dates[0]
  })()

  return (
    <Card className="border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Beaker className="h-5 w-5 text-stone-600" />
          Resumen de Muestras
        </CardTitle>
        <CardDescription>Estado actual de los especímenes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-stone-900">{cilindros}</div>
              <p className="text-xs text-stone-500">Cilindros</p>
              <Badge variant="outline" className="text-xs mt-1">
                {cilindrosEnsayados} ensayados
              </Badge>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-stone-900">{vigas}</div>
              <p className="text-xs text-stone-500">Vigas</p>
              <Badge variant="outline" className="text-xs mt-1">
                {vigasEnsayadas} ensayadas
              </Badge>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-stone-900">{cubos}</div>
              <p className="text-xs text-stone-500">Cubos</p>
              <Badge variant="outline" className="text-xs mt-1">
                {cubosEnsayados} ensayados
              </Badge>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-stone-500 mb-2">Próximo Ensayo</p>
            {pending.length > 0 ? (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-stone-600" />
                <p className="text-stone-600 font-medium text-sm">
                  {nextDate ? formatDate(nextDate, 'PPP') : 'Fecha no programada'}
                </p>
              </div>
            ) : allNoRealizado ? (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-stone-500" />
                <p className="text-stone-600 text-sm">Muestras marcadas como no realizadas</p>
              </div>
            ) : hasEnsayado ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-green-600 text-sm">Todos los ensayos completados</p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-stone-500" />
                <p className="text-stone-600 text-sm">Sin ensayos pendientes</p>
              </div>
            )}
          </div>
          <div className="pt-2">
            {firstEnsayoId ? (
              <Link href={`/quality/ensayos/${firstEnsayoId}`}>
                <Button size="sm" variant="primary" className={cn(qualityHubPrimaryButtonClass, 'w-full h-9')}>
                  Ver Ensayo
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className={cn(qualityHubOutlineNeutralClass, 'w-full h-9')}
                disabled
              >
                No hay ensayos
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
