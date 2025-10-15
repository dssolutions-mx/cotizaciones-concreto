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
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Check, ChevronsUpDown, Package, Search, Filter, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Material {
  id: string
  material_code?: string
  material_name: string
  category: string
  subcategory?: string
  unit_of_measure: string
  is_active: boolean
  plant_id?: string
}

interface MaterialSelectProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  plantId?: string
}

export default function MaterialSelect({ 
  value, 
  onChange, 
  required = false, 
  disabled = false,
  plantId
}: MaterialSelectProps) {
  
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    if (plantId) {
      fetchMaterials()
    } else {
      setMaterials([])
      setLoading(false)
    }
  }, [plantId])

  const fetchMaterials = async () => {
    if (!plantId) return
    
    try {
      setLoading(true)
      console.log('Fetching materials for plant:', plantId)
      const response = await fetch(`/api/materials?plant_id=${plantId}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Materials API response:', data)
        // The API returns data.data, not data.materials
        const materialsArray = data.data || data.materials || []
        console.log('Materials array:', materialsArray)
        // Filter by plant_id and active status
        const plantMaterials = materialsArray.filter((m: Material) => 
          m.is_active && m.plant_id === plantId
        )
        console.log('Filtered plant materials:', plantMaterials)
        setMaterials(plantMaterials)
      } else {
        console.error('Materials API error:', response.status, response.statusText)
        setMaterials([])
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }

  const selectedMaterial = materials.find(m => m.id === value)

  // Get unique categories for filtering
  const categories = ['all', ...Array.from(new Set(materials.map(m => m.category)))]

  // Filter materials based on search and category
  const filteredMaterials = materials.filter(material => {
    const matchesSearch = 
      material.material_name.toLowerCase().includes(searchValue.toLowerCase()) ||
      (material.material_code && material.material_code.toLowerCase().includes(searchValue.toLowerCase())) ||
      material.category.toLowerCase().includes(searchValue.toLowerCase()) ||
      (material.subcategory && material.subcategory.toLowerCase().includes(searchValue.toLowerCase()))
    
    const matchesCategory = selectedCategory === 'all' || material.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  // Group materials by category for display
  const groupedMaterials = filteredMaterials.reduce((acc, material) => {
    const category = material.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(material)
    return acc
  }, {} as Record<string, Material[]>)

  if (!plantId) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-10 w-full bg-gray-100 rounded-md flex items-center justify-center text-sm text-gray-500">
          Seleccione una planta primero
        </div>
      </div>
    )
  }

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
          disabled={disabled || materials.length === 0}
        >
          {selectedMaterial ? (
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <div className="flex flex-col items-start text-left">
                <span className="font-medium truncate max-w-[200px]">
                  {selectedMaterial.material_code && (
                    <span className="text-blue-600 font-mono mr-2">
                      {selectedMaterial.material_code}
                    </span>
                  )}
                  {selectedMaterial.material_name}
                </span>
                <span className="text-xs text-gray-500">
                  {selectedMaterial.category}
                  {selectedMaterial.subcategory && ` • ${selectedMaterial.subcategory}`}
                  {` • ${selectedMaterial.unit_of_measure}`}
                </span>
              </div>
            </div>
          ) : (
            materials.length === 0 ? 'No hay materiales disponibles' : 'Seleccionar material...'
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput 
              placeholder="Buscar por nombre, código o categoría..." 
              value={searchValue}
              onValueChange={setSearchValue}
              className="border-0 focus:ring-0"
            />
          </div>
          
          {/* Category Filter */}
          <div className="flex items-center gap-1 p-2 border-b">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600 mr-2">Filtrar por:</span>
            {categories.map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className={cn(
                  "cursor-pointer text-xs",
                  selectedCategory === category && "bg-blue-600 text-white"
                )}
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'Todas' : category}
              </Badge>
            ))}
          </div>

          <CommandList className="max-h-[400px]">
            <CommandEmpty>
              <div className="p-4 text-center text-gray-500">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No se encontraron materiales</p>
                <p className="text-sm">Intenta con otros términos de búsqueda</p>
              </div>
            </CommandEmpty>
            
            {Object.entries(groupedMaterials).map(([category, categoryMaterials]) => (
              <CommandGroup key={category} heading={category.toUpperCase()}>
                {categoryMaterials.map((material) => (
                  <CommandItem
                    key={material.id}
                    value={material.id}
                    onSelect={(currentValue) => {
                      onChange(currentValue === value ? '' : currentValue)
                      setOpen(false)
                      setSearchValue('')
                      setSelectedCategory('all')
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-gray-50">
                      <Check
                        className={cn(
                          "h-4 w-4",
                          value === material.id ? "opacity-100 text-blue-600" : "opacity-0"
                        )}
                      />
                      <Package className="h-5 w-5 text-gray-400 shrink-0" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {material.material_code && (
                            <Badge variant="secondary" className="font-mono text-xs">
                              <Hash className="h-3 w-3 mr-1" />
                              {material.material_code}
                            </Badge>
                          )}
                          <span className="font-medium text-gray-900 truncate">
                            {material.material_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Badge variant="outline" className="text-xs">
                            {material.category}
                          </Badge>
                          {material.subcategory && (
                            <Badge variant="outline" className="text-xs">
                              {material.subcategory}
                            </Badge>
                          )}
                          <span className="text-gray-400">•</span>
                          <span className="font-mono">{material.unit_of_measure}</span>
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          
          {/* Summary */}
          <div className="border-t p-2 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {filteredMaterials.length} de {materials.length} materiales
              </span>
              {selectedCategory !== 'all' && (
                <span>
                  Categoría: {selectedCategory}
                </span>
              )}
            </div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
