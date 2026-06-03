'use client'

import { Suspense } from 'react'
import ArkikEntriesComparator from '@/components/inventory/ArkikEntriesComparator'

function LoadingFallback() {
  return <div className="text-sm text-stone-500 py-8">Cargando…</div>
}

export default function ArkikConsumptionComparisonPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ArkikEntriesComparator
        initialTab="consumo_remision"
        pageTitle="Conciliar consumos Arkik"
        pageDescription="Compare movimientos Consumo con remisión del export Arkik contra remision_materiales del sistema (material + remisión normalizada, cantidad vs cantidad_real)."
      />
    </Suspense>
  )
}
