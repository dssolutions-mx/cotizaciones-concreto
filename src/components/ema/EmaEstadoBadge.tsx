import React from 'react'
import { CheckCircle, Clock, AlertTriangle, Wrench, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EstadoInstrumento } from '@/types/ema'

interface EmaEstadoBadgeProps {
  estado: EstadoInstrumento
  size?: 'sm' | 'md'
  className?: string
}

const ESTADO_CONFIG: Record<EstadoInstrumento, {
  label: string
  icon: React.ReactNode
  className: string
}> = {
  vigente: {
    label: 'Vigente',
    icon: <CheckCircle className="h-3 w-3" />,
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  proximo_vencer: {
    label: 'Próximo a vencer',
    icon: <Clock className="h-3 w-3" />,
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  vencido: {
    label: 'Vencido',
    icon: <AlertTriangle className="h-3 w-3" />,
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  en_revision: {
    label: 'En revisión',
    icon: <Wrench className="h-3 w-3" />,
    className: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  inactivo: {
    label: 'Inactivo',
    icon: <XCircle className="h-3 w-3" />,
    className: 'bg-stone-100 text-stone-500 border-stone-200',
  },
}

export function EmaEstadoBadge({ estado, size = 'md', className }: EmaEstadoBadgeProps) {
  const cfg = ESTADO_CONFIG[estado]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
        cfg.className,
        className
      )}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  )
}
