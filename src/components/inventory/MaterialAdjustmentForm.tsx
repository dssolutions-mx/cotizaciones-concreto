'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Package, 
  Save, 
  Calculator,
  FileText,
  User,
  AlertCircle,
  Minus, 
  Plus, 
  AlertTriangle, 
  Info
} from 'lucide-react'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { usePlantContext } from '@/contexts/PlantContext'
import { toast } from 'sonner'
import { PendingFile } from '@/types/inventory'
import MaterialSelect from './MaterialSelect'
import SimpleFileUpload from './SimpleFileUpload'
import { format } from 'date-fns'

interface MaterialAdjustmentFormData {
  material_id: string
  adjustment_type: 'consumption' | 'waste' | 'correction' | 'transfer' | 'loss'
  quantity_adjusted: number
  reference_type?: string
  reference_notes: string
  adjustment_date: string
}

interface MaterialAdjustmentFormProps {
  onSuccess?: (adjustment: any) => void
  onCancel?: () => void
  initialData?: Partial<MaterialAdjustmentFormData>
}

const adjustmentTypes = [
  {
    value: 'consumption',
    label: 'Consumo',
    description: 'Material consumido en producción',
    color: 'red' as const,
    icon: Minus
  },
  {
    value: 'waste',
    label: 'Material en Mal Estado',
    description: 'Material dañado o vencido que debe ser descartado',
    color: 'orange' as const,
    icon: AlertTriangle
  },
  {
    value: 'correction',
    label: 'Corrección',
    description: 'Ajuste por diferencias de inventario físico',
    color: 'blue' as const,
    icon: Info
  },
  {
    value: 'transfer',
    label: 'Transferencia',
    description: 'Material transferido a otra planta o ubicación',
    color: 'purple' as const,
    icon: Minus
  },
  {
    value: 'loss',
    label: 'Pérdida',
    description: 'Material perdido o no contabilizado',
    color: 'gray' as const,
    icon: Minus
  }
]

export default function MaterialAdjustmentForm({
  onSuccess,
  onCancel,
  initialData
}: MaterialAdjustmentFormProps) {
  const { profile } = useAuthSelectors()
  const { currentPlant } = usePlantContext()
  
  console.log('MaterialAdjustmentForm - profile:', profile);
  console.log('MaterialAdjustmentForm - currentPlant:', currentPlant);
  console.log('MaterialAdjustmentForm - currentPlant?.id:', currentPlant?.id);
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<MaterialAdjustmentFormData>({
    material_id: '',
    adjustment_type: 'consumption',
    quantity_adjusted: 0,
    reference_type: '',
    reference_notes: '',
    adjustment_date: new Date().toISOString().split('T')[0],
    ...initialData
  })
  const [uploading, setUploading] = useState(false)
  const [currentInventory, setCurrentInventory] = useState<number | null>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [existingDocuments, setExistingDocuments] = useState<any[]>([])

  // Allow signed quantity_adjusted: positive adds stock, negative reduces stock
  const inventoryAfter = currentInventory !== null ? currentInventory + formData.quantity_adjusted : null

  const selectedAdjustmentType = adjustmentTypes.find(
    type => type.value === formData.adjustment_type
  )

  // Fetch existing documents when adjustment is created
  const fetchExistingDocuments = async (adjustmentId: string) => {
    try {
      const response = await fetch(`/api/inventory/documents?reference_id=${adjustmentId}&type=adjustment`);
      if (response.ok) {
        const data = await response.json();
        setExistingDocuments(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  // Delete existing document
  const deleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/inventory/documents?id=${documentId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Remove from local state
        setExistingDocuments(prev => prev.filter(doc => doc.id !== documentId));
        toast.success('Documento eliminado correctamente');
      } else {
        const error = await response.json();
        toast.error(`Error al eliminar documento: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error al eliminar documento');
    }
  };

  const handleMaterialChange = async (materialId: string) => {
    setFormData(prev => ({ ...prev, material_id: materialId }))
    
    const plantId = currentPlant?.id || profile?.plant_id;
    
    if (materialId && plantId) {
      try {
        const response = await fetch(`/api/inventory?material_id=${materialId}&plant_id=${plantId}`)
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

  // Handle file upload
  const handleFileUpload = (files: FileList) => {
    const newFiles = Array.from(files).map(file => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending' as const
    }));
    
    setPendingFiles(prev => [...prev, ...newFiles]);
  };

  // Remove pending file
  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload documents after adjustment creation
  const uploadDocuments = async (adjustmentId: string) => {
    if (pendingFiles.length === 0) return;

    const uploadPromises = pendingFiles.map(async (fileInfo) => {
      try {
        const formData = new FormData();
        formData.append('file', fileInfo.file);
        formData.append('type', 'adjustment');
        formData.append('reference_id', adjustmentId);

        const response = await fetch('/api/inventory/documents', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          return { ...fileInfo, status: 'uploaded' as const, documentId: result.data.id };
        } else {
          const error = await response.json();
          console.error('Error uploading document:', error);
          return { ...fileInfo, status: 'error' as const, error: error.error };
        }
      } catch (error) {
        console.error('Error uploading document:', error);
        return { ...fileInfo, status: 'error' as const, error: 'Error de conexión' };
      }
    });

    const results = await Promise.all(uploadPromises);
    
    // Update pending files with results
    setPendingFiles(results);
    
    // Clear successfully uploaded files after a delay
    setTimeout(() => {
      setPendingFiles(prev => prev.filter(f => f.status !== 'uploaded'));
    }, 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('Form submission - currentPlant:', currentPlant);
    console.log('Form submission - formData:', formData);
    
    if (!formData.material_id || formData.quantity_adjusted <= 0 || !formData.reference_notes) {
      toast.error('Por favor complete todos los campos requeridos')
      return
    }

    if (!currentPlant?.id) {
      toast.error('Debe seleccionar una planta para continuar')
      return
    }

    // Fallback: if currentPlant is not available, try to use profile's plant_id
    const plantId = currentPlant?.id || profile?.plant_id;
    
    if (!plantId) {
      toast.error('No se pudo determinar la planta. Contacte al administrador.')
      return
    }

    console.log('Submitting with plant_id:', plantId);

    setLoading(true)
    try {
      const requestBody = {
        ...formData,
        plant_id: plantId
      };

      console.log('=== FRONTEND: Submitting adjustment ===')
      console.log('Form data:', formData)
      console.log('Plant ID:', plantId)
      console.log('Request body being sent:', requestBody)
      console.log('POST URL:', '/api/inventory/adjustments')
      
      const response = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('=== FRONTEND: Adjustment created successfully ===')
        console.log('Response data:', data)
        console.log('Adjustment ID:', data.data?.id)
        console.log('Adjustment number:', data.data?.adjustment_number)
        toast.success('Ajuste de inventario registrado correctamente')
        
        // Upload pending documents
        if (data.data?.id && pendingFiles.length > 0) {
          await uploadDocuments(data.data.id)
          toast.success(`${pendingFiles.length} archivo(s) subido(s) correctamente`)
          
          // Fetch existing documents to show them
          await fetchExistingDocuments(data.data.id)
        }
        
        // Reset form
        setFormData({
          material_id: '',
          adjustment_type: 'consumption',
          quantity_adjusted: 0,
          reference_type: '',
          reference_notes: '',
          adjustment_date: new Date().toISOString().split('T')[0]
        })
        setCurrentInventory(null)
        setPendingFiles([]) // Clear pending files after successful upload
        
        onSuccess?.(data.data)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al registrar el ajuste')
      }
    } catch (error) {
      console.error('Error creating adjustment:', error)
      toast.error(error instanceof Error ? error.message : 'Error al registrar el ajuste')
    } finally {
      setLoading(false)
    }
  }

  const getQuantitySign = () => {
    // Show dynamic sign based on the entered quantity
    return formData.quantity_adjusted >= 0 ? '+' : '-'
  }

  const getQuantityColor = () => {
    // Color reflects whether the adjustment adds or removes stock
    if (formData.quantity_adjusted > 0) return 'text-green-600'
    if (formData.quantity_adjusted < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  // Show warning if no plant is selected
  if (!currentPlant?.id) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <p className="text-yellow-700">
            Debe seleccionar una planta para registrar ajustes de inventario
          </p>
        </div>
        
        {/* Debug information */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Información de Depuración:</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <p>Profile: {profile ? '✅ Cargado' : '❌ No cargado'}</p>
            <p>Profile ID: {profile?.id || 'N/A'}</p>
            <p>Profile Plant ID: {profile?.plant_id || 'N/A'}</p>
            <p>Current Plant: {currentPlant ? '✅ Cargado' : '❌ No cargado'}</p>
            <p>Current Plant ID: {currentPlant?.id || 'N/A'}</p>
            <p>Current Plant Name: {currentPlant?.name || 'N/A'}</p>
          </div>
        </div>
        
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Solución:</h3>
          <p className="text-sm text-blue-700">
            Si el problema persiste, intente:
          </p>
          <ul className="text-sm text-blue-700 mt-2 list-disc list-inside space-y-1">
            <li>Recargar la página</li>
            <li>Verificar que esté autenticado</li>
            <li>Contactar al administrador si no tiene planta asignada</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Plant Context Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Planta Seleccionada
          </CardTitle>
          <CardDescription>
            {currentPlant ? (
              <>
                {currentPlant.name} ({currentPlant.code})
              </>
            ) : profile?.plant_id ? (
              <>
                Usando planta asignada del perfil (ID: {profile.plant_id})
              </>
            ) : (
              'No se pudo determinar la planta'
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Material Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Información del Material
          </CardTitle>
          <CardDescription>
            Seleccione el material y especifique la cantidad a ajustar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="material_id">Material *</Label>
              <div className="space-y-1">
                <MaterialSelect
                  value={formData.material_id}
                  onChange={handleMaterialChange}
                  required
                  plantId={currentPlant?.id || profile?.plant_id || undefined}
                />
                <p className="text-xs text-gray-500">
                  Seleccione un material de la lista disponible para esta planta
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quantity_adjusted">Cantidad a Ajustar (kg) *</Label>
              <div className="relative">
                <div className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-lg font-bold ${getQuantityColor()}`}>
                  {getQuantitySign()}
                </div>
                <Input
                  id="quantity_adjusted"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.quantity_adjusted || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    quantity_adjusted: parseFloat(e.target.value) || 0 
                  }))}
                  className="pl-8"
                  required
                />
              </div>
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
                    {currentInventory.toLocaleString('es-MX', { 
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} kg
                  </p>
                </div>
                <div>
                  <p className="text-blue-700">Cantidad a Ajustar</p>
                  <p className={`font-semibold ${getQuantityColor()}`}>
                    {getQuantitySign()}{Math.abs(formData.quantity_adjusted).toLocaleString('es-MX', { 
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} kg
                  </p>
                </div>
                <div>
                  <p className="text-blue-700">Inventario Final</p>
                  <p className="font-semibold text-blue-900">
                    {inventoryAfter?.toLocaleString('es-MX', { 
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} kg
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="adjustment_date">Fecha de Ajuste</Label>
            <Input
              id="adjustment_date"
              type="date"
              value={formData.adjustment_date}
              onChange={(e) => setFormData(prev => ({ ...prev, adjustment_date: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Adjustment Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Tipo de Ajuste
          </CardTitle>
          <CardDescription>
            Seleccione el tipo de ajuste que se realizará
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adjustment_type">Tipo de Ajuste *</Label>
            <Select
              value={formData.adjustment_type}
              onValueChange={(value: any) => setFormData(prev => ({ ...prev, adjustment_type: value }))}
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
          </div>
        </CardContent>
      </Card>

      {/* Reference Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Información de Referencia
          </CardTitle>
          <CardDescription>
            Detalles del motivo y referencia del ajuste
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reference_type">Tipo de Referencia</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="reference_type"
                  value={formData.reference_type || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, reference_type: e.target.value }))}
                  className="pl-10"
                  placeholder="Ej: OT-001, TICKET-123"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference_notes">Motivo del Ajuste *</Label>
            <Textarea
              id="reference_notes"
              value={formData.reference_notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, reference_notes: e.target.value }))}
              rows={3}
              placeholder="Describa detalladamente el motivo del ajuste..."
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos de Evidencia
          </CardTitle>
          <CardDescription>
            Información adicional y documentos de evidencia. Use la cámara para capturar documentos o suba archivos existentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Documentos de Evidencia</Label>
            <div className="text-xs text-gray-600 mb-3">
              <p>• Use la cámara para capturar documentos y convertirlos automáticamente a PDF</p>
              <p>• O suba archivos existentes (imágenes, PDFs)</p>
            </div>
            
            <SimpleFileUpload
              onFileSelect={handleFileUpload}
              acceptedTypes={['image/*', 'application/pdf']}
              multiple
              uploading={uploading}
              disabled={loading}
            />
            
            {pendingFiles.length > 0 && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-gray-600">
                  {pendingFiles.length} archivo(s) en cola
                </p>
                {pendingFiles.map((fileInfo, index) => (
                  <div key={index} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-gray-500 truncate">{fileInfo.name}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        fileInfo.status === 'uploaded' ? 'bg-green-100 text-green-700' :
                        fileInfo.status === 'error' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {fileInfo.status}
                      </span>
                      {fileInfo.isCameraCapture && (
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                          Cámara
                        </span>
                      )}
                      {fileInfo.error && (
                        <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                          Error: {fileInfo.error}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingFile(index)}
                      className="text-red-500 hover:text-red-700 ml-2"
                      title="Eliminar documento"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Existing Documents */}
            {existingDocuments.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600">
                  Documentos subidos:
                </p>
                {existingDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between text-xs p-2 bg-green-50 rounded border border-green-200">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-gray-700 truncate">{doc.original_name}</span>
                      <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                        Subido
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                          Ver
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteDocument(doc.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                        title="Eliminar documento"
                      >
                        ×
                      </button>
                    </div>
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
              adjustment_type: 'consumption',
              quantity_adjusted: 0,
              reference_type: '',
              reference_notes: '',
              adjustment_date: new Date().toISOString().split('T')[0]
            })
            setCurrentInventory(null)
            setPendingFiles([]) // Clear pending files on cancel
          }}
        >
          Limpiar
        </Button>
        <Button 
          type="submit" 
          disabled={loading || uploading || !formData.material_id || formData.quantity_adjusted <= 0 || !formData.reference_notes}
          className="min-w-[120px]"
        >
          {loading ? (
            'Guardando...'
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar Ajuste
            </>
          )}
        </Button>
      </div>

      {/* Warning for missing required fields */}
      {(!formData.material_id || formData.quantity_adjusted <= 0 || !formData.reference_notes) && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <p className="text-sm text-yellow-700">
            Complete el material, cantidad y motivo para continuar
          </p>
        </div>
      )}
    </form>
  )
}
