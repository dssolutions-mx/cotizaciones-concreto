'use client'

import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  message: string
  className?: string
}

/** Informative banner when a CFDI is already in CxP — read-only review, do not create again. */
export default function CfdiAlreadyRegisteredBanner({ message, className }: Props) {
  return (
    <div
      className={cn(
        'rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 flex items-start gap-2',
        className,
      )}
      role="status"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-700 mt-0.5" />
      <div>
        <p className="font-medium">Ya asignado en el sistema</p>
        <p className="mt-0.5 text-sky-800">{message}</p>
        <p className="mt-1 text-sky-700/90">
          Puede revisar el XML; no se creará un registro duplicado.
        </p>
      </div>
    </div>
  )
}
