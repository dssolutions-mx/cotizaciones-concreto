'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentFlowFromLifecycle, type LifecycleSummary } from '@/components/procurement/DocumentFlow'

type LifecycleApiData = LifecycleSummary & { credit_history_total?: number }
import { productionEntriesUrl } from '@/lib/procurement/navigation'

export default function POLifecycleView({ poId, plantId }: { poId: string; plantId?: string }) {
  const [data, setData] = useState<LifecycleApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/po/${poId}/lifecycle`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error')
      setData(json.success ? json.data : null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [poId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <Skeleton className="h-24 w-full rounded-lg mb-4" />
  }
  if (err || !data) {
    return null
  }

  const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

  return (
    <div className="mb-4 space-y-3">
      <DocumentFlowFromLifecycle data={data} plantId={plantId} />
      {data.credit_history_total > 0 && (
        <p className="text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded-md px-2 py-1.5">
          Créditos aplicados en historial (aprox.): {mxn.format(data.credit_history_total)}
        </p>
      )}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-stone-600">Entradas y facturas por línea</p>
        {data.lines.map((line) => (
          <div key={line.item_id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
            <div className="font-medium text-stone-900 mb-2">{line.material_name}</div>
            <div className="text-xs text-stone-500 mb-2">
              Pedido {line.qty_ordered.toLocaleString('es-MX')} · Recibido {line.qty_received.toLocaleString('es-MX')}
            </div>
            {line.entries.length === 0 ? (
              <p className="text-xs text-stone-400">Sin entradas registradas para esta línea</p>
            ) : (
              <ul className="space-y-2">
                {line.entries.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2 first:border-0 first:pt-0">
                    <div>
                      <Link
                        href={productionEntriesUrl({ plantId, poId })}
                        className="font-mono text-sky-800 hover:underline text-xs"
                      >
                        {e.entry_number || e.id.slice(0, 8)}
                      </Link>
                      <span className="text-xs text-stone-500 ml-2">
                        Precio: {e.pricing_status === 'pending' ? 'pendiente' : 'revisado'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {e.payables?.length ? (
                        e.payables.map((p) => (
                          <Link
                            key={p.id}
                            href={`/finanzas/procurement?tab=cxp&payable_id=${encodeURIComponent(p.id)}`}
                            className="text-[10px] rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-violet-900"
                          >
                            {p.invoice_number || p.id.slice(0, 6)} · {p.status}
                          </Link>
                        ))
                      ) : (
                        <span className="text-[10px] text-stone-400">Sin CXP vinculada</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
