'use client'

import React, { useState, useEffect, useCallback, useMemo, useId } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Save, BookOpen, CheckCircle2,
  AlertTriangle, Loader2, ChevronDown, ChevronRight, GripVertical, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { cn } from '@/lib/utils'
import type {
  VerificacionTemplateDetalle,
  VerificacionTemplateSection,
  VerificacionTemplateItem,
  VerificacionTemplateHeaderField,
  VerificacionTemplateSnapshot,
  TipoItemVerificacion,
  PassFailRule,
} from '@/types/ema'
import { evaluateFormula, parseFormula, extractVariables } from '@/lib/ema/formula'
import { evaluatePassFailRule } from '@/lib/ema/passFail'
import { TemplateFicha } from '@/components/ema/TemplateFicha'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<TipoItemVerificacion, string> = {
  medicion: 'Medición',
  booleano: '¿Cumple?',
  numero: 'Número libre',
  texto: 'Texto libre',
  calculado: 'Calculado',
  referencia_equipo: 'Equipo ref.',
}

const TIPO_COLOR: Record<TipoItemVerificacion, string> = {
  medicion: 'bg-sky-50 text-sky-700 border-sky-200',
  booleano: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  numero: 'bg-violet-50 text-violet-700 border-violet-200',
  texto: 'bg-stone-50 text-stone-600 border-stone-200',
  calculado: 'bg-amber-50 text-amber-700 border-amber-200',
  referencia_equipo: 'bg-cyan-50 text-cyan-700 border-cyan-200',
}

/** Plantillas nuevas: no ofrecer `referencia_equipo` (legacy en snapshots; trazabilidad patrón = FK en verificación tipo C). */
const TIPO_ITEM_OPTIONS_EN_PLANTILLA = (Object.keys(TIPO_LABEL) as TipoItemVerificacion[]).filter(
  t => t !== 'referencia_equipo',
)

function tiposItemEnSelector(tipoActual: TipoItemVerificacion): TipoItemVerificacion[] {
  if (tipoActual === 'referencia_equipo') {
    return [...TIPO_ITEM_OPTIONS_EN_PLANTILLA, 'referencia_equipo']
  }
  return TIPO_ITEM_OPTIONS_EN_PLANTILLA
}

function TipoBadge({ tipo }: { tipo: TipoItemVerificacion }) {
  return (
    <span className={cn(
      'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
      TIPO_COLOR[tipo],
    )}>
      {TIPO_LABEL[tipo]}
    </span>
  )
}

/** Dry-run diff: borrador vs snapshot publicado (clave sección|orden|punto). */
function diffDraftVsPublishedSnapshot(
  draftSections: VerificacionTemplateSection[],
  publishedSections: VerificacionTemplateSnapshot['sections'] | undefined,
): string[] {
  if (!publishedSections?.length) return ['No hay secciones en la versión publicada.']

  const lines: string[] = []
  const pubByKey = new Map<string, { formula: string; rule: string }>()
  for (const sec of publishedSections) {
    for (const it of sec.items ?? []) {
      const key = `${(sec.titulo || '').trim()}|${it.orden}|${(it.punto || '').trim()}`
      pubByKey.set(key, {
        formula: (it.formula ?? '').trim(),
        rule: JSON.stringify(it.pass_fail_rule ?? null),
      })
    }
  }
  for (const sec of draftSections) {
    for (const it of sec.items ?? []) {
      const key = `${(sec.titulo || '').trim()}|${it.orden}|${(it.punto || '').trim()}`
      const p = pubByKey.get(key)
      const f = (it.formula ?? '').trim()
      const r = JSON.stringify(it.pass_fail_rule ?? null)
      if (!p) {
        lines.push(`+ «${it.punto}» (${sec.titulo || sec.id}): no existe igual en la versión publicada (o cambió título/orden/punto).`)
        continue
      }
      if (p.formula !== f) {
        lines.push(`~ «${it.punto}»: fórmula distinta entre borrador y publicada.`)
      }
      if (p.rule !== r) {
        lines.push(`~ «${it.punto}»: regla de cumplimiento distinta.`)
      }
    }
  }
  return lines.length ? lines : ['Sin diferencias detectadas en fórmula ni pass_fail_rule por punto (misma clave).']
}

// ─── Item Form ─────────────────────────────────────────────────────────────────

interface ItemFormState {
  tipo: TipoItemVerificacion
  punto: string
  valor_esperado: string
  tolerancia: string
  tolerancia_tipo: 'absoluta' | 'porcentual' | 'rango' | 'formula_bound'
  tolerancia_min: string
  tolerancia_max: string
  /** Límites por fórmula (min/max) — evaluados con scope cabecera + mediciones */
  formula_bound_min: string
  formula_bound_max: string
  unidad: string
  formula: string
  observacion_prompt: string
  /** Texto de regla de decisión / auditoría (se guarda en pass_fail_rule.decision_note) */
  decision_rule_text: string
  requerido: boolean
  variable_name: string
  contributes_to_cumple: boolean
  expected_bool_value: boolean
}

interface HeaderFieldFormState {
  field_key: string
  label: string
  source: 'instrumento' | 'manual'
}

function tipoToItemRole(tipo: TipoItemVerificacion): string {
  switch (tipo) {
    case 'medicion': return 'input_medicion'
    case 'booleano': return 'input_booleano'
    case 'numero': return 'input_numero'
    case 'texto': return 'input_texto'
    case 'calculado': return 'derivado'
    case 'referencia_equipo': return 'input_referencia'
    default: return 'input_texto'
  }
}

function tipoToPrimitive(tipo: TipoItemVerificacion): string {
  if (tipo === 'booleano') return 'booleano'
  if (tipo === 'texto' || tipo === 'referencia_equipo') return 'texto'
  return 'numero'
}

function defaultContributesForTipo(tipo: TipoItemVerificacion): boolean {
  return !['numero', 'texto', 'referencia_equipo'].includes(tipo)
}

function decisionNotePayload(f: ItemFormState): { decision_note?: string | null } {
  const t = f.decision_rule_text.trim()
  return t ? { decision_note: t } : {}
}

function buildPassFailRuleFromForm(f: ItemFormState): Record<string, unknown> {
  if (f.tipo === 'booleano') {
    return { kind: 'expected_bool', value: f.expected_bool_value, ...decisionNotePayload(f) }
  }
  if (f.tipo === 'medicion' || f.tipo === 'calculado') {
    if (f.tolerancia_tipo === 'formula_bound') {
      return {
        kind: 'formula_bound',
        min_formula: f.formula_bound_min.trim() || null,
        max_formula: f.formula_bound_max.trim() || null,
        unit: f.unidad.trim() || null,
        ...decisionNotePayload(f),
      }
    }
    if (f.tolerancia_tipo === 'rango') {
      return {
        kind: 'range',
        min: f.tolerancia_min !== '' ? parseFloat(f.tolerancia_min) : null,
        max: f.tolerancia_max !== '' ? parseFloat(f.tolerancia_max) : null,
        unit: f.unidad.trim() || null,
        ...decisionNotePayload(f),
      }
    }
    if (f.tolerancia_tipo === 'porcentual' && f.valor_esperado !== '') {
      return {
        kind: 'tolerance_pct',
        expected: parseFloat(f.valor_esperado),
        tolerance_pct: f.tolerancia !== '' ? parseFloat(f.tolerancia) : 0,
        unit: f.unidad.trim() || null,
        ...decisionNotePayload(f),
      }
    }
    if (f.valor_esperado !== '' && f.tolerancia !== '') {
      return {
        kind: 'tolerance_abs',
        expected: parseFloat(f.valor_esperado),
        tolerance: parseFloat(f.tolerancia),
        unit: f.unidad.trim() || null,
        ...decisionNotePayload(f),
      }
    }
  }
  return { kind: 'none' }
}

const emptyItemForm = (): ItemFormState => ({
  tipo: 'medicion',
  punto: '',
  valor_esperado: '',
  tolerancia: '',
  tolerancia_tipo: 'absoluta',
  tolerancia_min: '',
  tolerancia_max: '',
  formula_bound_min: '',
  formula_bound_max: '',
  unidad: '',
  formula: '',
  observacion_prompt: '',
  decision_rule_text: '',
  requerido: true,
  variable_name: '',
  contributes_to_cumple: true,
  expected_bool_value: true,
})

function itemFormToPayload(f: ItemFormState) {
  return {
    tipo: f.tipo,
    punto: f.punto.trim(),
    valor_esperado: f.valor_esperado !== '' ? parseFloat(f.valor_esperado) : null,
    tolerancia: f.tolerancia !== '' ? parseFloat(f.tolerancia) : null,
    tolerancia_tipo: f.tolerancia_tipo,
    tolerancia_min: f.tolerancia_min !== '' ? parseFloat(f.tolerancia_min) : null,
    tolerancia_max: f.tolerancia_max !== '' ? parseFloat(f.tolerancia_max) : null,
    unidad: f.unidad.trim() || null,
    formula: f.formula.trim() || null,
    observacion_prompt: f.observacion_prompt.trim() || null,
    requerido: f.requerido,
    primitive: tipoToPrimitive(f.tipo),
    item_role: tipoToItemRole(f.tipo),
    variable_name: f.variable_name.trim() || null,
    pass_fail_rule: buildPassFailRuleFromForm(f),
    contributes_to_cumple: f.contributes_to_cumple,
  }
}

function itemToForm(item: VerificacionTemplateItem): ItemFormState {
  const pr = item.pass_fail_rule as { kind?: string; value?: boolean; decision_note?: string | null } | undefined
  const decision_rule_text =
    pr && 'decision_note' in pr && pr.decision_note ? String(pr.decision_note) : ''
  const base: ItemFormState = {
    tipo: item.tipo,
    punto: item.punto,
    valor_esperado: item.valor_esperado != null ? String(item.valor_esperado) : '',
    tolerancia: item.tolerancia != null ? String(item.tolerancia) : '',
    tolerancia_tipo: item.tolerancia_tipo as ItemFormState['tolerancia_tipo'],
    tolerancia_min: item.tolerancia_min != null ? String(item.tolerancia_min) : '',
    tolerancia_max: item.tolerancia_max != null ? String(item.tolerancia_max) : '',
    formula_bound_min: '',
    formula_bound_max: '',
    unidad: item.unidad ?? '',
    formula: item.formula ?? '',
    observacion_prompt: item.observacion_prompt ?? '',
    decision_rule_text,
    requerido: item.requerido,
    variable_name: item.variable_name ?? '',
    contributes_to_cumple: item.contributes_to_cumple ?? defaultContributesForTipo(item.tipo),
    expected_bool_value: pr?.kind === 'expected_bool' ? !!pr.value : true,
  }
  if (item.tipo !== 'calculado' || !item.pass_fail_rule) {
    if (item.tipo === 'medicion' && item.pass_fail_rule) {
      const rm = item.pass_fail_rule as {
        kind: string
        min_formula?: string | null
        max_formula?: string | null
        decision_note?: string | null
      }
      if (rm.kind === 'formula_bound') {
        return {
          ...base,
          tolerancia_tipo: 'formula_bound',
          formula_bound_min: rm.min_formula ?? '',
          formula_bound_max: rm.max_formula ?? '',
          decision_rule_text: rm.decision_note ? String(rm.decision_note) : base.decision_rule_text,
        }
      }
    }
    return base
  }
  const r = item.pass_fail_rule as {
    kind: string
    expected?: number
    tolerance?: number
    tolerance_pct?: number
    min?: number | null
    max?: number | null
    unit?: string | null
    min_formula?: string | null
    max_formula?: string | null
    decision_note?: string | null
  }
  if (r.kind === 'tolerance_abs' && r.expected != null && r.tolerance != null) {
    return {
      ...base,
      valor_esperado: String(r.expected),
      tolerancia: String(r.tolerance),
      tolerancia_tipo: 'absoluta',
      tolerancia_min: '',
      tolerancia_max: '',
      unidad: r.unit ?? base.unidad,
      decision_rule_text: r.decision_note ? String(r.decision_note) : base.decision_rule_text,
    }
  }
  if (r.kind === 'tolerance_pct' && r.expected != null && r.tolerance_pct != null) {
    return {
      ...base,
      valor_esperado: String(r.expected),
      tolerancia: String(r.tolerance_pct),
      tolerancia_tipo: 'porcentual',
      tolerancia_min: '',
      tolerancia_max: '',
      unidad: r.unit ?? base.unidad,
      decision_rule_text: r.decision_note ? String(r.decision_note) : base.decision_rule_text,
    }
  }
  if (r.kind === 'range') {
    return {
      ...base,
      tolerancia_tipo: 'rango',
      tolerancia_min: r.min != null ? String(r.min) : '',
      tolerancia_max: r.max != null ? String(r.max) : '',
      unidad: r.unit ?? base.unidad,
      decision_rule_text: r.decision_note ? String(r.decision_note) : base.decision_rule_text,
    }
  }
  if (r.kind === 'formula_bound') {
    return {
      ...base,
      tolerancia_tipo: 'formula_bound',
      formula_bound_min: r.min_formula ?? '',
      formula_bound_max: r.max_formula ?? '',
      unidad: r.unit ?? base.unidad,
      decision_rule_text: r.decision_note ? String(r.decision_note) : base.decision_rule_text,
    }
  }
  return base
}

function headerFieldToForm(field: VerificacionTemplateHeaderField): HeaderFieldFormState {
  return {
    field_key: field.field_key,
    label: field.label,
    source: field.source === 'instrumento' ? 'instrumento' : 'manual',
  }
}

function FormulaAuthoringPlayground({
  formula,
  rule,
  variableNames,
}: {
  formula: string
  rule: PassFailRule | Record<string, unknown> | null
  variableNames: string[]
}) {
  const varsInFormula = useMemo(() => {
    if (!formula.trim()) return variableNames
    try {
      const used = extractVariables(parseFormula(formula))
      const ordered = variableNames.filter(v => used.has(v))
      return ordered.length ? ordered : Array.from(used).sort()
    } catch {
      return variableNames
    }
  }, [formula, variableNames])

  const [vals, setVals] = useState<Record<string, string>>({})
  useEffect(() => {
    setVals(prev => {
      const next = { ...prev }
      for (const v of varsInFormula) {
        if (next[v] === undefined) next[v] = ''
      }
      return next
    })
  }, [varsInFormula.join(',')])

  const scope = useMemo(() => {
    const s: Record<string, number> = {}
    for (const v of varsInFormula) {
      const n = parseFloat(vals[v] ?? '')
      if (!Number.isNaN(n)) s[v] = n
    }
    return s
  }, [varsInFormula, vals])

  const evaluated = useMemo(() => {
    if (!formula.trim()) return { n: null as number | null, err: null as string | null }
    try {
      return { n: evaluateFormula(parseFormula(formula), scope), err: null }
    } catch (e: unknown) {
      return { n: null, err: e instanceof Error ? e.message : String(e) }
    }
  }, [formula, scope])

  const cumple = useMemo(() => {
    if (evaluated.err || !rule || (rule as { kind?: string }).kind === 'none') return null
    return evaluatePassFailRule(rule as PassFailRule, {
      valor_observado: evaluated.n,
      valor_booleano: null,
      scope,
    })
  }, [evaluated.err, evaluated.n, rule, scope])

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2.5 space-y-2 text-xs">
      <p className="font-medium text-stone-600">Valores de prueba</p>
      <p className="text-[11px] text-stone-500 leading-snug">
        Opcional: compruebe el resultado y el cumplimiento antes de guardar.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {varsInFormula.map(v => (
          <div key={v} className="space-y-0.5">
            <Label className="text-[10px] text-stone-500 font-mono">{v}</Label>
            <Input
              className="h-8 text-xs font-mono border-stone-200"
              value={vals[v] ?? ''}
              onChange={e => setVals(p => ({ ...p, [v]: e.target.value }))}
              placeholder="0"
            />
          </div>
        ))}
      </div>
      {evaluated.err && <p className="text-red-600">{evaluated.err}</p>}
      {!evaluated.err && evaluated.n != null && (
        <p className="font-mono text-stone-800">
          Resultado: <strong>{evaluated.n}</strong>
        </p>
      )}
      {cumple !== null && evaluated.n != null && (
        <p className={cn('font-semibold', cumple ? 'text-emerald-700' : 'text-red-700')}>
          {cumple ? 'Cumpliría (simulación)' : 'No cumpliría (simulación)'}
        </p>
      )}
    </div>
  )
}

function ItemForm({
  form, onChange, availableVariables = [],
}: {
  form: ItemFormState
  onChange: (f: ItemFormState) => void
  availableVariables?: string[]
}) {
  const formulaInputId = useId()
  const set = (k: keyof ItemFormState, v: any) => onChange({ ...form, [k]: v })
  const isMedicion = form.tipo === 'medicion'
  const isRango = form.tolerancia_tipo === 'rango'
  const isFormulaBound = form.tolerancia_tipo === 'formula_bound'
  const isCalculado = form.tipo === 'calculado'

  const renderToleranceGrid = (valorEsperadoLabel: string) => (
    <>
      {!isFormulaBound && (
        <div className="space-y-1">
          <Label className="text-[10px] text-stone-500 uppercase tracking-wide">{valorEsperadoLabel}</Label>
          <Input type="number" step="any" value={form.valor_esperado}
            onChange={e => set('valor_esperado', e.target.value)}
            placeholder="0" className="border-stone-200 text-sm font-mono" />
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Unidad</Label>
        <Input value={form.unidad} onChange={e => set('unidad', e.target.value)}
          placeholder="mm, gr, kg…" className="border-stone-200 text-sm font-mono" />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Tipo tolerancia / límite</Label>
        <select value={form.tolerancia_tipo}
          onChange={e => set('tolerancia_tipo', e.target.value as ItemFormState['tolerancia_tipo'])}
          className="w-full rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm focus:outline-none">
          <option value="absoluta">Absoluta (±)</option>
          <option value="porcentual">Porcentual (%)</option>
          <option value="rango">Rango (mín–máx)</option>
          <option value="formula_bound">Límites por fórmula (avanzado)</option>
        </select>
      </div>
      {isFormulaBound ? (
        <>
          <div className="space-y-1 col-span-2">
            <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Límite inferior (fórmula, opcional)</Label>
            <Input value={form.formula_bound_min}
              onChange={e => set('formula_bound_min', e.target.value)}
              placeholder="ej. carga * 0.95"
              className="border-stone-200 text-sm font-mono" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Límite superior (fórmula, opcional)</Label>
            <Input value={form.formula_bound_max}
              onChange={e => set('formula_bound_max', e.target.value)}
              placeholder="ej. carga * 1.05"
              className="border-stone-200 text-sm font-mono" />
          </div>
          <p className="col-span-2 text-[11px] text-stone-500 leading-relaxed">
            Al menos uno de los dos límites debe existir. Las fórmulas usan variables de cabecera y de la misma sección.
          </p>
        </>
      ) : !isRango ? (
        <div className="space-y-1">
          <Label className="text-[10px] text-stone-500 uppercase tracking-wide">
            Tolerancia {form.tolerancia_tipo === 'porcentual' ? '(%)' : `(${form.unidad || 'unidad'})`}
          </Label>
          <Input type="number" step="any" value={form.tolerancia}
            onChange={e => set('tolerancia', e.target.value)}
            placeholder="0" className="border-stone-200 text-sm font-mono" />
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Mínimo</Label>
            <Input type="number" step="any" value={form.tolerancia_min}
              onChange={e => set('tolerancia_min', e.target.value)}
              placeholder="0" className="border-stone-200 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Máximo</Label>
            <Input type="number" step="any" value={form.tolerancia_max}
              onChange={e => set('tolerancia_max', e.target.value)}
              placeholder="0" className="border-stone-200 text-sm font-mono" />
          </div>
        </>
      )}
    </>
  )

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1 col-span-2">
        <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Tipo</Label>
        <select
          value={form.tipo}
          onChange={e => {
            const t = e.target.value as TipoItemVerificacion
            onChange({
              ...form,
              tipo: t,
              contributes_to_cumple: defaultContributesForTipo(t),
            })
          }}
          className="w-full rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {tiposItemEnSelector(form.tipo).map(t => (
            <option key={t} value={t}>{TIPO_LABEL[t]}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1 col-span-2">
        <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Punto de verificación *</Label>
        <Input
          value={form.punto}
          onChange={e => set('punto', e.target.value)}
          placeholder="Ej. Longitud, Diámetro superior, ¿Cono completo?"
          className="border-stone-200 text-sm"
        />
      </div>

      <div className="space-y-1 col-span-2">
        <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Nombre de variable (fórmulas)</Label>
        <Input
          value={form.variable_name}
          onChange={e => set('variable_name', e.target.value)}
          placeholder="d1, lectura, capacidad_real…"
          className="border-stone-200 text-sm font-mono"
        />
      </div>

      {form.tipo === 'booleano' && (
        <div className="space-y-1 col-span-2">
          <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Respuesta esperada para «Cumple»</Label>
          <div className="flex gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" checked={form.expected_bool_value} onChange={() => set('expected_bool_value', true)} />
              Sí
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" checked={!form.expected_bool_value} onChange={() => set('expected_bool_value', false)} />
              No
            </label>
          </div>
        </div>
      )}

      {isMedicion && (
        <div className="col-span-2 grid grid-cols-2 gap-3">
          {renderToleranceGrid('Valor esperado')}
        </div>
      )}

      {isCalculado && (
        <div className="col-span-2 rounded-xl border border-stone-200 bg-white p-4 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Expresión del punto calculado</Label>
              <p className="text-xs text-stone-500 leading-relaxed max-w-prose">
                Use los mismos nombres de variable que en los demás puntos de <span className="font-medium text-stone-700">esta sección</span>.
                Ej.: <span className="font-mono text-stone-700">avg(d1, d2)</span>,{' '}
                <span className="font-mono text-stone-700">(d1 + d2) / 2</span>.
              </p>
            </div>
            {availableVariables.length > 0 && (
              <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600 tabular-nums">
                {availableVariables.length} variable{availableVariables.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {availableVariables.length === 0 ? (
            <p className="text-xs text-stone-500 rounded-md border border-dashed border-stone-200 bg-stone-50/80 px-3 py-2.5">
              Añada primero puntos de medición o numéricos con nombre de variable; luego podrá referenciarlos aquí.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <span className="text-[10px] font-medium text-stone-500 uppercase tracking-wide">Insertar en la fórmula</span>
                <div className="flex flex-wrap gap-1.5">
                  {availableVariables.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set('formula', `${form.formula}${form.formula ? ' ' : ''}${v}`)}
                      className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1 font-mono text-[11px] text-stone-800 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-900"
                      title={`Insertar ${v}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {availableVariables.length >= 2 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-medium text-stone-500 uppercase tracking-wide">Plantillas rápidas</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-50"
                      onClick={() => {
                        const v0 = availableVariables[0]
                        const v1 = availableVariables[1]
                        set('formula', `avg(${v0}, ${v1})`)
                        if (!form.variable_name.trim()) set('variable_name', `avg_${v0}_${v1}`)
                      }}
                    >
                      Promedio de <span className="font-mono">{availableVariables[0]}</span> y{' '}
                      <span className="font-mono">{availableVariables[1]}</span>
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-50"
                      onClick={() => {
                        const v0 = availableVariables[0]
                        const v1 = availableVariables[1]
                        set('formula', `abs(${v0} - ${v1})`)
                        if (!form.variable_name.trim()) set('variable_name', `diff_${v0}_${v1}`)
                      }}
                    >
                      Diferencia |<span className="font-mono">{availableVariables[0]}</span> −{' '}
                      <span className="font-mono">{availableVariables[1]}</span>|
                    </button>
                    {availableVariables.length >= 3 && (
                      <button
                        type="button"
                        className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-50"
                        onClick={() => {
                          const [a, b, c] = availableVariables
                          set('formula', `avg(${a}, ${b}, ${c})`)
                          if (!form.variable_name.trim()) set('variable_name', `avg_${a}_${b}_${c}`)
                        }}
                      >
                        Promedio de tres
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="space-y-1">
            <Label htmlFor={formulaInputId} className="text-[10px] text-stone-500 uppercase tracking-wide">
              Fórmula
            </Label>
            <Input
              id={formulaInputId}
              value={form.formula}
              onChange={e => set('formula', e.target.value)}
              placeholder="avg(d1, d2)"
              className="border-stone-200 bg-white text-sm font-mono focus-visible:ring-emerald-500/30"
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-stone-200 bg-stone-50/80 px-3 py-2.5 text-left text-xs font-medium text-stone-700 outline-none transition-colors hover:bg-stone-100/80 hover:border-stone-300">
              <span>Vista previa y prueba con valores</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-stone-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden">
              <div className="pt-2">
                <FormulaAuthoringPlayground
                  formula={form.formula}
                  rule={buildPassFailRuleFromForm(form) as PassFailRule}
                  variableNames={availableVariables}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <details className="rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-700">
            <summary className="cursor-pointer font-medium text-stone-800 outline-none select-none">
              Referencia: operadores y funciones
            </summary>
            <div className="mt-2 space-y-2 leading-relaxed text-stone-600">
              <p>
                <span className="font-semibold text-stone-700">Operadores:</span>{' '}
                <span className="font-mono text-stone-800">+ - * / ^</span> (potencia), comparaciones{' '}
                <span className="font-mono text-stone-800">&lt; &gt; &lt;= &gt;= == !=</span>.
              </p>
              <p>
                <span className="font-semibold text-stone-700">Funciones:</span>{' '}
                <span className="font-mono text-stone-800">abs</span>,{' '}
                <span className="font-mono text-stone-800">min(a,b,...)</span>,{' '}
                <span className="font-mono text-stone-800">max(...)</span>,{' '}
                <span className="font-mono text-stone-800">avg(...)</span>,{' '}
                <span className="font-mono text-stone-800">sum(...)</span>,{' '}
                <span className="font-mono text-stone-800">round(x)</span>,{' '}
                <span className="font-mono text-stone-800">sqrt(x)</span>, constante{' '}
                <span className="font-mono text-stone-800">pi</span>.
              </p>
              <p>
                Los nombres deben coincidir con los puntos de la sección. En <span className="font-mono">avg</span> /{' '}
                <span className="font-mono">min</span>, argumentos entre paréntesis y separados por coma.
              </p>
            </div>
          </details>
        </div>
      )}

      {isCalculado && (
        <div className="col-span-2 space-y-2 rounded-xl border border-stone-200 bg-stone-50/80 p-3">
          <div>
            <Label className="text-[10px] text-stone-600 uppercase tracking-wide">Cumplimiento del resultado calculado</Label>
            <p className="mt-1 text-xs text-stone-500 leading-relaxed">
              Mismo criterio que una medición: objetivo y tolerancia sobre el valor que arroja la fórmula.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {renderToleranceGrid('Objetivo del resultado')}
          </div>
        </div>
      )}

      {(isMedicion || isCalculado) && form.contributes_to_cumple && (
        <div className="space-y-1 col-span-2">
          <Label className="text-[10px] text-stone-500 uppercase tracking-wide">
            Regla de decisión / nota ISO (opcional)
          </Label>
          <Textarea
            value={form.decision_rule_text}
            onChange={e => set('decision_rule_text', e.target.value)}
            placeholder="Texto para auditoría: cómo se interpreta el cumplimiento, zona de guarda, etc."
            rows={2}
            className="border-stone-200 text-xs resize-none"
          />
        </div>
      )}

      <div className="space-y-1 col-span-2">
        <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Instrucción / prompt (opcional)</Label>
        <Input value={form.observacion_prompt}
          onChange={e => set('observacion_prompt', e.target.value)}
          placeholder="Ej. Medir en el punto central, en mm"
          className="border-stone-200 text-sm" />
      </div>

      <div className="col-span-2 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <input type="checkbox" id="req-chk" checked={form.requerido}
            onChange={e => set('requerido', e.target.checked)} className="h-3.5 w-3.5" />
          <label htmlFor="req-chk" className="text-xs text-stone-600">Requerido</label>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="ctc-chk" checked={form.contributes_to_cumple}
            onChange={e => set('contributes_to_cumple', e.target.checked)} className="h-3.5 w-3.5" />
          <label htmlFor="ctc-chk" className="text-xs text-stone-600">Cuenta para resultado global</label>
        </div>
      </div>
    </div>
  )
}

// ─── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({
  section, templateId, onUpdated, onDeleted,
}: {
  section: VerificacionTemplateSection & { items: VerificacionTemplateItem[] }
  templateId: string
  onUpdated: (s: VerificacionTemplateSection & { items: VerificacionTemplateItem[] }) => void
  onDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [addingItem, setAddingItem] = useState(false)
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm())
  const [savingItem, setSavingItem] = useState(false)
  const [itemErr, setItemErr] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ItemFormState>(emptyItemForm())

  async function handleAddItem() {
    if (!itemForm.punto.trim()) { setItemErr('El punto es requerido'); return }
    setSavingItem(true)
    setItemErr(null)
    try {
      const res = await fetch(`/api/ema/templates/${templateId}/sections/${section.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemFormToPayload(itemForm)),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      const j = await res.json()
      onUpdated({ ...section, items: [...section.items, j.data] })
      setItemForm(emptyItemForm())
      setAddingItem(false)
    } catch (e: any) { setItemErr(e.message) }
    finally { setSavingItem(false) }
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm('¿Eliminar este punto de verificación?')) return
    const res = await fetch(
      `/api/ema/templates/${templateId}/sections/${section.id}/items/${itemId}`,
      { method: 'DELETE' }
    )
    if (res.ok) onUpdated({ ...section, items: section.items.filter(i => i.id !== itemId) })
  }

  async function handleSaveItem(itemId: string) {
    if (!editForm.punto.trim()) return
    setSavingItem(true)
    try {
      const res = await fetch(
        `/api/ema/templates/${templateId}/sections/${section.id}/items/${itemId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemFormToPayload(editForm)) }
      )
      if (!res.ok) throw new Error((await res.json()).error)
      const j = await res.json()
      onUpdated({ ...section, items: section.items.map(i => i.id === itemId ? j.data : i) })
      setEditingItem(null)
    } catch (e: any) { setItemErr(e.message) }
    finally { setSavingItem(false) }
  }

  async function handleDeleteSection() {
    if (!confirm(`¿Eliminar la sección "${section.titulo}" y todos sus puntos?`)) return
    const res = await fetch(`/api/ema/templates/${templateId}/sections/${section.id}`, { method: 'DELETE' })
    if (res.ok) onDeleted(section.id)
  }

  const formulaVariables = section.items
    .filter(i => i.tipo !== 'calculado' && i.variable_name?.trim())
    .map(i => i.variable_name!.trim())
    .filter((v, idx, arr) => arr.indexOf(v) === idx)

  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Section header */}
      <div className="flex items-start gap-3 border-b border-stone-100 bg-white px-4 py-4 sm:px-5">
        <GripVertical className="mt-1 h-4 w-4 text-stone-300 shrink-0" />
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="group flex-1 text-left"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {expanded
                  ? <ChevronDown className="h-3.5 w-3.5 text-stone-400 shrink-0 transition-colors group-hover:text-stone-700" />
                  : <ChevronRight className="h-3.5 w-3.5 text-stone-400 shrink-0 transition-colors group-hover:text-stone-700" />
                }
                <span className="text-base font-semibold tracking-tight text-stone-900">{section.titulo}</span>
              </div>
              {section.descripcion && (
                <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-500">{section.descripcion}</p>
              )}
            </div>
            <span className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-500">
              {section.items.length} punto{section.items.length !== 1 ? 's' : ''}
            </span>
          </div>
        </button>
        <button
          type="button"
          onClick={handleDeleteSection}
          className="rounded-lg p-1.5 text-stone-300 transition-colors hover:bg-red-50 hover:text-red-500"
          title="Eliminar sección"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="divide-y divide-stone-100 bg-stone-50/40">
          {/* Items table */}
          {section.items.length > 0 && (
            <div className="overflow-x-auto bg-white">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50/70">
                    <th className="text-left px-5 py-2.5 font-semibold text-stone-400 uppercase tracking-wide w-10">#</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-stone-400 uppercase tracking-wide">Punto</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-stone-400 uppercase tracking-wide">Tipo</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-stone-400 uppercase tracking-wide">Variable</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-stone-400 uppercase tracking-wide">Criterio</th>
                    <th className="w-16 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                {section.items.map((item, idx) => (
                  editingItem === item.id ? (
                    <tr key={item.id}>
                      <td colSpan={6} className="px-5 py-4">
                        <div className="space-y-3">
                          <ItemForm form={editForm} onChange={setEditForm} availableVariables={formulaVariables} />
                          {itemErr && <p className="text-xs text-red-600">{itemErr}</p>}
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => { setEditingItem(null); setItemErr(null) }}>
                              Cancelar
                            </Button>
                            <Button size="sm" className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                              onClick={() => handleSaveItem(item.id)} disabled={savingItem}>
                              {savingItem ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              Guardar
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id} className="cursor-pointer bg-white transition-colors hover:bg-emerald-50/30"
                      onClick={() => { setEditingItem(item.id); setEditForm(itemToForm(item)); setItemErr(null) }}>
                      <td className="px-5 py-3 text-stone-400 font-mono">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-800">{item.punto}</p>
                        {item.observacion_prompt && (
                          <p className="mt-0.5 max-w-sm truncate text-[11px] text-stone-500">{item.observacion_prompt}</p>
                        )}
                      </td>
                      <td className="px-4 py-2"><TipoBadge tipo={item.tipo} /></td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-stone-100 px-2 py-1 font-mono text-[11px] text-stone-600">
                          {item.variable_name || 'sin_variable'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-stone-600">
                        {item.tipo === 'medicion' && item.valor_esperado != null
                          ? `${item.valor_esperado}${item.unidad ? ` ${item.unidad}` : ''}${item.tolerancia != null ? ` ± ${item.tolerancia}` : ''}${item.tolerancia_tipo === 'rango' ? ` [${item.tolerancia_min ?? '?'}–${item.tolerancia_max ?? '?'}]` : ''}`
                          : item.tipo === 'calculado' && item.formula
                          ? item.formula
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button"
                          onClick={e => { e.stopPropagation(); handleDeleteItem(item.id) }}
                          className="p-1 rounded-md text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  )
                ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add item form */}
          {addingItem ? (
            <div className="px-4 py-4 bg-emerald-50/30 space-y-3">
              <p className="text-xs font-semibold text-stone-600">Nuevo punto de verificación</p>
              <ItemForm form={itemForm} onChange={setItemForm} availableVariables={formulaVariables} />
              {itemErr && <p className="text-xs text-red-600">{itemErr}</p>}
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => { setAddingItem(false); setItemErr(null); setItemForm(emptyItemForm()) }}>
                  Cancelar
                </Button>
                <Button size="sm" className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                  onClick={handleAddItem} disabled={savingItem}>
                  {savingItem ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Agregar punto
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-2">
              <button
                type="button"
                onClick={() => setAddingItem(true)}
                className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-medium py-1"
              >
                <Plus className="h-3 w-3" /> Agregar punto de verificación
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Type for the chooser ──────────────────────────────────────────────────────
interface PlantillaSummary {
  id: string; codigo: string; nombre: string; norma_referencia: string | null
  estado: string; active_version: { version_number: number } | null; items_count: number
}

export default function PlantillaPage() {
  const { id: conjuntoId } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateParamId = searchParams.get('template')

  const [template, setTemplate] = useState<VerificacionTemplateDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conjuntoNombre, setConjuntoNombre] = useState('Conjunto')

  // Multi-template chooser (when ?template= absent and >1 exist)
  const [chooserList, setChooserList] = useState<PlantillaSummary[]>([])

  // Create template form (when none exists)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ codigo: '', nombre: '', norma_referencia: '' })
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [createSaving, setCreateSaving] = useState(false)

  // Add section form
  const [addingSection, setAddingSection] = useState(false)
  const [sectionForm, setSectionForm] = useState({ titulo: '', descripcion: '' })
  const [sectionErr, setSectionErr] = useState<string | null>(null)
  const [sectionSaving, setSectionSaving] = useState(false)

  // Publish
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)
  const [diffVsPublishedOpen, setDiffVsPublishedOpen] = useState(false)
  const [diffVsPublishedLines, setDiffVsPublishedLines] = useState<string[]>([])
  const [diffVsPublishedLoading, setDiffVsPublishedLoading] = useState(false)

  // Header fields (ficha metadata)
  const [headerFieldForm, setHeaderFieldForm] = useState<HeaderFieldFormState>({
    field_key: '',
    label: '',
    source: 'manual',
  })
  const [editingHeaderField, setEditingHeaderField] = useState<string | null>(null)
  const [headerEditForm, setHeaderEditForm] = useState<HeaderFieldFormState>({
    field_key: '',
    label: '',
    source: 'manual',
  })
  const [headerSaving, setHeaderSaving] = useState(false)
  const [headerErr, setHeaderErr] = useState<string | null>(null)

  /** Dry-run publish validation (cabecera, fórmulas, cumplimiento). */
  const [readiness, setReadiness] = useState<{ ok: boolean; errors: string[] } | null>(null)
  const [readinessBusy, setReadinessBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setChooserList([])
    setReadiness(null)
    try {
      // Load conjunto name
      const cRes = await fetch(`/api/ema/conjuntos/${conjuntoId}`)
      const cj = cRes.ok ? (await cRes.json()).data : null
      setConjuntoNombre(cj?.nombre_conjunto ?? 'Conjunto')

      // Fetch all templates for this conjunto (array)
      const tRes = await fetch(`/api/ema/conjuntos/${conjuntoId}/templates`)
      const tj = await tRes.json()
      const list: PlantillaSummary[] = Array.isArray(tj.data) ? tj.data : (tj.data ? [tj.data] : [])

      if (list.length === 0) {
        // No templates yet → show create form with auto-generated code
        const allRes = await fetch('/api/ema/templates/count')
        const total = (await allRes.json().catch(() => ({ count: 6 }))).count ?? 6
        const nextNum = String(total + 1).padStart(2, '0')
        setCreateForm(f => ({ ...f, codigo: `DC-LC-6.4-${nextNum}`, nombre: cj?.nombre_conjunto ?? '' }))
        setTemplate(null)
        setReadiness(null)
        setLoading(false)
        return
      }

      // Determine which template to open
      let targetId: string | null = templateParamId

      if (!targetId) {
        if (list.length === 1) {
          targetId = list[0].id
        } else {
          // Multiple templates, no ?template= param → show chooser
          setChooserList(list)
          setTemplate(null)
          setReadiness(null)
          setLoading(false)
          return
        }
      }

      // Load full detail for the target template
      const dRes = await fetch(`/api/ema/templates/${targetId}`)
      if (!dRes.ok) { setError('Plantilla no encontrada'); setReadiness(null); setLoading(false); return }
      const dj = await dRes.json()
      const detail = dj.data as VerificacionTemplateDetalle | null
      setTemplate(detail)
      if (detail?.id) {
        const vRes = await fetch(`/api/ema/templates/${detail.id}/validate`, { method: 'POST' })
        const vJ = await vRes.json().catch(() => ({}))
        setReadiness({
          ok: !!vJ.ok,
          errors: Array.isArray(vJ.errors)
            ? vJ.errors
            : vJ.error
              ? [String(vJ.error)]
              : vRes.ok
                ? []
                : ['No se pudo validar la plantilla'],
        })
      } else {
        setReadiness(null)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [conjuntoId, templateParamId])

  const refreshReadiness = useCallback(async (templateId: string) => {
    setReadinessBusy(true)
    try {
      const vRes = await fetch(`/api/ema/templates/${templateId}/validate`, { method: 'POST' })
      const vJ = await vRes.json().catch(() => ({}))
      setReadiness({
        ok: !!vJ.ok,
        errors: Array.isArray(vJ.errors)
          ? vJ.errors
          : vJ.error
            ? [String(vJ.error)]
            : vRes.ok
              ? []
              : ['No se pudo validar la plantilla'],
      })
    } finally {
      setReadinessBusy(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.nombre.trim()) { setCreateErr('El nombre es requerido'); return }
    setCreateSaving(true)
    setCreateErr(null)
    try {
      const res = await fetch(`/api/ema/conjuntos/${conjuntoId}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: createForm.codigo.trim(),
          nombre: createForm.nombre.trim(),
          norma_referencia: createForm.norma_referencia.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      await load()
    } catch (e: any) { setCreateErr(e.message) }
    finally { setCreateSaving(false) }
  }

  async function handleAddSection() {
    if (!template) return
    if (!sectionForm.titulo.trim()) { setSectionErr('El título es requerido'); return }
    setSectionSaving(true)
    setSectionErr(null)
    try {
      const res = await fetch(`/api/ema/templates/${template.id}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: sectionForm.titulo.trim(),
          descripcion: sectionForm.descripcion.trim() || null,
          repetible: false,
          repeticiones_default: 1,
          layout: 'linear',
          instances_config: {},
          series_config: {},
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const j = await res.json()
      setTemplate(t => t ? { ...t, sections: [...t.sections, j.data] } : t)
      setSectionForm({ titulo: '', descripcion: '' })
      setAddingSection(false)
      void refreshReadiness(template.id)
    } catch (e: any) { setSectionErr(e.message) }
    finally { setSectionSaving(false) }
  }

  async function handleAddHeaderField(e: React.FormEvent) {
    e.preventDefault()
    if (!template) return
    if (!headerFieldForm.field_key.trim() || !headerFieldForm.label.trim()) {
      setHeaderErr('Clave y etiqueta son requeridos')
      return
    }
    setHeaderSaving(true)
    setHeaderErr(null)
    try {
      const res = await fetch(`/api/ema/templates/${template.id}/header-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_key: headerFieldForm.field_key.trim(),
          label: headerFieldForm.label.trim(),
          source: headerFieldForm.source,
          variable_name: headerFieldForm.field_key.trim(),
          formula: null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setHeaderFieldForm({ field_key: '', label: '', source: 'manual' })
      await load()
    } catch (err: any) {
      setHeaderErr(err.message)
    } finally {
      setHeaderSaving(false)
    }
  }

  async function handleSaveHeaderField(fieldId: string) {
    if (!template) return
    if (!headerEditForm.field_key.trim() || !headerEditForm.label.trim()) {
      setHeaderErr('Clave y etiqueta son requeridos')
      return
    }
    setHeaderSaving(true)
    setHeaderErr(null)
    try {
      const res = await fetch(`/api/ema/templates/${template.id}/header-fields/${fieldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_key: headerEditForm.field_key.trim(),
          label: headerEditForm.label.trim(),
          source: headerEditForm.source,
          variable_name: headerEditForm.field_key.trim(),
          formula: null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setEditingHeaderField(null)
      await load()
    } catch (err: any) {
      setHeaderErr(err.message)
    } finally {
      setHeaderSaving(false)
    }
  }

  async function handleDeleteHeaderField(fieldId: string) {
    if (!template) return
    if (!confirm('¿Eliminar este campo de cabecera?')) return
    setHeaderSaving(true)
    setHeaderErr(null)
    try {
      const res = await fetch(`/api/ema/templates/${template.id}/header-fields/${fieldId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      if (editingHeaderField === fieldId) setEditingHeaderField(null)
      await load()
    } catch (err: any) {
      setHeaderErr(err.message)
    } finally {
      setHeaderSaving(false)
    }
  }

  async function handlePublish() {
    if (!template) return
    setPublishing(true)
    setPublishMsg(null)
    try {
      const valRes = await fetch(`/api/ema/templates/${template.id}/validate`, { method: 'POST' })
      const valJ = await valRes.json().catch(() => ({}))
      if (!valJ.ok) {
        setPublishMsg(`Error validación: ${(valJ.errors ?? []).join('; ') || valJ.error || 'revisar plantilla'}`)
        setPublishing(false)
        return
      }

      const res = await fetch(`/api/ema/templates/${template.id}/publish`, { method: 'POST' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      setPublishMsg(`Versión ${j.data.version.version_number} publicada correctamente`)
      await load()
    } catch (e: any) { setPublishMsg(`Error: ${e.message}`) }
    finally { setPublishing(false) }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 max-w-4xl">
        <div className="h-4 w-48 bg-stone-200 rounded animate-pulse" />
        <div className="h-96 rounded-lg bg-stone-100 animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
    )
  }

  // ── Multi-template chooser (>1 exist, no ?template= param)
  if (chooserList.length > 1 && !template) {
    return (
      <div className="flex flex-col gap-5 max-w-3xl">
        <EmaBreadcrumb items={[
          { label: 'Conjuntos', href: '/quality/conjuntos' },
          { label: conjuntoNombre, href: `/quality/conjuntos/${conjuntoId}` },
          { label: 'Plantillas' },
        ]} />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={`/quality/conjuntos/${conjuntoId}`}
              className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold text-stone-900">Plantillas de verificación</h1>
          </div>
          <Button
            size="sm"
            className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-4 w-4" /> Nueva plantilla
          </Button>
        </div>

        {creating && (
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Código</Label>
                <Input value={createForm.codigo}
                  onChange={e => setCreateForm(f => ({ ...f, codigo: e.target.value }))}
                  placeholder="DC-LC-6.4-NN" className="border-stone-200 text-sm font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Nombre *</Label>
                <Input value={createForm.nombre}
                  onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))}
                  className="border-stone-200 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">Norma de referencia</Label>
                <Input value={createForm.norma_referencia}
                  onChange={e => setCreateForm(f => ({ ...f, norma_referencia: e.target.value }))}
                  className="border-stone-200 text-sm" />
              </div>
              {createErr && <p className="text-xs text-red-600">{createErr}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setCreating(false)}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={createSaving}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white">
                  {createSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {chooserList.map(p => (
            <div key={p.id} className="rounded-lg border border-stone-200 bg-white p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-stone-800">{p.codigo}</span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase border',
                    p.estado === 'publicado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    p.estado === 'borrador' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-stone-50 text-stone-500 border-stone-200'
                  )}>
                    {p.estado === 'publicado' ? 'Publicada' : p.estado === 'borrador' ? 'Borrador' : 'Archivada'}
                  </span>
                  {p.active_version && (
                    <span className="text-[10px] text-stone-400">v{p.active_version.version_number}</span>
                  )}
                </div>
                <p className="text-sm text-stone-600 mt-0.5 truncate">{p.nombre}</p>
                <p className="text-xs text-stone-400 mt-0.5">{p.items_count} ítems</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-stone-300 shrink-0"
                onClick={() => router.push(`/quality/conjuntos/${conjuntoId}/plantilla?template=${p.id}`)}
              >
                Editar
              </Button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── No template yet — create form
  if (!template) {
    return (
      <div className="flex flex-col gap-5 max-w-xl">
        <EmaBreadcrumb items={[
          { label: 'Conjuntos', href: '/quality/conjuntos' },
          { label: conjuntoNombre, href: `/quality/conjuntos/${conjuntoId}` },
          { label: 'Plantilla de verificación' },
        ]} />

        <div className="flex items-center gap-3">
          <Link href={`/quality/conjuntos/${conjuntoId}`}
            className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-stone-900">Crear plantilla de verificación</h1>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-stone-600">Código del documento</Label>
                <span className="text-[10px] text-stone-400 italic">Generado automáticamente · No editable</span>
              </div>
              <div className="flex items-center rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                <span className="font-mono text-sm text-stone-700 flex-1">{createForm.codigo || '—'}</span>
              </div>
              <p className="text-[10px] text-stone-400">Código de control documental (DC-LC-6.4-NN). Se asigna automáticamente en secuencia.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Nombre *</Label>
              <Input value={createForm.nombre}
                onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Verificación de flexómetros" className="border-stone-200 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Norma de referencia</Label>
              <Input value={createForm.norma_referencia}
                onChange={e => setCreateForm(f => ({ ...f, norma_referencia: e.target.value }))}
                placeholder="NMX-C-083, NOM-008-SCFI-2002…" className="border-stone-200 text-sm" />
            </div>
            {createErr && <p className="text-xs text-red-600">{createErr}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={createSaving}
                className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5">
                {createSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Crear plantilla
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Template exists — editor
  const totalItems = template.sections.reduce((acc, s) => acc + s.items.length, 0)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-12 sm:px-6 lg:px-8">
      <EmaBreadcrumb items={[
        { label: 'Conjuntos', href: '/quality/conjuntos' },
        { label: conjuntoNombre, href: `/quality/conjuntos/${conjuntoId}` },
        { label: 'Plantilla de verificación' },
      ]} />

      {/* Header */}
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col gap-6 border-b border-stone-100 bg-gradient-to-br from-stone-50 via-white to-emerald-50/40 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <Link href={`/quality/conjuntos/${conjuntoId}`}
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-800">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold tracking-tight text-stone-600 shadow-sm">
                  {template.codigo}
                </span>
                <span className={cn(
                  'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
                  template.estado === 'publicado'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : template.estado === 'archivado'
                    ? 'bg-stone-100 text-stone-500 border-stone-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200',
                )}>
                  {template.estado}
                </span>
                {template.active_version && (
                  <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-medium text-stone-500">
                    v{template.active_version.version_number} activa
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">{template.nombre}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                  Constructor de ficha EMA: define cabecera, variables, fórmulas y criterios de cumplimiento antes de publicar una versión inmutable.
                </p>
              </div>
              {template.norma_referencia && (
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                  Norma de referencia · <span className="font-mono normal-case tracking-normal text-stone-700">{template.norma_referencia}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5 border-stone-300 bg-white/90">
                <Eye className="h-4 w-4" />
                Vista previa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ficha (vista previa)</DialogTitle>
              </DialogHeader>
              <TemplateFicha
                template={{
                  codigo: template.codigo,
                  nombre: template.nombre,
                  norma_referencia: template.norma_referencia,
                  descripcion: template.descripcion,
                }}
                sections={template.sections}
                header_fields={template.header_fields}
              />
            </DialogContent>
          </Dialog>
          {template.active_version?.id && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-stone-300 bg-white/90"
                onClick={async () => {
                  setDiffVsPublishedOpen(true)
                  setDiffVsPublishedLoading(true)
                  setDiffVsPublishedLines([])
                  try {
                    const r = await fetch(`/api/ema/template-versions/${template.active_version!.id}`).then(x => x.json())
                    const snap = r.data?.snapshot as VerificacionTemplateSnapshot | undefined
                    setDiffVsPublishedLines(diffDraftVsPublishedSnapshot(template.sections, snap?.sections))
                  } catch {
                    setDiffVsPublishedLines(['Error al cargar la versión publicada.'])
                  } finally {
                    setDiffVsPublishedLoading(false)
                  }
                }}
              >
                Diff vs publicada
              </Button>
              <Dialog open={diffVsPublishedOpen} onOpenChange={setDiffVsPublishedOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Cambios vs versión publicada (fórmula / cumplimiento)</DialogTitle>
                  </DialogHeader>
                  {diffVsPublishedLoading ? (
                    <div className="flex items-center gap-2 text-sm text-stone-600 py-6">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                    </div>
                  ) : (
                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-stone-700 font-mono">
                      {diffVsPublishedLines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  )}
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button
            onClick={handlePublish}
            disabled={
              publishing
              || template.sections.length === 0
              || (readiness != null && !readiness.ok)
            }
            className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-sm"
            title={
              template.sections.length === 0
                ? 'Agrega al menos una sección antes de publicar'
                : readiness && !readiness.ok
                  ? 'Corrija los errores de validación antes de publicar'
                  : ''
            }
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            Publicar versión
          </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-stone-100 bg-white">
          {[
            { label: 'Secciones', value: template.sections.length },
            { label: 'Puntos', value: totalItems },
            { label: 'Cabecera', value: (template.header_fields ?? []).length },
          ].map(s => (
            <div key={s.label} className="px-4 py-3 sm:px-6">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{s.label}</p>
              <p className="mt-1 text-lg font-semibold text-stone-900">{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {publishMsg && (
        <div className={cn(
          'rounded-lg border px-4 py-3 text-sm flex items-center gap-2',
          publishMsg.startsWith('Error')
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800',
        )}>
          {publishMsg.startsWith('Error')
            ? <AlertTriangle className="h-4 w-4 shrink-0" />
            : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {publishMsg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <main className="min-w-0 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Estructura de la ficha</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-900">Secciones y puntos de verificación</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-500">
                Cada sección es solo un bloque de la ficha (título e instrucciones). Mediciones, tolerancias y fórmulas se configuran en los puntos.
              </p>
            </div>
            <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-500">
              {totalItems} punto{totalItems !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Sections */}
          <div className="flex flex-col gap-3">
        {template.sections.map(section => (
          <SectionCard
            key={section.id}
            section={section}
            templateId={template.id}
            onUpdated={updated => {
              setTemplate(t => t ? {
                ...t, sections: t.sections.map(s => s.id === updated.id ? updated : s)
              } : t)
              void refreshReadiness(template.id)
            }}
            onDeleted={sid => {
              setTemplate(t => t ? {
                ...t, sections: t.sections.filter(s => s.id !== sid)
              } : t)
              void refreshReadiness(template.id)
            }}
          />
        ))}

        {/* Add section */}
        {addingSection ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
            <p className="text-sm font-semibold text-stone-700">Nueva sección</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs text-stone-600">Título *</Label>
                <Input value={sectionForm.titulo}
                  onChange={e => setSectionForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ej. Verificación del cono, Equipos utilizados"
                  className="border-stone-200 text-sm" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs text-stone-600">Descripción</Label>
                <Textarea value={sectionForm.descripcion}
                  onChange={e => setSectionForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Instrucciones o contexto para esta sección…"
                  rows={2} className="border-stone-200 text-sm resize-none" />
              </div>
              <p className="col-span-2 text-xs leading-5 text-stone-500">
                Después agrega los puntos de verificación: ahí defines mediciones, tolerancias, sí/no y puntos calculados.
              </p>
            </div>
            {sectionErr && <p className="text-xs text-red-600">{sectionErr}</p>}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-8 text-xs"
                onClick={() => {
                  setAddingSection(false)
                  setSectionErr(null)
                  setSectionForm({ titulo: '', descripcion: '' })
                }}>
                Cancelar
              </Button>
              <Button size="sm" className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                onClick={handleAddSection} disabled={sectionSaving}>
                {sectionSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Agregar sección
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingSection(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50/50 py-3 text-sm text-stone-500 hover:border-stone-400 hover:text-stone-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Agregar sección
          </button>
        )}
          </div>

          {template.sections.length === 0 && !addingSection && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>La plantilla no tiene secciones. Agrega al menos una sección con puntos de verificación para poder publicarla.</span>
            </div>
          )}
        </main>

        <aside className="space-y-4 lg:sticky lg:top-6">
          {readiness && (
            <div className={cn(
              'rounded-2xl border p-4 text-sm shadow-sm',
              readiness.ok
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                : 'bg-amber-50 border-amber-200 text-amber-950',
            )}>
              <div className="flex items-start gap-3">
                <div className={cn(
                  'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  readiness.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                )}>
                  {readiness.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {readiness.ok ? 'Lista para publicar' : 'No se puede publicar todavía'}
                  </p>
                  <p className="mt-1 text-xs leading-5 opacity-80">
                    {readiness.ok
                      ? 'La cabecera, variables, fórmulas y reglas pasan la validación actual.'
                      : 'Corrige estos puntos para evitar publicar una ficha rota.'}
                  </p>
                </div>
              </div>
              {!readiness.ok && readiness.errors.length > 0 && (
                <ul className="mt-3 max-h-60 space-y-1 overflow-y-auto rounded-xl border border-amber-200/70 bg-white/60 p-3 text-xs leading-5">
                  {readiness.errors.map((err, i) => <li key={i}>• {err}</li>)}
                </ul>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-8 w-full border-stone-300 bg-white/80 text-xs"
                onClick={() => void refreshReadiness(template.id)}
                disabled={readinessBusy}
              >
                {readinessBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Volver a validar'}
              </Button>
            </div>
          )}

          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Resumen</p>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {[
                { label: 'Secciones', value: template.sections.length },
                { label: 'Puntos', value: totalItems },
                { label: 'Versión', value: template.active_version ? `v${template.active_version.version_number}` : 'Sin publicar' },
                { label: 'Cabecera', value: (template.header_fields ?? []).length },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-stone-100 bg-stone-50/70 px-3 py-2">
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-stone-400">{s.label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-stone-900">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Cabecera de ficha (metadata) */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-4">
            <div>
              <p className="text-sm font-semibold text-stone-900">Cabecera de ficha</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                Datos visibles antes de los puntos: equipo, normas, fechas y variables base para fórmulas.
              </p>
            </div>
            {(template.header_fields ?? []).length > 0 ? (
              <div className="space-y-2">
                {(template.header_fields ?? []).map(h => (
                  editingHeaderField === h.id ? (
                    <div key={h.id} className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-stone-500">Clave / variable</Label>
                        <Input value={headerEditForm.field_key}
                          onChange={e => setHeaderEditForm(f => ({ ...f, field_key: e.target.value }))}
                          className="border-stone-200 text-xs font-mono" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-stone-500">Etiqueta</Label>
                        <Input value={headerEditForm.label}
                          onChange={e => setHeaderEditForm(f => ({ ...f, label: e.target.value }))}
                          className="border-stone-200 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-stone-500">Origen</Label>
                        <select
                          value={headerEditForm.source}
                          onChange={e => setHeaderEditForm(f => ({
                            ...f,
                            source: e.target.value as typeof f.source,
                          }))}
                          className="w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs"
                        >
                          <option value="manual">Manual</option>
                          <option value="instrumento">Instrumento</option>
                        </select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => { setEditingHeaderField(null); setHeaderErr(null) }}>
                          Cancelar
                        </Button>
                        <Button type="button" size="sm" className="h-7 text-xs bg-emerald-700 text-white hover:bg-emerald-800"
                          disabled={headerSaving}
                          onClick={() => handleSaveHeaderField(h.id)}>
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div key={h.id} className={cn(
                      'rounded-xl border px-3 py-2',
                      h.source === 'computed' && !h.formula
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-stone-100 bg-stone-50/60',
                    )}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-stone-800">{h.label}</p>
                          <p className="mt-1 truncate font-mono text-[11px] text-stone-500">{h.field_key}</p>
                          {h.source === 'computed' && (
                            <p className="mt-1 text-[11px] text-amber-700">
                              Origen heredado inválido. Cambia a Manual/Instrumento o elimínalo.
                            </p>
                          )}
                        </div>
                        <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] text-stone-500">
                          {h.source === 'computed' ? 'calculado heredado' : h.source}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-end gap-1">
                        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
                          onClick={() => {
                            setEditingHeaderField(h.id)
                            setHeaderEditForm(headerFieldToForm(h))
                            setHeaderErr(null)
                          }}>
                          Editar
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleDeleteHeaderField(h.id)}
                          disabled={headerSaving}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-3 py-4 text-center text-xs text-stone-500">
                Sin campos de cabecera todavía.
              </div>
            )}
            <form onSubmit={handleAddHeaderField} className="space-y-2 border-t border-stone-100 pt-4">
              <div className="space-y-1">
                <Label className="text-[10px] text-stone-500">Clave</Label>
                <Input value={headerFieldForm.field_key}
                  onChange={e => setHeaderFieldForm(f => ({ ...f, field_key: e.target.value }))}
                  placeholder="ej. capacidad_nominal" className="border-stone-200 text-xs font-mono" />
                <p className="text-[10px] text-stone-400">También se usa como variable en fórmulas.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-stone-500">Etiqueta</Label>
                <Input value={headerFieldForm.label}
                  onChange={e => setHeaderFieldForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Capacidad nominal" className="border-stone-200 text-xs" />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-[10px] text-stone-500">Origen</Label>
                  <select
                    value={headerFieldForm.source}
                    onChange={e => setHeaderFieldForm(f => ({
                      ...f,
                      source: e.target.value as typeof f.source,
                    }))}
                    className="w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="manual">Manual</option>
                    <option value="instrumento">Instrumento</option>
                  </select>
                </div>
                <Button type="submit" size="sm" disabled={headerSaving} className="h-8 text-xs bg-stone-900 text-white hover:bg-stone-800">
                  {headerSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                </Button>
              </div>
              {headerErr && <p className="text-xs text-red-600">{headerErr}</p>}
            </form>
          </div>
        </aside>
      </div>
    </div>
  )
}
