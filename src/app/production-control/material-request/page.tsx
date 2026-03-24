'use client'

import React, { Suspense } from 'react'
import MaterialRequestForm from '@/components/inventory/MaterialRequestForm'

export default function MaterialRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[200px] items-center justify-center text-stone-500">Cargando…</div>
      }
    >
      <MaterialRequestForm />
    </Suspense>
  )
}
