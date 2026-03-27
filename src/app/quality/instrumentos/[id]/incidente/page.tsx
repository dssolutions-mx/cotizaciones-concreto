'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaEstadoBadge } from '@/components/ema/EmaEstadoBadge'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { cn } from '@/lib/utils'
import type { InstrumentoDetalle } from '@/types/ema'

const TIPO_INCIDENTE_OPTIONS = [
  { value: 'dano_fisico', label: 'Daño físico', desc: 'Golpe, caída, rotura o deformación del instrumento' },
  { value: 'perdida', label: 'Pérdida', desc: 'El instrumento no se puede localizar' },
  { value: 'mal_funcionamiento', label: 'Mal funcionamiento', desc: 'El instrumento no opera correctamente' },
  { value: 'desviacion_lectura', label: 'Desviación de lectura', desc: 'Lecturas fuera del rango esperado' },
  { value: 'otro', label: 'Otro', desc: 'Otro tipo de incidente' },
]

const SEVERIDAD_OPTIONS = [
  { value: 'baja', label: 'Baja', color: 'emerald', desc: 'Sin impacto en mediciones. Registro preventivo.' },
  { value: 'media', label: 'Media', color: 'amber', desc: 'Posible impacto en precisión. Se recomienda verificación.' },
  { value: 'alta', label: 'Alta', color: 'orange', desc: 'Impacto confirmado. Se genera verificación post-incidente automática.' },
  { value: 'critica', label: 'Crítica', color: 'red', desc: 'Instrumento fuera de servicio. Se genera verificación post-incidente y el instrumento se marca como inactivo.' },
]

export default function IncidentePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [instrumento, setInstrumento] = useState<InstrumentoDetalle | null>(null)
  const [loadingInst, setLoadingInst] = useState(true)

  const [form, setForm] = useState({
    tipo: '',
    severidad: '',
    descripcion: '',
    fecha_incidente: new Date().toISOString().split('T')[0],
    evidencia_paths: [] as string[],
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/ema/instrumentos/${id}`)
      .then(r => r.json())
      .then(j => { setInstrumento(j.data ?? j); setLoadingInst(false) })
      .catch(() => setLoadingInst(false))
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/ema/instrumentos/${id}/incidentes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Error reportando incidente')
      }
      router.push(`/quality/instrumentos/${id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedSeveridad = SEVERIDAD_OPTIONS.find(s => s.value === form.severidad)

  if (loadingInst) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-4 w-64 bg-stone-200 rounded animate-pulse" />
        <div className="h-48 rounded-lg bg-stone-100 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <EmaBreadcrumb items={[
        { label: instrumento?.nombre ?? 'Instrumento', href: `/quality/instrumentos/${id}` },
        { label: 'Reportar incidente' },
      ]} />

      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Link
          href={`/quality/instrumentos/${id}`}
          className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Reportar incidente
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {instrumento?.nombre} · {instrumento?.codigo}
          </p>
        </div>
      </div>

      {/* Context card */}
      {instrumento && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 flex items-center gap-2 flex-wrap">
          <EmaTipoBadge tipo={instrumento.tipo} showLabel />
          <EmaEstadoBadge estado={instrumento.estado} />
          {instrumento.marca && (
            <span className="text-xs text-stone-500">{instrumento.marca} {instrumento.modelo_comercial}</span>
          )}
        </div>
      )}

      {/* Info banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-800">
          <p className="font-medium">Consecuencias según severidad</p>
          <p className="mt-0.5">
            Los incidentes de severidad <strong>alta</strong> o <strong>crítica</strong> generan automáticamente
            un evento de verificación post-incidente en el programa de calibraciones. Los incidentes críticos
            además marcan el instrumento como inactivo hasta que se resuelva.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Tipo de incidente</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TIPO_INCIDENTE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, tipo: opt.value }))}
                className={cn(
                  'rounded-lg border p-3 text-left transition-all',
                  form.tipo === opt.value
                    ? 'border-stone-400 bg-stone-50 ring-1 ring-stone-300'
                    : 'border-stone-200 bg-white hover:border-stone-300',
                )}
              >
                <p className="text-sm font-medium text-stone-900">{opt.label}</p>
                <p className="text-[11px] text-stone-500 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Severidad</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SEVERIDAD_OPTIONS.map(opt => {
              const dotColor =
                opt.color === 'emerald' ? 'bg-emerald-400'
                : opt.color === 'amber' ? 'bg-amber-400'
                : opt.color === 'orange' ? 'bg-orange-400'
                : 'bg-red-400'

              const ringColor =
                opt.color === 'emerald' ? 'border-emerald-400 ring-emerald-300'
                : opt.color === 'amber' ? 'border-amber-400 ring-amber-300'
                : opt.color === 'orange' ? 'border-orange-400 ring-orange-300'
                : 'border-red-400 ring-red-300'

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, severidad: opt.value }))}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-all',
                    form.severidad === opt.value
                      ? `${ringColor} ring-1`
                      : 'border-stone-200 bg-white hover:border-stone-300',
                  )}
                >
                  <div className={cn('h-3 w-3 rounded-full mb-2', dotColor)} />
                  <p className="text-sm font-medium text-stone-900">{opt.label}</p>
                </button>
              )
            })}
          </div>
          {selectedSeveridad && (
            <div className={cn(
              'rounded-md border px-3 py-2 text-xs',
              selectedSeveridad.color === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : selectedSeveridad.color === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-800'
                : selectedSeveridad.color === 'orange' ? 'border-orange-200 bg-orange-50 text-orange-800'
                : 'border-red-200 bg-red-50 text-red-800',
            )}>
              {selectedSeveridad.desc}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Detalles</h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-stone-600">Fecha del incidente <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              required
              value={form.fecha_incidente}
              onChange={e => setForm(f => ({ ...f, fecha_incidente: e.target.value }))}
              className="border-stone-200 max-w-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-stone-600">Descripción <span className="text-red-500">*</span></Label>
            <Textarea
              required
              rows={4}
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Describa qué sucedió, cuándo se detectó, y cualquier detalle relevante para la investigación..."
              className="border-stone-200 resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href={`/quality/instrumentos/${id}`}
            className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            Cancelar
          </Link>
          <Button
            type="submit"
            className="bg-red-700 hover:bg-red-800 text-white gap-1.5"
            disabled={submitting || !form.tipo || !form.severidad || !form.descripcion}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Reportando...</>
            ) : (
              <><AlertTriangle className="h-4 w-4" /> Reportar incidente</>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
