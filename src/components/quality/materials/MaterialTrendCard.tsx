'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ComposedChart, Line, ReferenceLine, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, ChevronRight, Plus, Settings2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { qualityHubPrimaryButtonClass } from '@/components/quality/qualityHubUi'
import AddReadingModal from './AddReadingModal'

interface StatEntry {
  mean: number | null; stdDev: number | null; cv: number | null
  count: number; min: number | null; max: number | null
}

interface MaterialTrendCardProps {
  materialId: string
  materialName: string
  category: string
  effectiveCategory: string
  subcategory?: string | null
  supplier?: string | null
  plantName?: string | null
  plantId?: string
  readingCount: number
  lastReadingDate?: string | null
  sparklines: Record<string, Array<{ date: string; value: number }>>
  stats: Record<string, StatEntry>
  hasAlert?: boolean
  onReadingAdded?: () => void
}

// ─── Property metadata ────────────────────────────────────────────────────────

const PROPERTY_META: Record<string, { label: string; unit: string; short: string }> = {
  resistencia_compresion:      { label: 'Resistencia compresión', unit: 'kg/cm²', short: 'Resist.' },
  tiempo_fraguado_inicial:     { label: 'Fraguado inicial',       unit: 'min',    short: 'Frag. ini.' },
  tiempo_fraguado_final:       { label: 'Fraguado final',         unit: 'min',    short: 'Frag. fin.' },
  ph:                          { label: 'pH',                     unit: '',       short: 'pH' },
  densidad_aditivo:            { label: 'Densidad',               unit: 'g/cm³',  short: 'Densidad' },
  pv_promedio:                 { label: 'PV promedio',            unit: 'kg/m³',  short: 'PV prom.' },
  densidad_agregado:           { label: 'Densidad',               unit: 'g/cm³',  short: 'Densidad' },
  absorcion:                   { label: 'Absorción',              unit: '%',      short: 'Absorción' },
  modulo_finura:               { label: 'Módulo de finura',       unit: '',       short: 'MF' },
  perdida_lavado:              { label: 'Pérdida lavado',         unit: '%',      short: 'P. lavado' },
}

const DEFAULT_SLOTS: Record<string, string[]> = {
  cemento:  ['resistencia_compresion', 'tiempo_fraguado_inicial', 'tiempo_fraguado_final'],
  aditivo:  ['ph', 'densidad_aditivo'],
  arena:    ['absorcion', 'modulo_finura', 'pv_promedio'],
  grava:    ['absorcion', 'densidad_agregado', 'pv_promedio'],
  agregado: ['absorcion', 'modulo_finura', 'pv_promedio'],
}

const CATEGORY_PROPS: Record<string, string[]> = {
  cemento:  ['resistencia_compresion', 'tiempo_fraguado_inicial', 'tiempo_fraguado_final'],
  aditivo:  ['ph', 'densidad_aditivo'],
  arena:    ['absorcion', 'modulo_finura', 'perdida_lavado', 'pv_promedio', 'densidad_agregado'],
  grava:    ['absorcion', 'densidad_agregado', 'modulo_finura', 'pv_promedio'],
  agregado: ['absorcion', 'modulo_finura', 'densidad_agregado', 'pv_promedio', 'perdida_lavado'],
}

// ─── Category design tokens (muted, aligned with stone/sky theme) ─────────────

const CAT_ACCENT: Record<string, { border: string; badge: string; label: string }> = {
  cemento:  { border: 'border-l-slate-400',   badge: 'bg-slate-100 text-slate-700 border-slate-300',   label: 'Cemento' },
  aditivo:  { border: 'border-l-violet-400',  badge: 'bg-violet-50 text-violet-700 border-violet-200', label: 'Aditivo' },
  arena:    { border: 'border-l-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',    label: 'Arena' },
  grava:    { border: 'border-l-stone-400',   badge: 'bg-stone-100 text-stone-600 border-stone-300',   label: 'Grava' },
  agregado: { border: 'border-l-stone-300',   badge: 'bg-stone-50 text-stone-500 border-stone-200',    label: 'Agregado' },
  agua:     { border: 'border-l-sky-300',     badge: 'bg-sky-50 text-sky-700 border-sky-200',          label: 'Agua' },
}

function getCatTokens(effectiveCategory: string) {
  return CAT_ACCENT[effectiveCategory] ?? CAT_ACCENT.agregado
}

// ─── Number formatter for sparkline Y-axis ────────────────────────────────────

function fmtTick(v: number): string {
  const abs = Math.abs(v)
  if (abs === 0) return '0'
  if (abs >= 10000) return `${(v / 1000).toFixed(0)}k`
  if (abs >= 1000)  return `${(v / 1000).toFixed(1)}k`
  if (abs >= 100)   return v.toFixed(0)
  if (abs >= 10)    return v.toFixed(1)
  if (abs >= 1)     return v.toFixed(2)
  return v.toFixed(3)
}

// ─── Property picker ──────────────────────────────────────────────────────────

const PropertyPicker = React.forwardRef<HTMLDivElement, { props: string[]; onSelect: (k: string) => void }>(
  function PropertyPicker({ props, onSelect }, ref) {
    return (
      <div ref={ref} className="absolute right-0 top-5 z-50 bg-white border border-stone-200 rounded-lg shadow-xl py-1 min-w-[160px]">
        {props.map((k) => {
          const m = PROPERTY_META[k]
          return (
            <button key={k} onClick={() => onSelect(k)}
              className="w-full text-left px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between gap-3">
              <span>{m?.label ?? k}</span>
              {m?.unit && <span className="text-stone-400 shrink-0">{m.unit}</span>}
            </button>
          )
        })}
      </div>
    )
  }
)

// ─── Sparkline panel ──────────────────────────────────────────────────────────

function SparkPanel({
  propKey, sparklines, stats, availableProps, onChangeProp,
}: {
  propKey: string | null
  sparklines: Record<string, Array<{ date: string; value: number }>>
  stats: Record<string, StatEntry>
  availableProps: string[]
  onChangeProp: (k: string) => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false)
    }
    if (showPicker) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showPicker])

  if (!propKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[80px] gap-1 relative">
        <button onClick={() => setShowPicker(v => !v)}
          className="text-[10px] text-stone-400 hover:text-stone-600 flex items-center gap-1">
          <Plus className="h-2.5 w-2.5" /> Agregar
        </button>
        {showPicker && (
          <PropertyPicker ref={pickerRef} props={availableProps}
            onSelect={k => { onChangeProp(k); setShowPicker(false) }} />
        )}
      </div>
    )
  }

  const meta  = PROPERTY_META[propKey]
  const stat  = stats[propKey]
  const points = sparklines[propKey] ?? []
  const ucl = stat?.mean != null && stat?.stdDev != null ? stat.mean + 3 * stat.stdDev : null
  const lcl = stat?.mean != null && stat?.stdDev != null ? stat.mean - 3 * stat.stdDev : null

  const lastVal  = points.length > 0 ? points[points.length - 1].value : null
  const prevVal  = points.length > 1 ? points[points.length - 2].value : null
  const trend    = lastVal != null && prevVal != null
    ? (lastVal > prevVal * 1.015 ? 'up' : lastVal < prevVal * 0.985 ? 'down' : 'flat')
    : null
  const isOoc = lastVal != null && ((ucl != null && lastVal > ucl) || (lcl != null && lcl > 0 && lastVal < lcl))

  const chartData = useMemo(() => points.map(p => ({ v: p.value })), [points])

  // Compute a sensible domain for the sparkline
  const allVals = points.map(p => p.value)
  let yMin: number | undefined
  let yMax: number | undefined
  if (allVals.length > 0) {
    const dMin = Math.min(...allVals, ...(lcl != null && lcl > 0 ? [lcl] : []))
    const dMax = Math.max(...allVals, ...(ucl != null ? [ucl] : []))
    const spread = dMax - dMin || Math.abs(dMin) * 0.1 || 1
    yMin = dMin - spread * 0.12
    yMax = dMax + spread * 0.12
  }

  return (
    <div className="flex-1 px-3 py-2.5 min-w-0 relative">
      <div className="flex items-center gap-0.5 mb-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 truncate flex-1">
          {meta?.short ?? propKey}
          {meta?.unit ? <span className="normal-case font-normal ml-0.5 text-stone-300">({meta.unit})</span> : null}
        </p>
        <div className="relative shrink-0" ref={pickerRef}>
          <button onClick={() => setShowPicker(v => !v)} title="Cambiar propiedad"
            className="p-0.5 text-stone-300 hover:text-stone-500 transition-colors rounded">
            <Settings2 className="h-2.5 w-2.5" />
          </button>
          {showPicker && (
            <PropertyPicker props={availableProps}
              onSelect={k => { onChangeProp(k); setShowPicker(false) }} />
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-1 mb-0.5">
        <span className={cn('text-base font-bold leading-none tabular-nums',
          isOoc ? 'text-red-600' : 'text-stone-900')}>
          {lastVal != null ? fmtTick(lastVal) : '—'}
        </span>
        {meta?.unit && <span className="text-[10px] text-stone-400">{meta.unit}</span>}
        {trend === 'up'   && <TrendingUp   className="h-3 w-3 text-emerald-500 shrink-0" />}
        {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400 shrink-0" />}
        {trend === 'flat' && <Minus        className="h-2.5 w-2.5 text-stone-400 shrink-0" />}
      </div>

      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={38}>
          <ComposedChart data={chartData} margin={{ top: 3, right: 2, left: 0, bottom: 0 }}>
            <XAxis dataKey="x" hide />
            <YAxis domain={[yMin ?? 'auto', yMax ?? 'auto']} hide width={0} />
            {stat?.mean != null && (
              <ReferenceLine y={stat.mean} stroke="#16a34a" strokeDasharray="3 3" strokeWidth={1} />
            )}
            {ucl != null && (
              <ReferenceLine y={ucl} stroke="#dc2626" strokeDasharray="2 2" strokeWidth={1} />
            )}
            {lcl != null && lcl > 0 && (
              <ReferenceLine y={lcl} stroke="#dc2626" strokeDasharray="2 2" strokeWidth={1} />
            )}
            <Line type="monotone" dataKey="v" stroke={isOoc ? '#dc2626' : '#0284c7'}
              strokeWidth={1.5} dot={false} animationDuration={300} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[38px] flex items-end">
          <span className="text-[10px] text-stone-300 italic">
            {points.length === 1 ? '1 lectura — más datos para gráfico' : 'sin datos'}
          </span>
        </div>
      )}

      {isOoc && (
        <p className="mt-0.5 text-[10px] text-red-600 font-semibold flex items-center gap-0.5">
          <AlertTriangle className="h-2.5 w-2.5 shrink-0" /> Fuera de control
        </p>
      )}
      {!isOoc && stat?.count != null && stat.count > 0 && (
        <p className="mt-0.5 text-[10px] text-stone-400 tabular-nums">
          μ {fmtTick(stat.mean ?? 0)} · n={stat.count}
        </p>
      )}
    </div>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function MaterialTrendCard({
  materialId, materialName, category, effectiveCategory, subcategory,
  supplier, plantName, plantId, readingCount, lastReadingDate,
  sparklines, stats, hasAlert, onReadingAdded,
}: MaterialTrendCardProps) {
  const [showReadingModal, setShowReadingModal] = useState(false)
  const [slots, setSlots] = useState<(string | null)[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`mcc.slots.${materialId}`)
        if (saved) return JSON.parse(saved)
      } catch { /* ignore */ }
    }
    const defaults = DEFAULT_SLOTS[effectiveCategory] ?? DEFAULT_SLOTS.agregado
    return [...defaults.slice(0, 3), ...[null, null, null]].slice(0, 3)
  })

  const tokens = getCatTokens(effectiveCategory)
  const availableProps = CATEGORY_PROPS[effectiveCategory] ?? CATEGORY_PROPS.agregado
  const isManual = ['cemento', 'aditivo'].includes(category)

  function updateSlot(idx: number, key: string) {
    const next = [...slots]; next[idx] = key; setSlots(next)
    try { localStorage.setItem(`mcc.slots.${materialId}`, JSON.stringify(next)) } catch { /* ignore */ }
  }

  return (
    <>
      <div className={cn(
        'rounded-xl bg-white border border-stone-200 border-l-4 overflow-hidden',
        'flex flex-col shadow-sm hover:shadow-md transition-all duration-200',
        tokens.border,
        hasAlert && 'border-red-200 border-l-red-400',
      )}>
        {/* Header */}
        <div className="px-4 pt-3 pb-2.5 border-b border-stone-100">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-stone-900 truncate leading-tight">
                  {materialName}
                </span>
                {hasAlert && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
                    <AlertTriangle className="h-2.5 w-2.5" /> Alerta
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Badge variant="outline" className={cn('text-[10px] py-0 h-4 font-medium', tokens.badge)}>
                  {tokens.label}
                </Badge>
                {subcategory && subcategory.trim() && (
                  <span className="text-[10px] text-stone-400 truncate">{subcategory}</span>
                )}
                {supplier && (
                  <span className="text-[10px] text-stone-400">· {supplier}</span>
                )}
                {plantName && (
                  <span className="text-[10px] text-stone-400">· {plantName}</span>
                )}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <Link href={`/quality/materials/${materialId}/analisis`}
                className="flex items-center gap-0.5 text-[11px] text-sky-600 hover:text-sky-700 font-medium whitespace-nowrap">
                Análisis <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <span className="text-[10px] text-stone-400 tabular-nums">
                {readingCount} {readingCount === 1 ? 'lectura' : 'lecturas'}
              </span>
            </div>
          </div>
        </div>

        {/* Sparkline panels */}
        {readingCount > 0 ? (
          <div className="flex divide-x divide-stone-100">
            {slots.slice(0, 3).map((prop, idx) => (
              <SparkPanel
                key={`${idx}-${prop}`}
                propKey={prop}
                sparklines={sparklines}
                stats={stats}
                availableProps={availableProps}
                onChangeProp={k => updateSlot(idx, k)}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 py-5 flex flex-col items-center justify-center gap-2 text-center">
            <CheckCircle2 className="h-6 w-6 text-stone-200" />
            <p className="text-xs text-stone-400">
              Sin lecturas registradas
              {!isManual && <><br /><span className="text-stone-300">Se llenará al guardar una caracterización</span></>}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded border',
              isManual ? 'text-sky-700 bg-sky-50 border-sky-200' : 'text-stone-500 bg-white border-stone-200'
            )}>
              {isManual ? 'Manual + PDF' : 'Auto · Caracterización'}
            </span>
            {lastReadingDate && (
              <span className="text-[10px] text-stone-400 truncate">{lastReadingDate}</span>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => setShowReadingModal(true)}
            className={cn('h-6 px-2.5 text-[11px] shrink-0',
              isManual ? qualityHubPrimaryButtonClass : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
            )}
            variant={isManual ? 'default' : 'outline'}
            title={!isManual ? 'Las caracterizaciones se sincronizan automáticamente' : undefined}
          >
            <Plus className="h-2.5 w-2.5 mr-1" />
            {readingCount === 0 ? 'Primera lectura' : 'Registrar'}
          </Button>
        </div>
      </div>

      <AddReadingModal
        open={showReadingModal}
        onClose={() => setShowReadingModal(false)}
        materialId={materialId}
        materialName={materialName}
        category={category}
        plantId={plantId}
        onSuccess={() => { setShowReadingModal(false); onReadingAdded?.() }}
      />
    </>
  )
}
