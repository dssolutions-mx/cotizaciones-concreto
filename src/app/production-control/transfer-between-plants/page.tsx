'use client'

import React from 'react'
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb'
import InterPlantTransferForm from '@/components/inventory/InterPlantTransferForm'

export default function TransferBetweenPlantsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <InventoryBreadcrumb />
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Transferencia entre plantas</h1>
        <p className="text-stone-600 mt-1 text-sm">
          Libro pareado: descuento en origen (tipo transferencia) y recepción en destino (corrección positiva). Se
          envía notificación a operaciones.
        </p>
      </div>
      <InterPlantTransferForm />
    </div>
  )
}
