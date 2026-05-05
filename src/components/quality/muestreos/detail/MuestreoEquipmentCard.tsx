'use client'

import React from 'react'
import Link from 'next/link'
import { FlaskConical, Loader2, Wrench } from 'lucide-react'
import { EmaEstadoBadge } from '@/components/ema/EmaEstadoBadge'
import type { EstadoInstrumento, InstrumentoCard, MuestreoInstrumento } from '@/types/ema'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export type MuestreoInstrumentoRow = MuestreoInstrumento & { instrumento: InstrumentoCard }

export type MoldeRow = {
  id: string
  codigo: string
  nombre: string
  /** Display names of the samples that used this mold (e.g. ["CUBO-15X15-1", "CUBO-15X15-2"]) */
  usadoEn: string[]
}

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
  moldeRows?: MoldeRow[]
  /** When set, shows an action to link more instruments (EMA) after the muestreo exists */
  onAddEquipment?: () => void
}

export default function MuestreoEquipmentCard({
  rows,
  loading,
  moldeRows = [],
  onAddEquipment,
}: Props) {
  const hasMoldes = moldeRows.length > 0
  const hasGeneral = rows.length > 0
  const isEmpty = !loading && !hasGeneral && !hasMoldes

  return (
    <Card className="mb-6 border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5 text-stone-600" />
              Equipo utilizado
            </CardTitle>
            <CardDescription>Instrumentos asociados a este muestreo (trazabilidad EMA)</CardDescription>
          </div>
          {onAddEquipment && (
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onAddEquipment}>
              Agregar equipo
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin text-sky-700" />
            Cargando equipo…
          </div>
        ) : isEmpty ? (
          <p className="text-sm text-stone-500">Sin equipo registrado para este muestreo</p>
        ) : (
          <>
            {hasGeneral && (
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

            {hasMoldes && (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                  <FlaskConical className="h-3.5 w-3.5" />
                  Moldes por espécimen
                </p>
                <ul className="space-y-2">
                  {moldeRows.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-sky-100 bg-sky-50/60 px-3 py-2 text-sm"
                    >
                      <Link
                        href={`/quality/instrumentos/${m.id}`}
                        className="font-mono text-sky-800 hover:text-sky-950 underline-offset-2 hover:underline decoration-sky-300/80"
                      >
                        {m.codigo}
                      </Link>
                      <span className="text-stone-800">{m.nombre}</span>
                      <span className="sm:ml-auto flex flex-wrap gap-1">
                        {m.usadoEn.map((label) => (
                          <Badge
                            key={label}
                            variant="outline"
                            className="text-xs font-mono bg-white border-sky-200 text-sky-800"
                          >
                            {label}
                          </Badge>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
