'use client'

import React from 'react'
import PlantInventoryReviewPanel from '@/components/inventory/PlantInventoryReviewPanel'

export default function ProcurementInventoryDetail({
  workspacePlantId,
  availablePlants,
}: {
  workspacePlantId: string
  availablePlants: Array<{ id: string; name: string; code?: string }>
}) {
  return (
    <PlantInventoryReviewPanel workspacePlantId={workspacePlantId} availablePlants={availablePlants} />
  )
}
