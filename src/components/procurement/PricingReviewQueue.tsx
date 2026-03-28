'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import EntryPricingReviewList from '@/components/inventory/EntryPricingReviewList'
import Link from 'next/link'
import { productionEntriesUrl } from '@/lib/procurement/navigation'

/**
 * Procurement-scoped pricing review (reuses production entry pricing UI with plant filter).
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
          Entradas con precio pendiente de revisión. También puede gestionarlas en Control de producción.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <EntryPricingReviewList
          plantId={workspacePlantId || undefined}
          onSuccess={() => onPricingAction?.()}
        />
        <Link
          href={productionEntriesUrl({ plantId: workspacePlantId || undefined, tab: 'pricing' })}
          className="text-xs text-sky-800 hover:underline font-medium inline-block"
        >
          Abrir vista completa en entradas →
        </Link>
      </CardContent>
    </Card>
  )
}
