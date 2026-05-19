'use client'

import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const ESTADO_BADGE: Record<string, string> = {
  vigente: 'bg-emerald-100 text-emerald-800',
  proximo_vencer: 'bg-amber-100 text-amber-900',
  vencido: 'bg-red-100 text-red-800',
}

const ESTADO_ICON: Record<string, React.ReactNode> = {
  vigente: <CheckCircle className="h-3 w-3" />,
  proximo_vencer: <Clock className="h-3 w-3" />,
  vencido: <AlertTriangle className="h-3 w-3" />,
}

export function EmaUncertaintyInstrumentEstadoBadge({
  estado,
  className,
}: {
  estado?: string | null
  className?: string
}) {
  if (!estado) return null
  const key = estado.toLowerCase().replace(/\s+/g, '_')
  const badge = ESTADO_BADGE[key] ?? 'bg-stone-100 text-stone-700'
  const icon = ESTADO_ICON[key]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize',
        badge,
        className,
      )}
    >
      {icon}
      {estado.replace(/_/g, ' ')}
    </span>
  )
}
