'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import EntryPricingReviewList from '@/components/inventory/EntryPricingReviewList'
import Link from 'next/link'
import { procurementEntriesUrl } from '@/lib/procurement/navigation'

/**
 * Procurement-scoped pricing review (compact card on resumen; full flow under Entradas → Revisión de precios).
 */
export default function PricingReviewQueue({
  workspacePlantId,
  onPricingAction,
}: {
  /** Omit or empty = all plants (global roles). */
  workspacePlantId?: string
  onPricingAction?: () => void
}) {
  return (
    <Card className="rounded-xl border border-stone-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600">
          Revisión de precios de entradas
        </CardTitle>
        <CardDescription className="text-xs text-stone-500">
          Entradas con precio pendiente de revisión. La vista completa está en Entradas → Revisión de precios (este
          espacio).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <EntryPricingReviewList
          plantId={workspacePlantId || undefined}
          onSuccess={() => onPricingAction?.()}
        />
        <Link
          href={procurementEntriesUrl({
            plantId: workspacePlantId || undefined,
            entradasPrecios: true,
          })}
          className="text-xs text-sky-800 hover:underline font-medium inline-block"
        >
          Abrir vista completa (Entradas → Revisión de precios) →
        </Link>
      </CardContent>
    </Card>
  )
}
