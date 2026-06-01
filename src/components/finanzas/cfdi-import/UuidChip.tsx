'use client'

import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Props = {
  uuid: string
  className?: string
  mono?: boolean
}

export function UuidChip({ uuid, className, mono = true }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(uuid)
      setCopied(true)
      toast.success('UUID copiado')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={cn(
        'inline-flex items-center gap-1 max-w-full text-left rounded px-1.5 py-0.5',
        'bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors',
        mono && 'font-mono text-[11px]',
        className,
      )}
      title="Copiar UUID"
    >
      <span className="truncate">{uuid}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 text-stone-500" />
      )}
    </button>
  )
}
