'use client'

import React, { useMemo } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface MallaPoint {
  abertura_mm: number
  numero_malla: string
  porcentaje_pasa: number
  porcentaje_acumulado: number
}

interface GranulometryEvent {
  alta_estudio: {
    id: string
    fecha_muestreo?: string | null
    fecha_elaboracion?: string | null
    nombre_material?: string | null
    mina_procedencia?: string | null
  } | null
  mallas: MallaPoint[]
  modulo_finura?: number | null
}

interface LimiteMalla {
  malla: string
  limite_inferior: number
  limite_superior: number
}

interface GranulometryOverlayProps {
  history: GranulometryEvent[]
  limites?: LimiteMalla[]
  tipoMaterial?: 'Arena' | 'Grava'
}

// Distinct hues for up to 8 curves
const CURVE_COLORS = [
  '#2563eb', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#9333ea',
]

const SIEVE_ORDER = [75, 50, 37.5, 25, 19, 12.5, 9.5, 4.75, 2.36, 1.18, 0.6, 0.3, 0.15, 0.075]

function sieveLabel(mm: number) {
  if (mm >= 25) return `${mm}mm`
  if (mm >= 4.75) return `${mm}mm`
  if (mm === 2.36) return 'No.8'
  if (mm === 1.18) return 'No.16'
  if (mm === 0.6) return 'No.30'
  if (mm === 0.3) return 'No.50'
  if (mm === 0.15) return 'No.100'
  if (mm === 0.075) return 'No.200'
  return `${mm}`
}

export default function GranulometryOverlay({ history, limites = [], tipoMaterial }: GranulometryOverlayProps) {
  const sorted = useMemo(
    () =>
      [...history]
        .filter((h) => h.mallas?.length > 0)
        .sort((a, b) => {
          const da = a.alta_estudio?.fecha_muestreo ?? a.alta_estudio?.fecha_elaboracion ?? ''
          const db = b.alta_estudio?.fecha_muestreo ?? b.alta_estudio?.fecha_elaboracion ?? ''
          return da < db ? -1 : da > db ? 1 : 0
        }),
    [history]
  )

  // Build unified sieve x-axis from all datasets
  const sieveKeys = useMemo(() => {
    const all = new Set<number>()
    sorted.forEach((ev) =>
      (ev.mallas as MallaPoint[]).forEach((m) => {
        if (m.abertura_mm > 0) all.add(m.abertura_mm)
      })
    )
    return SIEVE_ORDER.filter((s) => all.has(s))
  }, [sorted])

  // Pivot: one row per sieve, columns per study date
  const chartData = useMemo(() => {
    return sieveKeys.map((mm) => {
      const row: Record<string, number | string> = { sieve: sieveLabel(mm), mm }
      sorted.forEach((ev, idx) => {
        const malla = (ev.mallas as MallaPoint[]).find((m) => Math.abs(m.abertura_mm - mm) < 0.01)
        row[`curve_${idx}`] = malla?.porcentaje_pasa ?? null!
      })
      // Limits
      limites.forEach((lim) => {
        // Approximate match by malla name
        row['lim_inf'] = row['lim_inf'] ?? 0
        row['lim_sup'] = row['lim_sup'] ?? 100
      })
      return row
    })
  }, [sieveKeys, sorted, limites])

  // Compute limit band per sieve if limites provided
  const limitBand = useMemo(() => {
    if (!limites.length) return null
    return sieveKeys.map((mm) => {
      const label = sieveLabel(mm)
      // Match by normalized label
      const match = limites.find(
        (l) =>
          l.malla.replace(/\s/g, '').toLowerCase() ===
          label.replace(/\s/g, '').toLowerCase()
      )
      return {
        sieve: label,
        lim_inf: match?.limite_inferior ?? null,
        lim_sup: match?.limite_superior ?? null,
      }
    })
  }, [sieveKeys, limites])

  const mergedData = useMemo(() => {
    return chartData.map((row, i) => ({
      ...row,
      ...(limitBand?.[i] ?? {}),
    }))
  }, [chartData, limitBand])

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-stone-400 text-sm">
        Sin datos de granulometría disponibles
      </div>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={mergedData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis
            dataKey="sieve"
            tick={{ fontSize: 10, fill: '#78716c' }}
            tickLine={false}
            axisLine={{ stroke: '#d6d3d1' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#78716c' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
            width={36}
          />
          <Tooltip
            formatter={(value: number, name: string) => [`${value?.toFixed(1)}%`, name]}
            contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e7e5e4' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
            formatter={(value) => value}
          />

          {/* Regulatory band */}
          {limitBand && (
            <Area
              dataKey="lim_sup"
              stroke="transparent"
              fill="#fde68a"
              fillOpacity={0.4}
              name="Límite sup."
              legendType="none"
              connectNulls
            />
          )}

          {/* One line per historical study, newest = full opacity */}
          {sorted.map((ev, idx) => {
            const opacity = 0.2 + (0.8 * (idx + 1)) / sorted.length
            const date = ev.alta_estudio?.fecha_muestreo ?? ev.alta_estudio?.fecha_elaboracion
            const dateLabel = date ? format(parseISO(date), 'd MMM yyyy', { locale: es }) : `Estudio ${idx + 1}`
            const mf = ev.modulo_finura
            const lineName = `${dateLabel}${mf ? ` · MF=${mf}` : ''}`
            return (
              <Line
                key={`curve_${idx}`}
                type="monotone"
                dataKey={`curve_${idx}`}
                name={lineName}
                stroke={CURVE_COLORS[idx % CURVE_COLORS.length]}
                strokeWidth={idx === sorted.length - 1 ? 2.5 : 1.5}
                strokeOpacity={opacity}
                dot={{ r: 3, fillOpacity: opacity }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            )
          })}
        </ComposedChart>
      </ResponsiveContainer>

      {tipoMaterial && (
        <p className="text-xs text-stone-400 text-center mt-1">
          Curva granulométrica — {tipoMaterial} · La curva más reciente aparece con mayor opacidad
        </p>
      )}
    </div>
  )
}
