'use client'

import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmaFichaPrintToolbar({
  backHref,
  backLabel = 'Volver',
  title,
}: {
  backHref: string
  backLabel?: string
  title: string
}) {
  return (
    <div className="print:hidden sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-1.5" asChild>
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
        <h1 className="text-sm font-semibold text-stone-800 truncate">{title}</h1>
      </div>
      <Button
        type="button"
        size="sm"
        className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white shrink-0"
        onClick={() => window.print()}
      >
        <Printer className="h-4 w-4" />
        Imprimir
      </Button>
    </div>
  )
}
