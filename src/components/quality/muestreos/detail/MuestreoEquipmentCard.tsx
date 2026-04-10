'use client'

import React from 'react'
import Link from 'next/link'
import { Loader2, Wrench } from 'lucide-react'
import { EmaEstadoBadge } from '@/components/ema/EmaEstadoBadge'
import type { EstadoInstrumento, InstrumentoCard, MuestreoInstrumento } from '@/types/ema'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type MuestreoInstrumentoRow = MuestreoInstrumento & { instrumento: InstrumentoCard }

const VALID_ESTADOS: EstadoInstrumento[] = [
  'vigente',
  'proximo_vencer',
  'vencido',
  'en_revision',
  'inactivo',
]

function normalizeEstado(val: string | null | undefined): EstadoInstrumento {
  if (val && VALID_ESTADOS.includes(val as EstadoInstrumento)) {
    return val as EstadoInstrumento
  }
  return 'inactivo'
}

type Props = {
  rows: MuestreoInstrumentoRow[]
  loading: boolean
}

export default function MuestreoEquipmentCard({ rows, loading }: Props) {
  return (
    <Card className="mb-6 border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wrench className="h-5 w-5 text-stone-600" />
          Equipo utilizado
        </CardTitle>
        <CardDescription>Instrumentos asociados a este muestreo (trazabilidad EMA)</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin text-sky-700" />
            Cargando equipo…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-stone-500">Sin equipo registrado para este muestreo</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-stone-200 bg-stone-50/60 px-3 py-2 text-sm"
              >
                <Link
                  href={`/quality/instrumentos/${row.instrumento.id}`}
                  className="font-mono text-sky-800 hover:text-sky-950 underline-offset-2 hover:underline decoration-sky-300/80"
                >
                  {row.instrumento.codigo}
                </Link>
                <span className="text-stone-800">{row.instrumento.nombre}</span>
                <EmaEstadoBadge estado={normalizeEstado(row.estado_al_momento)} size="sm" />
                <span className="text-xs text-stone-500 w-full sm:w-auto sm:ml-auto">
                  Vence (registro):{' '}
                  {row.fecha_vencimiento_al_momento
                    ? formatDate(row.fecha_vencimiento_al_momento, 'PPP')
                    : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
