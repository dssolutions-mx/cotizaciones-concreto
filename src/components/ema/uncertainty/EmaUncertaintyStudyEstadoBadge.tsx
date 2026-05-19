import { cn } from '@/lib/utils'
import type { StudyEstado } from '@/types/ema-uncertainty'

const CONFIG: Record<
  StudyEstado,
  { label: string; className: string }
> = {
  borrador: { label: 'Borrador', className: 'bg-stone-100 text-stone-700 border-stone-200' },
  publicado: { label: 'Publicado', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  reemplazado: { label: 'Reemplazado', className: 'bg-amber-100 text-amber-800 border-amber-200' },
}

export function EmaUncertaintyStudyEstadoBadge({
  estado,
  className,
}: {
  estado: StudyEstado | string
  className?: string
}) {
  const cfg = CONFIG[estado as StudyEstado] ?? {
    label: estado,
    className: 'bg-stone-100 text-stone-600 border-stone-200',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        cfg.className,
        className,
      )}
    >
      {cfg.label}
    </span>
  )
}
