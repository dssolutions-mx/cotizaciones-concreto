'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Package } from 'lucide-react'

interface Material {
  id: string
  name: string
  category: 'cement' | 'aggregate' | 'water' | 'admixture'
}

interface MaterialQuickSelectProps {
  materials: Material[]
  selectedMaterialId?: string
  onSelect: (materialId: string) => void
  className?: string
  showAll?: boolean
}

const categoryColors = {
  cement: 'bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-300',
  aggregate: 'bg-orange-100 hover:bg-orange-200 text-orange-900 border-orange-300',
  water: 'bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-300',
  admixture: 'bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-300'
}

export default function MaterialQuickSelect({
  materials,
  selectedMaterialId,
  onSelect,
  className,
  showAll = true
}: MaterialQuickSelectProps) {
  // Group materials by category
  const groupedMaterials = materials.reduce((acc, material) => {
    if (!acc[material.category]) {
      acc[material.category] = []
    }
    acc[material.category].push(material)
    return acc
  }, {} as Record<string, Material[]>)

  // Common materials to show first (if available)
  const commonMaterials = materials.filter(m => 
    ['cement', 'gravel', 'sand', 'water'].some(name => 
      m.name.toLowerCase().includes(name)
    )
  ).slice(0, 4)

  const displayMaterials = showAll ? materials : commonMaterials

  return (
    <div className={cn('space-y-3', className)}>
      {showAll && Object.keys(groupedMaterials).length > 0 && (
        <>
          {Object.entries(groupedMaterials).map(([category, categoryMaterials]) => (
            <div key={category} className="space-y-2">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                {category === 'cement' && 'Cemento'}
                {category === 'aggregate' && 'Agregados'}
                {category === 'water' && 'Agua'}
                {category === 'admixture' && 'Aditivos'}
              </p>
              <div className="flex flex-wrap gap-2">
                {categoryMaterials.map((material) => (
                  <Button
                    key={material.id}
                    variant={selectedMaterialId === material.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onSelect(material.id)}
                    className={cn(
                      'h-12 min-w-[120px] text-sm font-medium',
                      selectedMaterialId === material.id 
                        ? 'bg-primary text-primary-foreground' 
                        : categoryColors[material.category] || 'bg-gray-50 hover:bg-gray-100'
                    )}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    {material.name}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      
      {!showAll && (
        <div className="flex flex-wrap gap-2">
          {displayMaterials.map((material) => (
            <Button
              key={material.id}
              variant={selectedMaterialId === material.id ? 'default' : 'outline'}
              size="lg"
              onClick={() => onSelect(material.id)}
              className={cn(
                'h-14 min-w-[140px] text-base font-medium',
                selectedMaterialId === material.id 
                  ? 'bg-primary text-primary-foreground' 
                  : categoryColors[material.category] || 'bg-gray-50 hover:bg-gray-100'
              )}
            >
              <Package className="h-5 w-5 mr-2" />
              {material.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
