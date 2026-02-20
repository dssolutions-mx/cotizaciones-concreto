'use client'

import React, { Suspense } from 'react'
import MaterialEntriesPage from '@/components/inventory/MaterialEntriesPage'

export default function InventoryEntriesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-muted-foreground">Cargando...</div>}>
      <MaterialEntriesPage />
    </Suspense>
  )
}
