'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { usePlantContext } from '@/contexts/PlantContext'
import type { InstrumentoDetalle } from '@/types/ema'

const MESES = [
  { v: 1, label: 'Enero' }, { v: 2, label: 'Febrero' }, { v: 3, label: 'Marzo' },
  { v: 4, label: 'Abril' }, { v: 5, label: 'Mayo' }, { v: 6, label: 'Junio' },
  { v: 7, label: 'Julio' }, { v: 8, label: 'Agosto' }, { v: 9, label: 'Septiembre' },
  { v: 10, label: 'Octubre' }, { v: 11, label: 'Noviembre' }, { v: 12, label: 'Diciembre' },
]

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-stone-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  )
}

export default function EditarInstrumentoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { availablePlants } = usePlantContext()

  const [instrumento, setInstrumento] = useState<InstrumentoDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Maestros list for Tipo C instruments
  const [maestros, setMaestros] = useState<{ id: string; codigo: string; nombre: string }[]>([])

  // Form state — only editable fields
  const [form, setForm] = useState({
    nombre: '',
    tipo: '' as 'A' | 'B' | 'C' | '',
    instrumento_maestro_ids: [] as string[],
    numero_serie: '',
    marca: '',
    modelo_comercial: '',
    plant_id: '',
    ubicacion_dentro_planta: '',
    fecha_alta: '',
    fecha_proximo_evento: '',
    mes_inicio_servicio_override: '' as string | number,
    mes_fin_servicio_override: '' as string | number,
    notas: '',
    estado: '' as string,
  })

  // Window override toggle
  const [overrideWindow, setOverrideWindow] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ema/instrumentos/${id}`)
      if (!res.ok) throw new Error('Instrumento no encontrado')
      const j = await res.json()
      const inst: InstrumentoDetalle = j.data ?? j
      setInstrumento(inst)

      const hasOverride = !!(inst.mes_inicio_servicio_override || inst.mes_fin_servicio_override)
      setOverrideWindow(hasOverride)

      setForm({
        nombre: inst.nombre ?? '',
        tipo: inst.tipo ?? '',
        instrumento_maestro_ids: [...(inst.instrumento_maestro_ids ?? [])],
        numero_serie: inst.numero_serie ?? '',
        marca: inst.marca ?? '',
        modelo_comercial: inst.modelo_comercial ?? '',
        plant_id: inst.plant_id ?? '',
        ubicacion_dentro_planta: inst.ubicacion_dentro_planta ?? '',
        fecha_alta: inst.fecha_alta ?? '',
        fecha_proximo_evento: inst.fecha_proximo_evento ?? '',
        mes_inicio_servicio_override: inst.mes_inicio_servicio_override ?? '',
        mes_fin_servicio_override: inst.mes_fin_servicio_override ?? '',
        notas: inst.notas ?? '',
        estado: inst.estado ?? 'vigente',
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Load Tipo A instruments as maestro candidates when tipo = C
  useEffect(() => {
    if (form.tipo !== 'C') return
    fetch('/api/ema/instrumentos?tipo=A&estado=vigente')
      .then(r => r.json())
      .then(j => setMaestros((j.data ?? j).map((m: any) => ({ id: m.id, codigo: m.codigo, nombre: m.nombre }))))
      .catch(() => {})
  }, [form.tipo])

  function update<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre || !form.tipo) return
    setSaving(true)
    setSaveError(null)
    try {
      const body: Record<string, any> = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        ...(form.tipo === 'C'
          ? { instrumento_maestro_ids: form.instrumento_maestro_ids }
          : { instrumento_maestro_ids: [] }),
        numero_serie: form.numero_serie.trim() || null,
        marca: form.marca.trim() || null,
        modelo_comercial: form.modelo_comercial.trim() || null,
        plant_id: form.plant_id || null,
        ubicacion_dentro_planta: form.ubicacion_dentro_planta.trim() || null,
        fecha_alta: form.fecha_alta || null,
        fecha_proximo_evento: form.fecha_proximo_evento || null,
        mes_inicio_servicio_override: overrideWindow && form.mes_inicio_servicio_override
          ? Number(form.mes_inicio_servicio_override) : null,
        mes_fin_servicio_override: overrideWindow && form.mes_fin_servicio_override
          ? Number(form.mes_fin_servicio_override) : null,
        notas: form.notas.trim() || null,
        estado: form.estado || 'vigente',
      }

      const res = await fetch(`/api/ema/instrumentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Error al guardar')
      }
      router.push(`/quality/instrumentos/${id}`)
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <EmaBreadcrumb items={[{ label: 'Instrumento', href: `/quality/instrumentos/${id}` }, { label: 'Editar' }]} />
        <div className="flex items-center justify-center py-16 text-stone-400 text-sm">Cargando…</div>
      </div>
    )
  }

  if (error || !instrumento) {
    return (
      <div className="flex flex-col gap-4">
        <EmaBreadcrumb items={[{ label: 'Instrumento' }]} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {error ?? 'Instrumento no encontrado'}
        </div>
      </div>
    )
  }

  const conjuntoNombre = instrumento.conjunto?.nombre_conjunto ?? instrumento.conjunto_id

  return (
    <div className="flex flex-col gap-4 pb-10">
      <EmaBreadcrumb
        items={[
          { label: instrumento.nombre, href: `/quality/instrumentos/${id}` },
          { label: 'Editar' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/quality/instrumentos/${id}`}
          className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">
            Editar instrumento
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs text-stone-400">{instrumento.codigo}</span>
            <span className="text-stone-300">·</span>
            <span className="text-xs text-stone-500">{conjuntoNombre}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* ── Sección: Identificación ────────────────────────────── */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-stone-700">Identificación</h2>

          {/* Read-only identity fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center gap-3 rounded-md bg-stone-50 border border-stone-200 px-3 py-2">
              <span className="text-xs text-stone-500 w-14 shrink-0">Código</span>
              <span className="font-mono text-sm font-medium text-stone-800">{instrumento.codigo}</span>
              <span className="ml-auto text-xs text-stone-400 italic">No editable</span>
            </div>
            <Link
              href={`/quality/conjuntos/${instrumento.conjunto_id}`}
              className="flex items-center gap-3 rounded-md bg-stone-50 border border-stone-200 px-3 py-2 hover:bg-stone-100 transition-colors group"
            >
              <span className="text-xs text-stone-500 w-14 shrink-0">Conjunto</span>
              <span className="font-mono text-xs font-semibold text-stone-600 bg-stone-200 px-1.5 py-0.5 rounded">
                DC-{instrumento.conjunto?.codigo_conjunto}
              </span>
              <span className="text-xs text-stone-700 truncate">{instrumento.conjunto?.nombre_conjunto}</span>
              <ChevronRight className="h-3 w-3 text-stone-400 group-hover:text-stone-600 ml-auto shrink-0" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre" required>
              <Input
                value={form.nombre}
                onChange={e => update('nombre', e.target.value)}
                placeholder="Nombre del instrumento"
                required
              />
            </Field>

            <Field label="Tipo de instrumento" required>
              <Select
                value={form.tipo}
                onValueChange={(v) => {
                  const t = v as 'A' | 'B' | 'C'
                  setForm((prev) => ({
                    ...prev,
                    tipo: t,
                    instrumento_maestro_ids: t === 'C' ? prev.instrumento_maestro_ids : [],
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">
                    <div className="flex items-center gap-2">
                      <EmaTipoBadge tipo="A" />
                      <span className="text-xs text-stone-500">Maestro — calibración externa</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="B">
                    <div className="flex items-center gap-2">
                      <EmaTipoBadge tipo="B" />
                      <span className="text-xs text-stone-500">Referencia — calibración externa</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="C">
                    <div className="flex items-center gap-2">
                      <EmaTipoBadge tipo="C" />
                      <span className="text-xs text-stone-500">Trabajo — verificación interna</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Patrones — only for Tipo C */}
          {form.tipo === 'C' && (
            <Field label="Instrumentos patrón (Tipo A)">
              <div className="border border-stone-200 rounded-md p-3 max-h-[220px] overflow-y-auto space-y-2">
                {maestros.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={form.instrumento_maestro_ids.includes(m.id)}
                      onCheckedChange={(c) => {
                        const on = c === true
                        setForm((prev) => {
                          const s = new Set(prev.instrumento_maestro_ids)
                          if (on) s.add(m.id)
                          else s.delete(m.id)
                          return { ...prev, instrumento_maestro_ids: Array.from(s) }
                        })
                      }}
                    />
                    <span className="font-mono text-xs">{m.codigo}</span>
                    <span className="text-stone-700">{m.nombre}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}
        </div>

        {/* ── Sección: Datos físicos ─────────────────────────────── */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-stone-700">Datos físicos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Número de serie">
              <Input
                value={form.numero_serie}
                onChange={e => update('numero_serie', e.target.value)}
                placeholder="S/N"
              />
            </Field>
            <Field label="Marca">
              <Input
                value={form.marca}
                onChange={e => update('marca', e.target.value)}
                placeholder="Fabricante"
              />
            </Field>
            <Field label="Modelo comercial">
              <Input
                value={form.modelo_comercial}
                onChange={e => update('modelo_comercial', e.target.value)}
                placeholder="Ref. comercial"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Planta">
              <Select value={form.plant_id} onValueChange={v => update('plant_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar planta" />
                </SelectTrigger>
                <SelectContent>
                  {availablePlants.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ubicación dentro de planta">
              <Input
                value={form.ubicacion_dentro_planta}
                onChange={e => update('ubicacion_dentro_planta', e.target.value)}
                placeholder="Laboratorio de Calidad"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fecha de alta">
              <Input
                type="date"
                value={form.fecha_alta}
                onChange={e => update('fecha_alta', e.target.value)}
              />
            </Field>
            <Field label="Próximo evento (V/C)">
              <Input
                type="date"
                value={form.fecha_proximo_evento}
                onChange={e => update('fecha_proximo_evento', e.target.value)}
              />
            </Field>
          </div>
        </div>

        {/* ── Sección: Ventana de servicio ──────────────────────── */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-stone-700">Ventana de servicio</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Por defecto hereda del conjunto. Activa el override para este instrumento.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-stone-600">Override</span>
              <button
                type="button"
                role="switch"
                aria-checked={overrideWindow}
                onClick={() => setOverrideWindow(v => !v)}
                className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${overrideWindow ? 'bg-stone-900' : 'bg-stone-300'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${overrideWindow ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
          </div>

          {/* Inherited window from conjunto */}
          {!overrideWindow && instrumento.conjunto && (
            <div className="rounded-md bg-stone-50 border border-stone-100 px-3 py-2 text-xs text-stone-500">
              Heredado del conjunto: &nbsp;
              <span className="font-medium text-stone-700">
                {instrumento.conjunto.mes_inicio_servicio && instrumento.conjunto.mes_fin_servicio
                  ? `${MESES.find(m => m.v === instrumento.conjunto!.mes_inicio_servicio)?.label} – ${MESES.find(m => m.v === instrumento.conjunto!.mes_fin_servicio)?.label}`
                  : 'Sin ventana definida'}
              </span>
            </div>
          )}

          {overrideWindow && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Mes inicio">
                <Select
                  value={String(form.mes_inicio_servicio_override || '')}
                  onValueChange={v => update('mes_inicio_servicio_override', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map(m => <SelectItem key={m.v} value={String(m.v)}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Mes fin">
                <Select
                  value={String(form.mes_fin_servicio_override || '')}
                  onValueChange={v => update('mes_fin_servicio_override', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map(m => <SelectItem key={m.v} value={String(m.v)}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
        </div>

        {/* ── Sección: Estado y notas ───────────────────────────── */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-stone-700">Estado y notas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Estado">
              <Select value={form.estado} onValueChange={v => update('estado', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vigente">Vigente</SelectItem>
                  <SelectItem value="proximo_vencer">Próximo a vencer</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="inactivo">Inactivo (baja)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notas">
            <Textarea
              value={form.notas}
              onChange={e => update('notas', e.target.value)}
              rows={3}
              placeholder="Observaciones, descripción adicional…"
            />
          </Field>
        </div>

        {/* Error */}
        {saveError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {saveError}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/quality/instrumentos/${id}`}>Cancelar</Link>
          </Button>
          <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  )
}
