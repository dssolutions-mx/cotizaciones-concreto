'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Info, Loader2, Minus, Plus, Shield, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaEstadoBadge } from '@/components/ema/EmaEstadoBadge'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { cn } from '@/lib/utils'
import type { InstrumentoDetalle, InstrumentoCard, LecturaVerificacion } from '@/types/ema'

interface LecturaRow {
  punto: string
  lectura_maestro: string
  lectura_trabajo: string
  unidad: string
}

const EMPTY_LECTURA: LecturaRow = { punto: '', lectura_maestro: '', lectura_trabajo: '', unidad: '' }

export default function VerificarPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [instrumento, setInstrumento] = useState<InstrumentoDetalle | null>(null)
  const [maestros, setMaestros] = useState<InstrumentoCard[]>([])
  const [loadingInst, setLoadingInst] = useState(true)

  const [form, setForm] = useState({
    instrumento_maestro_id: '',
    fecha_verificacion: new Date().toISOString().split('T')[0],
    resultado: '',
    fecha_proxima_verificacion: '',
    criterio_aceptacion: '',
    condiciones_temperatura: '',
    condiciones_humedad: '',
    observaciones: '',
  })
  const [lecturas, setLecturas] = useState<LecturaRow[]>([{ ...EMPTY_LECTURA }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/ema/instrumentos/${id}`).then(r => r.json()),
      fetch('/api/ema/instrumentos?tipo=A&limit=100').then(r => r.json()),
    ]).then(([instJ, maestrosJ]) => {
      const inst = instJ.data ?? instJ
      setInstrumento(inst)
      setMaestros(maestrosJ.data ?? [])

      // Pre-select master if instrument has one
      if (inst.instrumento_maestro_id) {
        setForm(f => ({ ...f, instrumento_maestro_id: inst.instrumento_maestro_id }))
      }

      // Auto-calculate next verification date
      const period = inst.periodo_efectivo_dias ?? inst.periodo_calibracion_dias
      if (period) {
        const next = new Date()
        next.setDate(next.getDate() + period)
        setForm(f => ({ ...f, fecha_proxima_verificacion: next.toISOString().split('T')[0] }))
      }

      // Pre-fill unit from modelo
      if (inst.modelo?.unidad_medicion) {
        setLecturas([{ ...EMPTY_LECTURA, unidad: inst.modelo.unidad_medicion }])
      }

      setLoadingInst(false)
    }).catch(() => setLoadingInst(false))
  }, [id])

  // Recalculate next date when verification date changes
  useEffect(() => {
    if (form.fecha_verificacion && instrumento) {
      const period = instrumento.periodo_efectivo_dias ?? instrumento.periodo_calibracion_dias
      if (period) {
        const next = new Date(form.fecha_verificacion)
        next.setDate(next.getDate() + period)
        setForm(f => ({ ...f, fecha_proxima_verificacion: next.toISOString().split('T')[0] }))
      }
    }
  }, [form.fecha_verificacion, instrumento])

  const addLectura = useCallback(() => {
    const lastUnit = lecturas.length > 0 ? lecturas[lecturas.length - 1].unidad : ''
    setLecturas(prev => [...prev, { ...EMPTY_LECTURA, unidad: lastUnit }])
  }, [lecturas])

  const removeLectura = useCallback((idx: number) => {
    setLecturas(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const updateLectura = useCallback((idx: number, key: keyof LecturaRow, val: string) => {
    setLecturas(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l))
  }, [])

  // Build lecturas payload with computed deviation
  const buildLecturasPayload = (): LecturaVerificacion[] => {
    return lecturas
      .filter(l => l.punto && l.lectura_maestro && l.lectura_trabajo)
      .map(l => ({
        punto: l.punto,
        lectura_maestro: parseFloat(l.lectura_maestro),
        lectura_trabajo: parseFloat(l.lectura_trabajo),
        desviacion: parseFloat(l.lectura_trabajo) - parseFloat(l.lectura_maestro),
        unidad: l.unidad,
      }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const body = {
        instrumento_maestro_id: form.instrumento_maestro_id,
        fecha_verificacion: form.fecha_verificacion,
        fecha_proxima_verificacion: form.fecha_proxima_verificacion,
        resultado: form.resultado,
        lecturas: buildLecturasPayload(),
        criterio_aceptacion: form.criterio_aceptacion || null,
        condiciones_ambientales: (form.condiciones_temperatura || form.condiciones_humedad) ? {
          temperatura: form.condiciones_temperatura || undefined,
          humedad: form.condiciones_humedad || undefined,
        } : null,
        observaciones: form.observaciones || null,
      }
      const res = await fetch(`/api/ema/instrumentos/${id}/verificaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Error registrando verificación')
      }
      router.push(`/quality/instrumentos/${id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedMaestro = maestros.find(m => m.id === form.instrumento_maestro_id)

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
        { label: 'Registrar verificación' },
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
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Registrar verificación interna
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {instrumento?.nombre} · {instrumento?.codigo}
          </p>
        </div>
      </div>

      {/* Context card */}
      {instrumento && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <EmaTipoBadge tipo={instrumento.tipo} showLabel />
            <EmaEstadoBadge estado={instrumento.estado} />
          </div>
          <div className="text-xs text-stone-500 font-mono">
            Período: {instrumento.periodo_efectivo_dias ?? instrumento.periodo_calibracion_dias ?? '—'} días
            {instrumento.modelo?.unidad_medicion && ` · ${instrumento.modelo.unidad_medicion}`}
          </div>
        </div>
      )}

      {/* Traceability mini-diagram */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Cadena de verificación</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={cn(
            'rounded-md border px-2.5 py-1.5 font-medium',
            selectedMaestro
              ? 'border-sky-200 bg-sky-50 text-sky-800'
              : 'border-stone-200 bg-stone-50 text-stone-500'
          )}>
            {selectedMaestro
              ? `${selectedMaestro.nombre} (${selectedMaestro.codigo})`
              : 'Seleccione instrumento maestro'
            }
          </span>
          <span className="text-stone-400">→</span>
          <span className="rounded-md border border-stone-400 bg-stone-50 px-2.5 py-1.5 font-medium text-stone-800 ring-1 ring-stone-300">
            {instrumento?.nombre ?? '—'}
          </span>
        </div>
        <p className="text-[11px] text-emerald-700 mt-2">
          La verificación interna compara las lecturas del instrumento de trabajo contra el instrumento maestro (Tipo A) calibrado externamente.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Master instrument */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Instrumento maestro</h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-stone-600">Instrumento maestro (Tipo A) <span className="text-red-500">*</span></Label>
            <Select
              required
              value={form.instrumento_maestro_id}
              onValueChange={v => setForm(f => ({ ...f, instrumento_maestro_id: v }))}
            >
              <SelectTrigger className="border-stone-200">
                <SelectValue placeholder="Seleccionar instrumento maestro vigente" />
              </SelectTrigger>
              <SelectContent>
                {maestros.filter(m => m.estado === 'vigente').map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="font-mono text-xs text-stone-500">{m.codigo}</span>
                    {' — '}{m.nombre}
                    {m.marca && <span className="text-stone-400"> · {m.marca}</span>}
                  </SelectItem>
                ))}
                {maestros.filter(m => m.estado !== 'vigente').length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase text-stone-400">No vigentes</div>
                    {maestros.filter(m => m.estado !== 'vigente').map(m => (
                      <SelectItem key={m.id} value={m.id} disabled>
                        <span className="font-mono text-xs text-stone-400">{m.codigo}</span>
                        {' — '}{m.nombre} ({m.estado})
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Verification dates */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Datos de verificación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Fecha de verificación <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                required
                value={form.fecha_verificacion}
                onChange={e => setForm(f => ({ ...f, fecha_verificacion: e.target.value }))}
                className="border-stone-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Próxima verificación</Label>
              <Input
                type="date"
                value={form.fecha_proxima_verificacion}
                onChange={e => setForm(f => ({ ...f, fecha_proxima_verificacion: e.target.value }))}
                className="border-stone-200"
              />
              <p className="text-[11px] text-stone-400">Auto-calculada según el período del instrumento</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Criterio de aceptación</Label>
              <Input
                value={form.criterio_aceptacion}
                onChange={e => setForm(f => ({ ...f, criterio_aceptacion: e.target.value }))}
                placeholder="ej. ±1% de la lectura"
                className="border-stone-200 font-mono text-sm"
                list="criterios-list"
              />
              <datalist id="criterios-list">
                <option value="±1% de la lectura" />
                <option value="±0.5% de la lectura" />
                <option value="±2% del fondo de escala" />
                <option value="±0.1 °C" />
                <option value="±0.5 °C" />
                <option value="±0.01 mm" />
                <option value="±1 g" />
              </datalist>
              <p className="text-[11px] text-stone-400">Tolerancia máxima aceptable entre lecturas</p>
            </div>
            <div className="space-y-1.5 grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Temp. ambiente</Label>
                <Input
                  value={form.condiciones_temperatura}
                  onChange={e => setForm(f => ({ ...f, condiciones_temperatura: e.target.value }))}
                  placeholder="ej. 23 °C"
                  className="border-stone-200 font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Humedad</Label>
                <Input
                  value={form.condiciones_humedad}
                  onChange={e => setForm(f => ({ ...f, condiciones_humedad: e.target.value }))}
                  placeholder="ej. 50 %HR"
                  className="border-stone-200 font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Measurement readings table */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Lecturas de comparación</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Compare las lecturas del instrumento maestro con el instrumento de trabajo en cada punto de verificación.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLectura}
              className="border-stone-300 text-stone-700 gap-1 text-xs"
            >
              <Plus className="h-3 w-3" /> Punto
            </Button>
          </div>

          {lecturas.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="text-left py-2 pr-2 font-semibold text-stone-500 uppercase tracking-wide w-[25%]">Punto</th>
                    <th className="text-left py-2 pr-2 font-semibold text-stone-500 uppercase tracking-wide w-[20%]">Maestro</th>
                    <th className="text-left py-2 pr-2 font-semibold text-stone-500 uppercase tracking-wide w-[20%]">Trabajo</th>
                    <th className="text-left py-2 pr-2 font-semibold text-stone-500 uppercase tracking-wide w-[15%]">Desviación</th>
                    <th className="text-left py-2 pr-2 font-semibold text-stone-500 uppercase tracking-wide w-[12%]">Unidad</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lecturas.map((l, idx) => {
                    const maestroVal = parseFloat(l.lectura_maestro)
                    const trabajoVal = parseFloat(l.lectura_trabajo)
                    const desviacion = !isNaN(maestroVal) && !isNaN(trabajoVal)
                      ? (trabajoVal - maestroVal)
                      : null
                    return (
                      <tr key={idx} className="border-b border-stone-100">
                        <td className="py-1.5 pr-2">
                          <Input
                            value={l.punto}
                            onChange={e => updateLectura(idx, 'punto', e.target.value)}
                            placeholder={`Punto ${idx + 1}`}
                            className="border-stone-200 h-8 text-xs"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            type="number"
                            step="any"
                            value={l.lectura_maestro}
                            onChange={e => updateLectura(idx, 'lectura_maestro', e.target.value)}
                            placeholder="0.00"
                            className="border-stone-200 h-8 text-xs font-mono"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            type="number"
                            step="any"
                            value={l.lectura_trabajo}
                            onChange={e => updateLectura(idx, 'lectura_trabajo', e.target.value)}
                            placeholder="0.00"
                            className="border-stone-200 h-8 text-xs font-mono"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className={cn(
                            'font-mono text-xs px-2 py-1 rounded',
                            desviacion === null
                              ? 'text-stone-400'
                              : Math.abs(desviacion) < 0.001
                                ? 'text-emerald-700 bg-emerald-50'
                                : 'text-stone-700 bg-stone-50',
                          )}>
                            {desviacion !== null ? (desviacion >= 0 ? '+' : '') + desviacion.toFixed(3) : '—'}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            value={l.unidad}
                            onChange={e => updateLectura(idx, 'unidad', e.target.value)}
                            placeholder="kN"
                            className="border-stone-200 h-8 text-xs font-mono w-16"
                          />
                        </td>
                        <td className="py-1.5">
                          {lecturas.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLectura(idx)}
                              className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {lecturas.filter(l => l.lectura_maestro && l.lectura_trabajo).length > 0 && (
            <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
              <span className="font-medium">{lecturas.filter(l => l.lectura_maestro && l.lectura_trabajo).length}</span> punto(s) registrado(s)
              {(() => {
                const filled = lecturas.filter(l => l.lectura_maestro && l.lectura_trabajo)
                if (filled.length === 0) return null
                const maxDev = Math.max(...filled.map(l => Math.abs(parseFloat(l.lectura_trabajo) - parseFloat(l.lectura_maestro))))
                return <> · Desviación máxima: <span className="font-mono font-medium">{maxDev.toFixed(3)}</span></>
              })()}
            </div>
          )}
        </div>

        {/* Result */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Resultado</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'conforme', label: 'Conforme', dotClass: 'bg-emerald-400', activeClass: 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300', desc: 'Lecturas dentro de tolerancia' },
              { value: 'no_conforme', label: 'No conforme', dotClass: 'bg-red-400', activeClass: 'border-red-400 bg-red-50 ring-1 ring-red-300', desc: 'Fuera de tolerancia — requiere acción' },
              { value: 'condicional', label: 'Condicional', dotClass: 'bg-amber-400', activeClass: 'border-amber-400 bg-amber-50 ring-1 ring-amber-300', desc: 'Uso limitado con restricciones' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, resultado: opt.value }))}
                className={cn(
                  'rounded-lg border p-3 text-left transition-all',
                  form.resultado === opt.value
                    ? opt.activeClass
                    : 'border-stone-200 bg-white hover:border-stone-300',
                )}
              >
                <div className={cn('h-3 w-3 rounded-full mb-2', opt.dotClass)} />
                <p className="text-sm font-medium text-stone-900">{opt.label}</p>
                <p className="text-[11px] text-stone-500 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
          {!form.resultado && (
            <p className="text-xs text-stone-400">Seleccione el resultado de la verificación</p>
          )}
        </div>

        {/* Notes */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Observaciones</h2>
          <Textarea
            rows={3}
            value={form.observaciones}
            onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
            placeholder="Notas sobre la verificación, condiciones observadas, lecturas atípicas..."
            className="border-stone-200 resize-none"
          />
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
            className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
            disabled={submitting || !form.resultado}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Registrar verificación</>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
