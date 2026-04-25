'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, AlertTriangle,
  ClipboardList, ChevronRight, RefreshCw,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
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
import { evaluateFormula, parseFormula } from '@/lib/ema/formula'
import { effectiveSectionRepetitions, effectiveLayout, referencePointForRow } from '@/lib/ema/sectionLayout'
import { normalizeTemplateItem } from '@/lib/ema/templateItem'
import { evaluatePassFailRule } from '@/lib/ema/passFail'
import type { ComputedMeasurementRow } from '@/lib/ema/measurementCompute'
import {
  buildIncomingListForSnapshot,
  computeAllMeasurementRowsFromSnapshot,
  firstToleranceBandFromSnapshot,
  missingSectionFormulaVariableNames,
  previewSectionMeasurements,
} from '@/lib/ema/measurementCompute'

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

type EmaApiErrorPayload = {
  error?: string
  issues?: Array<{ codigo: string; nombre: string; detalle: string }>
}

function formatEmaApiError(j: EmaApiErrorPayload): string {
  const base = j.error ?? 'Error'
  const list = j.issues
  if (!list?.length) return base
  const lines = list.map((i) => {
    const who = i.nombre && i.nombre !== '—' ? ` (${i.nombre})` : ''
    return `• ${i.codigo}${who}: ${i.detalle}`
  })
  return [base, ...lines].join('\n')
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
  mKeyFn: (sectionId: string, rep: number, itemId: string) => MeasurementKey,
  headerScope: Record<string, number> | undefined,
  instrumentTipo: string | undefined,
): 'conforme' | 'no_conforme' | 'condicional' {
  const incoming = buildIncomingListForSnapshot(
    snapshot.sections,
    (sectionId, rep, itemId) => measurements[mKeyFn(sectionId, rep, itemId)],
    { instrumentTipo },
  )
  const { rows } = computeAllMeasurementRowsFromSnapshot(
    snapshot.sections,
    incoming,
    headerScope ?? {},
  )
  let hasNoConforme = false
  for (const row of rows) {
    if (row.cumple === false) hasNoConforme = true
  }
  return hasNoConforme ? 'no_conforme' : 'conforme'
}

// ─── Item Row Component ───────────────────────────────────────────────────────

function ItemRow({
  item,
  value,
  onChange,
  /** When set (same engine as PUT), drives cumple + derivado valor for worksheet parity. */
  previewRow,
  /** Solo tipo C: `undefined` = usar captura texto legacy (A/B). Array (vacío o no) = solo lectura desde FK de verificación. */
  referenciaEquipoPatronesReadonly,
}: {
  item: VerificacionTemplateItem
  value: MeasurementValue
  onChange: (v: MeasurementValue) => void
  previewRow?: ComputedMeasurementRow | null
  referenciaEquipoPatronesReadonly?: Array<{ id: string; codigo: string; nombre: string }> | undefined
}) {
  const n = normalizeTemplateItem(item)
  const cumple = previewRow != null ? previewRow.cumple : computeCumpleForItem(item, value)

  const hasValue = n.primitive === 'booleano'
    ? value.valor_booleano !== undefined && value.valor_booleano !== null
    : n.item_role === 'derivado'
      ? previewRow != null && previewRow.valor_observado !== null && previewRow.valor_observado !== undefined
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
          {(n.item_role === 'input_medicion' || n.item_role === 'derivado') && n.pass_fail_rule && (
            <p className="text-xs text-stone-400 mt-0.5 font-mono">
              {(() => {
                const r = n.pass_fail_rule
                if (!r || r.kind === 'none') return '—'
                if (r.kind === 'range') return `${r.min ?? '?'} – ${r.max ?? '?'}${r.unit ? ` ${r.unit}` : ''}`
                if (r.kind === 'tolerance_pct') return `${r.expected}${r.unit ? ` ${r.unit}` : ''} ± ${r.tolerance_pct}%`
                if (r.kind === 'tolerance_abs') return `${r.expected}${r.unit ? ` ${r.unit}` : ''} ± ${r.tolerance}`
                if (r.kind === 'formula_bound') return 'Límites por fórmula (ver plantilla)'
                if (r.kind === 'expression') return 'Regla por expresión'
                return '—'
              })()}
            </p>
          )}
        </div>
        {hasValue && cumple !== null && cumple !== undefined && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold border',
              cumple
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200',
            )}
            aria-label={cumple ? 'Resultado: cumple la regla' : 'Resultado: no cumple la regla'}
          >
            {cumple ? 'CUMPLE' : 'NO CUMPLE'}
          </span>
        )}
      </div>

      {/* Input area by tipo */}
      {normalizeTemplateItem(item).primitive === 'booleano' ? (
        <div className="space-y-1">
          <p id={`bool-hint-${item.id}`} className="text-xs text-stone-500">
            Registro (el sistema calcula si cumple según la norma)
          </p>
          <div
            className="flex gap-2"
            role="group"
            aria-labelledby={`bool-hint-${item.id}`}
            aria-label={`Respuesta: ${item.punto}`}
          >
            {[{ label: 'Sí', val: true }, { label: 'No', val: false }].map(opt => (
              <button
                key={String(opt.val)}
                type="button"
                aria-pressed={value.valor_booleano === opt.val}
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
      ) : item.tipo === 'referencia_equipo' && referenciaEquipoPatronesReadonly !== undefined ? (
        <div className="rounded-md border border-cyan-200 bg-cyan-50/60 px-3 py-2 text-xs text-cyan-950 space-y-1.5">
          <p className="font-medium text-cyan-900">Patrones registrados (trazabilidad)</p>
          <p className="text-cyan-800/90 leading-relaxed">
            Seleccionados al inicio de la verificación y guardados por vínculo a instrumentos tipo A.
          </p>
          {referenciaEquipoPatronesReadonly.length === 0 ? (
            <p className="text-amber-800">No hay patrones asociados a esta ejecución.</p>
          ) : (
            <ul className="list-disc pl-4 space-y-0.5 font-mono text-[11px]">
              {referenciaEquipoPatronesReadonly.map(p => (
                <li key={p.id}>
                  <span className="font-semibold">{p.codigo}</span>
                  {' — '}
                  {p.nombre}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : item.tipo === 'referencia_equipo' ? (
        <Input
          placeholder="Código / N° serie / fecha calibración"
          value={value.valor_texto ?? ''}
          onChange={e => onChange({ ...value, valor_texto: e.target.value })}
          className="border-stone-200 text-sm font-mono"
        />
      ) : n.item_role === 'derivado' ? (
        <div className="rounded-md bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-600 space-y-1">
          <p className="font-mono text-stone-500">
            Calculado: <code>{item.formula}</code>
          </p>
          {previewRow && previewRow.valor_observado != null && (
            <p className="text-sm font-semibold text-stone-800">
              = {previewRow.valor_observado}
              {item.unidad ? ` ${item.unidad}` : ''}
            </p>
          )}
          {previewRow && previewRow.valor_observado == null && (
            <p className="text-amber-700 text-[11px]">Complete las mediciones referenciadas para ver el resultado.</p>
          )}
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
          {hasValue && n.pass_fail_rule?.kind === 'tolerance_abs' && (previewRow?.valor_observado ?? value.valor_observado) != null && (
            <span className={cn(
              'text-xs font-mono w-20 shrink-0 text-right',
              cumple ? 'text-emerald-600' : 'text-red-600',
            )}>
              err: {(Math.abs((previewRow?.valor_observado ?? value.valor_observado)! - (n.pass_fail_rule as { expected: number }).expected)).toFixed(3)}
            </span>
          )}
        </div>
      )}

      {/* Observación */}
      {normalizeTemplateItem(item).item_role !== 'derivado' && item.tipo !== 'texto'
        && !(item.tipo === 'referencia_equipo' && referenciaEquipoPatronesReadonly !== undefined) && (
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

  // Plantilla picker (when conjunto has ≥2 publicadas)
  const [plantillaCandidates, setPlantillaCandidates] = useState<Array<{
    id: string; codigo: string; nombre: string; norma_referencia: string | null; active_version_id: string
  }>>([])
  const [selectedPlantillaId, setSelectedPlantillaId] = useState<string>('')

  /** Captured at Inicio for templates with `header_fields` (e.g. prensa compresión). */
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({})

  // Master instrument picker (for Tipo C)
  const [maestros, setMaestros] = useState<Array<{
    id: string
    codigo: string
    nombre: string
    estado: string
    incertidumbre_expandida?: number | null
    incertidumbre_k?: number | null
    incertidumbre_unidad?: string | null
  }>>([])
  const [selectedMaestroIds, setSelectedMaestroIds] = useState<string[]>([])

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

      const configured = inst.instrumento_maestro_ids ?? []
      setSelectedMaestroIds([...configured])

      // Fetch Tipo A instruments (same plant); limit to patrones configurados cuando existan
      if (inst.tipo === 'C') {
        const qs = new URLSearchParams({ tipo: 'A', limit: '200' })
        if (inst.plant_id) qs.set('plant_id', inst.plant_id)
        fetch(`/api/ema/instrumentos?${qs}`)
          .then((r) => r.json())
          .then((j) => {
            const all = Array.isArray(j.data) ? j.data : []
            const allow = new Set(configured)
            setMaestros(allow.size ? all.filter((m: { id: string }) => allow.has(m.id)) : all)
          })
          .catch(() => setMaestros([]))
      }

      // Load templates for this conjunto (now returns an array)
      if (inst.conjunto_id) {
        fetch(`/api/ema/conjuntos/${inst.conjunto_id}/templates`)
          .then(r => r.json())
          .then(tj => {
            const list: any[] = Array.isArray(tj.data) ? tj.data : (tj.data ? [tj.data] : [])
            const publicadas = list.filter((t: any) => t.estado === 'publicado' && t.active_version_id)
            if (publicadas.length === 0) {
              setNoTemplate(true)
              setLoading(false)
              return
            }
            if (publicadas.length > 1) {
              // Multiple publicadas — show picker; user will choose
              setPlantillaCandidates(publicadas.map((t: any) => ({
                id: t.id,
                codigo: t.codigo,
                nombre: t.nombre,
                norma_referencia: t.norma_referencia ?? null,
                active_version_id: t.active_version_id,
              })))
              setLoading(false)
              return
            }
            // Single publicada — auto-select and load snapshot
            const tmpl = publicadas[0]
            setSelectedPlantillaId(tmpl.id)
            setTemplateVersionId(tmpl.active_version_id)
            fetch(`/api/ema/template-versions/${tmpl.active_version_id}`)
              .then(r => r.json())
              .then(vj => {
                const snap: VerificacionTemplateSnapshot = vj.data?.snapshot
                if (!snap) { setNoTemplate(true); setLoading(false); return }
                setSnapshot(snap)
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

  useEffect(() => {
    if (!snapshot?.header_fields?.length) {
      setHeaderValues({})
      return
    }
    const next: Record<string, string> = {}
    for (const h of snapshot.header_fields) {
      if (h.source === 'manual' && h.variable_name) next[h.variable_name] = ''
    }
    setHeaderValues(next)
  }, [snapshot])

  const headerNumericPayload = useMemo(() => {
    if (!snapshot?.header_fields?.length) return undefined as Record<string, number> | undefined
    const out: Record<string, number> = {}
    for (const h of snapshot.header_fields) {
      if (h.source !== 'manual' || !h.variable_name) continue
      const raw = headerValues[h.variable_name]?.trim()
      if (raw === '') continue
      const n = Number(raw)
      if (!Number.isNaN(n)) out[h.variable_name] = n
    }
    const sorted = [...snapshot.header_fields].sort((a, b) => a.orden - b.orden)
    const scope: Record<string, number> = { ...out }
    for (const h of sorted) {
      const key = h.variable_name
      if (!key) continue
      if (h.source === 'computed' && h.formula) {
        try {
          scope[key] = evaluateFormula(parseFormula(h.formula), scope)
        } catch { /* skip */ }
      }
    }
    return Object.keys(out).length ? out : undefined
  }, [snapshot?.header_fields, headerValues])

  const mKey = useCallback((sectionId: string, rep: number, itemId: string): MeasurementKey =>
    `${sectionId}:${rep}:${itemId}`, [])

  const updateMeasurement = useCallback((key: MeasurementKey, val: MeasurementValue) => {
    setMeasurements(prev => ({ ...prev, [key]: val }))
  }, [])

  const referenciaEquipoPatronesReadonly = useMemo(() => {
    if (instrumento?.tipo !== 'C') return undefined as
      | Array<{ id: string; codigo: string; nombre: string }>
      | undefined
    const byId = new Map(maestros.map(m => [m.id, m]))
    return selectedMaestroIds.map(mid => {
      const m = byId.get(mid)
      return m
        ? { id: m.id, codigo: m.codigo, nombre: m.nombre }
        : { id: mid, codigo: '—', nombre: 'Instrumento patrón' }
    })
  }, [instrumento?.tipo, maestros, selectedMaestroIds])

  // Plantilla picker → load selected plantilla snapshot
  const handlePickPlantilla = useCallback(async (candidate: typeof plantillaCandidates[number]) => {
    setLoading(true)
    setError(null)
    try {
      setSelectedPlantillaId(candidate.id)
      setTemplateVersionId(candidate.active_version_id)
      const vj = await fetch(`/api/ema/template-versions/${candidate.active_version_id}`).then(r => r.json())
      const snap: VerificacionTemplateSnapshot = vj.data?.snapshot
      if (!snap) { setNoTemplate(true); return }
      setSnapshot(snap)
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
      const meses = instrumento?.conjunto?.cadencia_meses ?? 12
      const next = new Date()
      next.setMonth(next.getMonth() + meses)
      setCierreForm(f => ({ ...f, fecha_proxima_verificacion: next.toISOString().split('T')[0] }))
      setPlantillaCandidates([]) // clear picker
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [instrumento])

  // Inicio → create the verif record + advance
  const handleInicioNext = async () => {
    if (snapshot?.header_fields?.some(h => h.source === 'manual' && h.variable_name && !String(headerValues[h.variable_name] ?? '').trim())) {
      setError('Complete los campos de cabecera de la plantilla antes de continuar.')
      return
    }
    if (instrumento?.tipo === 'C' && selectedMaestroIds.length === 0) {
      setError('Seleccione al menos un instrumento patrón (Tipo A) para la verificación.')
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
          instrumento_maestro_ids: instrumento?.tipo === 'C' ? selectedMaestroIds : undefined,
          template_id: selectedPlantillaId || undefined,
          condiciones_ambientales: {
            temperatura: inicioForm.temperatura || undefined,
            humedad: inicioForm.humedad || undefined,
            lugar: inicioForm.lugar || undefined,
          },
        }),
      })
      if (!res.ok) {
        const j = (await res.json()) as EmaApiErrorPayload
        throw new Error(formatEmaApiError(j) || 'Error creando verificación')
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

    const instKey = `${section.id}:${rep}`
    const codeRow = instanceCodes[instKey]?.trim() || null

    const previewInputs = [...(section.items ?? [])]
      .sort((a, b) => a.orden - b.orden)
      .filter(it => normalizeTemplateItem(it).item_role !== 'derivado')
      .filter(it => !(instrumento?.tipo === 'C' && it.tipo === 'referencia_equipo'))
      .map(item => {
        const key = mKey(section.id, rep, item.id)
        const mv = measurements[key] ?? {}
        return {
          item_id: item.id,
          valor_observado: mv.valor_observado ?? null,
          valor_booleano: mv.valor_booleano ?? null,
          valor_texto: mv.valor_texto ?? null,
          observacion: mv.observacion ?? null,
          instance_code: codeRow ?? mv.instance_code ?? null,
        }
      })

    const missingVars = missingSectionFormulaVariableNames(
      section,
      rep,
      previewInputs,
      headerNumericPayload ?? {},
    )
    if (missingVars.length > 0) {
      setError(`Faltan valores para las variables: ${missingVars.join(', ')}. Complételas antes de continuar.`)
      return
    }

    // Collect measurements for this section/rep
    const toSave = section.items
      .filter(item => normalizeTemplateItem(item).item_role !== 'derivado')
      .filter(item => !(instrumento?.tipo === 'C' && item.tipo === 'referencia_equipo'))
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
          body: JSON.stringify({
            measurements: toSave,
            ...(headerNumericPayload ? { header_values: headerNumericPayload } : {}),
          }),
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
      const suggested = autoSuggestResultado(
        snapshot,
        measurements,
        mKey,
        headerNumericPayload,
        instrumento?.tipo,
      )
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
        const j = (await res.json()) as EmaApiErrorPayload
        throw new Error(formatEmaApiError(j) || 'Error cerrando verificación')
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

  // ── Plantilla picker (≥2 publicadas) ──────────────────────────────────────
  if (plantillaCandidates.length > 1 && !snapshot) {
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
          <div>
            <h1 className="text-base font-semibold text-stone-900">Seleccione la plantilla de verificación</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              {instrumento?.nombre} · {instrumento?.codigo}
            </p>
          </div>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">{error}</div>
        )}
        <div className="flex flex-col gap-3">
          {plantillaCandidates.map(c => (
            <button
              key={c.id}
              onClick={() => handlePickPlantilla(c)}
              className="text-left w-full rounded-lg border border-stone-200 bg-white p-4 hover:border-emerald-400 hover:bg-emerald-50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-800 group-hover:text-emerald-700">{c.codigo}</p>
                  <p className="text-sm text-stone-600 mt-0.5">{c.nombre}</p>
                  {c.norma_referencia && (
                    <p className="text-xs text-stone-400 mt-1">{c.norma_referencia}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-500 shrink-0 mt-0.5" />
              </div>
            </button>
          ))}
        </div>
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">
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
            {(snapshot?.header_fields ?? []).length > 0 && (
              <div className="rounded-md border border-stone-100 bg-stone-50/80 p-3 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Datos de cabecera</p>
                {Array.from(snapshot?.header_fields ?? []).sort((a, b) => a.orden - b.orden).map(h => {
                  if (h.source === 'manual' && h.variable_name) {
                    return (
                      <div key={h.id} className="space-y-1.5">
                        <Label className="text-xs text-stone-600">{h.label} <span className="text-red-500">*</span></Label>
                        <Input
                          type="number"
                          step="any"
                          value={headerValues[h.variable_name] ?? ''}
                          onChange={e => setHeaderValues(v => ({ ...v, [h.variable_name!]: e.target.value }))}
                          className="border-stone-200 font-mono text-sm"
                        />
                      </div>
                    )
                  }
                  if (h.source === 'computed' && h.variable_name && h.formula) {
                    let preview = '—'
                    try {
                      const scope: Record<string, number> = {}
                      for (const x of Array.from(snapshot?.header_fields ?? []).sort((a, b) => a.orden - b.orden)) {
                        if (x.source === 'manual' && x.variable_name) {
                          const n = Number(headerValues[x.variable_name]?.trim())
                          if (!Number.isNaN(n)) scope[x.variable_name] = n
                        } else if (x.source === 'computed' && x.variable_name && x.formula) {
                          scope[x.variable_name] = evaluateFormula(parseFormula(x.formula), scope)
                        }
                      }
                      const v = scope[h.variable_name]
                      preview = v != null && !Number.isNaN(v) ? String(v) : '—'
                    } catch { /* keep — */ }
                    return (
                      <div key={h.id} className="flex justify-between gap-2 text-xs">
                        <span className="text-stone-600">{h.label}</span>
                        <span className="font-mono text-stone-800">{preview}</span>
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ema-verif-fecha" className="text-xs text-stone-600">
                  Fecha de verificación <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ema-verif-fecha"
                  type="date"
                  value={inicioForm.fecha_verificacion}
                  onChange={e => setInicioForm(f => ({ ...f, fecha_verificacion: e.target.value }))}
                  className="border-stone-200"
                  required
                />
              </div>
            </div>

            {/* Pattern instruments — only for Tipo C */}
            {instrumento?.tipo === 'C' && (
              <div className="space-y-2">
                <Label className="text-xs text-stone-600">
                  Instrumentos patrón (Tipo A) <span className="text-red-500">*</span>
                </Label>
                <div className="rounded-md border border-stone-200 bg-white p-3 max-h-[200px] overflow-y-auto space-y-2">
                  {maestros.length === 0 ? (
                    <p className="text-xs text-amber-700">
                      No hay instrumentos patrón configurados para este instrumento. Configúrelos en la ficha antes de
                      verificar.
                    </p>
                  ) : (
                    maestros.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedMaestroIds.includes(m.id)}
                          onCheckedChange={(c) => {
                            const on = c === true
                            setSelectedMaestroIds((prev) => {
                              const s = new Set(prev)
                              if (on) s.add(m.id)
                              else s.delete(m.id)
                              return Array.from(s)
                            })
                          }}
                        />
                        <span className="font-mono text-xs text-stone-500">{m.codigo}</span>
                        <span>
                          · {m.nombre} ({m.estado})
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Patrones Tipo A definidos para este instrumento (trazabilidad NMX-EC-17025-IMNC). Puede usar uno o
                  varios en esta corrida. La incertidumbre U del patrón proviene de la ficha (sincronizada con el
                  certificado vigente) o del certificado si la ficha aún no la tiene.
                </p>
                {snapshot && (() => {
                  const band = firstToleranceBandFromSnapshot(snapshot)
                  const selected = maestros.filter(m => selectedMaestroIds.includes(m.id))
                  const lowTur = selected.filter(m => {
                    const u = m.incertidumbre_expandida
                    if (u == null || u <= 0 || band == null || band <= 0) return false
                    return band / u < 4
                  })
                  if (!selected.length) return null
                  return (
                    <div
                      className="rounded-md border border-stone-100 bg-stone-50/80 px-3 py-2 text-xs text-stone-700 space-y-1.5"
                      role="region"
                      aria-label="Indicadores metrológicos orientativos"
                    >
                      <p className="font-medium text-stone-800">Metrología: cociente TUR (indicativo, no sustituye dictamen de laboratorio)</p>
                      <p className="text-stone-600 leading-relaxed">
                        TUR (test uncertainty ratio) aquí es{' '}
                        <strong>referencia interna</strong>: tolerancia detectada en la plantilla ÷ U del patrón. No
                        constituye evaluación de aptitud ISO; depende de que la plantilla exprese tolerancia absoluta o
                        porcentual comparable.
                      </p>
                      {band != null && band > 0 ? (
                        <p>
                          Banda de tolerancia de referencia (desde plantilla): <span className="font-mono">{band}</span>
                        </p>
                      ) : (
                        <p className="text-amber-800">
                          No se detectó tolerancia absoluta ni porcentual en la plantilla; el cociente TUR no se calcula hasta definirla.
                        </p>
                      )}
                      <ul className="space-y-0.5 font-mono text-xs">
                        {selected.map(m => {
                          const u = m.incertidumbre_expandida
                          const tur = band != null && band > 0 && u != null && u > 0 ? band / u : null
                          return (
                            <li key={m.id}>
                              {m.codigo}: U={u ?? '—'} {m.incertidumbre_unidad ? m.incertidumbre_unidad : ''}
                              {tur != null ? ` → TUR≈${tur.toFixed(2)} (objetivo frecuente ≥ 4)` : ''}
                            </li>
                          )
                        })}
                      </ul>
                      {lowTur.length > 0 && (
                        <p className="text-amber-800 font-medium" role="status">
                          Aviso: patrón(es) con TUR bajo frente a la tolerancia de referencia — revise incertidumbre del certificado o la tolerancia operativa.
                        </p>
                      )}
                    </div>
                  )
                })()}
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

        const instKeyLocal = `${section.id}:${rep}`
        const codeRowLocal = instanceCodes[instKeyLocal]?.trim() || null
        const previewInputsLocal = [...(section.items ?? [])]
          .sort((a, b) => a.orden - b.orden)
          .filter(it => normalizeTemplateItem(it).item_role !== 'derivado')
          .filter(it => !(instrumento?.tipo === 'C' && it.tipo === 'referencia_equipo'))
          .map(item => {
            const key = mKey(section.id, rep, item.id)
            const mv = measurements[key] ?? {}
            return {
              item_id: item.id,
              valor_observado: mv.valor_observado ?? null,
              valor_booleano: mv.valor_booleano ?? null,
              valor_texto: mv.valor_texto ?? null,
              observacion: mv.observacion ?? null,
              instance_code: codeRowLocal ?? mv.instance_code ?? null,
            }
          })
        const { rows: previewRows, warnings: previewWarnings } = previewSectionMeasurements(
          section,
          rep,
          previewInputsLocal,
          headerNumericPayload ?? {},
        )
        const previewByItemId = new Map(previewRows.map(r => [r.item_id, r]))
        const sectionBlocked = missingSectionFormulaVariableNames(
          section,
          rep,
          previewInputsLocal,
          headerNumericPayload ?? {},
        ).length > 0

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

            {previewWarnings.length > 0 && (
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-900 space-y-0.5">
                {previewWarnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            )}

            <div className="px-5 py-4 space-y-3">
              {[...(section.items ?? [])]
                .sort((a, b) => a.orden - b.orden)
                .map(item => {
                  const key = mKey(section.id, rep, item.id)
                  return (
                    <ItemRow
                      key={item.id}
                      item={item}
                      value={measurements[key] ?? {}}
                      previewRow={previewByItemId.get(item.id) ?? null}
                      onChange={val => updateMeasurement(key, val)}
                      referenciaEquipoPatronesReadonly={
                        instrumento?.tipo === 'C' ? referenciaEquipoPatronesReadonly : undefined
                      }
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
                disabled={saving || sectionBlocked}
                title={sectionBlocked ? 'Complete las variables requeridas por las fórmulas de esta sección' : undefined}
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
