'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  trend?: {
    value: number
    label?: string
  }
  subtitle?: string
  className?: string
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = 'text-blue-600',
  trend,
  subtitle,
  className
}: StatCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      return val.toLocaleString('es-MX')
    }
    return val
  }

  const getTrendColor = (trendValue: number) => {
    if (trendValue > 0) return 'text-green-600'
    if (trendValue < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const getTrendIcon = (trendValue: number) => {
    if (trendValue > 0) return '↑'
    if (trendValue < 0) return '↓'
    return '→'
  }

  return (
    <Card className={cn('h-full', className)}>
      <CardContent className="p-6">
        <div className="flex items-center">
          <div className={cn('p-2 rounded-full mr-4', iconColor.replace('text-', 'bg-').replace('-600', '-100'))}>
            <Icon className={cn('h-6 w-6', iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-600 truncate">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-gray-900">{formatValue(value)}</p>
              {trend && (
                <span className={cn('text-sm font-medium flex items-center gap-1', getTrendColor(trend.value))}>
                  <span>{getTrendIcon(trend.value)}</span>
                  <span>{Math.abs(trend.value)}%</span>
                  {trend.label && <span className="text-xs text-gray-500">({trend.label})</span>}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
