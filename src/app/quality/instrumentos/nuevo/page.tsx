'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Award,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  Plus,
  Save,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { usePlantContext } from '@/contexts/PlantContext'
import { cn } from '@/lib/utils'
import type { ConjuntoHerramientas, InstrumentoCard } from '@/types/ema'

type Step = 1 | 2 | 3

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const

const mesAbbr = (m: number | null | undefined) => {
  if (!m) return '—'
  return MESES[m - 1]?.slice(0, 3) ?? '—'
}

const TIPO_EXPLAIN = {
  A: {
    icon: Award,
    color: 'sky',
    title: 'Instrumento Maestro (Tipo A)',
    subtitle: 'Calibrado por laboratorio EMA, verifica instrumentos Tipo C',
    next: 'Después de crearlo, registre su primer certificado de calibración externa para activarlo.',
    borderColor: 'border-sky-300 ring-sky-200',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-800',
  },
  B: {
    icon: Award,
    color: 'violet',
    title: 'Instrumento Externo (Tipo B)',
    subtitle: 'Calibrado por laboratorio EMA, uso independiente',
    next: 'Después de crearlo, registre su primer certificado de calibración externa para activarlo.',
    borderColor: 'border-violet-300 ring-violet-200',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-800',
  },
  C: {
    icon: Shield,
    color: 'amber',
    title: 'Instrumento de Trabajo (Tipo C)',
    subtitle: 'Verificado internamente con instrumento maestro Tipo A',
    next: 'Después de crearlo, registre su primera verificación interna para activarlo.',
    borderColor: 'border-amber-300 ring-amber-200',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-800',
  },
} as const

const TIPO_SERVICIO_LABEL = {
  calibracion: 'Calibración externa',
  verificacion: 'Verificación interna',
  ninguno: 'Sin servicio programado',
} as const

export default function NuevoInstrumentoPage() {
  const router = useRouter()
  const { currentPlant, availablePlants } = usePlantContext()

  const [step, setStep] = useState<Step>(1)
  const [conjuntos, setConjuntos] = useState<ConjuntoHerramientas[]>([])
  const [loadingConjuntos, setLoadingConjuntos] = useState(true)
  const [instrumentosTypeA, setInstrumentosTypeA] = useState<InstrumentoCard[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchConjunto, setSearchConjunto] = useState('')

  // Step 1: select conjunto
  const [selectedConjuntoId, setSelectedConjuntoId] = useState<string>('')

  // Window override toggle
  const [overrideWindow, setOverrideWindow] = useState(false)

  // Step 2-3: instrument details
  const [form, setForm] = useState({
    nombre: '',
    tipo: '' as '' | 'A' | 'B' | 'C',
    plant_id: currentPlant?.id ?? '',
    numero_serie: '',
    marca: '',
    modelo_comercial: '',
    instrumento_maestro_ids: [] as string[],
    mes_inicio_servicio_override: '' as string,
    mes_fin_servicio_override: '' as string,
    ubicacion_dentro_planta: '',
    fecha_alta: '',
    notas: '',
  })

  useEffect(() => {
    fetch('/api/ema/conjuntos')
      .then(r => r.json())
      .then(j => setConjuntos(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingConjuntos(false))
  }, [])

  useEffect(() => {
    if (form.tipo === 'C') {
      fetch('/api/ema/instrumentos?tipo=A&limit=200')
        .then(r => r.json())
        .then(j => setInstrumentosTypeA(j.data ?? []))
    }
  }, [form.tipo])

  const selectedConjunto = conjuntos.find(c => c.id === selectedConjuntoId)

  const filteredConjuntos = useMemo(() =>
    conjuntos.filter(c =>
      !searchConjunto ||
      c.nombre_conjunto.toLowerCase().includes(searchConjunto.toLowerCase()) ||
      c.categoria.toLowerCase().includes(searchConjunto.toLowerCase()) ||
      c.codigo_conjunto.includes(searchConjunto)
    ), [conjuntos, searchConjunto])

  const groupedConjuntos = useMemo(() => {
    const map = new Map<string, ConjuntoHerramientas[]>()
    for (const c of filteredConjuntos) {
      if (!map.has(c.categoria)) map.set(c.categoria, [])
      map.get(c.categoria)!.push(c)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredConjuntos])

  const nextCodePreview = useMemo(() => {
    if (!selectedConjunto) return null
    const nn = String((selectedConjunto.secuencia_actual ?? 0) + 1).padStart(2, '0')
    return `DC-${selectedConjunto.codigo_conjunto}-${nn}`
  }, [selectedConjunto])

  const effectiveWindow = useMemo(() => {
    if (!selectedConjunto) return null
    const ini = overrideWindow && form.mes_inicio_servicio_override
      ? parseInt(form.mes_inicio_servicio_override)
      : selectedConjunto.mes_inicio_servicio
    const fin = overrideWindow && form.mes_fin_servicio_override
      ? parseInt(form.mes_fin_servicio_override)
      : selectedConjunto.mes_fin_servicio
    return { ini, fin, tipo: selectedConjunto.tipo_servicio }
  }, [selectedConjunto, overrideWindow, form.mes_inicio_servicio_override, form.mes_fin_servicio_override])

  const handleStep1Next = () => {
    if (!selectedConjuntoId || !selectedConjunto) return
    setForm(f => ({
      ...f,
      tipo: (selectedConjunto.tipo_defecto as 'A' | 'B' | 'C') || f.tipo,
      mes_inicio_servicio_override: '',
      mes_fin_servicio_override: '',
      instrumento_maestro_ids: [],
    }))
    setOverrideWindow(false)
    setStep(2)
  }

  const handleStep2Next = () => {
    if (!form.nombre || !form.tipo || !form.plant_id) return
    if (form.tipo === 'C' && form.instrumento_maestro_ids.length === 0) return
    if (overrideWindow) {
      const hasIni = !!form.mes_inicio_servicio_override
      const hasFin = !!form.mes_fin_servicio_override
      if (hasIni !== hasFin) return
    }
    setStep(3)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, any> = {
        conjunto_id: selectedConjuntoId,
        nombre: form.nombre,
        tipo: form.tipo,
        plant_id: form.plant_id || currentPlant?.id,
        numero_serie: form.numero_serie || undefined,
        marca: form.marca || undefined,
        modelo_comercial: form.modelo_comercial || undefined,
        ...(form.tipo === 'C' && form.instrumento_maestro_ids.length > 0
          ? { instrumento_maestro_ids: form.instrumento_maestro_ids }
          : {}),
        ubicacion_dentro_planta: form.ubicacion_dentro_planta || undefined,
        fecha_alta: form.fecha_alta || undefined,
        notas: form.notas || undefined,
      }
      if (overrideWindow) {
        if (form.mes_inicio_servicio_override)
          body.mes_inicio_servicio_override = parseInt(form.mes_inicio_servicio_override)
        if (form.mes_fin_servicio_override)
          body.mes_fin_servicio_override = parseInt(form.mes_fin_servicio_override)
      }
      const res = await fetch('/api/ema/instrumentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Error creando instrumento')
      }
      const json = await res.json()
      router.push(`/quality/instrumentos/${json.data.id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const toggleMaestroPatron = (mid: string, on: boolean) => {
    setForm((f) => {
      const s = new Set(f.instrumento_maestro_ids)
      if (on) s.add(mid)
      else s.delete(mid)
      return { ...f, instrumento_maestro_ids: Array.from(s) }
    })
  }

  const tipoInfo = form.tipo ? TIPO_EXPLAIN[form.tipo] : null

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <EmaBreadcrumb items={[
        { label: 'Catálogo', href: '/quality/instrumentos/catalogo' },
        { label: 'Nuevo instrumento' },
      ]} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => step === 1 ? router.back() : setStep((step - 1) as Step)}
          className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">
            Nuevo instrumento
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Paso {step} de 3
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs">
        {[
          { n: 1, label: 'Conjunto' },
          { n: 2, label: 'Datos e identidad' },
          { n: 3, label: 'Confirmación' },
        ].map((s, i) => (
          <React.Fragment key={s.n}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-stone-300" />}
            <span className={cn(
              'px-2.5 py-1 rounded-full font-medium',
              step === s.n
                ? 'bg-stone-900 text-white'
                : step > s.n
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-stone-100 text-stone-400',
            )}>
              {step > s.n ? '✓' : s.n}. {s.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ═══ STEP 1: Select Conjunto ═══ */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Seleccionar conjunto de herramientas</h2>
                <p className="text-[11px] text-stone-400 mt-0.5">El conjunto define la categoría, ventana de servicio y patrón de código.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-stone-300 text-stone-700 gap-1.5 text-xs"
                onClick={() => router.push('/quality/conjuntos/nuevo')}
              >
                <Plus className="h-3 w-3" />
                Crear conjunto
              </Button>
            </div>

            <Input
              placeholder="Buscar por código, nombre o categoría..."
              value={searchConjunto}
              onChange={e => setSearchConjunto(e.target.value)}
              className="border-stone-200 bg-stone-50 text-sm"
            />

            {loadingConjuntos ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
              </div>
            ) : filteredConjuntos.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-sm">
                {conjuntos.length === 0 ? (
                  <>
                    No hay conjuntos registrados.{' '}
                    <Link href="/quality/conjuntos/nuevo" className="text-stone-600 underline">
                      Cree el primero →
                    </Link>
                  </>
                ) : (
                  'Sin resultados para la búsqueda.'
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {groupedConjuntos.map(([cat, items]) => (
                  <div key={cat}>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5 px-1">
                      {cat}
                    </div>
                    <div className="space-y-1">
                      {items.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedConjuntoId(c.id)}
                          className={cn(
                            'w-full rounded-lg border p-3 text-left transition-all',
                            selectedConjuntoId === c.id
                              ? 'border-stone-400 bg-stone-50 ring-1 ring-stone-300'
                              : 'border-stone-200 hover:border-stone-300',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[11px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                                  DC-{c.codigo_conjunto}
                                </span>
                                <span className="text-sm font-medium text-stone-900">{c.nombre_conjunto}</span>
                                <EmaTipoBadge tipo={c.tipo_defecto} />
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                                <span>{TIPO_SERVICIO_LABEL[c.tipo_servicio]}</span>
                                {c.tipo_servicio !== 'ninguno' && c.mes_inicio_servicio && c.mes_fin_servicio && (
                                  <span className="font-mono">
                                    · {mesAbbr(c.mes_inicio_servicio)}–{mesAbbr(c.mes_fin_servicio)}
                                  </span>
                                )}
                                {c.unidad_medicion && <span>· {c.unidad_medicion}</span>}
                              </div>
                            </div>
                            {selectedConjuntoId === c.id && (
                              <CheckCircle2 className="h-4 w-4 text-stone-600 shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              disabled={!selectedConjuntoId}
              onClick={handleStep1Next}
              className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: Instrument Data ═══ */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Conjunto context + next code preview */}
          {selectedConjunto && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] text-stone-500 bg-white px-1.5 py-0.5 rounded border border-stone-200">
                    DC-{selectedConjunto.codigo_conjunto}
                  </span>
                  <span className="font-medium text-stone-800 text-sm">{selectedConjunto.nombre_conjunto}</span>
                  <EmaTipoBadge tipo={selectedConjunto.tipo_defecto} showLabel />
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-stone-500 hover:text-stone-700 underline shrink-0"
                >
                  Cambiar
                </button>
              </div>
              {nextCodePreview && (
                <div className="flex items-center gap-2 text-xs text-stone-600">
                  <span className="text-stone-400">Código asignado:</span>
                  <span className="font-mono font-semibold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                    {nextCodePreview}
                  </span>
                  <span className="text-[10px] text-stone-400">(generado al guardar)</span>
                </div>
              )}
            </div>
          )}

          {/* Type selector */}
          <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Tipo de instrumento</h2>
            <div className="grid grid-cols-3 gap-2">
              {(['A', 'B', 'C'] as const).map(tipo => {
                const info = TIPO_EXPLAIN[tipo]
                const isSelected = form.tipo === tipo
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        tipo,
                        instrumento_maestro_ids: tipo === 'C' ? f.instrumento_maestro_ids : [],
                      }))
                    }
                    className={cn(
                      'rounded-lg border p-3 text-left transition-all',
                      isSelected ? `${info.borderColor} ring-1` : 'border-stone-200 hover:border-stone-300',
                    )}
                  >
                    <p className="text-sm font-medium text-stone-900">Tipo {tipo}</p>
                    <p className="text-[10px] text-stone-500 mt-0.5 leading-tight">
                      {tipo === 'A' ? 'Maestro' : tipo === 'B' ? 'Externo' : 'Trabajo'}
                    </p>
                  </button>
                )
              })}
            </div>
            {tipoInfo && (
              <div className={cn('rounded-md border px-3 py-2 text-xs', tipoInfo.bgColor, tipoInfo.textColor, 'border-transparent')}>
                <p className="font-medium">{tipoInfo.title}</p>
                <p className="mt-0.5 opacity-80">{tipoInfo.subtitle}</p>
              </div>
            )}
          </div>

          {/* Identity */}
          <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Identificación</h2>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Nombre descriptivo <span className="text-red-500">*</span></Label>
              <Input
                required
                value={form.nombre}
                onChange={e => update('nombre', e.target.value)}
                placeholder="ej. Molde cilíndrico 01"
                className="border-stone-200"
              />
              <p className="text-[11px] text-stone-400">
                El código <span className="font-mono">{nextCodePreview ?? 'DC-CC-NN'}</span> se asigna automáticamente.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Planta actual <span className="text-red-500">*</span></Label>
                <Select value={form.plant_id} onValueChange={v => update('plant_id', v)} required>
                  <SelectTrigger className="border-stone-200">
                    <SelectValue placeholder="Seleccionar planta" />
                  </SelectTrigger>
                  <SelectContent>
                    {(availablePlants ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Fecha de alta</Label>
                <Input
                  type="date"
                  value={form.fecha_alta}
                  onChange={e => update('fecha_alta', e.target.value)}
                  className="border-stone-200"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Ubicación dentro de planta</Label>
              <Input
                value={form.ubicacion_dentro_planta}
                onChange={e => update('ubicacion_dentro_planta', e.target.value)}
                placeholder="ej. Laboratorio, estantería B2"
                className="border-stone-200"
              />
            </div>
          </div>

          {/* Physical details */}
          <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Datos del equipo</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Marca</Label>
                <Input
                  value={form.marca}
                  onChange={e => update('marca', e.target.value)}
                  placeholder="ej. Controls, Humboldt"
                  className="border-stone-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Modelo comercial</Label>
                <Input
                  value={form.modelo_comercial}
                  onChange={e => update('modelo_comercial', e.target.value)}
                  placeholder="ej. Automax 5"
                  className="border-stone-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">No. de serie</Label>
                <Input
                  value={form.numero_serie}
                  onChange={e => update('numero_serie', e.target.value)}
                  placeholder="ej. SN-2024-1234"
                  className="border-stone-200 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Type C: pattern instruments (Tipo A) */}
          {form.tipo === 'C' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">Instrumentos patrón</h2>
              </div>
              <p className="text-xs text-amber-700 -mt-2">
                Seleccione uno o más instrumentos Tipo A que servirán de referencia para la verificación interna de este
                instrumento de trabajo.
              </p>
              <div className="space-y-2 max-h-[240px] overflow-y-auto border border-amber-200 rounded-md bg-white p-3">
                <Label className="text-xs text-amber-800">
                  Instrumentos patrón (Tipo A) <span className="text-red-500">*</span>
                </Label>
                {instrumentosTypeA.filter((m) => m.estado === 'vigente').map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.instrumento_maestro_ids.includes(m.id)}
                      onCheckedChange={(c) => toggleMaestroPatron(m.id, c === true)}
                    />
                    <span className="font-mono text-xs text-stone-500">{m.codigo}</span>
                    <span>— {m.nombre}</span>
                    {m.marca && <span className="text-stone-400"> · {m.marca}</span>}
                  </label>
                ))}
                {instrumentosTypeA.some((m) => m.estado !== 'vigente') && (
                  <p className="text-[10px] font-semibold uppercase text-stone-400 pt-2">No vigentes (deshabilitados)</p>
                )}
                {instrumentosTypeA
                  .filter((m) => m.estado !== 'vigente')
                  .map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm text-stone-400 cursor-not-allowed">
                      <Checkbox disabled checked={false} />
                      <span className="font-mono text-xs">{m.codigo}</span>
                      <span>
                        — {m.nombre} ({m.estado})
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          )}

          {/* Service window (conjunto default + optional override) */}
          <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-stone-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Ventana de servicio</h2>
              </div>
            </div>

            {selectedConjunto && (
              <div className="rounded-md bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-600 flex items-center gap-2 flex-wrap">
                <span className="text-stone-400">Heredado del conjunto:</span>
                <span className="font-medium text-stone-800">
                  {TIPO_SERVICIO_LABEL[selectedConjunto.tipo_servicio]}
                </span>
                {selectedConjunto.tipo_servicio !== 'ninguno' && selectedConjunto.mes_inicio_servicio && selectedConjunto.mes_fin_servicio && (
                  <span className="font-mono">
                    · {mesAbbr(selectedConjunto.mes_inicio_servicio)}–{mesAbbr(selectedConjunto.mes_fin_servicio)}
                  </span>
                )}
                {selectedConjunto.cadencia_meses !== 12 && (
                  <span>· cada {selectedConjunto.cadencia_meses} meses</span>
                )}
              </div>
            )}

            {selectedConjunto?.tipo_servicio !== 'ninguno' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setOverrideWindow(v => !v)
                    if (overrideWindow) {
                      setForm(f => ({ ...f, mes_inicio_servicio_override: '', mes_fin_servicio_override: '' }))
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 transition-colors"
                >
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', overrideWindow && 'rotate-180')} />
                  Sobrescribir ventana para este instrumento
                </button>

                {overrideWindow && (
                  <div className="grid grid-cols-2 gap-4 pl-5 border-l-2 border-stone-200">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-stone-600">Mes inicio</Label>
                      <Select
                        value={form.mes_inicio_servicio_override}
                        onValueChange={v => update('mes_inicio_servicio_override', v)}
                      >
                        <SelectTrigger className="border-stone-200">
                          <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent>
                          {MESES.map((m, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-stone-600">Mes fin</Label>
                      <Select
                        value={form.mes_fin_servicio_override}
                        onValueChange={v => update('mes_fin_servicio_override', v)}
                      >
                        <SelectTrigger className="border-stone-200">
                          <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent>
                          {MESES.map((m, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="col-span-2 text-[11px] text-stone-400">
                      Debe definir ambos meses o dejar ambos vacíos para usar la ventana heredada.
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs text-stone-600">Notas</Label>
              <Textarea
                rows={2}
                value={form.notas}
                onChange={e => update('notas', e.target.value)}
                placeholder="Condiciones especiales, historial previo..."
                className="border-stone-200 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              ← Anterior
            </button>
            <Button
              onClick={handleStep2Next}
              disabled={
                !form.nombre ||
                !form.tipo ||
                !form.plant_id ||
                (form.tipo === 'C' && form.instrumento_maestro_ids.length === 0) ||
                (overrideWindow && (!!form.mes_inicio_servicio_override !== !!form.mes_fin_servicio_override))
              }
              className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Confirmation ═══ */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Resumen</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <span className="text-[11px] text-stone-400 uppercase">Conjunto</span>
                <p className="text-stone-900 font-medium">
                  <span className="font-mono text-xs text-stone-500">DC-{selectedConjunto?.codigo_conjunto}</span>{' '}
                  {selectedConjunto?.nombre_conjunto}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-stone-400 uppercase">Tipo</span>
                <div className="mt-0.5"><EmaTipoBadge tipo={form.tipo as any} showLabel /></div>
              </div>
              <div>
                <span className="text-[11px] text-stone-400 uppercase">Código (auto)</span>
                <p className="text-stone-900 font-mono">{nextCodePreview ?? '—'}</p>
              </div>
              <div>
                <span className="text-[11px] text-stone-400 uppercase">Nombre</span>
                <p className="text-stone-900">{form.nombre}</p>
              </div>
              {(form.marca || form.modelo_comercial) && (
                <div>
                  <span className="text-[11px] text-stone-400 uppercase">Marca / Modelo</span>
                  <p className="text-stone-900">{form.marca} {form.modelo_comercial}</p>
                </div>
              )}
              {form.numero_serie && (
                <div>
                  <span className="text-[11px] text-stone-400 uppercase">No. Serie</span>
                  <p className="text-stone-900 font-mono">{form.numero_serie}</p>
                </div>
              )}
              {effectiveWindow && (
                <div className="col-span-2">
                  <span className="text-[11px] text-stone-400 uppercase">Ventana de servicio</span>
                  <p className="text-stone-900 flex items-center gap-2 flex-wrap">
                    <span>{TIPO_SERVICIO_LABEL[effectiveWindow.tipo]}</span>
                    {effectiveWindow.tipo !== 'ninguno' && effectiveWindow.ini && effectiveWindow.fin && (
                      <span className="font-mono text-xs">
                        · {mesAbbr(effectiveWindow.ini)}–{mesAbbr(effectiveWindow.fin)}
                      </span>
                    )}
                    {overrideWindow && form.mes_inicio_servicio_override && (
                      <span className="text-[10px] uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Override</span>
                    )}
                  </p>
                </div>
              )}
              {form.tipo === 'C' && form.instrumento_maestro_ids.length > 0 && (
                <div className="col-span-2">
                  <span className="text-[11px] text-stone-400 uppercase">Patrones (Tipo A)</span>
                  <p className="text-stone-900 text-sm">
                    {form.instrumento_maestro_ids
                      .map((mid) => instrumentosTypeA.find((i) => i.id === mid)?.codigo ?? mid)
                      .join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {tipoInfo && (
            <div className={cn('rounded-lg border px-4 py-3 flex items-start gap-3', tipoInfo.bgColor, 'border-transparent')}>
              <Info className={cn('h-4 w-4 mt-0.5 shrink-0', tipoInfo.textColor)} />
              <div className={cn('text-xs', tipoInfo.textColor)}>
                <p className="font-medium">Siguiente paso</p>
                <p className="mt-0.5 opacity-80">{tipoInfo.next}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              ← Anterior
            </button>
            <Button
              type="submit"
              className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5"
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</>
              ) : (
                <><Save className="h-4 w-4" /> Crear instrumento</>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
