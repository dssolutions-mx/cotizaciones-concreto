'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { procurementEntriesUrl } from '@/lib/procurement/navigation'
import { format, subDays } from 'date-fns'
import { DollarSign } from 'lucide-react'

/**
 * Procurement-scoped pricing review teaser (compact card on resumen).
 * Shows pending count; full flow is under Entradas → Cola de precios.
 */
export default function PricingReviewQueue({
  workspacePlantId,
  onPricingAction: _onPricingAction,
}: {
  /** Omit or empty = all plants (global roles). */
  workspacePlantId?: string
  onPricingAction?: () => void
}) {
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const from = format(subDays(new Date(), 30), 'yyyy-MM-dd')
        const to = format(new Date(), 'yyyy-MM-dd')
        const params = new URLSearchParams({
          date_from: from,
          date_to: to,
          pricing_status: 'pending',
          limit: '1',
          include: 'document_counts',
        })
        if (workspacePlantId) params.set('plant_id', workspacePlantId)
        // Use limit=100 to get a real count (API doesn't expose total_count separately)
        params.set('limit', '100')
        const res = await fetch(`/api/inventory/entries?${params}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setPendingCount((data.entries || []).length)
        }
      } catch {
        // ignore
      }
    })()
    return () => { cancelled = true }
  }, [workspacePlantId])

  return (
    <Card className="rounded-xl border border-stone-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-amber-600" />
          Revisión de precios
          {pendingCount != null && pendingCount > 0 && (
            <Badge className="bg-amber-100 text-amber-900 border-0 text-[11px]">
              {pendingCount}
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs text-stone-500">
          {pendingCount == null
            ? 'Cargando entradas pendientes…'
            : pendingCount === 0
              ? 'No hay entradas pendientes de revisión.'
              : `${pendingCount} entrada${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''} de revisión en los últimos 30 días.`}
        </CardDescription>
      </CardHeader>
      {pendingCount != null && pendingCount > 0 && (
        <CardContent>
          <Link
            href={procurementEntriesUrl({
              plantId: workspacePlantId || undefined,
              entradasPrecios: true,
            })}
            className="text-xs text-sky-800 hover:underline font-medium inline-block"
          >
            Abrir cola de precios →
          </Link>
        </CardContent>
      )}
      {pendingCount != null && pendingCount === 0 && (
        <CardContent className="pt-0">
          <Link
            href={procurementEntriesUrl({
              plantId: workspacePlantId || undefined,
              entradasRevisadas: true,
            })}
            className="text-xs text-sky-800 hover:underline font-medium inline-block"
          >
            Ver entradas ya revisadas →
          </Link>
        </CardContent>
      )}
    </Card>
  )
}
