'use client'

import React from 'react'
import Link from 'next/link'
import { Package, Warehouse, FileText, DollarSign, ArrowRight, LayoutDashboard } from 'lucide-react'
import { procurementEntriesUrl, buildProcurementUrl } from '@/lib/procurement/navigation'

/**
 * Static journey strip for procurement workspace (generic flow when no object context).
 */
export default function ProcurementFlowNav({ plantId }: { plantId?: string }) {
  const entriesHref = procurementEntriesUrl({ plantId })
  const cxpHref = buildProcurementUrl('/finanzas/procurement', { plantId, tab: 'cxp' })
  const poHref = buildProcurementUrl('/finanzas/procurement', { plantId, tab: 'po' })
  const hubHref = buildProcurementUrl('/finanzas/procurement', { plantId, tab: 'resumen' })
  const alertsHref = plantId
    ? `/production-control/alerts?plant_id=${encodeURIComponent(plantId)}`
    : '/production-control/alerts'

  const chip =
    'inline-flex items-center gap-1 rounded-md px-2 py-1 bg-white border border-stone-200 hover:bg-stone-50 font-medium text-sm text-stone-700'

  return (
    <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-[#faf9f7]/95 backdrop-blur border border-stone-200 rounded-lg shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 mb-2 px-1">
        Flujo típico de compra
      </p>
      <nav className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm text-stone-700" aria-label="Flujo OC a pago">
        <Link href={hubHref} className={chip}>
          <LayoutDashboard className="h-3.5 w-3.5 text-stone-600" />
          Centro
        </Link>
        <ArrowRight className="h-3.5 w-3.5 text-stone-400 shrink-0" aria-hidden />
        <Link href={poHref} className={chip}>
          <Package className="h-3.5 w-3.5 text-sky-700" />
          OC
        </Link>
        <ArrowRight className="h-3.5 w-3.5 text-stone-400 shrink-0" aria-hidden />
        <Link href={entriesHref} className={chip}>
          <Warehouse className="h-3.5 w-3.5 text-amber-700" />
          Entrada
        </Link>
        <ArrowRight className="h-3.5 w-3.5 text-stone-400 shrink-0" aria-hidden />
        <Link href={cxpHref} className={chip}>
          <FileText className="h-3.5 w-3.5 text-violet-700" />
          Factura / CXP
        </Link>
        <ArrowRight className="h-3.5 w-3.5 text-stone-400 shrink-0" aria-hidden />
        <Link href={cxpHref} className={chip}>
          <DollarSign className="h-3.5 w-3.5 text-green-700" />
          Pago
        </Link>
        <span className="w-full sm:w-auto sm:ml-2 text-[11px] text-stone-400 hidden sm:inline">|</span>
        <Link href={alertsHref} className={`${chip} border-dashed`}>
          Alertas (planta)
        </Link>
      </nav>
      <p className="text-xs text-stone-500 mt-2 px-1">
        Use las pestañas de abajo o estos accesos. CXP y pagos comparten la vista &quot;Por pagar&quot;.
      </p>
    </div>
  )
}
