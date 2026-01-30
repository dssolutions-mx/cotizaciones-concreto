'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Package } from 'lucide-react'

export type MaterialCategory = 'all' | 'cement' | 'aggregate' | 'water' | 'admixture'

interface MaterialCategoryFilterProps {
  selectedCategory: MaterialCategory
  onCategoryChange: (category: MaterialCategory) => void
  className?: string
}

const categories: Array<{ value: MaterialCategory; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'cement', label: 'Cemento' },
  { value: 'aggregate', label: 'Agregados' },
  { value: 'water', label: 'Agua' },
  { value: 'admixture', label: 'Aditivos' }
]

export default function MaterialCategoryFilter({
  selectedCategory,
  onCategoryChange,
  className
}: MaterialCategoryFilterProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {categories.map((category) => (
        <Button
          key={category.value}
          variant={selectedCategory === category.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onCategoryChange(category.value)}
          className={cn(
            'text-xs sm:text-sm',
            selectedCategory === category.value && 'font-semibold'
          )}
        >
          {category.value !== 'all' && <Package className="h-3 w-3 mr-1" />}
          {category.label}
        </Button>
      ))}
    </div>
  )
}
