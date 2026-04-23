'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2, ChevronRight, AlertTriangle, Plus, ClipboardList, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { EmaEstadoBadge } from '@/components/ema/EmaEstadoBadge'
import { cn } from '@/lib/utils'
import type { ConjuntoHerramientas, InstrumentoCard } from '@/types/ema'

const MESES = [
  { v: 1, label: 'Enero' }, { v: 2, label: 'Febrero' }, { v: 3, label: 'Marzo' },
  { v: 4, label: 'Abril' }, { v: 5, label: 'Mayo' }, { v: 6, label: 'Junio' },
  { v: 7, label: 'Julio' }, { v: 8, label: 'Agosto' }, { v: 9, label: 'Septiembre' },
  { v: 10, label: 'Octubre' }, { v: 11, label: 'Noviembre' }, { v: 12, label: 'Diciembre' },
]

const TIPO_SERVICIO_LABEL: Record<string, string> = {
  calibracion: 'Calibración externa',
  verificacion: 'Verificación interna',
  ninguno: 'Sin servicio programado',
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-stone-600">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-stone-400">{hint}</p>}
    </div>
  )
}

function MissingBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
      <AlertTriangle className="h-2.5 w-2.5" /> Sin definir
    </span>
  )
}

function PlantillaCard({ conjuntoId }: { conjuntoId: string }) {
  const [tmpl, setTmpl] = useState<{
    id: string; codigo: string; nombre: string; estado: string;
    active_version?: { version_number: number; published_at: string } | null;
    items_count?: number;
  } | null>(null)
  const [loadingTmpl, setLoadingTmpl] = useState(true)

  useEffect(() => {
    fetch(`/api/ema/conjuntos/${conjuntoId}/templates`)
      .then(r => r.json())
      .then(j => { setTmpl(j.data ?? null); setLoadingTmpl(false) })
      .catch(() => setLoadingTmpl(false))
  }, [conjuntoId])

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50/60">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5 text-stone-500" />
          <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
            Plantilla de verificación
          </span>
        </div>
        <Link
          href={`/quality/conjuntos/${conjuntoId}/plantilla`}
          className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium"
        >
          <ExternalLink className="h-3 w-3" />
          {tmpl ? 'Editar plantilla' : 'Crear plantilla'}
        </Link>
      </div>
      {loadingTmpl ? (
        <div className="px-4 py-4 text-xs text-stone-400">Cargando…</div>
      ) : !tmpl ? (
        <div className="px-4 py-4 text-sm text-stone-500 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          Sin plantilla de verificación. Cree una para habilitar la ejecución de verificaciones.
        </div>
      ) : (
        <div className="px-4 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-800 truncate">{tmpl.nombre}</p>
            <p className="text-xs text-stone-400 font-mono">{tmpl.codigo}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-stone-500 shrink-0">
            {tmpl.active_version ? (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 font-medium">
                v{tmpl.active_version.version_number} publicada
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 font-medium">
                Borrador
              </span>
            )}
            {tmpl.items_count != null && (
              <span>{tmpl.items_count} puntos de verificación</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ConjuntoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [conjunto, setConjunto] = useState<ConjuntoHerramientas | null>(null)
  const [instrumentos, setInstrumentos] = useState<InstrumentoCard[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    nombre_conjunto: '',
    categoria: '',
    tipo_defecto: '' as 'A' | 'B' | 'C',
    tipo_servicio: '' as 'calibracion' | 'verificacion' | 'ninguno',
    mes_inicio_servicio: '' as string | number,
    mes_fin_servicio: '' as string | number,
    cadencia_meses: 12 as number,
    norma_referencia: '',
    unidad_medicion: '',
    rango_medicion_tipico: '',
    descripcion: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cRes, iRes] = await Promise.all([
        fetch(`/api/ema/conjuntos/${id}`),
        fetch(`/api/ema/instrumentos?conjunto_id=${id}&limit=200`),
      ])
      if (!cRes.ok) throw new Error('Conjunto no encontrado')
      const cj: ConjuntoHerramientas = (await cRes.json()).data
      setConjunto(cj)
      setForm({
        nombre_conjunto: cj.nombre_conjunto ?? '',
        categoria: cj.categoria ?? '',
        tipo_defecto: cj.tipo_defecto ?? 'B',
        tipo_servicio: cj.tipo_servicio ?? 'ninguno',
        mes_inicio_servicio: cj.mes_inicio_servicio ?? '',
        mes_fin_servicio: cj.mes_fin_servicio ?? '',
        cadencia_meses: cj.cadencia_meses ?? 12,
        norma_referencia: cj.norma_referencia ?? '',
        unidad_medicion: cj.unidad_medicion ?? '',
        rango_medicion_tipico: cj.rango_medicion_tipico ?? '',
        descripcion: cj.descripcion ?? '',
      })
      if (iRes.ok) {
        const ij = await iRes.json()
        setInstrumentos(ij.data ?? ij ?? [])
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  function update<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const hasWindow = form.tipo_servicio !== 'ninguno'
      const body = {
        nombre_conjunto: form.nombre_conjunto.trim(),
        categoria: form.categoria.trim() || form.nombre_conjunto.trim(),
        tipo_defecto: form.tipo_defecto,
        tipo_servicio: form.tipo_servicio,
        mes_inicio_servicio: hasWindow && form.mes_inicio_servicio ? Number(form.mes_inicio_servicio) : null,
        mes_fin_servicio: hasWindow && form.mes_fin_servicio ? Number(form.mes_fin_servicio) : null,
        cadencia_meses: Number(form.cadencia_meses) || 12,
        norma_referencia: form.norma_referencia.trim() || null,
        unidad_medicion: form.unidad_medicion.trim() || null,
        rango_medicion_tipico: form.rango_medicion_tipico.trim() || null,
        descripcion: form.descripcion.trim() || null,
      }
      const res = await fetch(`/api/ema/conjuntos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Error al guardar')
      }
      const updated = (await res.json()).data
      setConjunto(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <EmaBreadcrumb items={[{ label: 'Conjuntos', href: '/quality/conjuntos' }, { label: '…' }]} />
        <div className="flex items-center justify-center py-16 text-stone-400 text-sm">Cargando…</div>
      </div>
    )
  }

  if (error || !conjunto) {
    return (
      <div className="flex flex-col gap-4">
        <EmaBreadcrumb items={[{ label: 'Conjuntos', href: '/quality/conjuntos' }, { label: 'Error' }]} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {error ?? 'Conjunto no encontrado'}
        </div>
      </div>
    )
  }

  const missingWindow = form.tipo_servicio !== 'ninguno' && (!form.mes_inicio_servicio || !form.mes_fin_servicio)
  const missingNorma = !form.norma_referencia
  const missingUnidad = !form.unidad_medicion && form.tipo_servicio !== 'ninguno'

  return (
    <div className="flex flex-col gap-4 pb-10">
      <EmaBreadcrumb
        items={[
          { label: 'Conjuntos', href: '/quality/conjuntos' },
          { label: conjunto.nombre_conjunto },
        ]}
      />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <Link
          href="/quality/conjuntos"
          className="mt-1 rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded">
              DC-{conjunto.codigo_conjunto}
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              {conjunto.nombre_conjunto}
            </h1>
            <EmaTipoBadge tipo={conjunto.tipo_defecto} showLabel />
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-stone-500">
            <span>{TIPO_SERVICIO_LABEL[conjunto.tipo_servicio] ?? conjunto.tipo_servicio}</span>
            {conjunto.mes_inicio_servicio && conjunto.mes_fin_servicio ? (
              <span className="font-mono">
                · {MESES.find(m => m.v === conjunto.mes_inicio_servicio)?.label} – {MESES.find(m => m.v === conjunto.mes_fin_servicio)?.label}
              </span>
            ) : form.tipo_servicio !== 'ninguno' ? (
              <MissingBadge />
            ) : null}
            <span>· {instrumentos.length} instrumento{instrumentos.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-1.5 shrink-0"
          asChild
        >
          <Link href={`/quality/instrumentos/nuevo?conjunto_id=${id}`}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo instrumento
          </Link>
        </Button>
      </div>

      {/* ── Missing params alert ───────────────────────────────── */}
      {(missingWindow || missingNorma || missingUnidad) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-medium">Parámetros faltantes</span> —{' '}
            {[
              missingWindow && 'ventana de servicio (mes inicio / mes fin)',
              missingNorma && 'norma de referencia',
              missingUnidad && 'unidad de medición',
            ].filter(Boolean).join(', ')}.
            Completa los campos a continuación.
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {/* ── Identidad ─────────────────────────────────────────── */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-stone-700">Identidad del conjunto</h2>

          {/* Read-only code */}
          <div className="flex items-center gap-3 rounded-md bg-stone-50 border border-stone-200 px-3 py-2">
            <span className="text-xs text-stone-500 shrink-0">Código</span>
            <span className="font-mono text-sm font-medium text-stone-800">DC-{conjunto.codigo_conjunto}</span>
            <span className="ml-auto text-xs text-stone-400 italic">No editable</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre del conjunto">
              <Input
                value={form.nombre_conjunto}
                onChange={e => update('nombre_conjunto', e.target.value)}
                required
                placeholder="Ej. Molde cilíndrico"
              />
            </Field>
            <Field label="Tipo por defecto para nuevos instrumentos">
              <Select value={form.tipo_defecto} onValueChange={v => update('tipo_defecto', v as 'A' | 'B' | 'C')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A"><EmaTipoBadge tipo="A" /> <span className="ml-2 text-xs text-stone-500">Maestro</span></SelectItem>
                  <SelectItem value="B"><EmaTipoBadge tipo="B" /> <span className="ml-2 text-xs text-stone-500">Referencia</span></SelectItem>
                  <SelectItem value="C"><EmaTipoBadge tipo="C" /> <span className="ml-2 text-xs text-stone-500">Trabajo</span></SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        {/* ── Ventana de servicio ────────────────────────────────── */}
        <div className={cn(
          'rounded-lg border bg-white p-4 md:p-5 flex flex-col gap-4',
          missingWindow ? 'border-amber-300' : 'border-stone-200',
        )}>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-stone-700">Ventana de servicio</h2>
            {missingWindow && <MissingBadge />}
          </div>

          <Field label="Tipo de servicio">
            <Select value={form.tipo_servicio} onValueChange={v => update('tipo_servicio', v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calibracion">Calibración externa</SelectItem>
                <SelectItem value="verificacion">Verificación interna</SelectItem>
                <SelectItem value="ninguno">Sin servicio programado</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {form.tipo_servicio !== 'ninguno' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Mes inicio">
                <Select
                  value={String(form.mes_inicio_servicio || '')}
                  onValueChange={v => update('mes_inicio_servicio', v)}
                >
                  <SelectTrigger className={!form.mes_inicio_servicio ? 'border-amber-300' : ''}>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map(m => <SelectItem key={m.v} value={String(m.v)}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Mes fin">
                <Select
                  value={String(form.mes_fin_servicio || '')}
                  onValueChange={v => update('mes_fin_servicio', v)}
                >
                  <SelectTrigger className={!form.mes_fin_servicio ? 'border-amber-300' : ''}>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map(m => <SelectItem key={m.v} value={String(m.v)}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cadencia (meses)" hint="Default: 12 meses">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={form.cadencia_meses}
                  onChange={e => update('cadencia_meses', Number(e.target.value))}
                />
              </Field>
            </div>
          )}
        </div>

        {/* ── Parámetros metrológicos ───────────────────────────── */}
        <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-stone-700">Parámetros metrológicos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Norma de referencia" hint="Ej. NMX-C-083-ONNCCE-2014">
              <Input
                value={form.norma_referencia}
                onChange={e => update('norma_referencia', e.target.value)}
                placeholder="NMX-C-…"
                className={missingNorma ? 'border-amber-300' : ''}
              />
            </Field>
            <Field label="Unidad de medición" hint="Ej. kN, °C, kg, mm">
              <Input
                value={form.unidad_medicion}
                onChange={e => update('unidad_medicion', e.target.value)}
                placeholder="kN"
                className={missingUnidad ? 'border-amber-300' : ''}
              />
            </Field>
            <Field label="Rango de medición típico" hint="Ej. 0–2000 kN">
              <Input
                value={form.rango_medicion_tipico}
                onChange={e => update('rango_medicion_tipico', e.target.value)}
                placeholder="0–2000 kN"
              />
            </Field>
          </div>
          <Field label="Descripción / alcance de verificación">
            <Textarea
              value={form.descripcion}
              onChange={e => update('descripcion', e.target.value)}
              rows={2}
              placeholder="Describe el uso del conjunto y los ensayos que aplican…"
            />
          </Field>
        </div>

        {/* Save */}
        {saveError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {saveError}
          </div>
        )}
        <div className="flex items-center gap-3 justify-end">
          {saved && (
            <span className="text-xs text-emerald-600 font-medium">✓ Cambios guardados</span>
          )}
          <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar cambios
          </Button>
        </div>
      </form>

      {/* ── Plantilla de verificación ─────────────────────────── */}
      {conjunto.tipo_servicio === 'verificacion' && (
        <PlantillaCard conjuntoId={id} />
      )}

      {/* ── Instrumentos en este conjunto ─────────────────────── */}
      <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50/60">
          <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
            Instrumentos — DC-{conjunto.codigo_conjunto}-NN
          </span>
          <span className="text-xs text-stone-400">{instrumentos.length} registros</span>
        </div>
        {instrumentos.length === 0 ? (
          <div className="py-10 text-center text-sm text-stone-400">
            Sin instrumentos registrados en este conjunto.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {instrumentos.map(inst => (
              <Link
                key={inst.id}
                href={`/quality/instrumentos/${inst.id}`}
                className="group flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 transition-colors"
              >
                <span className="font-mono text-xs text-stone-500 w-20 shrink-0">{inst.codigo}</span>
                <span className="flex-1 text-sm text-stone-800 truncate">{inst.nombre}</span>
                <EmaTipoBadge tipo={inst.tipo} />
                <EmaEstadoBadge estado={inst.estado} />
                <ChevronRight className="h-3.5 w-3.5 text-stone-300 group-hover:text-stone-500 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
