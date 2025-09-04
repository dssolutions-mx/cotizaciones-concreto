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
  User,
  AlertCircle
} from 'lucide-react'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { usePlantContext } from '@/contexts/PlantContext'
import { toast } from 'sonner'
import { MaterialEntryInput, PendingFile } from '@/types/inventory'
import MaterialSelect from '@/components/inventory/MaterialSelect'
import SupplierSelect from '@/components/inventory/SupplierSelect'
import SimpleFileUpload from '@/components/inventory/SimpleFileUpload'
import { format } from 'date-fns'

interface MaterialEntryFormProps {
  onSuccess?: () => void
}

export default function MaterialEntryForm({ onSuccess }: MaterialEntryFormProps) {
  const { profile } = useAuthSelectors()
  const { currentPlant } = usePlantContext()
  
  console.log('MaterialEntryForm - profile:', profile);
  console.log('MaterialEntryForm - currentPlant:', currentPlant);
  console.log('MaterialEntryForm - currentPlant?.id:', currentPlant?.id);
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    material_id: '',
    quantity_received: 0,
    supplier_id: '',
    supplier_invoice: '',
    notes: '',
    entry_date: new Date().toISOString().split('T')[0]
  })
  const [uploading, setUploading] = useState(false)
  const [currentInventory, setCurrentInventory] = useState<number | null>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [existingDocuments, setExistingDocuments] = useState<any[]>([])

  // Calculate inventory after
  const inventoryAfter = currentInventory !== null ? currentInventory + formData.quantity_received : null

  // Fetch existing documents when entry is created
  const fetchExistingDocuments = async (entryId: string) => {
    try {
      const response = await fetch(`/api/inventory/documents?reference_id=${entryId}&type=entry`);
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

  // Upload documents after entry creation
  const uploadDocuments = async (entryId: string) => {
    if (pendingFiles.length === 0) return;

    const uploadPromises = pendingFiles.map(async (fileInfo) => {
      try {
        const formData = new FormData();
        formData.append('file', fileInfo.file);
        formData.append('type', 'entry');
        formData.append('reference_id', entryId);

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
    
    if (!formData.material_id || formData.quantity_received <= 0) {
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
        plant_id: plantId,
        inventory_before: currentInventory || 0
      };
      
      console.log('Request body being sent:', requestBody);
      
      const response = await fetch('/api/inventory/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Entrada registrada correctamente')
        
        // Upload pending documents
        if (data.entry_id && pendingFiles.length > 0) {
          await uploadDocuments(data.entry_id)
          toast.success(`${pendingFiles.length} archivo(s) subido(s) correctamente`)
          
          // Fetch existing documents to show them
          await fetchExistingDocuments(data.entry_id)
        }
        
        // Reset form
        setFormData({
          material_id: '',
          quantity_received: 0,
          supplier_id: '',
          supplier_invoice: '',
          notes: '',
          entry_date: new Date().toISOString().split('T')[0]
        })
        setCurrentInventory(null)
        setPendingFiles([]) // Clear pending files after successful upload
        
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

  // Show warning if no plant is selected
  if (!currentPlant?.id) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <p className="text-yellow-700">
            Debe seleccionar una planta para registrar entradas de materiales
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
            Seleccione el material y especifique la cantidad recibida
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
                    {currentInventory.toLocaleString('es-MX', { 
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} kg
                  </p>
                </div>
                <div>
                  <p className="text-blue-700">Cantidad a Agregar</p>
                  <p className="font-semibold text-green-600">
                    +{formData.quantity_received.toLocaleString('es-MX', { 
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
            <User className="h-5 w-5" />
            Información del Proveedor
          </CardTitle>
          <CardDescription>
            Datos del proveedor y documentación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Proveedor</Label>
              <SupplierSelect
                value={formData.supplier_id || ''}
                onChange={(value: string) => setFormData(prev => ({ ...prev, supplier_id: value }))}
                plantId={currentPlant?.id || profile?.plant_id || undefined}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier_invoice">Número de Remisión</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="supplier_invoice"
                  value={formData.supplier_invoice || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier_invoice: e.target.value }))}
                  className="pl-10"
                  placeholder="Ej: REM-2024-001"
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
            Información adicional y documentos de evidencia. Use la cámara para capturar documentos o suba archivos existentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Notas</Label>
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
              quantity_received: 0,
              supplier_id: '',
              supplier_invoice: '',
              notes: '',
              entry_date: new Date().toISOString().split('T')[0]
            })
            setCurrentInventory(null)
            setPendingFiles([]) // Clear pending files on cancel
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
