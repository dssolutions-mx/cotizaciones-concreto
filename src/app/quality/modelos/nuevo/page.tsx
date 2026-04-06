'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  Info,
  Loader2,
  Plus,
  Ruler,
  Save,
  Thermometer,
  Weight,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaFileUpload } from '@/components/ema/EmaFileUpload'
import { cn } from '@/lib/utils'

// ─── Domain presets for concrete testing labs (NMX-C / NMX-CH) ──────────────

const CATEGORIAS_PRESET = [
  { value: 'Equipo de compresión', icon: Zap, desc: 'Prensas hidráulicas, marcos de carga', unit: 'kN', norma: 'NMX-CH-7500-1-IMNC-2008', periodo: 365, rango: '0–2000 kN' },
  { value: 'Celdas de carga', icon: Zap, desc: 'Celdas de carga patrón, anillos de prueba', unit: 'kN', norma: 'NMX-CH-7500-1-IMNC-2008', periodo: 365, rango: '0–3000 kN' },
  { value: 'Medición de temperatura', icon: Thermometer, desc: 'Termómetros digitales, termopares', unit: '°C', norma: '', periodo: 180, rango: '-20–150 °C' },
  { value: 'Termómetros de referencia', icon: Thermometer, desc: 'Termómetros patrón trazables a CENAM', unit: '°C', norma: '', periodo: 365, rango: '-30–200 °C' },
  { value: 'Medición de masa', icon: Weight, desc: 'Básculas, balanzas analíticas', unit: 'kg', norma: 'NMX-CH-OIML-R76-IMNC', periodo: 365, rango: '0–300 kg' },
  { value: 'Pesas patrón', icon: Weight, desc: 'Juegos de pesas clase M1/F1', unit: 'kg', norma: 'OIML R111', periodo: 730, rango: '1 g–20 kg' },
  { value: 'Medición dimensional', icon: Ruler, desc: 'Verniers, micrómetros, flexómetros', unit: 'mm', norma: '', periodo: 365, rango: '0–300 mm' },
  { value: 'Bloques patrón', icon: Ruler, desc: 'Bloques patrón de longitud', unit: 'mm', norma: 'ISO 3650', periodo: 1460, rango: '0.5–100 mm' },
  { value: 'Medición de presión', icon: Zap, desc: 'Manómetros, transductores de presión', unit: 'MPa', norma: '', periodo: 365, rango: '0–70 MPa' },
  { value: 'Medición de volumen', icon: Ruler, desc: 'Probetas, medidores volumétricos', unit: 'mL', norma: '', periodo: 365, rango: '0–2000 mL' },
  { value: 'Cronómetros', icon: Zap, desc: 'Cronómetros digitales, temporizadores', unit: 's', norma: '', periodo: 365, rango: '' },
  { value: 'Equipo de revenimiento', icon: Ruler, desc: 'Cono de Abrams, placa base, varilla', unit: 'mm', norma: 'NMX-C-156-ONNCCE', periodo: 365, rango: '' },
] as const

const TIPO_INFO: Record<string, { label: string; color: string; desc: string }> = {
  A: { label: 'Tipo A — Maestro verificador', color: 'sky', desc: 'Calibrado externamente por laboratorio EMA. Sirve como referencia para verificar instrumentos Tipo C.' },
  B: { label: 'Tipo B — Externo independiente', color: 'violet', desc: 'Calibrado externamente por laboratorio EMA. No verifica otros instrumentos.' },
  C: { label: 'Tipo C — Trabajo interno', color: 'amber', desc: 'Verificado internamente usando un instrumento Tipo A como referencia.' },
}

export default function NuevoModeloPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    nombre_modelo: '',
    categoria: '',
    tipo_defecto: '',
    periodo_calibracion_dias: '',
    norma_referencia: '',
    unidad_medicion: '',
    rango_medicion_tipico: '',
    descripcion: '',
    manual_path: '',
    instrucciones_path: '',
  })

  const [documentosAdicionales, setDocumentosAdicionales] = useState<Array<{ nombre: string; path: string }>>([])

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  // When user picks a category preset, auto-fill related fields (no tipo)
  const applyPreset = (preset: typeof CATEGORIAS_PRESET[number]) => {
    setForm(f => ({
      ...f,
      categoria: preset.value,
      unidad_medicion: f.unidad_medicion || preset.unit,
      norma_referencia: f.norma_referencia || preset.norma,
      periodo_calibracion_dias: f.periodo_calibracion_dias || String(preset.periodo),
      rango_medicion_tipico: f.rango_medicion_tipico || preset.rango,
    }))
  }

  const addDocumentoAdicional = () => {
    setDocumentosAdicionales(prev => [...prev, { nombre: '', path: '' }])
  }

  const updateDocumentoAdicional = (index: number, field: 'nombre' | 'path', value: string) => {
    setDocumentosAdicionales(prev =>
      prev.map((doc, i) => (i === index ? { ...doc, [field]: value } : doc))
    )
  }

  const removeDocumentoAdicional = (index: number) => {
    setDocumentosAdicionales(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const body = {
        nombre_modelo: form.nombre_modelo,
        categoria: form.categoria,
        tipo_defecto: form.tipo_defecto || undefined,
        periodo_calibracion_dias: parseInt(form.periodo_calibracion_dias),
        norma_referencia: form.norma_referencia || undefined,
        unidad_medicion: form.unidad_medicion || undefined,
        rango_medicion_tipico: form.rango_medicion_tipico || undefined,
        descripcion: form.descripcion || undefined,
        manual_path: form.manual_path || undefined,
        instrucciones_path: form.instrucciones_path || undefined,
        documentos_adicionales: documentosAdicionales.filter(d => d.path !== ''),
      }
      const res = await fetch('/api/ema/modelos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Error al crear modelo')
      }
      router.push('/quality/modelos')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTipo = form.tipo_defecto ? TIPO_INFO[form.tipo_defecto] : null

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <EmaBreadcrumb items={[
        { label: 'Modelos', href: '/quality/modelos' },
        { label: 'Nuevo modelo' },
      ]} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/quality/modelos"
          className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-stone-600" />
            Nuevo modelo de instrumento
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Plantilla que define categoría, período de calibración y norma de referencia
          </p>
        </div>
      </div>

      {/* EMA info */}
      <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
        <div className="text-xs text-sky-800">
          <p className="font-medium">NMX-EC-17025 · Cláusula 6.4</p>
          <p className="mt-0.5">
            Los modelos agrupan instrumentos por categoría y definen su período de calibración/verificación
            predeterminado. Al dar de alta un instrumento, hereda estos valores del modelo. El tipo (A/B/C)
            se asigna a cada instrumento individual según su rol en la cadena de trazabilidad.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Section 1 — Category selection */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">1. Categoría del instrumento</h2>
          <p className="text-xs text-stone-500 -mt-2">
            Seleccione una categoría predefinida para auto-completar campos, o escriba una categoría libre.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIAS_PRESET.map(preset => {
              const Icon = preset.icon
              const isSelected = form.categoria === preset.value
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-all',
                    isSelected
                      ? 'border-stone-400 bg-stone-50 ring-1 ring-stone-300'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  )}
                >
                  <Icon className={cn('h-4 w-4 mb-1.5', isSelected ? 'text-stone-700' : 'text-stone-400')} />
                  <p className="text-xs font-medium text-stone-900 leading-tight">{preset.value}</p>
                  <p className="text-[10px] text-stone-500 mt-0.5 line-clamp-1">{preset.desc}</p>
                </button>
              )
            })}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-stone-600">Categoría <span className="text-red-500">*</span></Label>
            <Input
              required
              value={form.categoria}
              onChange={e => update('categoria', e.target.value)}
              placeholder="Seleccione arriba o escriba una categoría personalizada"
              className="border-stone-200"
            />
          </div>
        </div>

        {/* Section 2 — Model identity */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">2. Identificación del modelo</h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-stone-600">Nombre del modelo <span className="text-red-500">*</span></Label>
            <Input
              required
              value={form.nombre_modelo}
              onChange={e => update('nombre_modelo', e.target.value)}
              placeholder="ej. Prensa hidráulica de compresión 2000 kN"
              className="border-stone-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-stone-600">Descripción</Label>
            <Textarea
              rows={2}
              value={form.descripcion}
              onChange={e => update('descripcion', e.target.value)}
              placeholder="Características principales, uso previsto, notas relevantes..."
              className="border-stone-200 resize-none"
            />
          </div>
        </div>

        {/* Section 3 — Calibration & metrology */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">3. Calibración y metrología</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">
                Período de calibración / verificación (días)
                <span className="text-red-500"> *</span>
              </Label>
              <Input
                type="number"
                required
                min="1"
                value={form.periodo_calibracion_dias}
                onChange={e => update('periodo_calibracion_dias', e.target.value)}
                placeholder="ej. 365"
                className="border-stone-200 font-mono"
              />
              <p className="text-[11px] text-stone-400">
                Intervalo predeterminado. Cada instrumento puede sobreescribirlo.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Unidad de medición</Label>
              <Input
                value={form.unidad_medicion}
                onChange={e => update('unidad_medicion', e.target.value)}
                placeholder="ej. kN, °C, kg, mm"
                className="border-stone-200 font-mono"
                list="units-list"
              />
              <datalist id="units-list">
                <option value="kN" />
                <option value="°C" />
                <option value="kg" />
                <option value="g" />
                <option value="mm" />
                <option value="MPa" />
                <option value="mL" />
                <option value="s" />
                <option value="%HR" />
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Norma de referencia</Label>
              <Input
                value={form.norma_referencia}
                onChange={e => update('norma_referencia', e.target.value)}
                placeholder="ej. NMX-CH-7500-1-IMNC-2008"
                className="border-stone-200 font-mono text-sm"
                list="normas-list"
              />
              <datalist id="normas-list">
                <option value="NMX-CH-7500-1-IMNC-2008" />
                <option value="NMX-CH-OIML-R76-IMNC" />
                <option value="NMX-C-083-ONNCCE-2014" />
                <option value="NMX-C-156-ONNCCE" />
                <option value="NMX-C-159-ONNCCE" />
                <option value="NMX-C-161-ONNCCE" />
                <option value="OIML R111" />
                <option value="ISO 3650" />
                <option value="ASTM E4" />
                <option value="ASTM C39" />
              </datalist>
              <p className="text-[11px] text-stone-400">
                Norma NMX/ASTM que rige la calibración de este tipo de instrumento
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Rango de medición típico</Label>
              <Input
                value={form.rango_medicion_tipico}
                onChange={e => update('rango_medicion_tipico', e.target.value)}
                placeholder="ej. 0–2000 kN"
                className="border-stone-200 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* Section 4 — Tipo sugerido (optional, demoted) */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">4. Tipo sugerido (opcional)</h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-stone-600">Tipo sugerido al crear instrumentos</Label>
            <Select value={form.tipo_defecto} onValueChange={val => update('tipo_defecto', val)}>
              <SelectTrigger className="border-stone-200 w-48">
                <SelectValue placeholder="Sin sugerencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Tipo A — Maestro</SelectItem>
                <SelectItem value="B">Tipo B — Externo</SelectItem>
                <SelectItem value="C">Tipo C — Trabajo</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-stone-400 leading-snug">
              Este campo es solo una sugerencia. El tipo real (A/B/C) se asigna al registrar cada instrumento
              según su rol en la cadena de trazabilidad.
            </p>
          </div>
          {selectedTipo && (
            <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
              {selectedTipo.desc}
            </div>
          )}
        </div>

        {/* Section 5 — Documentation */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">5. Documentación (opcional)</h2>

          <div className="space-y-1.5">
            <Label className="text-xs text-stone-600">Manual del equipo</Label>
            <EmaFileUpload
              value={form.manual_path}
              onChange={(p) => update('manual_path', p)}
              folder="modelos/manuales"
              label="Manual del equipo (PDF)"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-stone-600">Instrucciones de verificación</Label>
            <EmaFileUpload
              value={form.instrucciones_path}
              onChange={(p) => update('instrucciones_path', p)}
              folder="modelos/instrucciones"
              label="Instrucciones de verificación (PDF)"
            />
          </div>

          {/* Additional documents */}
          <div className="space-y-3 pt-1">
            <p className="text-xs font-medium text-stone-600">Documentos adicionales</p>
            {documentosAdicionales.map((doc, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <Input
                    value={doc.nombre}
                    onChange={e => updateDocumentoAdicional(index, 'nombre', e.target.value)}
                    placeholder="Nombre del documento"
                    className="border-stone-200 text-sm"
                  />
                  <EmaFileUpload
                    value={doc.path}
                    onChange={(p) => updateDocumentoAdicional(index, 'path', p)}
                    folder="modelos/adicionales"
                    label="Seleccionar archivo"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeDocumentoAdicional(index)}
                  className="mt-1 rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors shrink-0"
                  aria-label="Eliminar documento"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDocumentoAdicional}
              className="border-stone-200 text-stone-600 hover:bg-stone-50 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar documento
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href="/quality/modelos"
            className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            Cancelar
          </Link>
          <Button
            type="submit"
            className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5"
            disabled={submitting || !form.nombre_modelo || !form.categoria || !form.periodo_calibracion_dias}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="h-4 w-4" /> Crear modelo</>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
