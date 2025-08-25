'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Check, ChevronsUpDown, Package, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'

interface Material {
  id: string
  material_name: string
  category: string
  subcategory?: string
  unit_of_measure: string
  is_active: boolean
}

interface MaterialSelectProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
}

export default function MaterialSelect({ 
  value, 
  onChange, 
  required = false, 
  disabled = false 
}: MaterialSelectProps) {
  const { userProfile } = useAuth()
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    fetchMaterials()
  }, [])

  const fetchMaterials = async () => {
    try {
      const response = await fetch('/api/materials')
      if (response.ok) {
        const data = await response.json()
        setMaterials(data.materials?.filter((m: Material) => m.is_active) || [])
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedMaterial = materials.find(m => m.id === value)

  // Group materials by category
  const groupedMaterials = materials.reduce((acc, material) => {
    const category = material.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(material)
    return acc
  }, {} as Record<string, Material[]>)

  // Filter materials based on search
  const filteredMaterials = materials.filter(material =>
    material.material_name.toLowerCase().includes(searchValue.toLowerCase()) ||
    material.category.toLowerCase().includes(searchValue.toLowerCase()) ||
    (material.subcategory && material.subcategory.toLowerCase().includes(searchValue.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-10 w-full bg-gray-200 animate-pulse rounded-md"></div>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedMaterial ? (
            <div className="flex items-center gap-2 text-left">
              <Package className="h-4 w-4 text-gray-500" />
              <div className="flex flex-col">
                <span className="font-medium">{selectedMaterial.material_name}</span>
                <span className="text-xs text-gray-500">
                  {selectedMaterial.category} - {selectedMaterial.unit_of_measure}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500">
              <Package className="h-4 w-4" />
              <span>Seleccionar material...</span>
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput 
            placeholder="Buscar material..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandEmpty>No se encontraron materiales.</CommandEmpty>
          {Object.entries(groupedMaterials).map(([category, categoryMaterials]) => {
            const visibleMaterials = categoryMaterials.filter(material =>
              material.material_name.toLowerCase().includes(searchValue.toLowerCase()) ||
              material.category.toLowerCase().includes(searchValue.toLowerCase()) ||
              (material.subcategory && material.subcategory.toLowerCase().includes(searchValue.toLowerCase()))
            )

            if (visibleMaterials.length === 0) return null

            return (
              <CommandGroup key={category} heading={category}>
                {visibleMaterials.map((material) => (
                  <CommandItem
                    key={material.id}
                    value={material.id}
                    onSelect={(currentValue) => {
                      onChange(currentValue === value ? '' : currentValue)
                      setOpen(false)
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Check
                        className={cn(
                          "h-4 w-4",
                          value === material.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <Package className="h-4 w-4 text-gray-500" />
                      <div className="flex flex-col flex-1">
                        <span className="font-medium">{material.material_name}</span>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Badge variant="outline" className="text-xs">
                            {material.category}
                          </Badge>
                          {material.subcategory && (
                            <Badge variant="outline" className="text-xs">
                              {material.subcategory}
                            </Badge>
                          )}
                          <span>{material.unit_of_measure}</span>
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
