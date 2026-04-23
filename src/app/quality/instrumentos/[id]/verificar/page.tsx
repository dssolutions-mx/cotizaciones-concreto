'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, AlertTriangle,
  ClipboardList, ChevronRight, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { cn } from '@/lib/utils'
import type {
  InstrumentoDetalle,
  VerificacionTemplateSnapshot,
  VerificacionTemplateItem,
} from '@/types/ema'
import { effectiveSectionRepetitions, effectiveLayout, referencePointForRow } from '@/lib/ema/sectionLayout'
import { normalizeTemplateItem } from '@/lib/ema/templateItem'
import { evaluatePassFailRule } from '@/lib/ema/passFail'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  kind: 'inicio' | 'section' | 'cierre'
  sectionIndex?: number   // index into snapshot.sections
  repeticion?: number     // 1-based
}

type MeasurementKey = string // `${section_id}:${repeticion}:${item_id}`
interface MeasurementValue {
  valor_observado?: number | null
  valor_booleano?: boolean | null
  valor_texto?: string | null
  observacion?: string | null
  instance_code?: string | null
}

// ─── Pass/fail logic ──────────────────────────────────────────────────────────

function computeCumpleForItem(item: VerificacionTemplateItem, mv: MeasurementValue): boolean | null {
  const n = normalizeTemplateItem(item)
  if (!n.contributes_to_cumple || !n.pass_fail_rule || n.pass_fail_rule.kind === 'none') return null
  return evaluatePassFailRule(n.pass_fail_rule, {
    valor_observado: mv.valor_observado ?? null,
    valor_booleano: mv.valor_booleano ?? null,
    scope: {},
  })
}

function autoSuggestResultado(
  snapshot: VerificacionTemplateSnapshot,
  measurements: Record<MeasurementKey, MeasurementValue>,
): 'conforme' | 'no_conforme' | 'condicional' {
  let hasNoConforme = false
  let hasCondicional = false

  for (const section of snapshot.sections) {
    const reps = effectiveSectionRepetitions(section as any)
    for (let rep = 1; rep <= reps; rep++) {
      for (const item of section.items) {
        const key: MeasurementKey = `${section.id}:${rep}:${item.id}`
        const mv = measurements[key]
        if (!mv) continue
        const cumple = computeCumpleForItem(item, mv)
        if (cumple === false) hasNoConforme = true
      }
    }
  }

  if (hasNoConforme) return hasCondicional ? 'no_conforme' : 'no_conforme'
  return 'conforme'
}

// ─── Item Row Component ───────────────────────────────────────────────────────

function ItemRow({
  item,
  value,
  onChange,
}: {
  item: VerificacionTemplateItem
  value: MeasurementValue
  onChange: (v: MeasurementValue) => void
}) {
  const cumple = computeCumpleForItem(item, value)

  const hasValue = normalizeTemplateItem(item).primitive === 'booleano'
    ? value.valor_booleano !== undefined && value.valor_booleano !== null
    : (value.valor_observado !== undefined && value.valor_observado !== null) ||
      (value.valor_texto !== undefined && value.valor_texto !== '')

  return (
    <div className="border border-stone-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-800">{item.punto}</p>
          {item.observacion_prompt && (
            <p className="text-xs text-stone-500 mt-0.5">{item.observacion_prompt}</p>
          )}
          {normalizeTemplateItem(item).item_role === 'input_medicion' && (
            <p className="text-xs text-stone-400 mt-0.5 font-mono">
              {(() => {
                const r = normalizeTemplateItem(item).pass_fail_rule
                if (!r || r.kind === 'none') return '—'
                if (r.kind === 'range') return `${r.min ?? '?'} – ${r.max ?? '?'}${r.unit ? ` ${r.unit}` : ''}`
                if (r.kind === 'tolerance_pct') return `${r.expected}${r.unit ? ` ${r.unit}` : ''} ± ${r.tolerance_pct}%`
                if (r.kind === 'tolerance_abs') return `${r.expected}${r.unit ? ` ${r.unit}` : ''} ± ${r.tolerance}`
                return '—'
              })()}
            </p>
          )}
        </div>
        {hasValue && cumple !== null && (
          <span className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold border',
            cumple
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200',
          )}>
            {cumple ? 'CUMPLE' : 'NO CUMPLE'}
          </span>
        )}
      </div>

      {/* Input area by tipo */}
      {normalizeTemplateItem(item).primitive === 'booleano' ? (
        <div className="space-y-1">
          <p className="text-[10px] text-stone-500">Registro (el sistema calcula si cumple según la norma)</p>
          <div className="flex gap-2">
            {[{ label: 'Sí', val: true }, { label: 'No', val: false }].map(opt => (
              <button
                key={String(opt.val)}
                type="button"
                onClick={() => onChange({ ...value, valor_booleano: opt.val })}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-all',
                  value.valor_booleano === opt.val
                    ? opt.val
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                      : 'border-red-400 bg-red-50 text-red-800'
                    : 'border-stone-200 text-stone-600 hover:border-stone-300',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : item.tipo === 'texto' ? (
        <Textarea
          rows={2}
          placeholder="Escribir..."
          value={value.valor_texto ?? ''}
          onChange={e => onChange({ ...value, valor_texto: e.target.value })}
          className="border-stone-200 text-sm resize-none"
        />
      ) : item.tipo === 'referencia_equipo' ? (
        <Input
          placeholder="Código / N° serie / fecha calibración"
          value={value.valor_texto ?? ''}
          onChange={e => onChange({ ...value, valor_texto: e.target.value })}
          className="border-stone-200 text-sm font-mono"
        />
      ) : normalizeTemplateItem(item).item_role === 'derivado' ? (
        <div className="rounded-md bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-500 font-mono">
          Calculado: <code>{item.formula}</code>
        </div>
      ) : (
        /* medicion or numero */
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="any"
            placeholder="0.000"
            value={value.valor_observado ?? ''}
            onChange={e => {
              const v = e.target.value === '' ? null : parseFloat(e.target.value)
              onChange({ ...value, valor_observado: isNaN(v as number) ? null : v })
            }}
            className={cn(
              'flex-1 border-stone-200 font-mono text-sm',
              hasValue && cumple === false && 'border-red-300 bg-red-50/30',
              hasValue && cumple === true && 'border-emerald-300 bg-emerald-50/30',
            )}
          />
          {item.unidad && (
            <span className="text-xs text-stone-400 font-mono w-10 shrink-0">{item.unidad}</span>
          )}
          {hasValue && normalizeTemplateItem(item).pass_fail_rule?.kind === 'tolerance_abs' && value.valor_observado != null && (
            <span className={cn(
              'text-xs font-mono w-20 shrink-0 text-right',
              cumple ? 'text-emerald-600' : 'text-red-600',
            )}>
              err: {(Math.abs(value.valor_observado - (normalizeTemplateItem(item).pass_fail_rule as any).expected)).toFixed(3)}
            </span>
          )}
        </div>
      )}

      {/* Observación */}
      {normalizeTemplateItem(item).item_role !== 'derivado' && item.tipo !== 'texto' && (
        <Input
          placeholder="Observación (opcional)"
          value={value.observacion ?? ''}
          onChange={e => onChange({ ...value, observacion: e.target.value || null })}
          className="border-stone-200 text-xs text-stone-600"
        />
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VerificarPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [instrumento, setInstrumento] = useState<InstrumentoDetalle | null>(null)
  const [snapshot, setSnapshot] = useState<VerificacionTemplateSnapshot | null>(null)
  const [templateVersionId, setTemplateVersionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [noTemplate, setNoTemplate] = useState(false)

  // Execution state
  const [verifId, setVerifId] = useState<string | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [measurements, setMeasurements] = useState<Record<MeasurementKey, MeasurementValue>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instanceCodes, setInstanceCodes] = useState<Record<string, string>>({})

  // Master instrument picker (for Tipo C)
  const [maestros, setMaestros] = useState<Array<{ id: string; codigo: string; nombre: string; estado: string }>>([])
  const [instrumento_maestro_id, setInstrumentoMaestroId] = useState<string>('')

  // Inicio form
  const [inicioForm, setInicioForm] = useState({
    fecha_verificacion: new Date().toISOString().split('T')[0],
    temperatura: '',
    humedad: '',
    lugar: '',
  })

  // Cierre form
  const [cierreForm, setCierreForm] = useState({
    resultado: '' as '' | 'conforme' | 'no_conforme' | 'condicional',
    fecha_proxima_verificacion: '',
    observaciones_generales: '',
  })

  useEffect(() => {
    Promise.all([
      fetch(`/api/ema/instrumentos/${id}`).then(r => r.json()),
    ]).then(([instJ]) => {
      const inst = instJ.data ?? instJ
      setInstrumento(inst)

      // Pre-fill maestro from existing instrumento_maestro_id
      if (inst.instrumento_maestro_id) {
        setInstrumentoMaestroId(inst.instrumento_maestro_id)
      }

      // Fetch Tipo A instruments as maestro candidates (only for Tipo C)
      if (inst.tipo === 'C') {
        fetch(`/api/ema/instrumentos?tipo=A&limit=200`)
          .then(r => r.json())
          .then(j => setMaestros(j.data ?? []))
          .catch(() => {})
      }

      // Load template for this conjunto
      if (inst.conjunto_id) {
        fetch(`/api/ema/conjuntos/${inst.conjunto_id}/templates`)
          .then(r => r.json())
          .then(tj => {
            const tmpl = tj.data
            if (!tmpl?.active_version_id) {
              setNoTemplate(true)
              setLoading(false)
              return
            }
            setTemplateVersionId(tmpl.active_version_id)

            // Load the snapshot
            fetch(`/api/ema/template-versions/${tmpl.active_version_id}`)
              .then(r => r.json())
              .then(vj => {
                const snap: VerificacionTemplateSnapshot = vj.data?.snapshot
                if (!snap) { setNoTemplate(true); setLoading(false); return }
                setSnapshot(snap)

                // Build steps
                const built: Step[] = [{ kind: 'inicio' }]
                for (let si = 0; si < snap.sections.length; si++) {
                  const sec = snap.sections[si]
                  const reps = effectiveSectionRepetitions(sec as any)
                  for (let rep = 1; rep <= reps; rep++) {
                    built.push({ kind: 'section', sectionIndex: si, repeticion: rep })
                  }
                }
                built.push({ kind: 'cierre' })
                setSteps(built)

                // Compute suggested next date
                const meses = inst.conjunto?.cadencia_meses ?? 12
                const next = new Date()
                next.setMonth(next.getMonth() + meses)
                setCierreForm(f => ({ ...f, fecha_proxima_verificacion: next.toISOString().split('T')[0] }))

                setLoading(false)
              })
          })
      } else {
        setNoTemplate(true)
        setLoading(false)
      }
    }).catch(() => setLoading(false))
  }, [id])

  const mKey = useCallback((sectionId: string, rep: number, itemId: string): MeasurementKey =>
    `${sectionId}:${rep}:${itemId}`, [])

  const updateMeasurement = useCallback((key: MeasurementKey, val: MeasurementValue) => {
    setMeasurements(prev => ({ ...prev, [key]: val }))
  }, [])

  // Step 0 → create the verif record + advance
  const handleInicioNext = async () => {
    if (instrumento?.tipo === 'C' && !instrumento_maestro_id) {
      setError('Debe seleccionar el instrumento maestro (Tipo A) para instrumentos de trabajo.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/ema/instrumentos/${id}/verificaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_verificacion: inicioForm.fecha_verificacion,
          instrumento_maestro_id: instrumento_maestro_id || null,
          condiciones_ambientales: {
            temperatura: inicioForm.temperatura || undefined,
            humedad: inicioForm.humedad || undefined,
            lugar: inicioForm.lugar || undefined,
          },
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Error creando verificación')
      }
      const j = await res.json()
      setVerifId(j.data.id)
      setCurrentStep(1)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Section step → save measurements + advance
  const handleSectionNext = async () => {
    if (!verifId || !snapshot) return
    const step = steps[currentStep]
    if (step.kind !== 'section') return

    const section = snapshot.sections[step.sectionIndex!]
    const rep = step.repeticion!

    // Collect measurements for this section/rep
    const instKey = `${section.id}:${rep}`
    const codeRow = instanceCodes[instKey]?.trim() || null

    const toSave = section.items
      .filter(item => normalizeTemplateItem(item).item_role !== 'derivado')
      .map(item => {
        const key = mKey(section.id, rep, item.id)
        const mv = measurements[key] ?? {}
        return {
          section_id: section.id,
          section_repeticion: rep,
          item_id: item.id,
          valor_observado: mv.valor_observado ?? null,
          valor_booleano: mv.valor_booleano ?? null,
          valor_texto: mv.valor_texto ?? null,
          observacion: mv.observacion ?? null,
          instance_code: codeRow,
        }
      })
      .filter(m =>
        m.valor_observado != null || m.valor_booleano != null || m.valor_texto != null
      )

    if (toSave.length > 0) {
      setSaving(true)
      setError(null)
      try {
        const res = await fetch(`/api/ema/verificaciones/${verifId}/measurements`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ measurements: toSave }),
        })
        if (!res.ok) {
          const j = await res.json()
          throw new Error(j.error ?? 'Error guardando mediciones')
        }
      } catch (e: any) {
        setError(e.message)
        setSaving(false)
        return
      } finally {
        setSaving(false)
      }
    }

    // Auto-suggest resultado when reaching cierre
    if (currentStep + 1 === steps.length - 1 && snapshot) {
      const suggested = autoSuggestResultado(snapshot, measurements)
      setCierreForm(f => ({ ...f, resultado: f.resultado || suggested }))
    }

    setCurrentStep(s => s + 1)
  }

  // Cierre → close the verification
  const handleClose = async () => {
    if (!verifId) return
    if (!cierreForm.resultado) { setError('Seleccione el resultado'); return }
    if (!cierreForm.fecha_proxima_verificacion) { setError('Ingrese fecha próxima verificación'); return }

    setSaving(true)
    setError(null)
    try {
      // Update conditions/observations
      await fetch(`/api/ema/verificaciones/${verifId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observaciones_generales: cierreForm.observaciones_generales || null }),
      })

      const res = await fetch(`/api/ema/verificaciones/${verifId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultado: cierreForm.resultado,
          fecha_proxima_verificacion: cierreForm.fecha_proxima_verificacion,
          observaciones_generales: cierreForm.observaciones_generales || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Error cerrando verificación')
      }
      router.push(`/quality/instrumentos/${id}/verificaciones/${verifId}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl">
        <div className="h-4 w-48 bg-stone-200 rounded animate-pulse" />
        <div className="h-64 rounded-lg bg-stone-100 animate-pulse" />
      </div>
    )
  }

  if (noTemplate) {
    return (
      <div className="flex flex-col gap-5 max-w-2xl">
        <EmaBreadcrumb items={[
          { label: instrumento?.nombre ?? 'Instrumento', href: `/quality/instrumentos/${id}` },
          { label: 'Verificar' },
        ]} />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
          <h2 className="font-semibold text-stone-800">Sin plantilla de verificación</h2>
          <p className="text-sm text-stone-600">
            Este conjunto no tiene una plantilla publicada. Configure y publique la plantilla antes de ejecutar verificaciones.
          </p>
          {instrumento?.conjunto_id && (
            <Button variant="outline" className="border-stone-300" asChild>
              <Link href={`/quality/conjuntos/${instrumento.conjunto_id}/plantilla`}>
                Configurar plantilla
              </Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  const step = steps[currentStep]
  const totalSteps = steps.length
  const progress = Math.round((currentStep / (totalSteps - 1)) * 100)

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <EmaBreadcrumb items={[
        { label: instrumento?.nombre ?? 'Instrumento', href: `/quality/instrumentos/${id}` },
        { label: 'Nueva verificación' },
      ]} />

      <div className="flex items-center gap-3">
        <Link
          href={`/quality/instrumentos/${id}`}
          className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-stone-900 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-emerald-600 shrink-0" />
            {snapshot?.template.nombre}
          </h1>
          <p className="text-xs text-stone-500 mt-0.5 truncate">
            {instrumento?.nombre} · {instrumento?.codigo}
            {snapshot?.template.norma_referencia && ` · ${snapshot.template.norma_referencia}`}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>Paso {currentStep + 1} de {totalSteps}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Inicio ── */}
      {step.kind === 'inicio' && (
        <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-800">Inicio de verificación</h2>
            <p className="text-xs text-stone-500 mt-0.5">Confirme los datos iniciales antes de comenzar las mediciones.</p>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Fecha de verificación <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={inicioForm.fecha_verificacion}
                  onChange={e => setInicioForm(f => ({ ...f, fecha_verificacion: e.target.value }))}
                  className="border-stone-200"
                />
              </div>
            </div>

            {/* Master instrument — only for Tipo C */}
            {instrumento?.tipo === 'C' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">
                  Instrumento maestro (Tipo A) <span className="text-red-500">*</span>
                </Label>
                <select
                  value={instrumento_maestro_id}
                  onChange={e => setInstrumentoMaestroId(e.target.value)}
                  className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">— Seleccionar maestro —</option>
                  {maestros.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.codigo} · {m.nombre} ({m.estado})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-stone-400">
                  Instrumento patrón Tipo A con el que se realiza la verificación (trazabilidad NMX-EC-17025).
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Temperatura</Label>
                <Input
                  placeholder="ej. 23 °C"
                  value={inicioForm.temperatura}
                  onChange={e => setInicioForm(f => ({ ...f, temperatura: e.target.value }))}
                  className="border-stone-200 font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Humedad</Label>
                <Input
                  placeholder="ej. 50 %HR"
                  value={inicioForm.humedad}
                  onChange={e => setInicioForm(f => ({ ...f, humedad: e.target.value }))}
                  className="border-stone-200 font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Lugar</Label>
                <Input
                  placeholder="ej. Lab central"
                  value={inicioForm.lugar}
                  onChange={e => setInicioForm(f => ({ ...f, lugar: e.target.value }))}
                  className="border-stone-200 text-sm"
                />
              </div>
            </div>
          </div>
          <div className="px-5 py-3 flex justify-end">
            <Button
              onClick={handleInicioNext}
              disabled={saving || !inicioForm.fecha_verificacion}
              className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Comenzar
            </Button>
          </div>
        </div>
      )}

      {/* ── Section step ── */}
      {step.kind === 'section' && snapshot && (() => {
        const section = snapshot.sections[step.sectionIndex!]
        const rep = step.repeticion!
        const totalReps = effectiveSectionRepetitions(section as any)
        const layout = effectiveLayout(section as any)
        const refPt = layout === 'reference_series' ? referencePointForRow(section as any, rep) : null

        return (
          <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100 max-w-4xl">
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-stone-800">{section.titulo}</h2>
                {totalReps > 1 && (
                  <span className="rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                    {rep} / {totalReps}
                  </span>
                )}
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono text-emerald-800">
                  {layout}
                </span>
              </div>
              {section.descripcion && (
                <p className="text-xs text-stone-500 mt-0.5">{section.descripcion}</p>
              )}
              {refPt != null && (
                <p className="text-xs font-mono text-stone-600 mt-2">
                  Valor patrón: <strong>{refPt}</strong>
                  {section.series_config?.unit ? ` ${section.series_config.unit}` : ''}
                </p>
              )}
            </div>

            {layout === 'instrument_grid' && (
              <div className="px-5 py-3 border-b border-stone-100 bg-stone-50/50">
                <Label className="text-xs text-stone-600">Código de instancia</Label>
                <Input
                  className="mt-1 border-stone-200 font-mono text-sm max-w-md"
                  placeholder="Ej. VAR-001"
                  value={instanceCodes[`${section.id}:${rep}`] ?? ''}
                  onChange={e => setInstanceCodes(prev => ({
                    ...prev,
                    [`${section.id}:${rep}`]: e.target.value,
                  }))}
                />
              </div>
            )}

            <div className="px-5 py-4 space-y-3">
              {section.items
                .filter(item => normalizeTemplateItem(item).item_role !== 'derivado')
                .map(item => {
                  const key = mKey(section.id, rep, item.id)
                  return (
                    <ItemRow
                      key={item.id}
                      item={item}
                      value={measurements[key] ?? {}}
                      onChange={val => updateMeasurement(key, val)}
                    />
                  )
                })}
            </div>

            <div className="px-5 py-3 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep(s => s - 1)}
                className="text-stone-500 gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Anterior
              </Button>
              <Button
                onClick={handleSectionNext}
                disabled={saving}
                className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
              >
                {saving
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
                  : <><ArrowRight className="h-4 w-4" /> {currentStep + 1 === totalSteps - 1 ? 'Ir al cierre' : 'Siguiente'}</>
                }
              </Button>
            </div>
          </div>
        )
      })()}

      {/* ── Cierre ── */}
      {step.kind === 'cierre' && (
        <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-800">Cierre de verificación</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Revise el resultado global y confirme para cerrar la verificación.
            </p>
          </div>

          {/* Result selection */}
          <div className="px-5 py-4 space-y-3">
            <Label className="text-xs text-stone-600 font-semibold uppercase tracking-wide">Resultado global</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'conforme', label: 'Conforme', cls: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
                { value: 'no_conforme', label: 'No conforme', cls: 'border-red-400 bg-red-50 text-red-800' },
                { value: 'condicional', label: 'Condicional', cls: 'border-amber-400 bg-amber-50 text-amber-800' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCierreForm(f => ({ ...f, resultado: opt.value }))}
                  className={cn(
                    'rounded-lg border px-3 py-3 text-sm font-medium transition-all',
                    cierreForm.resultado === opt.value
                      ? opt.cls
                      : 'border-stone-200 text-stone-600 hover:border-stone-300',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Next date */}
          <div className="px-5 py-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Próxima verificación <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={cierreForm.fecha_proxima_verificacion}
                onChange={e => setCierreForm(f => ({ ...f, fecha_proxima_verificacion: e.target.value }))}
                className="border-stone-200 max-w-48"
              />
              <p className="text-[11px] text-stone-400">
                Auto-calculada según período del conjunto ({instrumento?.conjunto?.cadencia_meses ?? 12} meses)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Observaciones generales</Label>
              <Textarea
                rows={3}
                placeholder="Notas sobre la verificación..."
                value={cierreForm.observaciones_generales}
                onChange={e => setCierreForm(f => ({ ...f, observaciones_generales: e.target.value }))}
                className="border-stone-200 resize-none"
              />
            </div>
          </div>

          <div className="px-5 py-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep(s => s - 1)}
              className="text-stone-500 gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Anterior
            </Button>
            <Button
              onClick={handleClose}
              disabled={saving || !cierreForm.resultado || !cierreForm.fecha_proxima_verificacion}
              className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
            >
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Cerrando…</>
                : <><CheckCircle2 className="h-4 w-4" /> Cerrar verificación</>
              }
            </Button>
          </div>
        </div>
      )}

      {/* Step map */}
      {steps.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {steps.map((s, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full flex-1 min-w-4 transition-colors',
                i < currentStep ? 'bg-emerald-400' : i === currentStep ? 'bg-emerald-600' : 'bg-stone-200',
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
