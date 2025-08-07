'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import RemisionPdfExtractor from './RemisionPdfExtractor';
import VerificationModal from './VerificationModal';
import RemisionManualForm from './RemisionManualForm';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Material type mapping from VerificationModal
const MATERIAL_TYPE_MAP: Record<string, string> = {
  'cement': 'CPC 40',
  'water': 'AGUA 1',
  'gravel': 'GRAVA BASALTO 20mm',
  'gravel40mm': 'GRAVA BASALTO 40mm',
  'volcanicSand': 'ARENA BLANCA',
  'basalticSand': 'ARENA TRITURADA',
  'additive1': '800 MX',
  'additive2': 'ADITIVO 2'
};

// Reverse mapping to convert display names back to DB types
const REVERSE_MATERIAL_TYPE_MAP: Record<string, string> = {};
Object.entries(MATERIAL_TYPE_MAP).forEach(([key, value]) => {
  REVERSE_MATERIAL_TYPE_MAP[value] = key;
});

interface ExtractedRemisionData {
  remisionNumber: string;
  fecha: string;
  hora: string;
  volumenFabricado: string;
  matricula: string;
  conductor: string;
  recipeCode: string;
  materiales: Array<{
    tipo: string;
    dosificadoReal: number;
    dosificadoTeorico: number;
  }>;
}

interface RegistroRemisionProps {
  orderId: string;
  onRemisionCreated: () => void;
  allowedRecipeIds: string[];
}

export default function RegistroRemision({ 
  orderId, 
  onRemisionCreated, 
  allowedRecipeIds
}: RegistroRemisionProps) {
  const [extractedData, setExtractedData] = useState<ExtractedRemisionData | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [bulkUploadComplete, setBulkUploadComplete] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState({ 
    success: 0, 
    failed: 0,
    errors: [] as {remision: string; error: string}[]
  });
  const { profile } = useAuthBridge();
  
  // Solo permitir a dosificadores y roles superiores
  const canCreateRemisiones = profile?.role === 'DOSIFICADOR' || 
                             profile?.role === 'PLANT_MANAGER' || 
                             profile?.role === 'EXECUTIVE';
  
  // Log cuando cambian los allowedRecipeIds para depuración
  useEffect(() => {
    if (allowedRecipeIds.length > 0) {
      console.log('RegistroRemision recibió allowedRecipeIds:', JSON.stringify(allowedRecipeIds));
    }
  }, [allowedRecipeIds]);
  
  if (!canCreateRemisiones) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registro de Remisiones</CardTitle>
          <CardDescription>
            No tienes permisos para registrar remisiones
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  const handleDataExtracted = (data: ExtractedRemisionData) => {
    setExtractedData(data);
    setIsVerificationModalOpen(true);
  };

  const handleBulkDataExtracted = async (data: ExtractedRemisionData | ExtractedRemisionData[]) => {
    // If it's not an array (single file was processed), handle it normally
    if (!Array.isArray(data)) {
      handleDataExtracted(data);
      return;
    }

    const dataArray = data as ExtractedRemisionData[];
    
    // Process all remisiones without showing verification modal
    let successCount = 0;
    let failedCount = 0;
    const errors: {remision: string; error: string}[] = [];
    
    // Process each remision
    for (const remisionData of dataArray) {
      try {
        // Skip remisiones with empty fields - prevent server errors
        if (!remisionData.remisionNumber || !remisionData.fecha || !remisionData.volumenFabricado) {
          failedCount++;
          errors.push({
            remision: remisionData.remisionNumber || 'Sin número',
            error: 'Datos incompletos en el PDF'
          });
          continue;
        }

        // Validate volume format
        const volume = parseFloat(remisionData.volumenFabricado.replace(',', '.'));
        if (isNaN(volume)) {
          failedCount++;
          errors.push({
            remision: remisionData.remisionNumber,
            error: 'Formato de volumen inválido'
          });
          continue;
        }
        
        // 1. Find recipe_id based on recipeCode
        const { data: recipeData, error: recipeError } = await supabase
          .from('recipes')
          .select('id')
          .eq('recipe_code', remisionData.recipeCode)
          .single();

        if (recipeError || !recipeData) {
          failedCount++;
          errors.push({
            remision: remisionData.remisionNumber,
            error: `Código de receta "${remisionData.recipeCode}" no encontrado`
          });
          continue;
        }
        
        const recipeId = recipeData.id;

        // Formatear fecha para PostgreSQL (YYYY-MM-DD)
        const dateParts = remisionData.fecha.split('/');
        const formattedDate = dateParts.length === 3 
          ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
          : null;
        
        // Ensure hora is in HH:MM:SS format if needed, default to HH:MM if correct
        const formattedHora = remisionData.hora.includes(':') ? remisionData.hora.padEnd(8, ':00') : null;
        
        if (!formattedDate) {
          failedCount++;
          errors.push({
            remision: remisionData.remisionNumber,
            error: 'Formato de fecha inválido'
          });
          continue;
        }
        
        // Get current user ID
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;
        
        // Create the payload with all required fields
        const remisionPayload = {
          order_id: orderId,
          remision_number: remisionData.remisionNumber,
          fecha: formattedDate,
          hora_carga: formattedHora,
          volumen_fabricado: volume,
          conductor: remisionData.conductor,
          unidad: remisionData.matricula,
          recipe_id: recipeId,
          created_by: userId,
          tipo_remision: 'CONCRETO',
          designacion_ehe: remisionData.recipeCode
        };
        
        console.log(`Procesando remisión ${remisionData.remisionNumber} con Supabase`);
        
        // Insertar remisión
        const { data: remision, error: remisionError } = await supabase
          .from('remisiones')
          .insert(remisionPayload)
          .select()
          .single();
        
        if (remisionError) {
          failedCount++;
          errors.push({
            remision: remisionData.remisionNumber,
            error: remisionError.message || 'Error al guardar la remisión'
          });
          console.error('Error inserting remision:', remisionError);
          continue;
        }
        
        // Insertar materiales
        if (remisionData.materiales && remisionData.materiales.length > 0) {
          // Filter out empty material types 
          const validMateriales = remisionData.materiales.filter(mat => mat.tipo.trim() !== '');
          
          // Create materials data using the DB material types, not the display names
          const materialesData = validMateriales.map(material => {
            // Try to find the material type code from reverse mapping, or use the display name if not found
            const materialTypeCode = REVERSE_MATERIAL_TYPE_MAP[material.tipo] || material.tipo;
            
            return {
              remision_id: remision.id,
              material_type: materialTypeCode, // Use the code for DB storage
              cantidad_real: material.dosificadoReal,
              cantidad_teorica: material.dosificadoTeorico
            };
          });
          
          const { error: materialesError } = await supabase
            .from('remision_materiales')
            .insert(materialesData);
          
          if (materialesError) {
            // We consider this a partial success with warning
            errors.push({
              remision: remisionData.remisionNumber,
              error: `Remisión guardada pero error en materiales: ${materialesError.message}`
            });
            console.error('Error inserting materials:', materialesError);
          }
        }
        
        successCount++;
        
        // Add a small delay between requests to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        errors.push({
          remision: remisionData.remisionNumber || 'Sin número',
          error: errorMessage
        });
        console.error('Error processing remision:', error);
      }
    }
    
    // Update UI to show results
    setBulkUploadResult({ 
      success: successCount, 
      failed: failedCount,
      errors: errors
    });
    setBulkUploadComplete(true);
    
    // Refresh the remisiones list
    if (successCount > 0) {
      onRemisionCreated();
    }
  };
  
  const handleModalClose = () => {
    setIsVerificationModalOpen(false);
    setExtractedData(null);
  };
  
  const resetBulkUploadStatus = () => {
    setBulkUploadComplete(false);
    setBulkUploadResult({ success: 0, failed: 0, errors: [] });
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Remisiones</CardTitle>
        <CardDescription>
          Registra una nueva remisión para esta orden
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pdf" className="w-full" onValueChange={resetBulkUploadStatus}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pdf">PDF de Remisión</TabsTrigger>
            <TabsTrigger value="manual">Registro Manual</TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-1">
              <FileUp size={16} />
              <span>Carga Masiva</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pdf">
            <div className="mt-4">
              <RemisionPdfExtractor onDataExtracted={(data) => {
                // This wrapper ensures we only get a single item from the non-bulk extractor
                if (Array.isArray(data)) {
                  // This should not happen, but just in case
                  handleDataExtracted(data[0]);
                } else {
                  handleDataExtracted(data);
                }
              }} />
            </div>
          </TabsContent>
          
          <TabsContent value="manual">
            <div className="mt-4">
              <RemisionManualForm 
                orderId={orderId} 
                onSuccess={onRemisionCreated} 
                allowedRecipeIds={allowedRecipeIds}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="bulk">
            <div className="mt-4">
              {bulkUploadComplete ? (
                <Alert className={bulkUploadResult.success > 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}>
                  <AlertDescription>
                    <div className="py-2">
                      <p className="font-medium">Resultados de la carga masiva:</p>
                      <ul className="list-disc list-inside mt-2">
                        <li className="text-green-700">{bulkUploadResult.success} remisiones procesadas correctamente</li>
                        {bulkUploadResult.failed > 0 && (
                          <li className="text-red-700">{bulkUploadResult.failed} remisiones con errores</li>
                        )}
                      </ul>
                      
                      {bulkUploadResult.errors.length > 0 && (
                        <div className="mt-4">
                          <p className="font-medium text-red-700">Detalle de errores:</p>
                          <div className="max-h-60 overflow-y-auto mt-2 p-2 bg-red-50 rounded border border-red-200">
                            {bulkUploadResult.errors.map((err, idx) => (
                              <div key={idx} className="text-sm mb-1 pb-1 border-b border-red-100">
                                <span className="font-medium">Remisión {err.remision}:</span> {err.error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-4">
                    Selecciona múltiples archivos PDF de remisiones para procesarlos todos a la vez sin verificación manual.
                  </p>
                  <RemisionPdfExtractor onDataExtracted={handleBulkDataExtracted} bulk={true} />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Modal para verificar datos extraídos */}
        <VerificationModal 
          isOpen={isVerificationModalOpen}
          onClose={handleModalClose}
          extractedData={extractedData}
          orderId={orderId}
          onSuccess={onRemisionCreated}
        />
      </CardContent>
    </Card>
  );
} 