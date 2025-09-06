'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
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
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Check, ChevronsUpDown, Truck, Search, Hash, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Supplier {
  id: string
  name: string
  provider_number: number
  provider_letter?: string
  internal_code?: string
  is_active: boolean
  plant_id?: string
}

interface SupplierSelectProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  plantId?: string
}

export default function SupplierSelect({ 
  value, 
  onChange, 
  required = false, 
  disabled = false,
  plantId
}: SupplierSelectProps) {
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    if (plantId) {
      fetchSuppliers()
    } else {
      setSuppliers([])
      setLoading(false)
    }
  }, [plantId])

  const fetchSuppliers = async () => {
    if (!plantId) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/suppliers?plant_id=${plantId}`)
      if (response.ok) {
        const data = await response.json()
        // Filter by plant_id and active status
        const plantSuppliers = data.suppliers?.filter((s: Supplier) => 
          s.is_active && (!s.plant_id || s.plant_id === plantId)
        ) || []
        setSuppliers(plantSuppliers)
      } else {
        // Fallback to recipe service if API endpoint doesn't exist
        const { recipeService } = await import('@/lib/supabase/recipes')
        const suppliersData = await recipeService.getSuppliers(plantId)
        const plantSuppliers = suppliersData.filter((s: any) => 
          s.is_active && (!s.plant_id || s.plant_id === plantId)
        )
        setSuppliers(plantSuppliers)
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }

  const selectedSupplier = suppliers.find(s => s.id === value)

  // Filter suppliers based on search
  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    supplier.provider_number.toString().includes(searchValue) ||
    (supplier.provider_letter && supplier.provider_letter.toLowerCase().includes(searchValue.toLowerCase())) ||
    (supplier.internal_code && supplier.internal_code.toLowerCase().includes(searchValue.toLowerCase()))
  )

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
          disabled={disabled || suppliers.length === 0}
        >
          {selectedSupplier ? (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <div className="flex flex-col items-start text-left">
                <span className="font-medium truncate max-w-[200px]">
                  <span className="text-blue-600 font-mono mr-2">
                    #{selectedSupplier.provider_number}
                  </span>
                  {selectedSupplier.name}
                </span>
                <span className="text-xs text-gray-500">
                  {selectedSupplier.provider_letter && `Letra: ${selectedSupplier.provider_letter}`}
                  {selectedSupplier.internal_code && ` • Código: ${selectedSupplier.internal_code}`}
                </span>
              </div>
            </div>
          ) : (
            suppliers.length === 0 ? 'No hay proveedores disponibles' : 'Seleccionar proveedor...'
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput 
              placeholder="Buscar por nombre, número o código..." 
              value={searchValue}
              onValueChange={setSearchValue}
              className="border-0 focus:ring-0"
            />
          </div>
          
          <CommandList className="max-h-[400px]">
            <CommandEmpty>
              <div className="p-4 text-center text-gray-500">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No se encontraron proveedores</p>
                <p className="text-sm">Intenta con otros términos de búsqueda</p>
              </div>
            </CommandEmpty>
            
            <CommandGroup heading="PROVEEDORES">
              {filteredSuppliers.map((supplier) => (
                <CommandItem
                  key={supplier.id}
                  value={supplier.id}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? '' : currentValue)
                    setOpen(false)
                    setSearchValue('')
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-gray-50">
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === supplier.id ? "opacity-100 text-blue-600" : "opacity-0"
                      )}
                    />
                    <Building2 className="h-5 w-5 text-gray-400 shrink-0" />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="font-mono text-xs">
                          <Hash className="h-3 w-3 mr-1" />
                          #{supplier.provider_number}
                        </Badge>
                        {supplier.provider_letter && (
                          <Badge variant="outline" className="text-xs">
                            {supplier.provider_letter}
                          </Badge>
                        )}
                        <span className="font-medium text-gray-900 truncate">
                          {supplier.name}
                        </span>
                      </div>
                      {supplier.internal_code && (
                        <div className="text-xs text-gray-500">
                          <span className="font-mono">Código: {supplier.internal_code}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          
          {/* Summary */}
          <div className="border-t p-2 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {filteredSuppliers.length} de {suppliers.length} proveedores
              </span>
              <span>
                Planta: {plantId}
              </span>
            </div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
