'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Plus,
  TrendingDown,
  Minus,
  AlertTriangle,
  RotateCcw,
  ArrowUpDown,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  adjustmentBadgeClass,
  adjustmentTypeLabelEs,
  formatSignedKg,
  referenceTypeLabelEs,
  signedQuantityForStockEffect,
  stockDirectionForType,
} from '@/lib/inventory/adjustmentModel'
import type { MaterialAdjustment } from '@/types/inventory'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function adjustmentIcon(type: string) {
  switch (type) {
    case 'initial_count':
    case 'physical_count':
    case 'positive_correction':
      return Plus
    case 'consumption':
      return TrendingDown
    case 'waste':
      return AlertTriangle
    case 'correction':
      return RotateCcw
    case 'transfer':
      return ArrowUpDown
    case 'loss':
      return Minus
    default:
      return TrendingDown
  }
}

type Props = {
  adjustment: MaterialAdjustment
  canDelete?: boolean
  deleting?: boolean
  onDelete?: (adjustment: MaterialAdjustment) => void
}

export default function AdjustmentRowCard({
  adjustment,
  canDelete,
  deleting,
  onDelete,
}: Props) {
  const Icon = adjustmentIcon(adjustment.adjustment_type)
  const inc = stockDirectionForType(adjustment.adjustment_type) === 'increase'
  const signed = signedQuantityForStockEffect(
    adjustment.adjustment_type,
    adjustment.quantity_adjusted,
  )
  const matName = adjustment.materials?.material_name
  const isClosure = adjustment.reference_type === 'inventory_closure'
  const userName = adjustment.adjusted_by_user
    ? `${adjustment.adjusted_by_user.first_name} ${adjustment.adjusted_by_user.last_name}`.trim()
    : null

  return (
    <Card
      className={cn(
        'border-l-4 hover:shadow-md transition-shadow',
        inc ? 'border-l-emerald-500' : 'border-l-red-500',
      )}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            <Icon className={cn('h-8 w-8 shrink-0', inc ? 'text-emerald-600' : 'text-red-500')} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="text-sm sm:text-base font-medium text-gray-900">
                  {adjustment.adjustment_number}
                </p>
                <Badge
                  variant="outline"
                  className={cn('text-xs', adjustmentBadgeClass(adjustment.adjustment_type))}
                >
                  {adjustmentTypeLabelEs(adjustment.adjustment_type)}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    isClosure
                      ? 'border-violet-200 bg-violet-50 text-violet-800'
                      : 'border-stone-200 bg-stone-50 text-stone-600',
                  )}
                >
                  {referenceTypeLabelEs(adjustment.reference_type)}
                </Badge>
              </div>
              {matName && (
                <p className="text-sm font-medium text-stone-800 mb-1">{matName}</p>
              )}
              {adjustment.reference_notes && (
                <p className="text-sm text-gray-500 line-clamp-3 mb-1">{adjustment.reference_notes}</p>
              )}
              <p className="text-xs text-gray-400">
                {format(new Date(adjustment.adjustment_date), 'dd/MM/yyyy', { locale: es })}
                {adjustment.adjustment_time ? ` · ${adjustment.adjustment_time.slice(0, 5)}` : ''}
                {userName ? ` · ${userName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 shrink-0">
            <div className="text-left sm:text-right">
              <p
                className={cn(
                  'text-lg sm:text-xl font-semibold font-mono tabular-nums',
                  inc ? 'text-emerald-700' : 'text-red-600',
                )}
              >
                {formatSignedKg(signed)} kg
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Inventario: {Number(adjustment.inventory_before).toLocaleString('es-MX')} →{' '}
                {Number(adjustment.inventory_after).toLocaleString('es-MX')}
              </p>
            </div>
            {canDelete && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-stone-400 hover:text-red-600 hover:bg-red-50"
                title="Eliminar ajuste (solo ejecutivo)"
                disabled={deleting}
                onClick={() => onDelete(adjustment)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
