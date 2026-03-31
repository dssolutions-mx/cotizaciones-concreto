'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { procurementEntriesUrl, buildProcurementUrl } from '@/lib/procurement/navigation'

export type LifecycleSummary = {
  po: {
    id: string
    po_number: string | null
    status: string
    supplier_name: string | null
  }
  alerts: Array<{ id: string; alert_number: string; status: string }>
  lines: Array<{
    item_id: string
    is_service?: boolean
    material_name: string
    qty_ordered: number
    qty_received: number
    line_uom?: string | null
    entries: Array<{
      id: string
      entry_number: string | null
      entry_date?: string | null
      quantity_received?: number | null
      received_qty_kg?: number | null
      pricing_status: string | null
      fleet_qty_entered?: number | null
      fleet_uom?: string | null
      payables?: Array<{ id: string; invoice_number: string | null; status: string; total: number }>
    }>
  }>
}

function statusBadge(status: string) {
  const s = status?.toLowerCase() || ''
  if (s.includes('fulfilled') || s.includes('closed') || s.includes('paid')) return 'bg-green-100 text-green-800 border-green-200'
  if (s.includes('partial') || s.includes('open')) return 'bg-amber-100 text-amber-900 border-amber-200'
  if (s.includes('pending')) return 'bg-stone-100 text-stone-700 border-stone-200'
  return 'bg-sky-50 text-sky-800 border-sky-200'
}

export function DocumentFlowFromLifecycle({
  data,
  plantId,
}: {
  data: LifecycleSummary
  plantId?: string
}) {
  const alertNodes = data.alerts.slice(0, 3)
  const entryCount = data.lines.reduce((n, l) => n + l.entries.length, 0)
  const hasPricingPending = data.lines.some((l) =>
    l.entries.some((e) => e.pricing_status === 'pending')
  )

  const poLabel = data.po.po_number || data.po.id.slice(0, 8)

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5 mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 mb-2">Cadena del documento</p>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
        {alertNodes.length > 0 ? (
          <>
            {alertNodes.map((a, i) => (
              <React.Fragment key={a.id}>
                {i > 0 && <span className="text-stone-300">·</span>}
                <Link
                  href={plantId ? `/production-control/alerts?plant_id=${encodeURIComponent(plantId)}` : '/production-control/alerts'}
                  className={cn('rounded px-2 py-0.5 border font-mono', statusBadge(a.status))}
                >
                  {a.alert_number}
                </Link>
              </React.Fragment>
            ))}
            <ArrowRight className="h-3 w-3 text-stone-400 shrink-0" />
          </>
        ) : null}
        <span className={cn('rounded px-2 py-0.5 border font-medium', statusBadge(data.po.status))}>OC {poLabel}</span>
        <ArrowRight className="h-3 w-3 text-stone-400 shrink-0" />
        <Link
          href={procurementEntriesUrl({ plantId, poId: data.po.id })}
          className={cn(
            'rounded px-2 py-0.5 border',
            entryCount > 0 ? 'bg-white border-stone-200 text-stone-800 hover:bg-stone-50' : 'bg-stone-100 text-stone-500 border-stone-200'
          )}
        >
          {entryCount} entrada{entryCount === 1 ? '' : 's'}
        </Link>
        <ArrowRight className="h-3 w-3 text-stone-400 shrink-0" />
        <Link
          href={buildProcurementUrl('/finanzas/procurement', { plantId, tab: 'cxp', poId: data.po.id })}
          className={cn(
            'rounded px-2 py-0.5 border',
            hasPricingPending ? 'border-amber-300 bg-amber-50 text-amber-900' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
          )}
        >
          CXP {hasPricingPending ? '(revisar precios)' : ''}
        </Link>
      </div>
    </div>
  )
}
