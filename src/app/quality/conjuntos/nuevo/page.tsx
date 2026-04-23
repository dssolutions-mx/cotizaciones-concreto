'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

type TipoServicio = 'calibracion' | 'verificacion' | 'ninguno'

export default function NuevoConjuntoPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    codigo_conjunto: '',
    nombre_conjunto: '',
    categoria: '',
    tipo_defecto: 'C' as 'A' | 'B' | 'C',
    tipo_servicio: 'verificacion' as TipoServicio,
    mes_inicio_servicio: '' as string,
    mes_fin_servicio: '' as string,
    cadencia_meses: '12',
    unidad_medicion: '',
    norma_referencia: '',
    rango_medicion_tipico: '',
    descripcion: '',
  })

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const codigoValido = /^[0-9]{2,3}$/.test(form.codigo_conjunto)
  const ventanaValida = form.tipo_servicio === 'ninguno' ||
    (!!form.mes_inicio_servicio && !!form.mes_fin_servicio)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codigoValido || !form.nombre_conjunto || !form.categoria || !ventanaValida) return
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, any> = {
        codigo_conjunto: form.codigo_conjunto,
        nombre_conjunto: form.nombre_conjunto,
        categoria: form.categoria,
        tipo_defecto: form.tipo_defecto,
        tipo_servicio: form.tipo_servicio,
        cadencia_meses: parseInt(form.cadencia_meses) || 12,
        unidad_medicion: form.unidad_medicion || null,
        norma_referencia: form.norma_referencia || null,
        rango_medicion_tipico: form.rango_medicion_tipico || null,
        descripcion: form.descripcion || null,
      }
      if (form.tipo_servicio !== 'ninguno') {
        body.mes_inicio_servicio = parseInt(form.mes_inicio_servicio)
        body.mes_fin_servicio = parseInt(form.mes_fin_servicio)
      }
      const res = await fetch('/api/ema/conjuntos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Error creando conjunto')
      }
      router.push('/quality/conjuntos')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <EmaBreadcrumb items={[
        { label: 'Conjuntos', href: '/quality/conjuntos' },
        { label: 'Nuevo conjunto' },
      ]} />

      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">Nuevo conjunto de herramientas</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            El código <span className="font-mono">DC-{form.codigo_conjunto || 'CC'}-NN</span> se asignará a sus instrumentos.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Identificación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Código (NN) <span className="text-red-500">*</span></Label>
              <Input
                required
                value={form.codigo_conjunto}
                onChange={e => update('codigo_conjunto', e.target.value.replace(/\D/g,'').slice(0,3))}
                placeholder="07"
                className="border-stone-200 font-mono"
              />
              <p className="text-[11px] text-stone-400">2 ó 3 dígitos. Único.</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-stone-600">Nombre <span className="text-red-500">*</span></Label>
              <Input
                required
                value={form.nombre_conjunto}
                onChange={e => update('nombre_conjunto', e.target.value)}
                placeholder="ej. Molde cilíndrico"
                className="border-stone-200"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Categoría <span className="text-red-500">*</span></Label>
              <Input
                required
                value={form.categoria}
                onChange={e => update('categoria', e.target.value)}
                placeholder="ej. Moldes y accesorios"
                className="border-stone-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Tipo por defecto</Label>
              <Select value={form.tipo_defecto} onValueChange={v => update('tipo_defecto', v)}>
                <SelectTrigger className="border-stone-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A — Maestro</SelectItem>
                  <SelectItem value="B">B — Externo</SelectItem>
                  <SelectItem value="C">C — Trabajo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Servicio metrológico</h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-stone-600">Tipo de servicio</Label>
            <Select value={form.tipo_servicio} onValueChange={v => update('tipo_servicio', v)}>
              <SelectTrigger className="border-stone-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="calibracion">Calibración externa (EMA)</SelectItem>
                <SelectItem value="verificacion">Verificación interna</SelectItem>
                <SelectItem value="ninguno">Sin servicio programado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.tipo_servicio !== 'ninguno' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Mes inicio <span className="text-red-500">*</span></Label>
                <Select value={form.mes_inicio_servicio} onValueChange={v => update('mes_inicio_servicio', v)}>
                  <SelectTrigger className="border-stone-200"><SelectValue placeholder="Mes" /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Mes fin <span className="text-red-500">*</span></Label>
                <Select value={form.mes_fin_servicio} onValueChange={v => update('mes_fin_servicio', v)}>
                  <SelectTrigger className="border-stone-200"><SelectValue placeholder="Mes" /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Cadencia (meses)</Label>
                <Input
                  type="number" min="1" max="60"
                  value={form.cadencia_meses}
                  onChange={e => update('cadencia_meses', e.target.value)}
                  className="border-stone-200 font-mono"
                />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Técnico (opcional)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Unidad medición</Label>
              <Input value={form.unidad_medicion} onChange={e => update('unidad_medicion', e.target.value)} placeholder="kN, °C, kg…" className="border-stone-200 font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Rango típico</Label>
              <Input value={form.rango_medicion_tipico} onChange={e => update('rango_medicion_tipico', e.target.value)} placeholder="0–1500 kN" className="border-stone-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Norma referencia</Label>
              <Input value={form.norma_referencia} onChange={e => update('norma_referencia', e.target.value)} placeholder="NMX-C-083" className="border-stone-200" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-stone-600">Descripción</Label>
            <Textarea rows={2} value={form.descripcion} onChange={e => update('descripcion', e.target.value)} className="border-stone-200 resize-none" />
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <Button
            type="submit"
            disabled={submitting || !codigoValido || !form.nombre_conjunto || !form.categoria || !ventanaValida}
            className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5"
          >
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</> : <><Save className="h-4 w-4" /> Crear conjunto</>}
          </Button>
        </div>
      </form>
    </div>
  )
}
