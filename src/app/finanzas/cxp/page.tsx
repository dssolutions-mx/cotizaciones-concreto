import { Suspense } from 'react'
import ProcurementTabRedirect from '@/components/finanzas/ProcurementTabRedirect'

export default function CxpRoutePage() {
  return (
    <Suspense fallback={<div className="py-8 text-sm text-stone-500">Cargando…</div>}>
      <ProcurementTabRedirect tab="cxp" />
    </Suspense>
  )
}
