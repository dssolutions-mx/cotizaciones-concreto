'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'

type ProcurementTab =
  | 'resumen'
  | 'po'
  | 'cxp'
  | 'suppliers'
  | 'inventario'
  | 'entradas'

type ProcurementTabRedirectProps = {
  tab: ProcurementTab
}

/** Standalone finance routes → Centro de compras workspace tab (preserves query string). */
export default function ProcurementTabRedirect({ tab }: ProcurementTabRedirectProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    const target = `/finanzas/procurement?${params.toString()}`
    if (typeof window !== 'undefined') {
      const current = `${window.location.pathname}?${searchParams.toString()}`
      if (current === target) return
    }
    router.replace(target)
  }, [router, searchParams, tab])

  return (
    <div className="space-y-3 py-8" aria-busy="true" aria-label="Redirigiendo">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
