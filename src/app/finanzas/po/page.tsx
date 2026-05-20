import { Suspense } from 'react'
import ProcurementTabRedirect from '@/components/finanzas/ProcurementTabRedirect'

export default function PurchaseOrdersRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="py-8 text-sm text-stone-500" aria-busy="true">
          Cargando…
        </div>
      }
    >
      <ProcurementTabRedirect tab="po" />
    </Suspense>
  )
}
