'use client'

import React from 'react'
import type {
  CompletedVerificacionMeasurement,
  VerificacionTemplateHeaderField,
  VerificacionTemplateItem,
  VerificacionTemplateSection,
  VerificacionTemplateSnapshot,
} from '@/types/ema'
import { effectiveLayout, effectiveSectionRepetitions } from '@/lib/ema/sectionLayout'
import {
  buildMeasurementMap,
  formatVerificacionMeasurement,
  sectionItemsForDisplay,
  verificacionCumpleLabel,
  verificacionRowCumple,
} from '@/lib/ema/verificacionFichaModel'
import { cn } from '@/lib/utils'

export interface CompletedVerificacionFichaProps {
  snapshot: VerificacionTemplateSnapshot
  measurements: CompletedVerificacionMeasurement[]
  meta?: {
    instrumentoCodigo?: string
    instrumentoNombre?: string
    fechaVerificacion?: string
    fechaProxima?: string | null
    resultado?: string
    verificador?: string | null
    condiciones?: string | null
    observaciones?: string | null
  }
  className?: string
}

export function CompletedVerificacionFicha({
  snapshot,
  measurements,
  meta,
  className,
}: CompletedVerificacionFichaProps) {
  const template = snapshot.template
  const sections = snapshot.sections ?? []
  const headerFields = snapshot.header_fields ?? []

  const mMap = buildMeasurementMap(measurements)

  return (
    <div className={cn('rounded-lg border border-stone-900 overflow-hidden text-sm', className)}>
      <div className="bg-slate-800 text-white px-4 py-3 text-center font-semibold tracking-tight">
        {template.nombre}
      </div>
      {template.norma_referencia && (
        <div className="bg-emerald-800 text-white px-4 py-2 text-xs text-center">{template.norma_referencia}</div>
      )}
      {template.descripcion && (
        <div className="bg-stone-100 px-3 py-2 text-[11px] text-stone-700 border-b border-stone-300">
          {template.descripcion}
        </div>
      )}

      {meta && (
        <div className="grid grid-cols-2 gap-px bg-stone-300 border-b border-stone-300 text-xs">
          {[
            meta.instrumentoCodigo && { label: 'Código', value: meta.instrumentoCodigo },
            meta.instrumentoNombre && { label: 'Instrumento', value: meta.instrumentoNombre },
            meta.fechaVerificacion && { label: 'Fecha verificación', value: meta.fechaVerificacion },
            meta.fechaProxima && { label: 'Próxima verificación', value: meta.fechaProxima },
            meta.resultado && { label: 'Resultado', value: meta.resultado },
            meta.verificador && { label: 'Registrado por', value: meta.verificador },
          ]
            .filter(Boolean)
            .map((row) => (
              <div key={row!.label} className="flex bg-white">
                <div className="bg-emerald-700 text-white text-[10px] font-semibold uppercase px-2 py-1.5 w-32 shrink-0">
                  {row!.label}
                </div>
                <div className="px-2 py-1.5 text-stone-800 flex-1">{row!.value}</div>
              </div>
            ))}
        </div>
      )}

      {headerFields.length > 0 && (
        <HeaderFieldsBlock fields={headerFields} />
      )}

      {(meta?.condiciones || meta?.observaciones) && (
        <div className="px-3 py-2 text-xs text-stone-700 border-b border-stone-300 bg-stone-50 space-y-1">
          {meta.condiciones && (
            <p>
              <span className="font-semibold text-stone-600">Condiciones: </span>
              {meta.condiciones}
            </p>
          )}
          {meta.observaciones && (
            <p>
              <span className="font-semibold text-stone-600">Observaciones: </span>
              {meta.observaciones}
            </p>
          )}
        </div>
      )}

      <div className="divide-y divide-stone-300">
        {sections.map((sec) => (
          <SectionBlock key={sec.id} section={sec} mMap={mMap} />
        ))}
      </div>
    </div>
  )
}

function HeaderFieldsBlock({ fields }: { fields: VerificacionTemplateHeaderField[] }) {
  return (
    <div className="grid grid-cols-2 gap-px bg-stone-300 border-b border-stone-300">
      {fields.map((h) => (
        <div key={h.id} className="flex bg-white">
          <div className="bg-emerald-700 text-white text-[10px] font-semibold uppercase px-2 py-1.5 w-32 shrink-0">
            {h.label}
          </div>
          <div className="px-2 py-1.5 text-xs text-stone-600 flex-1 font-mono">
            {h.source === 'computed' ? <span className="text-stone-400">(calculado)</span> : '—'}
          </div>
        </div>
      ))}
    </div>
  )
}

function SectionBlock({
  section,
  mMap,
}: {
  section: VerificacionTemplateSection & { items?: VerificacionTemplateItem[] }
  mMap: Map<string, CompletedVerificacionMeasurement>
}) {
  const layout = effectiveLayout(section as VerificacionTemplateSection & { layout?: string })
  const reps = effectiveSectionRepetitions(section as VerificacionTemplateSection & {
    repetible?: boolean
    repeticiones_default?: number
  })
  const items = sectionItemsForDisplay(section)

  return (
    <div className="break-inside-avoid">
      <div className="bg-slate-800 text-white px-3 py-2 text-xs font-semibold flex justify-between">
        <span>{section.titulo}</span>
        <span className="text-emerald-200 font-mono text-[10px]">{layout}</span>
      </div>
      {section.descripcion && (
        <div className="bg-stone-50 px-3 py-1 text-[11px] text-stone-600 border-b border-stone-200">
          {section.descripcion}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-emerald-700 text-white">
              {layout === 'instrument_grid' && (
                <th className="border border-stone-400 px-2 py-1 text-left">Código</th>
              )}
              {items.map((it) => (
                <th key={it.id} className="border border-stone-400 px-2 py-1 text-left font-semibold">
                  {it.punto}
                </th>
              ))}
              <th className="border border-stone-400 px-2 py-1">¿Cumple?</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: reps }, (_, i) => i + 1).map((rep) => (
              <tr key={rep} className="bg-white">
                {layout === 'instrument_grid' && (
                  <td className="border border-stone-300 px-2 py-2 font-mono text-stone-800">
                    {items
                      .map((it) => mMap.get(`${section.id}:${rep}:${it.id}`)?.instance_code)
                      .find((c) => c?.trim()) ?? '—'}
                  </td>
                )}
                {items.map((it) => {
                  const m = mMap.get(`${section.id}:${rep}:${it.id}`)
                  return (
                    <td key={it.id} className="border border-stone-300 px-2 py-2 align-top font-mono text-stone-800">
                      {formatVerificacionMeasurement(it, m)}
                    </td>
                  )
                })}
                <td className="border border-stone-300 px-2 py-2 text-center font-medium">
                  {verificacionCumpleLabel(verificacionRowCumple(section.id, rep, items, mMap))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
