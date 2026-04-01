import React, { Suspense } from 'react'
import ConsumosPeriodoView from '@/components/procurement/ConsumosPeriodoView'
import { Skeleton } from '@/components/ui/skeleton'

function PeriodoFallback() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default function ConsumosPeriodoPage() {
  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <Suspense fallback={<PeriodoFallback />}>
        <ConsumosPeriodoView />
      </Suspense>
    </div>
  )
}
