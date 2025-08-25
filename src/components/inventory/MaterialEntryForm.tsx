'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Package, 
  Upload, 
  Save, 
  Calculator,
  FileText,
  Truck,
  User,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { toast } from 'sonner'
import { MaterialEntryInput } from '@/types/inventory'
import MaterialSelect from './MaterialSelect'
import SupplierSelect from './SupplierSelect'
import FileUpload from './FileUpload'

interface MaterialEntryFormProps {
  onSuccess?: () => void
}

export default function MaterialEntryForm({ onSuccess }: MaterialEntryFormProps) {
  const { userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<MaterialEntryInput>({
    material_id: '',
    quantity_received: 0,
    supplier_id: '',
    supplier_invoice: '',
    truck_number: '',
    driver_name: '',
    notes: '',
    entry_date: new Date().toISOString().split('T')[0],
    documents: []
  })
  const [uploading, setUploading] = useState(false)
  const [currentInventory, setCurrentInventory] = useState<number | null>(null)

  // Calculate inventory after
  const inventoryAfter = currentInventory !== null 
    ? currentInventory + formData.quantity_received 
    : null

  const handleMaterialChange = async (materialId: string) => {
    setFormData(prev => ({ ...prev, material_id: materialId }))
    
    if (materialId) {
      try {
        const response = await fetch(`/api/inventory?material_id=${materialId}`)
        if (response.ok) {
          const data = await response.json()
          const inventory = data.inventory.find((inv: any) => inv.material_id === materialId)
          setCurrentInventory(inventory?.current_stock || 0)
        }
      } catch (error) {
        console.error('Error fetching current inventory:', error)
      }
    } else {
      setCurrentInventory(null)
    }
  }

  const handleFileUpload = async (files: FileList) => {
    setUploading(true)
    try {
      const uploadedUrls: string[] = []
      
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'entry')
        
        const response = await fetch('/api/inventory/documents', {
          method: 'POST',
          body: formData
        })
        
        if (response.ok) {
          const data = await response.json()
          uploadedUrls.push(data.url)
        }
      }
      
      setFormData(prev => ({
        ...prev,
        documents: [...(prev.documents || []), ...uploadedUrls.map(url => ({ name: url, url }))]
      }))
      
      toast.success(`${uploadedUrls.length} archivo(s) subido(s) correctamente`)
    } catch (error) {
      console.error('Error uploading files:', error)
      toast.error('Error al subir los archivos')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.material_id || formData.quantity_received <= 0) {
      toast.error('Por favor complete todos los campos requeridos')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/inventory/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          inventory_before: currentInventory || 0,
          document_urls: formData.documents?.map(doc => typeof doc === 'string' ? doc : doc.url)
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Entrada registrada correctamente')
        
        // Reset form
        setFormData({
          material_id: '',
          quantity_received: 0,
          supplier_id: '',
          supplier_invoice: '',
          truck_number: '',
          driver_name: '',
          notes: '',
          entry_date: new Date().toISOString().split('T')[0],
          documents: []
        })
        setCurrentInventory(null)
        
        onSuccess?.()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al registrar la entrada')
      }
    } catch (error) {
      console.error('Error creating entry:', error)
      toast.error(error instanceof Error ? error.message : 'Error al registrar la entrada')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Material Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Información del Material
          </CardTitle>
          <CardDescription>
            Seleccione el material y especifique la cantidad recibida
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="material_id">Material *</Label>
              <MaterialSelect
                value={formData.material_id}
                onChange={handleMaterialChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quantity_received">Cantidad Recibida (kg) *</Label>
              <Input
                id="quantity_received"
                type="number"
                step="0.01"
                min="0"
                value={formData.quantity_received || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  quantity_received: parseFloat(e.target.value) || 0 
                }))}
                required
              />
            </div>
          </div>

          {/* Inventory Calculation */}
          {currentInventory !== null && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Cálculo de Inventario</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-blue-700">Inventario Actual</p>
                  <p className="font-semibold text-blue-900">
                    {currentInventory.toLocaleString('es-ES', { minimumFractionDigits: 2 })} kg
                  </p>
                </div>
                <div>
                  <p className="text-blue-700">Cantidad a Agregar</p>
                  <p className="font-semibold text-green-600">
                    +{formData.quantity_received.toLocaleString('es-ES', { minimumFractionDigits: 2 })} kg
                  </p>
                </div>
                <div>
                  <p className="text-blue-700">Inventario Final</p>
                  <p className="font-semibold text-blue-900">
                    {inventoryAfter?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} kg
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="entry_date">Fecha de Entrada</Label>
            <Input
              id="entry_date"
              type="date"
              value={formData.entry_date}
              onChange={(e) => setFormData(prev => ({ ...prev, entry_date: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Supplier Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Información del Proveedor
          </CardTitle>
          <CardDescription>
            Datos del proveedor y entrega
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Proveedor</Label>
              <SupplierSelect
                value={formData.supplier_id || ''}
                onChange={(value) => setFormData(prev => ({ ...prev, supplier_id: value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier_invoice">Número de Factura</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="supplier_invoice"
                  value={formData.supplier_invoice || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier_invoice: e.target.value }))}
                  className="pl-10"
                  placeholder="Ej: FAC-2024-001"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="truck_number">Número de Camión</Label>
              <div className="relative">
                <Truck className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="truck_number"
                  value={formData.truck_number || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, truck_number: e.target.value }))}
                  className="pl-10"
                  placeholder="Ej: ABC-123"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="driver_name">Nombre del Conductor</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="driver_name"
                  value={formData.driver_name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, driver_name: e.target.value }))}
                  className="pl-10"
                  placeholder="Nombre completo"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes and Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Notas y Documentos
          </CardTitle>
          <CardDescription>
            Información adicional y documentos de evidencia
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Observaciones adicionales sobre la entrada..."
            />
          </div>
          
          <div className="space-y-2">
            <Label>Documentos de Evidencia</Label>
            <FileUpload
              onFileSelect={handleFileUpload}
              acceptedTypes={['image/*', 'application/pdf']}
              multiple
              uploading={uploading}
              disabled={loading}
            />
            
            {formData.documents && formData.documents.length > 0 && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-gray-600">
                  {formData.documents.length} archivo(s) subido(s)
                </p>
                {formData.documents.map((doc, index) => (
                  <div key={index} className="text-xs text-gray-500">
                    {typeof doc === 'string' ? doc : doc.name || doc.url}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end space-x-3">
        <Button 
          type="button" 
          variant="outline"
          onClick={() => {
            setFormData({
              material_id: '',
              quantity_received: 0,
              supplier_id: '',
              supplier_invoice: '',
              truck_number: '',
              driver_name: '',
              notes: '',
              entry_date: new Date().toISOString().split('T')[0],
              documents: []
            })
            setCurrentInventory(null)
          }}
        >
          Limpiar
        </Button>
        <Button 
          type="submit" 
          disabled={loading || uploading || !formData.material_id || formData.quantity_received <= 0}
          className="min-w-[120px]"
        >
          {loading ? (
            'Guardando...'
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar Entrada
            </>
          )}
        </Button>
      </div>

      {/* Warning for missing required fields */}
      {(!formData.material_id || formData.quantity_received <= 0) && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <p className="text-sm text-yellow-700">
            Complete el material y la cantidad para continuar
          </p>
        </div>
      )}
    </form>
  )
}
