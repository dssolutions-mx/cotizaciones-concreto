'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, MoreVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Props = {
  numeroMuestreo: number
  remisionLabel: string
  statusLabel: string
  statusClassName: string
  onDeleteMuestreo: () => void
}

export default function MuestreoDetailHeader({
  numeroMuestreo,
  remisionLabel,
  statusLabel,
  statusClassName,
  onDeleteMuestreo,
}: Props) {
  const router = useRouter()

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-stone-900">
            Muestreo #{numeroMuestreo}
          </h1>
          <Badge variant="outline" className={statusClassName}>
            {statusLabel}
          </Badge>
        </div>
        <p className="text-sm text-stone-600">Remisión {remisionLabel}</p>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className={cn(
            'h-9 border-stone-300 bg-white shadow-none hover:bg-stone-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700/35 focus-visible:ring-offset-2'
          )}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'h-9 w-9 border-stone-300 bg-white shadow-none hover:bg-stone-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700/35 focus-visible:ring-offset-2'
              )}
              aria-label="Más acciones"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
              onClick={onDeleteMuestreo}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar muestreo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
