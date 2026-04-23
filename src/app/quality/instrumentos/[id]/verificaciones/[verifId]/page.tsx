'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Clock, FileText } from 'lucide-react'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { cn } from '@/lib/utils'
import type {
  CompletedVerificacionDetalle,
  VerificacionTemplateItem,
  CompletedVerificacionMeasurement,
} from '@/types/ema'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RESULTADO_STYLE: Record<string, string> = {
  conforme: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  no_conforme: 'bg-red-100 text-red-800 border-red-200',
  condicional: 'bg-amber-100 text-amber-800 border-amber-200',
  pendiente: 'bg-stone-100 text-stone-600 border-stone-200',
}
const RESULTADO_LABEL: Record<string, string> = {
  conforme: 'Conforme',
  no_conforme: 'No conforme',
  condicional: 'Condicional',
  pendiente: 'Pendiente',
}
const ESTADO_LABEL: Record<string, string> = {
  cerrado: 'Cerrada',
  en_proceso: 'En proceso',
  firmado_operador: 'Firmada (operador)',
  firmado_revisor: 'Firmada (revisor)',
  cancelado: 'Cancelada',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function MeasurementCell({
  item,
  measurement,
}: {
  item: VerificacionTemplateItem
  measurement?: CompletedVerificacionMeasurement
}) {
  if (!measurement) {
    return <span className="text-stone-300 text-xs">—</span>
  }

  if (item.tipo === 'booleano') {
    return measurement.valor_booleano === null ? (
      <span className="text-stone-400 text-xs">—</span>
    ) : measurement.valor_booleano ? (
      <span className="flex items-center gap-1 text-emerald-700 text-xs font-medium">
        <CheckCircle2 className="h-3 w-3" /> Sí
      </span>
    ) : (
      <span className="flex items-center gap-1 text-red-700 text-xs font-medium">
        <XCircle className="h-3 w-3" /> No
      </span>
    )
  }

  if (item.tipo === 'texto' || item.tipo === 'referencia_equipo') {
    return (
      <span className="text-xs text-stone-700">{measurement.valor_texto ?? '—'}</span>
    )
  }

  const val = measurement.valor_observado
  const cumple = measurement.cumple
  const err = measurement.error_calculado

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm font-medium text-stone-800">
        {val != null ? `${val}${item.unidad ? ` ${item.unidad}` : ''}` : '—'}
      </span>
      {err != null && (
        <span className="text-xs font-mono text-stone-400">
          err: {err.toFixed(3)}
        </span>
      )}
      {cumple !== null && cumple !== undefined && (
        <span className={cn(
          'rounded-full px-1.5 py-0.5 text-[10px] font-semibold border',
          cumple
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200',
        )}>
          {cumple ? '✓' : '✗'}
        </span>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VerificacionDetailPage() {
  const { id: instrumentoId, verifId } = useParams<{ id: string; verifId: string }>()
  const [data, setData] = useState<CompletedVerificacionDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!verifId) return
    let cancelled = false
    const ac = new AbortController()
    ;(async () => {
      try {
        const r = await fetch(`/api/ema/verificaciones/${verifId}`, { signal: ac.signal })
        const j = (await r.json().catch(() => ({}))) as { data?: CompletedVerificacionDetalle; error?: string }
        if (!r.ok) {
          if (!cancelled) {
            setError(j.error ?? 'Error cargando la verificación')
            setData(null)
          }
          return
        }
        if (!cancelled) {
          setData(j.data ?? null)
          setError(null)
        }
      } catch (e: unknown) {
        const err = e as { name?: string; message?: string }
        if (!cancelled && err.name !== 'AbortError') {
          setError(err.message ?? 'Error de red')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [verifId])

  if (loading) {
    return (
      <div className="flex flex-col gap-4 max-w-3xl">
        <div className="h-4 w-48 bg-stone-200 rounded animate-pulse" />
        <div className="h-96 rounded-lg bg-stone-100 animate-pulse" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {error ?? 'No se pudo cargar la verificación'}
      </div>
    )
  }

  const snap = data.snapshot
  const measurements = data.measurements ?? []
  const mMap = new Map(
    measurements.map(m => [`${m.section_id}:${m.section_repeticion}:${m.item_id}`, m] as const)
  )

  const totalItems = measurements.length
  const cumpleCount = measurements.filter(m => m.cumple === true).length
  const noCount = measurements.filter(m => m.cumple === false).length

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <EmaBreadcrumb items={[
        { label: data.instrumento?.nombre ?? 'Instrumento', href: `/quality/instrumentos/${instrumentoId}` },
        { label: 'Verificaciones', href: `/quality/instrumentos/${instrumentoId}` },
        { label: fmtDate(data.fecha_verificacion) },
      ]} />

      <div className="flex items-center gap-3">
        <Link
          href={`/quality/instrumentos/${instrumentoId}`}
          className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold tracking-tight text-stone-900">
              Verificación {fmtDate(data.fecha_verificacion)}
            </h1>
            <span className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium',
              RESULTADO_STYLE[data.resultado] ?? RESULTADO_STYLE.pendiente,
            )}>
              {RESULTADO_LABEL[data.resultado] ?? data.resultado}
            </span>
            <span className="rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-[10px] text-stone-600">
              {ESTADO_LABEL[data.estado] ?? data.estado}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            {snap?.template.nombre}
            {data.template_version_number != null && ` · v${data.template_version_number}`}
          </p>
        </div>
      </div>

      {/* Header card */}
      <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-stone-100">
          {[
            { label: 'Fecha verificación', value: fmtDate(data.fecha_verificacion) },
            { label: 'Próxima verificación', value: fmtDate(data.fecha_proxima_verificacion) },
            { label: 'Items revisados', value: `${totalItems}` },
            {
              label: 'Cumple / No cumple',
              value: totalItems > 0 ? `${cumpleCount} / ${noCount}` : '—',
            },
          ].map(item => (
            <div key={item.label} className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{item.label}</p>
              <p className="text-sm font-medium text-stone-800 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>

        {(data.condiciones_ambientales || data.observaciones_generales) && (
          <div className="px-4 py-3 grid grid-cols-2 gap-4 text-xs text-stone-600">
            {data.condiciones_ambientales && (
              <div>
                <span className="font-semibold text-stone-500">Condiciones: </span>
                {[
                  data.condiciones_ambientales.temperatura && `Temp: ${data.condiciones_ambientales.temperatura}`,
                  data.condiciones_ambientales.humedad && `Hum: ${data.condiciones_ambientales.humedad}`,
                  data.condiciones_ambientales.lugar && data.condiciones_ambientales.lugar,
                ].filter(Boolean).join(' · ')}
              </div>
            )}
            {data.observaciones_generales && (
              <div>
                <span className="font-semibold text-stone-500">Observaciones: </span>
                {data.observaciones_generales}
              </div>
            )}
          </div>
        )}

        {data.created_by_profile && (
          <div className="px-4 py-2 text-xs text-stone-400">
            Registrada por {data.created_by_profile.full_name}
            {data.created_at && ` · ${new Date(data.created_at).toLocaleDateString('es-MX')}`}
          </div>
        )}
      </div>

      {/* Measurements per section */}
      {snap?.sections.map(section => {
        const reps = section.repetible ? section.repeticiones_default : 1

        return (
          <div key={section.id} className="rounded-lg border border-stone-200 bg-white overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-200">
              <h3 className="text-sm font-semibold text-stone-700">{section.titulo}</h3>
              {section.descripcion && (
                <p className="text-xs text-stone-500 mt-0.5">{section.descripcion}</p>
              )}
            </div>

            {Array.from({ length: reps }, (_, i) => i + 1).map(rep => (
              <div key={rep}>
                {section.repetible && (
                  <div className="px-4 py-1.5 bg-stone-50/50 border-b border-stone-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                      Repetición {rep}
                    </span>
                  </div>
                )}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50/30">
                      <th className="text-left px-4 py-2 font-semibold text-stone-500 uppercase tracking-wide w-[40%]">Punto</th>
                      <th className="text-left px-4 py-2 font-semibold text-stone-500 uppercase tracking-wide w-[25%]">Esperado</th>
                      <th className="text-left px-4 py-2 font-semibold text-stone-500 uppercase tracking-wide">Observado</th>
                      <th className="text-left px-4 py-2 font-semibold text-stone-500 uppercase tracking-wide w-[15%]">Obs.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {section.items.map(item => {
                      const key = `${section.id}:${rep}:${item.id}`
                      const m = mMap.get(key)
                      return (
                        <tr key={item.id} className="hover:bg-stone-50/50">
                          <td className="px-4 py-2 text-stone-700 font-medium">{item.punto}</td>
                          <td className="px-4 py-2 font-mono text-stone-500">
                            {item.tipo === 'medicion' && item.valor_esperado != null
                              ? `${item.valor_esperado}${item.unidad ? ` ${item.unidad}` : ''}${item.tolerancia != null ? ` ± ${item.tolerancia}` : ''}`
                              : item.tipo === 'booleano' ? 'Sí / No'
                              : '—'
                            }
                          </td>
                          <td className="px-4 py-2">
                            <MeasurementCell item={item} measurement={m} />
                          </td>
                          <td className="px-4 py-2 text-stone-400 text-xs max-w-[120px] truncate">
                            {m?.observacion ?? ''}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )
      })}

      {/* Status indicator */}
      {data.estado !== 'cerrado' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2 text-sm text-amber-800">
          <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <span>Esta verificación está <strong>{ESTADO_LABEL[data.estado]}</strong> — aún no se ha cerrado formalmente.</span>
        </div>
      )}

      {data.estado === 'cerrado' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>Verificación cerrada. La fecha de próxima verificación del instrumento fue actualizada a <strong>{fmtDate(data.fecha_proxima_verificacion)}</strong>.</span>
        </div>
      )}
    </div>
  )
}
