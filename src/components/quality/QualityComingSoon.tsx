'use client'

import React from 'react'
import { Construction } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function QualityComingSoon({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center mb-6">
          <Construction className="h-8 w-8 text-stone-400" />
        </div>
        <h1 className="text-xl font-bold text-stone-900 mb-2">{title}</h1>
        <p className="text-sm text-stone-600 mb-4">{description}</p>
        <Badge variant="outline" className="text-xs">
          Próximamente
        </Badge>
      </div>
    </div>
  )
}
