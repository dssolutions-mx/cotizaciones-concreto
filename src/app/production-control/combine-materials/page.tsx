'use client'

import React from 'react'
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb'
import MaterialCombinationForm from '@/components/inventory/MaterialCombinationForm'

export default function CombineMaterialsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <InventoryBreadcrumb />
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Combinación de materiales</h1>
        <p className="text-stone-600 mt-1 text-sm">
          Registra la mezcla de materiales de entrada en un material resultante. El costo FIFO de
          los insumos (incluyendo flete) se transfiere al material combinado. Permite fechas pasadas.
        </p>
      </div>
      <MaterialCombinationForm />
    </div>
  )
}
