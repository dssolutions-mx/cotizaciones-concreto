import React from 'react'
import { cn } from '@/lib/utils'
import type { TipoInstrumento } from '@/types/ema'

interface EmaTipoBadgeProps {
  tipo: TipoInstrumento | string | undefined
  showLabel?: boolean
  className?: string
}

const TIPO_CONFIG: Record<TipoInstrumento, { label: string; sublabel: string; className: string }> = {
  A: {
    label: 'Tipo A',
    sublabel: 'Maestro',
    className: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  B: {
    label: 'Tipo B',
    sublabel: 'Externo',
    className: 'bg-violet-100 text-violet-800 border-violet-200',
  },
  C: {
    label: 'Tipo C',
    sublabel: 'Trabajo',
    className: 'bg-stone-100 text-stone-700 border-stone-200',
  },
  D: {
    label: 'Tipo D',
    sublabel: 'Auxiliar',
    className: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  },
}

function normalizeTipo(t: string): TipoInstrumento | null {
  const u = String(t ?? '')
    .trim()
    .toUpperCase()
    .slice(0, 1)
  if (u === 'A' || u === 'B' || u === 'C' || u === 'D') return u
  return null
}

export function EmaTipoBadge({ tipo, showLabel = false, className }: EmaTipoBadgeProps) {
  const key = normalizeTipo(String(tipo ?? ''))
  const cfg = key
    ? TIPO_CONFIG[key]
    : {
        label: `Tipo (${String(tipo ?? '').trim() || '?'})`,
        sublabel: 'Desconocido',
        className: 'bg-stone-100 text-stone-600 border-stone-200',
      }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        cfg.className,
        className,
      )}
    >
      {cfg.label}
      {showLabel && <span className="opacity-70">— {cfg.sublabel}</span>}
    </span>
  )
}
