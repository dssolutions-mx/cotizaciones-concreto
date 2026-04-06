'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
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
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { usePlantContext } from '@/contexts/PlantContext'
import { cn } from '@/lib/utils'
import type { ModeloInstrumento, InstrumentoCard } from '@/types/ema'

type Step = 1 | 2 | 3

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

export default function NuevoInstrumentoPage() {
  const router = useRouter()
  const { currentPlant, availablePlants } = usePlantContext()

  const [step, setStep] = useState<Step>(1)
  const [modelos, setModelos] = useState<ModeloInstrumento[]>([])
  const [loadingModelos, setLoadingModelos] = useState(true)
  const [instrumentosTypeA, setInstrumentosTypeA] = useState<InstrumentoCard[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchModelo, setSearchModelo] = useState('')

  // Step 1: select model
  const [selectedModeloId, setSelectedModeloId] = useState<string>('')

  // Step 2-3: instrument details
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    tipo: '' as '' | 'A' | 'B' | 'C',
    plant_id: currentPlant?.id ?? '',
    numero_serie: '',
    marca: '',
    modelo_comercial: '',
    instrumento_maestro_id: '',
    periodo_calibracion_dias: '',
    notas: '',
  })

  useEffect(() => {
    fetch('/api/ema/modelos')
      .then(r => r.json())
      .then(j => setModelos(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingModelos(false))
  }, [])

  useEffect(() => {
    if (form.tipo === 'C') {
      fetch('/api/ema/instrumentos?tipo=A&limit=200')
        .then(r => r.json())
        .then(j => setInstrumentosTypeA(j.data ?? []))
    }
  }, [form.tipo])

  const selectedModelo = modelos.find(m => m.id === selectedModeloId)

  const filteredModelos = useMemo(() =>
    modelos.filter(m =>
      !searchModelo ||
      m.nombre_modelo.toLowerCase().includes(searchModelo.toLowerCase()) ||
      m.categoria.toLowerCase().includes(searchModelo.toLowerCase())
    ), [modelos, searchModelo])

  // Group modelos by categoria
  const groupedModelos = useMemo(() => {
    const map = new Map<string, ModeloInstrumento[]>()
    for (const m of filteredModelos) {
      if (!map.has(m.categoria)) map.set(m.categoria, [])
      map.get(m.categoria)!.push(m)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredModelos])

  const handleStep1Next = () => {
    if (!selectedModeloId || !selectedModelo) return
    setForm(f => ({
      ...f,
      tipo: (selectedModelo.tipo_defecto as 'A' | 'B' | 'C') || f.tipo,
      periodo_calibracion_dias: '',
    }))
    setStep(2)
  }

  const handleStep2Next = () => {
    if (!form.codigo || !form.nombre || !form.tipo) return
    if (form.tipo === 'C' && !form.instrumento_maestro_id) return
    setStep(3)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const body = {
        modelo_id: selectedModeloId,
        codigo: form.codigo,
        nombre: form.nombre,
        tipo: form.tipo,
        plant_id: form.plant_id || currentPlant?.id,
        numero_serie: form.numero_serie || undefined,
        marca: form.marca || undefined,
        modelo_comercial: form.modelo_comercial || undefined,
        instrumento_maestro_id: form.instrumento_maestro_id || undefined,
        periodo_calibracion_dias: form.periodo_calibracion_dias ? parseInt(form.periodo_calibracion_dias) : undefined,
        notas: form.notas || undefined,
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
          { n: 1, label: 'Modelo' },
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

      {/* ═══ STEP 1: Select Model ═══ */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Seleccionar modelo</h2>
              <Button
                variant="outline"
                size="sm"
                className="border-stone-300 text-stone-700 gap-1.5 text-xs"
                onClick={() => router.push('/quality/modelos/nuevo')}
              >
                <Plus className="h-3 w-3" />
                Crear modelo
              </Button>
            </div>

            <Input
              placeholder="Buscar por nombre o categoría..."
              value={searchModelo}
              onChange={e => setSearchModelo(e.target.value)}
              className="border-stone-200 bg-stone-50 text-sm"
            />

            {loadingModelos ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
              </div>
            ) : filteredModelos.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-sm">
                {modelos.length === 0 ? (
                  <>
                    No hay modelos registrados.{' '}
                    <Link href="/quality/modelos/nuevo" className="text-stone-600 underline">
                      Cree el primero →
                    </Link>
                  </>
                ) : (
                  'Sin resultados para la búsqueda.'
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {groupedModelos.map(([cat, items]) => (
                  <div key={cat}>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5 px-1">
                      {cat}
                    </div>
                    <div className="space-y-1">
                      {items.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedModeloId(m.id)}
                          className={cn(
                            'w-full rounded-lg border p-3 text-left transition-all',
                            selectedModeloId === m.id
                              ? 'border-stone-400 bg-stone-50 ring-1 ring-stone-300'
                              : 'border-stone-200 hover:border-stone-300',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-stone-900">{m.nombre_modelo}</span>
                                <EmaTipoBadge tipo={m.tipo_defecto} />
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                                <span className="font-mono">c/{m.periodo_calibracion_dias}d</span>
                                {m.unidad_medicion && <span>· {m.unidad_medicion}</span>}
                                {m.norma_referencia && <span>· {m.norma_referencia}</span>}
                              </div>
                            </div>
                            {selectedModeloId === m.id && (
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
              disabled={!selectedModeloId}
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
          {/* Model context */}
          {selectedModelo && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-stone-800">{selectedModelo.nombre_modelo}</span>
                <EmaTipoBadge tipo={selectedModelo.tipo_defecto} showLabel />
                {selectedModelo.unidad_medicion && (
                  <span className="text-xs text-stone-500 font-mono">{selectedModelo.unidad_medicion}</span>
                )}
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-xs text-stone-500 hover:text-stone-700 underline shrink-0"
              >
                Cambiar
              </button>
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
                    onClick={() => update('tipo', tipo)}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Código único <span className="text-red-500">*</span></Label>
                <Input
                  required
                  value={form.codigo}
                  onChange={e => update('codigo', e.target.value)}
                  placeholder="ej. INS-P001-001"
                  className="border-stone-200 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Planta <span className="text-red-500">*</span></Label>
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
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Nombre descriptivo <span className="text-red-500">*</span></Label>
              <Input
                required
                value={form.nombre}
                onChange={e => update('nombre', e.target.value)}
                placeholder="ej. Prensa de compresión hidráulica #1"
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

          {/* Type C: master instrument selector */}
          {form.tipo === 'C' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">Instrumento maestro</h2>
              </div>
              <p className="text-xs text-amber-700 -mt-2">
                El instrumento Tipo C se verifica comparando sus lecturas contra un instrumento maestro (Tipo A) calibrado.
                Seleccione cuál instrumento maestro será su referencia.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-800">Instrumento maestro (Tipo A) <span className="text-red-500">*</span></Label>
                <Select
                  required
                  value={form.instrumento_maestro_id}
                  onValueChange={v => update('instrumento_maestro_id', v)}
                >
                  <SelectTrigger className="border-amber-200 bg-white">
                    <SelectValue placeholder="Seleccionar instrumento maestro vigente" />
                  </SelectTrigger>
                  <SelectContent>
                    {instrumentosTypeA.filter(m => m.estado === 'vigente').map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-mono text-xs text-stone-500">{m.codigo}</span>
                        {' — '}{m.nombre}
                        {m.marca && <span className="text-stone-400"> · {m.marca}</span>}
                      </SelectItem>
                    ))}
                    {instrumentosTypeA.filter(m => m.estado !== 'vigente').length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase text-stone-400">No vigentes</div>
                        {instrumentosTypeA.filter(m => m.estado !== 'vigente').map(m => (
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
          )}

          {/* Period override */}
          <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Período</h2>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">
                Período de {form.tipo === 'C' ? 'verificación' : 'calibración'} (días)
              </Label>
              <Input
                type="number"
                min="1"
                value={form.periodo_calibracion_dias}
                onChange={e => update('periodo_calibracion_dias', e.target.value)}
                placeholder={`Heredar del modelo (${selectedModelo?.periodo_calibracion_dias ?? '—'} días)`}
                className="border-stone-200 font-mono"
              />
              <p className="text-[11px] text-stone-400">
                Deje vacío para usar el período del modelo ({selectedModelo?.periodo_calibracion_dias ?? '—'} días)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Notas</Label>
              <Textarea
                rows={2}
                value={form.notas}
                onChange={e => update('notas', e.target.value)}
                placeholder="Ubicación, condiciones especiales, historial previo..."
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
              disabled={!form.codigo || !form.nombre || !form.tipo || (form.tipo === 'C' && !form.instrumento_maestro_id)}
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
          {/* Summary card */}
          <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Resumen</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <span className="text-[11px] text-stone-400 uppercase">Modelo</span>
                <p className="text-stone-900 font-medium">{selectedModelo?.nombre_modelo}</p>
              </div>
              <div>
                <span className="text-[11px] text-stone-400 uppercase">Tipo</span>
                <div className="mt-0.5"><EmaTipoBadge tipo={form.tipo as any} showLabel /></div>
              </div>
              <div>
                <span className="text-[11px] text-stone-400 uppercase">Código</span>
                <p className="text-stone-900 font-mono">{form.codigo}</p>
              </div>
              <div>
                <span className="text-[11px] text-stone-400 uppercase">Nombre</span>
                <p className="text-stone-900">{form.nombre}</p>
              </div>
              {form.marca && (
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
              <div>
                <span className="text-[11px] text-stone-400 uppercase">Período</span>
                <p className="text-stone-900 font-mono">
                  {form.periodo_calibracion_dias || selectedModelo?.periodo_calibracion_dias} días
                </p>
              </div>
              {form.tipo === 'C' && form.instrumento_maestro_id && (
                <div>
                  <span className="text-[11px] text-stone-400 uppercase">Maestro</span>
                  <p className="text-stone-900">
                    {instrumentosTypeA.find(i => i.id === form.instrumento_maestro_id)?.codigo ?? '—'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Next steps info */}
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
