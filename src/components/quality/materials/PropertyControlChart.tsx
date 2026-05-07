'use client'

import React, { useMemo, useState } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, Maximize2, X, Info } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface PropertyReading {
  id: string
  reading_date: string
  source: string
  tecnico?: string | null
  lote?: string | null
  [key: string]: unknown
}

interface PropertyControlChartProps {
  readings: PropertyReading[]
  property: string
  label: string
  unit: string
  stats: { mean: number | null; stdDev: number | null; count: number }
}

interface ChartPoint {
  dateLabel: string
  value: number | null
  isOoc: boolean
  tecnico?: string | null
  lote?: string | null
}

// ─── Number formatter ─────────────────────────────────────────────────────────

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

// ─── Custom dot ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot({ cx, cy, payload }: any) {
  if (payload?.value == null) return null
  if (payload.isOoc) {
    return <circle cx={cx} cy={cy} r={5} fill="#dc2626" stroke="#fff" strokeWidth={1.5} />
  }
  return <circle cx={cx} cy={cy} r={3.5} fill="#0284c7" stroke="#fff" strokeWidth={1.5} />
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as ChartPoint
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg text-xs max-w-[200px]">
      <p className="font-semibold text-stone-900 mb-1">{d.dateLabel}</p>
      <p className="text-stone-700">Valor: <span className="font-bold tabular-nums">{d.value != null ? fmtTick(d.value) : '—'}</span></p>
      {d.tecnico && <p className="text-stone-500 truncate">Técnico: {d.tecnico}</p>}
      {d.lote && <p className="text-stone-500 truncate">Lote: {d.lote}</p>}
      {d.isOoc && (
        <p className="text-red-600 font-semibold flex items-center gap-1 mt-1">
          <AlertTriangle className="h-3 w-3" /> Fuera de control
        </p>
      )}
    </div>
  )
}

// ─── Stats info popover ───────────────────────────────────────────────────────

function StatsInfo({ mean, stdDev, count, ucl, lcl, unit }: {
  mean: number | null; stdDev: number | null; count: number
  ucl: number | null; lcl: number | null; unit: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
        title="¿Cómo se calculan estos límites?"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-72 bg-white border border-stone-200 rounded-xl shadow-xl p-4 text-xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-stone-900">Control Estadístico de Proceso</h4>
            <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2.5 text-stone-600">
            <div className="flex gap-2 items-start">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
              <div>
                <span className="font-semibold text-stone-800">μ (Media)</span> = {mean != null ? fmtTick(mean) : '—'} {unit}
                <p className="text-stone-400 leading-snug mt-0.5">Promedio aritmético de las {count} lecturas registradas.</p>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <span className="w-2 h-2 rounded-full bg-stone-400 shrink-0 mt-1" />
              <div>
                <span className="font-semibold text-stone-800">σ (Desviación estándar)</span> = {stdDev != null ? fmtTick(stdDev) : '—'} {unit}
                <p className="text-stone-400 leading-snug mt-0.5">Mide la dispersión de los datos respecto a la media. Se calcula como la raíz cuadrada de la varianza poblacional.</p>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1" />
              <div>
                <span className="font-semibold text-stone-800">UCL</span> = μ + 3σ = {ucl != null ? fmtTick(ucl) : '—'} {unit}
                <p className="text-stone-400 leading-snug mt-0.5">Límite de Control Superior. Puntos arriba de este valor indican variación fuera de control.</p>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1" />
              <div>
                <span className="font-semibold text-stone-800">LCL</span> = μ − 3σ = {lcl != null ? fmtTick(lcl) : '—'} {unit}
                <p className="text-stone-400 leading-snug mt-0.5">Límite de Control Inferior. Bajo la metodología de Shewhart (±3σ), el 99.73% de datos normales caen dentro de estos límites.</p>
              </div>
            </div>
            <p className="text-stone-400 border-t border-stone-100 pt-2 leading-snug">
              Los puntos <span className="text-red-600 font-semibold">rojos</span> indican lecturas fuera de los límites de control y requieren revisión.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Chart body (shared between inline and fullscreen) ────────────────────────

function ChartBody({
  chartData, mean, ucl, lcl, height = 160,
}: {
  chartData: ChartPoint[]
  mean: number | null; ucl: number | null; lcl: number | null
  height?: number
}) {
  const allValues = chartData.map(p => p.value!).filter(v => v != null)
  if (allValues.length === 0) return null

  const dMin = Math.min(...allValues, ...(lcl != null && lcl > 0 ? [lcl] : []))
  const dMax = Math.max(...allValues, ...(ucl != null ? [ucl] : []))
  const spread = dMax - dMin || Math.abs(dMin) * 0.1 || 1
  const yMin = dMin - spread * 0.15
  const yMax = dMax + spread * 0.15

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
        <XAxis
          dataKey="dateLabel"
          tick={{ fontSize: 9, fill: '#a8a29e' }}
          tickLine={false}
          axisLine={{ stroke: '#e7e5e4' }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[yMin, yMax]}
          tick={{ fontSize: 9, fill: '#a8a29e' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtTick}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} />
        {mean != null && (
          <ReferenceLine y={mean} stroke="#16a34a" strokeDasharray="5 3" strokeWidth={1.5}
            label={{ value: `μ ${fmtTick(mean)}`, position: 'insideTopRight', fontSize: 9, fill: '#16a34a' }}
          />
        )}
        {ucl != null && (
          <ReferenceLine y={ucl} stroke="#dc2626" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: `UCL`, position: 'insideTopRight', fontSize: 8, fill: '#dc2626' }}
          />
        )}
        {lcl != null && lcl > 0 && (
          <ReferenceLine y={lcl} stroke="#dc2626" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: `LCL`, position: 'insideBottomRight', fontSize: 8, fill: '#dc2626' }}
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke="#0284c7"
          strokeWidth={2}
          dot={<CustomDot />}
          activeDot={{ r: 5, fill: '#0284c7' }}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function PropertyControlChart({ readings, property, label, unit, stats }: PropertyControlChartProps) {
  const [fullscreen, setFullscreen] = useState(false)
  const { mean, stdDev } = stats

  const ucl = mean != null && stdDev != null ? mean + 3 * stdDev : null
  const lcl = mean != null && stdDev != null ? mean - 3 * stdDev : null

  const chartData: ChartPoint[] = useMemo(() => (
    readings
      .filter(r => r[property] != null)
      .map(r => ({
        dateLabel: format(parseISO(r.reading_date), 'd MMM yy', { locale: es }),
        value: r[property] as number,
        isOoc: (ucl != null && (r[property] as number) > ucl) || (lcl != null && (r[property] as number) < lcl),
        tecnico: r.tecnico,
        lote: r.lote,
      }))
  ), [readings, property, ucl, lcl])

  const oocCount = chartData.filter(p => p.isOoc).length

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-stone-400 text-xs">
        Sin datos para {label.toLowerCase()}
      </div>
    )
  }

  return (
    <div>
      {oocCount > 0 && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {oocCount} punto{oocCount > 1 ? 's' : ''} fuera de control
        </div>
      )}

      {/* Chart */}
      <ChartBody chartData={chartData} mean={mean} ucl={ucl} lcl={lcl} height={160} />

      {/* Footer stats row */}
      <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-500 px-1">
        <span className="tabular-nums">μ = {mean != null ? fmtTick(mean) : '—'} {unit}</span>
        <span className="tabular-nums">σ = {stdDev != null ? fmtTick(stdDev) : '—'}</span>
        {stats.count > 1 && stdDev != null && mean != null && mean !== 0 && (
          <span className="tabular-nums">CV = {((stdDev / Math.abs(mean)) * 100).toFixed(1)}%</span>
        )}
        <span className="ml-auto tabular-nums">n = {stats.count}</span>
        <button
          onClick={() => setFullscreen(true)}
          className="text-stone-400 hover:text-stone-600 p-0.5 rounded transition-colors"
          title="Expandir gráfico"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <StatsInfo mean={mean} stdDev={stdDev} count={stats.count} ucl={ucl} lcl={lcl} unit={unit} />
      </div>

      {/* Fullscreen dialog */}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-5xl w-full p-0 overflow-hidden">
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <div className="px-6 pt-5 pb-2 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-stone-900">{label}</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Gráfico de control de Shewhart · {unit && <span>{unit} · </span>}
                μ = {mean != null ? fmtTick(mean) : '—'} · σ = {stdDev != null ? fmtTick(stdDev) : '—'} · n = {stats.count}
              </p>
            </div>
            <button onClick={() => setFullscreen(false)}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {oocCount > 0 && (
            <div className="mx-6 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {oocCount} punto{oocCount > 1 ? 's' : ''} fuera de control estadístico (± 3σ)
            </div>
          )}

          <div className="px-4 pt-3 pb-4">
            <ChartBody chartData={chartData} mean={mean} ucl={ucl} lcl={lcl} height={380} />
          </div>

          {/* Legend */}
          <div className="px-6 pb-5 flex items-center gap-5 text-xs text-stone-500 border-t border-stone-100 pt-3">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-sky-600 inline-block" />Lecturas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-emerald-500 inline-block border-dashed border-t border-emerald-500" />Media (μ)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-red-500 inline-block" />UCL / LCL (±3σ)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Fuera de control
            </span>
            <div className="ml-auto">
              <StatsInfo mean={mean} stdDev={stdDev} count={stats.count} ucl={ucl} lcl={lcl} unit={unit} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
