'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  className?: string
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className
}: EmptyStateProps) {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-4">
        <div className="p-4 bg-gray-100 rounded-full mb-4">
          <Icon className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2 text-center">
          {title}
        </h3>
        <p className="text-gray-500 text-center mb-6 max-w-md">
          {description}
        </p>
        {(actionLabel || secondaryActionLabel) && (
          <div className="flex flex-col sm:flex-row gap-3">
            {actionLabel && onAction && (
              <Button onClick={onAction} size="lg" className="min-w-[160px]">
                {actionLabel}
              </Button>
            )}
            {secondaryActionLabel && onSecondaryAction && (
              <Button 
                onClick={onSecondaryAction} 
                variant="outline" 
                size="lg"
                className="min-w-[160px]"
              >
                {secondaryActionLabel}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
