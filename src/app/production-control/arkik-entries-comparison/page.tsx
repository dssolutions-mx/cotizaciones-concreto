'use client'

import { Suspense } from 'react'
import ArkikEntriesComparator from '@/components/inventory/ArkikEntriesComparator'

function LoadingFallback() {
  return <div className="text-sm text-stone-500 py-8">Cargando…</div>
}

export default function ArkikEntriesComparisonPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ArkikEntriesComparator initialTab="remision" />
    </Suspense>
  )
}
