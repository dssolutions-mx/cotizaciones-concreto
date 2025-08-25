'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import MaterialSelect from './MaterialSelect'
import FileUpload from './FileUpload'
import DocumentPreview from './DocumentPreview'
import { uploadDocument } from '@/lib/utils/upload'
import { toast } from 'sonner'
import { Minus, Plus, AlertTriangle, Info } from 'lucide-react'

interface MaterialAdjustmentFormData {
  materialId: string
  adjustmentType: 'manual_out' | 'manual_in' | 'correction' | 'waste' | 'transfer' | 'return'
  quantity: number
  reason: string
  referenceNumber?: string
  transferDestination?: string
  notes?: string
  documents: string[]
}

interface MaterialAdjustmentFormProps {
  onSuccess?: (adjustment: any) => void
  onCancel?: () => void
  initialData?: Partial<MaterialAdjustmentFormData>
}

const adjustmentTypes = [
  {
    value: 'manual_out',
    label: 'Salida Manual',
    description: 'Material usado manualmente fuera del sistema Arkik',
    color: 'red' as const,
    icon: Minus
  },
  {
    value: 'manual_in',
    label: 'Entrada Manual',
    description: 'Material agregado manualmente al inventario',
    color: 'green' as const,
    icon: Plus
  },
  {
    value: 'correction',
    label: 'Corrección',
    description: 'Ajuste por diferencias de inventario físico',
    color: 'blue' as const,
    icon: Info
  },
  {
    value: 'waste',
    label: 'Material en Mal Estado',
    description: 'Material dañado o vencido que debe ser descartado',
    color: 'orange' as const,
    icon: AlertTriangle
  },
  {
    value: 'transfer',
    label: 'Transferencia',
    description: 'Material transferido a otra planta o ubicación',
    color: 'purple' as const,
    icon: Minus
  },
  {
    value: 'return',
    label: 'Devolución',
    description: 'Material devuelto al proveedor',
    color: 'gray' as const,
    icon: Minus
  }
]

export default function MaterialAdjustmentForm({
  onSuccess,
  onCancel,
  initialData
}: MaterialAdjustmentFormProps) {
  const [formData, setFormData] = useState<MaterialAdjustmentFormData>({
    materialId: '',
    adjustmentType: 'manual_out',
    quantity: 0,
    reason: '',
    referenceNumber: '',
    transferDestination: '',
    notes: '',
    documents: [],
    ...initialData
  })

  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)

  const selectedAdjustmentType = adjustmentTypes.find(
    type => type.value === formData.adjustmentType
  )

  const handleFileUpload = async (files: FileList) => {
    setUploading(true)
    try {
      const uploadedUrls = await Promise.all(
        Array.from(files).map(file => uploadDocument(file, 'adjustment'))
      )
      setFormData(prev => ({
        ...prev,
        documents: [...prev.documents, ...uploadedUrls]
      }))
      toast.success('Documentos subidos correctamente')
    } catch (error) {
      console.error('Error uploading documents:', error)
      toast.error('Error al subir documentos')
    } finally {
      setUploading(false)
    }
  }

  const removeDocument = (index: number) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.materialId || !formData.adjustmentType || !formData.quantity || !formData.reason) {
      toast.error('Por favor complete todos los campos obligatorios')
      return
    }

    if (formData.adjustmentType === 'transfer' && !formData.transferDestination) {
      toast.error('Debe especificar el destino de la transferencia')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          material_id: formData.materialId,
          adjustment_type: formData.adjustmentType,
          quantity: formData.quantity,
          reason: formData.reason,
          reference_number: formData.referenceNumber,
          transfer_destination: formData.transferDestination,
          notes: formData.notes,
          document_urls: formData.documents
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error al crear el ajuste')
      }

      const adjustment = await response.json()
      toast.success('Ajuste de inventario registrado correctamente')
      
      if (onSuccess) {
        onSuccess(adjustment)
      }

      // Reset form
      setFormData({
        materialId: '',
        adjustmentType: 'manual_out',
        quantity: 0,
        reason: '',
        referenceNumber: '',
        transferDestination: '',
        notes: '',
        documents: []
      })
    } catch (error) {
      console.error('Error creating adjustment:', error)
      toast.error(error instanceof Error ? error.message : 'Error al crear el ajuste')
    } finally {
      setSubmitting(false)
    }
  }

  const getQuantitySign = () => {
    if (['manual_out', 'waste', 'transfer', 'return'].includes(formData.adjustmentType)) {
      return '-'
    }
    return '+'
  }

  const getQuantityColor = () => {
    if (['manual_out', 'waste', 'transfer', 'return'].includes(formData.adjustmentType)) {
      return 'text-red-600'
    }
    return 'text-green-600'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajuste de Inventario</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Material Selection */}
          <FormField
            label="Material"
            required
          >
            <MaterialSelect
              value={formData.materialId}
              onChange={(value) => setFormData(prev => ({ ...prev, materialId: value }))}
            />
          </FormField>

          {/* Adjustment Type */}
          <FormField
            label="Tipo de Ajuste"
            required
          >
            <Select
              value={formData.adjustmentType}
              onValueChange={(value: any) => setFormData(prev => ({ ...prev, adjustmentType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione el tipo de ajuste" />
              </SelectTrigger>
              <SelectContent>
                {adjustmentTypes.map((type) => {
                  const Icon = type.icon
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-gray-500">{type.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            
            {selectedAdjustmentType && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`border-${selectedAdjustmentType.color}-200 text-${selectedAdjustmentType.color}-700`}>
                    {selectedAdjustmentType.label}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedAdjustmentType.description}
                </p>
              </div>
            )}
          </FormField>

          {/* Quantity */}
          <FormField
            label="Cantidad"
            required
            description="La cantidad será aplicada según el tipo de ajuste seleccionado"
          >
            <div className="relative">
              <div className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-lg font-bold ${getQuantityColor()}`}>
                {getQuantitySign()}
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                className="pl-8"
                placeholder="0.00"
              />
            </div>
          </FormField>

          {/* Transfer Destination (only for transfers) */}
          {formData.adjustmentType === 'transfer' && (
            <FormField
              label="Destino de Transferencia"
              required
            >
              <Input
                value={formData.transferDestination}
                onChange={(e) => setFormData(prev => ({ ...prev, transferDestination: e.target.value }))}
                placeholder="Planta o ubicación de destino"
              />
            </FormField>
          )}

          {/* Reason */}
          <FormField
            label="Motivo"
            required
          >
            <Textarea
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Describa el motivo del ajuste"
              rows={3}
            />
          </FormField>

          {/* Reference Number */}
          <FormField
            label="Número de Referencia"
            description="Número de orden, ticket, o documento de referencia"
          >
            <Input
              value={formData.referenceNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, referenceNumber: e.target.value }))}
              placeholder="OT-001, TICKET-123, etc."
            />
          </FormField>

          {/* Notes */}
          <FormField
            label="Notas Adicionales"
          >
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Observaciones adicionales"
              rows={2}
            />
          </FormField>

          {/* Document Upload */}
          <FormField
            label="Documentos de Evidencia"
            description="Fotos, documentos o evidencia del ajuste"
          >
            <FileUpload
              onFileSelect={handleFileUpload}
              acceptedTypes={['image/*', 'application/pdf']}
              multiple
              uploading={uploading}
            />
            {formData.documents.length > 0 && (
              <div className="mt-4 space-y-2">
                {formData.documents.map((url, index) => (
                  <DocumentPreview 
                    key={index} 
                    url={url} 
                    onRemove={() => removeDocument(index)}
                  />
                ))}
              </div>
            )}
          </FormField>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || uploading}
              className={getQuantityColor()}
            >
              {submitting ? 'Guardando...' : `${getQuantitySign()} ${selectedAdjustmentType?.label || 'Ajuste'}`}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
