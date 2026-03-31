'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
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
  /** FK en catálogo de materiales — define el proveedor habitual del insumo. */
  supplier_id?: string | null
  /** Set when fetching with supplier_id (PO flow). */
  has_supplier_agreement?: boolean
  /** Material apareció en líneas de OC de este proveedor (planta). */
  has_po_history_with_supplier?: boolean
  /** Recepciones registradas con este proveedor aunque no haya línea de OC (o legacy). */
  has_entry_history_with_supplier?: boolean
}

export type MaterialSelectChangeMeta = {
  material_name?: string
}

interface MaterialSelectProps {
  value: string
  /** Second argument is set when the user picks a row from the list (avoids race with parent fetching the same catalog). */
  onChange: (value: string, meta?: MaterialSelectChangeMeta) => void
  required?: boolean
  disabled?: boolean
  plantId?: string
  /** When set, full catalog is shown; materials are enriched with suggestion flags (OC previa, etc.). */
  supplierId?: string
}

export default function MaterialSelect({
  value,
  onChange,
  required: _required = false,
  disabled = false,
  plantId,
  supplierId,
}: MaterialSelectProps) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    if (!plantId) {
      setMaterials([])
      setLoading(false)
      return
    }

    const ac = new AbortController()
    setLoading(true)
    const qs = new URLSearchParams({ plant_id: plantId })
    if (supplierId) qs.set('supplier_id', supplierId)

    fetch(`/api/materials?${qs.toString()}`, { signal: ac.signal })
      .then((response) => {
        if (!response.ok) {
          setMaterials([])
          return
        }
        return response.json()
      })
      .then((data) => {
        if (!data) return
        const materialsArray = data.data || data.materials || []
        const plantMaterials = materialsArray.filter(
          (m: Material) => m.is_active && m.plant_id === plantId
        )
        setMaterials(plantMaterials)
      })
      .catch((error) => {
        if ((error as Error).name === 'AbortError') return
        console.error('Error fetching materials:', error)
        setMaterials([])
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })

    return () => ac.abort()
  }, [plantId, supplierId])

  const selectedMaterial = materials.find((m) => m.id === value)

  const categories = ['all', ...Array.from(new Set(materials.map((m) => m.category)))]

  const filteredMaterials = materials.filter((material) => {
    const matchesSearch =
      material.material_name.toLowerCase().includes(searchValue.toLowerCase()) ||
      (material.material_code &&
        material.material_code.toLowerCase().includes(searchValue.toLowerCase())) ||
      material.category.toLowerCase().includes(searchValue.toLowerCase()) ||
      (material.subcategory &&
        material.subcategory.toLowerCase().includes(searchValue.toLowerCase()))

    const matchesCategory = selectedCategory === 'all' || material.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const groupedMaterials = filteredMaterials.reduce(
    (acc, material) => {
      const category = material.category
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(material)
      return acc
    },
    {} as Record<string, Material[]>
  )

  const isSuggestedForSupplier = (m: Material) =>
    !!(m.has_supplier_agreement || m.has_po_history_with_supplier || m.has_entry_history_with_supplier)

  const { suggestedMaterials, restMaterials } = useMemo(() => {
    if (!supplierId) {
      return { suggestedMaterials: [] as Material[], restMaterials: [] as Material[] }
    }
    const sortByName = (a: Material, b: Material) =>
      a.material_name.localeCompare(b.material_name, 'es', { sensitivity: 'base' })
    const sug = filteredMaterials.filter(isSuggestedForSupplier).sort(sortByName)
    const rest = filteredMaterials.filter((m) => !isSuggestedForSupplier(m)).sort(sortByName)
    return { suggestedMaterials: sug, restMaterials: rest }
  }, [filteredMaterials, supplierId])

  const renderMaterialItem = (material: Material) => (
    <CommandItem
      key={material.id}
      value={material.id}
      onSelect={(currentValue) => {
        const next = currentValue === value ? '' : currentValue
        onChange(
          next,
          next ? { material_name: material.material_name } : undefined
        )
        setOpen(false)
        setSearchValue('')
        setSelectedCategory('all')
      }}
      className="cursor-pointer"
    >
      <div className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-stone-50">
        <Check
          className={cn(
            'h-4 w-4 shrink-0',
            value === material.id ? 'opacity-100 text-sky-800' : 'opacity-0'
          )}
        />
        <Package className="h-5 w-5 text-stone-400 shrink-0" />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {material.material_code && (
              <Badge variant="secondary" className="font-mono text-xs bg-stone-100 text-stone-800">
                <Hash className="h-3 w-3 mr-1" />
                {material.material_code}
              </Badge>
            )}
            <span className="font-medium text-stone-900 truncate">{material.material_name}</span>
            {supplierId && material.has_supplier_agreement && (
              <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-900 border-emerald-200">
                Acuerdo
              </Badge>
            )}
            {supplierId && !material.has_supplier_agreement && material.has_po_history_with_supplier && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-stone-300">
                OC previa
              </Badge>
            )}
            {supplierId &&
              !material.has_supplier_agreement &&
              !material.has_po_history_with_supplier &&
              material.has_entry_history_with_supplier && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-200 text-amber-900">
                  Recepción previa
                </Badge>
              )}
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-500 flex-wrap">
            <Badge variant="outline" className="text-xs border-stone-200">
              {material.category}
            </Badge>
            {material.subcategory && (
              <Badge variant="outline" className="text-xs border-stone-200">
                {material.subcategory}
              </Badge>
            )}
            <span className="text-stone-400">•</span>
            <span className="font-mono text-stone-600">{material.unit_of_measure}</span>
          </div>
        </div>
      </div>
    </CommandItem>
  )

  if (!plantId) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-10 w-full bg-stone-100 rounded-md flex items-center justify-center text-sm text-stone-500 border border-stone-200">
          Seleccione una planta primero
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-10 w-full bg-stone-200 animate-pulse rounded-md border border-stone-200" />
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
          className="w-full justify-between border-stone-200 bg-white hover:bg-stone-50"
          disabled={disabled || materials.length === 0}
        >
          {selectedMaterial ? (
            <div className="flex items-center gap-2 min-w-0">
              <Package className="h-4 w-4 shrink-0 text-stone-500" />
              <div className="flex flex-col items-start text-left min-w-0">
                <span className="font-medium truncate max-w-[200px]">
                  {selectedMaterial.material_code && (
                    <span className="text-sky-800 font-mono text-sm mr-2">{selectedMaterial.material_code}</span>
                  )}
                  {selectedMaterial.material_name}
                </span>
                <span className="text-xs text-stone-500">
                  {selectedMaterial.category}
                  {selectedMaterial.subcategory && ` • ${selectedMaterial.subcategory}`}
                  {` • ${selectedMaterial.unit_of_measure}`}
                </span>
              </div>
            </div>
          ) : materials.length === 0 ? (
            'No hay materiales disponibles'
          ) : (
            'Seleccionar material...'
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(500px,calc(100vw-2rem))] p-0 border-stone-200"
        align="start"
      >
        <Command className="rounded-md">
          <div className="flex items-center border-b border-stone-200 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-stone-500" />
            <CommandInput
              placeholder="Buscar por nombre, código o categoría..."
              value={searchValue}
              onValueChange={setSearchValue}
              className="border-0 focus:ring-0"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-2 border-b border-stone-200 bg-stone-50/80">
            <Filter className="h-4 w-4 text-stone-500 shrink-0" />
            <span className="text-sm text-stone-600 mr-1">Filtrar por:</span>
            {categories.map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer text-xs font-medium border-stone-200',
                  selectedCategory === category && 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
                )}
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'Todas' : category}
              </Badge>
            ))}
          </div>

          <CommandList className="max-h-[400px]">
            <CommandEmpty>
              <div className="p-4 text-center text-stone-500">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No se encontraron materiales</p>
                <p className="text-sm text-stone-400">Intenta con otros términos de búsqueda</p>
              </div>
            </CommandEmpty>

            {supplierId ? (
              <>
                {suggestedMaterials.length > 0 && (
                  <CommandGroup heading="Sugeridos (OCs previas o historial con este proveedor)">
                    {suggestedMaterials.map((m) => renderMaterialItem(m))}
                  </CommandGroup>
                )}
                <CommandGroup
                  heading={
                    suggestedMaterials.length > 0 ? 'Resto del catálogo' : 'Materiales'
                  }
                >
                  {restMaterials.map((m) => renderMaterialItem(m))}
                </CommandGroup>
              </>
            ) : (
              Object.entries(groupedMaterials).map(([category, categoryMaterials]) => (
                <CommandGroup key={category} heading={category.toUpperCase()}>
                  {categoryMaterials.map((material) => renderMaterialItem(material))}
                </CommandGroup>
              ))
            )}
          </CommandList>

          <div className="border-t border-stone-200 p-2 bg-stone-50/90">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>
                {filteredMaterials.length} de {materials.length} materiales
              </span>
              {selectedCategory !== 'all' && <span>Categoría: {selectedCategory}</span>}
            </div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
