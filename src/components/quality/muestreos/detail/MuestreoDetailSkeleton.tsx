'use client'

import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function MuestreoDetailSkeleton() {
  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
      <Skeleton className="h-10 w-full max-w-md rounded-md" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton className="h-[420px] rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-52 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  )
}
