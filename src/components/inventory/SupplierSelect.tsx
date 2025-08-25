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
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronsUpDown, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'

interface Supplier {
  id: string
  name: string
  provider_number: number
  provider_letter?: string
  internal_code?: string
  is_active: boolean
}

interface SupplierSelectProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
}

export default function SupplierSelect({ 
  value, 
  onChange, 
  required = false, 
  disabled = false 
}: SupplierSelectProps) {
  const { userProfile } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    try {
      // For now, we'll create some mock suppliers since the API might not be ready
      // In a real implementation, this would fetch from the suppliers API
      const mockSuppliers: Supplier[] = [
        { id: '1', name: 'CEMEX México', provider_number: 1, provider_letter: 'C', is_active: true },
        { id: '2', name: 'Holcim México', provider_number: 2, provider_letter: 'H', is_active: true },
        { id: '3', name: 'Cementos Cruz Azul', provider_number: 3, provider_letter: 'A', is_active: true },
        { id: '4', name: 'Grupo Calidra', provider_number: 4, provider_letter: 'G', is_active: true },
        { id: '5', name: 'Proveedora Local S.A.', provider_number: 5, provider_letter: 'P', is_active: true },
        { id: '6', name: 'Materiales del Bajío', provider_number: 6, provider_letter: 'M', is_active: true },
      ]
      setSuppliers(mockSuppliers.filter(s => s.is_active))
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedSupplier = suppliers.find(s => s.id === value)

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
          {selectedSupplier ? (
            <div className="flex items-center gap-2 text-left">
              <Truck className="h-4 w-4 text-gray-500" />
              <div className="flex flex-col">
                <span className="font-medium">{selectedSupplier.name}</span>
                <span className="text-xs text-gray-500">
                  Proveedor #{selectedSupplier.provider_number}
                  {selectedSupplier.provider_letter && ` (${selectedSupplier.provider_letter})`}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500">
              <Truck className="h-4 w-4" />
              <span>Seleccionar proveedor...</span>
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0">
        <Command>
          <CommandInput placeholder="Buscar proveedor..." />
          <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
          <CommandGroup>
            {suppliers.map((supplier) => (
              <CommandItem
                key={supplier.id}
                value={supplier.id}
                onSelect={(currentValue) => {
                  onChange(currentValue === value ? '' : currentValue)
                  setOpen(false)
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === supplier.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Truck className="h-4 w-4 text-gray-500" />
                  <div className="flex flex-col flex-1">
                    <span className="font-medium">{supplier.name}</span>
                    <span className="text-xs text-gray-500">
                      Proveedor #{supplier.provider_number}
                      {supplier.provider_letter && ` (${supplier.provider_letter})`}
                      {supplier.internal_code && ` - ${supplier.internal_code}`}
                    </span>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
