'use client'

import React, { Suspense } from 'react'
import ReorderConfigPage from '@/components/inventory/ReorderConfigPage'

export default function ReorderPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-muted-foreground">Cargando configuracion...</div>}>
      <ReorderConfigPage />
    </Suspense>
  )
}
