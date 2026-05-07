'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'

interface StatEntry {
  mean: number | null
  stdDev: number | null
  cv: number | null
  count: number
  min: number | null
  max: number | null
}

interface KPICard {
  label: string
  value: string | number | null
  unit?: string
  status: 'ok' | 'warning' | 'critical' | 'neutral'
  hint?: string
  trend?: 'up' | 'down' | 'flat' | null
}

interface MaterialKPICardsProps {
  category: string
  stats: Record<string, StatEntry>
  readingCount: number
  lastReadingDate?: string | null
}

const statusMap = {
  ok: { card: 'bg-emerald-50 border-emerald-200', value: 'text-emerald-800', label: 'text-emerald-600' },
  warning: { card: 'bg-amber-50 border-amber-200', value: 'text-amber-800', label: 'text-amber-600' },
  critical: { card: 'bg-red-50 border-red-200', value: 'text-red-800', label: 'text-red-600' },
  neutral: { card: 'bg-white border-stone-200', value: 'text-stone-900', label: 'text-stone-500' },
} as const

function TrendIcon({ trend }: { trend: KPICard['trend'] }) {
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
  if (trend === 'flat') return <Minus className="h-3.5 w-3.5 text-stone-400" />
  return null
}

function fmt(v: number | null | undefined, decimals = 2) {
  if (v == null) return '—'
  return v.toFixed(decimals)
}

function cvStatus(cv: number | null): KPICard['status'] {
  if (cv == null) return 'neutral'
  if (cv < 5) return 'ok'
  if (cv < 10) return 'warning'
  return 'critical'
}

export default function MaterialKPICards({ category, stats, readingCount, lastReadingDate }: MaterialKPICardsProps) {
  let cards: KPICard[] = []

  if (category === 'cemento') {
    const rc = stats.resistencia_compresion
    const tf = stats.tiempo_fraguado_inicial
    cards = [
      {
        label: 'Resistencia media',
        value: fmt(rc?.mean),
        unit: 'kg/cm²',
        status: rc?.count ? 'neutral' : 'neutral',
        hint: rc?.count ? `n=${rc.count}` : undefined,
      },
      {
        label: 'CV Resistencia',
        value: rc?.cv != null ? `${rc.cv.toFixed(1)}%` : '—',
        status: cvStatus(rc?.cv ?? null),
        hint: 'Coeficiente de variación',
      },
      {
        label: 'Fraguado inicial medio',
        value: tf?.mean != null ? `${Math.round(tf.mean)} min` : '—',
        status: 'neutral',
        hint: 'Promedio',
      },
      {
        label: 'Lecturas registradas',
        value: readingCount,
        status: readingCount > 0 ? 'ok' : 'warning',
        hint: lastReadingDate ? `Última: ${lastReadingDate}` : undefined,
      },
    ]
  } else if (category === 'aditivo') {
    const ph = stats.ph
    const dens = stats.densidad_aditivo
    cards = [
      {
        label: 'pH medio',
        value: fmt(ph?.mean, 2),
        status: 'neutral',
        hint: ph?.count ? `n=${ph.count}` : undefined,
      },
      {
        label: 'CV pH',
        value: ph?.cv != null ? `${ph.cv.toFixed(1)}%` : '—',
        status: cvStatus(ph?.cv ?? null),
      },
      {
        label: 'Densidad media',
        value: fmt(dens?.mean, 3),
        unit: 'g/cm³',
        status: 'neutral',
      },
      {
        label: 'Lecturas registradas',
        value: readingCount,
        status: readingCount > 0 ? 'ok' : 'warning',
        hint: lastReadingDate ? `Última: ${lastReadingDate}` : undefined,
      },
    ]
  } else {
    // agregado (arena / grava)
    const abs = stats.absorcion
    const mf = stats.modulo_finura
    const hasOoc = abs?.cv != null && abs.cv > 10
    cards = [
      {
        label: 'Absorción media',
        value: fmt(abs?.mean, 3),
        unit: '%',
        status: hasOoc ? 'warning' : 'neutral',
        hint: abs?.count ? `n=${abs.count}` : undefined,
      },
      {
        label: 'CV Absorción',
        value: abs?.cv != null ? `${abs.cv.toFixed(1)}%` : '—',
        status: cvStatus(abs?.cv ?? null),
        hint: 'Coeficiente de variación',
      },
      {
        label: 'Módulo de finura medio',
        value: fmt(mf?.mean, 2),
        status: 'neutral',
      },
      {
        label: 'Caracterizaciones',
        value: readingCount,
        status: readingCount > 0 ? 'ok' : 'warning',
        hint: lastReadingDate ? `Última: ${lastReadingDate}` : undefined,
      },
    ]
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((card) => {
        const styles = statusMap[card.status]
        return (
          <div
            key={card.label}
            className={cn('rounded-lg border px-4 py-3', styles.card)}
          >
            <div className="flex items-center gap-1 mb-1">
              <p className={cn('text-xs font-medium truncate', styles.label)}>{card.label}</p>
              {card.status === 'critical' && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
            </div>
            <div className="flex items-end gap-1">
              <p className={cn('text-xl font-bold', styles.value)}>
                {card.value ?? '—'}
              </p>
              {card.unit && (
                <p className={cn('text-xs mb-0.5', styles.label)}>{card.unit}</p>
              )}
              {card.trend && <TrendIcon trend={card.trend} />}
            </div>
            {card.hint && (
              <p className={cn('text-xs mt-0.5 truncate', styles.label)}>{card.hint}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
