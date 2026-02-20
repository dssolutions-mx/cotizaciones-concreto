'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { MaterialEntry } from '@/types/inventory'
import { DollarSign, Truck, Save, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface EntryPricingFormProps {
  entry: MaterialEntry
  onSuccess?: (warnings?: string[]) => void
  onCancel?: () => void
}

interface Supplier {
  id: string
  name: string
}

export default function EntryPricingForm({ entry, onSuccess, onCancel }: EntryPricingFormProps) {
  const [loading, setLoading] = useState(false)
  const [apiWarnings, setApiWarnings] = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [formData, setFormData] = useState({
    unit_price: entry.unit_price?.toString() || '',
    total_cost: entry.total_cost?.toString() || '',
    fleet_supplier_id: entry.fleet_supplier_id || '',
    fleet_cost: entry.fleet_cost?.toString() || '',
    supplier_invoice: entry.supplier_invoice || '',
    ap_due_date_material: entry.ap_due_date_material || '',
    fleet_invoice: entry.fleet_invoice || '',
    ap_due_date_fleet: entry.ap_due_date_fleet || '',
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

  // Currency formatter for MXN amounts
  const currencyFormatter = React.useMemo(() => new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }), [])

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value || '0') : value
    if (Number.isNaN(num)) return ''
    return currencyFormatter.format(num)
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch(`/api/suppliers?plant_id=${entry.plant_id}`)
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

    // If supplier invoice is provided, require material due date
    if (formData.supplier_invoice && !formData.ap_due_date_material) {
      toast.error('Fecha de vencimiento (material) es requerida cuando hay remisión/factura del proveedor')
      return
    }

    // If fleet supplier is provided with cost, require fleet invoice and due date
    const hasFleet = !!formData.fleet_supplier_id && !!formData.fleet_cost && parseFloat(formData.fleet_cost) > 0
    if (hasFleet) {
      if (!formData.fleet_invoice) {
        toast.error('Factura de flota es requerida cuando se registra costo de flota')
        return
      }
      if (!formData.ap_due_date_fleet) {
        toast.error('Fecha de vencimiento (flota) es requerida cuando se registra costo de flota')
        return
      }
    }

    setLoading(true)
    try {
      const updatePayload = {
        id: entry.id,
        unit_price: parseFloat(formData.unit_price),
        total_cost: parseFloat(formData.total_cost),
        ...(formData.fleet_supplier_id && { fleet_supplier_id: formData.fleet_supplier_id }),
        ...(formData.fleet_cost && { fleet_cost: parseFloat(formData.fleet_cost) }),
        ...(formData.supplier_invoice && { supplier_invoice: formData.supplier_invoice }),
        ...(formData.ap_due_date_material && { ap_due_date_material: formData.ap_due_date_material }),
        ...(formData.fleet_invoice && { fleet_invoice: formData.fleet_invoice }),
        ...(formData.ap_due_date_fleet && { ap_due_date_fleet: formData.ap_due_date_fleet }),
      }

      const response = await fetch('/api/inventory/entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (response.ok) {
        const data = await response.json()
        const warnings = Array.isArray(data.warnings) ? data.warnings : []
        toast.success('Precios actualizados exitosamente')
        if (warnings.length > 0) {
          setApiWarnings(warnings)
          toast.warning(
            <div className="space-y-2">
              <p className="font-medium">Advertencias de conciliación 3 vías:</p>
              <ul className="list-disc list-inside text-sm">
                {warnings.map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>,
            { duration: 10000 }
          )
        }
        onSuccess?.(warnings)
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
      {apiWarnings.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-800 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Advertencias de conciliación 3 vías</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
              {apiWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
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
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="0.00"
              required
            />
            {formData.unit_price && (
              <div className="text-xs text-gray-500 mt-1">
                {formatCurrency(formData.unit_price)} por kg
              </div>
            )}
          </div>
          
          <div>
            <Label htmlFor="total_cost">Costo Total (auto-calculado)</Label>
            <Input
              id="total_cost"
              type="text"
              value={formatCurrency(formData.total_cost || '0')}
              readOnly
              className="bg-gray-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="supplier_invoice">Remisión/Factura del Proveedor</Label>
            <Input
              id="supplier_invoice"
              type="text"
              value={formData.supplier_invoice}
              onChange={(e) => setFormData(prev => ({ ...prev, supplier_invoice: e.target.value }))}
              placeholder="Ej. FAC-12345"
            />
          </div>
          <div>
            <Label htmlFor="ap_due_date_material">Fecha de Vencimiento (Material)</Label>
            <Input
              id="ap_due_date_material"
              type="date"
              value={formData.ap_due_date_material}
              onChange={(e) => setFormData(prev => ({ ...prev, ap_due_date_material: e.target.value }))}
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
              onValueChange={(value) => setFormData(prev => ({ ...prev, fleet_supplier_id: value === 'none' ? '' : value }))}
            >
              <SelectTrigger id="fleet_supplier">
                <SelectValue placeholder="Seleccione proveedor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin proveedor</SelectItem>
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
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="0.00"
            />
            {formData.fleet_cost && (
              <div className="text-xs text-gray-500 mt-1">
                {formatCurrency(formData.fleet_cost)}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fleet_invoice">Factura de Flota</Label>
            <Input
              id="fleet_invoice"
              type="text"
              value={formData.fleet_invoice}
              onChange={(e) => setFormData(prev => ({ ...prev, fleet_invoice: e.target.value }))}
              placeholder="Ej. FL-9988"
            />
          </div>
          <div>
            <Label htmlFor="ap_due_date_fleet">Fecha de Vencimiento (Flota)</Label>
            <Input
              id="ap_due_date_fleet"
              type="date"
              value={formData.ap_due_date_fleet}
              onChange={(e) => setFormData(prev => ({ ...prev, ap_due_date_fleet: e.target.value }))}
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
              {formatCurrency(parseFloat(formData.total_cost) + parseFloat(formData.fleet_cost || '0'))}
            </span>
          </div>
          {formData.fleet_cost && parseFloat(formData.fleet_cost) > 0 && (
            <div className="text-xs text-blue-700 mt-1">
              Material: {formatCurrency(parseFloat(formData.total_cost))} + 
              Flota: {formatCurrency(parseFloat(formData.fleet_cost))}
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

