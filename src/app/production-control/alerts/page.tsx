'use client'

import React, { Suspense } from 'react'
import MaterialAlertsPage from '@/components/inventory/MaterialAlertsPage'

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-muted-foreground">Cargando alertas...</div>}>
      <MaterialAlertsPage />
    </Suspense>
  )
}
