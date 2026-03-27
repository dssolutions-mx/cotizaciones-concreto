'use client'

import React from 'react'
import Link from 'next/link'
import { Award, Wrench, FlaskConical, ChevronDown } from 'lucide-react'
import { EmaEstadoBadge } from './EmaEstadoBadge'
import { EmaTipoBadge } from './EmaTipoBadge'
import type { InstrumentoDetalle } from '@/types/ema'

interface EmaTraceabilityChainProps {
  instrumento: InstrumentoDetalle
}

export function EmaTraceabilityChain({ instrumento }: EmaTraceabilityChainProps) {
  const isTypeC = instrumento.tipo === 'C'
  const isTypeAorB = instrumento.tipo === 'A' || instrumento.tipo === 'B'

  return (
    <section className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-200 bg-stone-50/80">
        <Award className="h-4 w-4 text-stone-500" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
          Cadena de trazabilidad EMA
        </h2>
      </div>

      <div className="p-4">
        <div className="flex flex-col items-center gap-0 max-w-sm mx-auto">

          {/* Level 1: External EMA Lab */}
          <div className="w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">
              Laboratorio externo
            </div>
            <div className="text-sm font-medium text-stone-800">
              {isTypeC && instrumento.instrumento_maestro
                ? (instrumento.instrumento_maestro as any).certificado_vigente?.laboratorio_externo ?? 'Acreditado EMA'
                : instrumento.certificado_vigente?.laboratorio_externo ?? 'Acreditado EMA'}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              Patrón de referencia nacional
            </div>
          </div>

          {/* Connector */}
          <div className="flex flex-col items-center py-1">
            <div className="w-px h-4 border-l-2 border-dashed border-stone-300" />
            <ChevronDown className="h-3 w-3 text-stone-400 -mt-1" />
          </div>

          {/* Level 2: Type A instrument (either this instrument, or master) */}
          {isTypeC && instrumento.instrumento_maestro ? (
            <Link
              href={`/quality/instrumentos/${instrumento.instrumento_maestro_id}`}
              className="w-full rounded-lg border border-sky-200 bg-sky-50 p-3 text-center hover:bg-sky-100 transition-colors"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <EmaTipoBadge tipo="A" />
                <span className="text-xs text-stone-500">Instrumento maestro</span>
              </div>
              <div className="text-sm font-semibold text-stone-900">
                {(instrumento.instrumento_maestro as any).nombre}
              </div>
              <div className="text-xs text-stone-500 font-mono mt-0.5">
                {(instrumento.instrumento_maestro as any).codigo}
              </div>
              {(instrumento.instrumento_maestro as any).estado && (
                <div className="flex justify-center mt-1">
                  <EmaEstadoBadge estado={(instrumento.instrumento_maestro as any).estado} size="sm" />
                </div>
              )}
            </Link>
          ) : isTypeAorB ? (
            <div className="w-full rounded-lg border-2 border-sky-200 bg-sky-50 p-3 text-center ring-2 ring-sky-300 ring-offset-1">
              <div className="flex items-center justify-center gap-2 mb-1">
                <EmaTipoBadge tipo={instrumento.tipo} showLabel />
              </div>
              <div className="text-sm font-semibold text-stone-900">{instrumento.nombre}</div>
              <div className="text-xs text-stone-500 font-mono mt-0.5">{instrumento.codigo}</div>
              <div className="flex justify-center mt-1">
                <EmaEstadoBadge estado={instrumento.estado} size="sm" />
              </div>
              {instrumento.certificado_vigente && (
                <div className="text-xs text-stone-500 mt-1">
                  Cert. válido hasta {instrumento.certificado_vigente.fecha_vencimiento}
                </div>
              )}
            </div>
          ) : null}

          {/* Connector (only if Type C, showing the working instrument below) */}
          {isTypeC && (
            <>
              <div className="flex flex-col items-center py-1">
                <div className="w-px h-4 border-l-2 border-dashed border-stone-300" />
                <ChevronDown className="h-3 w-3 text-stone-400 -mt-1" />
              </div>

              {/* Level 3: This Type C instrument (highlighted) */}
              <div className="w-full rounded-lg border-2 border-stone-300 bg-white p-3 text-center ring-2 ring-stone-300 ring-offset-1">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Wrench className="h-3.5 w-3.5 text-stone-500" />
                  <EmaTipoBadge tipo="C" showLabel />
                </div>
                <div className="text-sm font-semibold text-stone-900">{instrumento.nombre}</div>
                <div className="text-xs text-stone-500 font-mono mt-0.5">{instrumento.codigo}</div>
                <div className="flex justify-center mt-1">
                  <EmaEstadoBadge estado={instrumento.estado} size="sm" />
                </div>
              </div>
            </>
          )}

          {/* Connector to usage */}
          <div className="flex flex-col items-center py-1">
            <div className="w-px h-4 border-l-2 border-dashed border-stone-300" />
            <ChevronDown className="h-3 w-3 text-stone-400 -mt-1" />
          </div>

          {/* Usage node */}
          <div className="w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <FlaskConical className="h-3.5 w-3.5 text-stone-500" />
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Muestreos y ensayos
              </div>
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              Snapshots inmutables al momento del uso
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
