'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { MaterialEntry } from '@/types/inventory'
import { DollarSign, Truck, Save } from 'lucide-react'

interface EntryPricingFormProps {
  entry: MaterialEntry
  onSuccess?: () => void
  onCancel?: () => void
}

interface Supplier {
  id: string
  name: string
}

export default function EntryPricingForm({ entry, onSuccess, onCancel }: EntryPricingFormProps) {
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [formData, setFormData] = useState({
    unit_price: entry.unit_price?.toString() || '',
    total_cost: entry.total_cost?.toString() || '',
    fleet_supplier_id: entry.fleet_supplier_id || '',
    fleet_cost: entry.fleet_cost?.toString() || '',
  })

  useEffect(() => {
    fetchSuppliers()
  }, [])

  // Auto-calculate total_cost when unit_price changes
  useEffect(() => {
    if (formData.unit_price && entry.quantity_received) {
      const calculated = parseFloat(formData.unit_price) * entry.quantity_received
      setFormData(prev => ({
        ...prev,
        total_cost: calculated.toFixed(2)
      }))
    }
  }, [formData.unit_price, entry.quantity_received])

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers')
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.unit_price) {
      toast.error('El precio unitario es requerido')
      return
    }

    setLoading(true)
    try {
      const updatePayload = {
        id: entry.id,
        unit_price: parseFloat(formData.unit_price),
        total_cost: parseFloat(formData.total_cost),
        ...(formData.fleet_supplier_id && { fleet_supplier_id: formData.fleet_supplier_id }),
        ...(formData.fleet_cost && { fleet_cost: parseFloat(formData.fleet_cost) }),
      }

      const response = await fetch('/api/inventory/entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (response.ok) {
        toast.success('Precios actualizados exitosamente')
        onSuccess?.()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Error al actualizar precios')
      }
    } catch (error) {
      console.error('Error updating pricing:', error)
      toast.error('Error al actualizar precios')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg border">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Revisión de Precios</h3>
        <div className="text-sm text-gray-500">
          Entrada: <span className="font-mono">{entry.entry_number}</span>
        </div>
      </div>

      {/* Entry Summary */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Material:</span>
          <span className="font-medium">{entry.material?.material_name || entry.material_id}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Cantidad:</span>
          <span className="font-medium">
            {entry.quantity_received.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {entry.material?.unit_of_measure || 'kg'}
          </span>
        </div>
      </div>

      {/* Material Pricing */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Costo del Material
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="unit_price">Precio Unitario (por kg) *</Label>
            <Input
              id="unit_price"
              type="number"
              step="0.00001"
              min="0"
              value={formData.unit_price}
              onChange={(e) => setFormData(prev => ({ ...prev, unit_price: e.target.value }))}
              placeholder="0.00"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="total_cost">Costo Total (auto-calculado)</Label>
            <Input
              id="total_cost"
              type="number"
              step="0.01"
              min="0"
              value={formData.total_cost}
              readOnly
              className="bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* Fleet Pricing */}
      <div className="space-y-4 pt-4 border-t">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Costo de Flota (Opcional)
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fleet_supplier">Proveedor de Flota</Label>
            <Select
              value={formData.fleet_supplier_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, fleet_supplier_id: value }))}
            >
              <SelectTrigger id="fleet_supplier">
                <SelectValue placeholder="Seleccione proveedor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin proveedor</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="fleet_cost">Costo de Flota</Label>
            <Input
              id="fleet_cost"
              type="number"
              step="0.01"
              min="0"
              value={formData.fleet_cost}
              onChange={(e) => setFormData(prev => ({ ...prev, fleet_cost: e.target.value }))}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      {formData.total_cost && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-blue-900">Costo Total de la Entrada:</span>
            <span className="text-lg font-bold text-blue-900">
              ${(parseFloat(formData.total_cost) + parseFloat(formData.fleet_cost || '0')).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
          </div>
          {formData.fleet_cost && parseFloat(formData.fleet_cost) > 0 && (
            <div className="text-xs text-blue-700 mt-1">
              Material: ${parseFloat(formData.total_cost).toLocaleString('es-MX', { minimumFractionDigits: 2 })} + 
              Flota: ${parseFloat(formData.fleet_cost).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Guardando...' : 'Guardar Precios'}
        </Button>
      </div>
    </form>
  )
}

