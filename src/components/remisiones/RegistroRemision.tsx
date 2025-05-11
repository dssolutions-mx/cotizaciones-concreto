'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import RemisionPdfExtractor from './RemisionPdfExtractor';
import VerificationModal from './VerificationModal';
import RemisionManualForm from './RemisionManualForm';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUp } from 'lucide-react';

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
  const [bulkUploadResult, setBulkUploadResult] = useState({ success: 0, failed: 0 });
  const { profile } = useAuth();
  
  // Solo permitir a dosificadores y roles superiores
  const canCreateRemisiones = profile?.role === 'DOSIFICADOR' || 
                             profile?.role === 'PLANT_MANAGER' || 
                             profile?.role === 'EXECUTIVE';
  
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
    
    // Process each remision
    for (const remisionData of dataArray) {
      try {
        // Call the same API that VerificationModal would call to save the remision
        const { error } = await fetch('/api/quality/remisiones', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_id: orderId,
            remision_number: remisionData.remisionNumber,
            fecha: remisionData.fecha,
            hora: remisionData.hora,
            volumen_fabricado: parseFloat(remisionData.volumenFabricado),
            matricula: remisionData.matricula,
            conductor: remisionData.conductor,
            tipo_remision: 'CONCRETO',
            recipe_id: remisionData.recipeCode,
            materiales: remisionData.materiales.map((m) => ({
              tipo: m.tipo,
              dosificado_real: m.dosificadoReal,
              dosificado_teorico: m.dosificadoTeorico
            }))
          }),
        }).then(res => res.json());
        
        if (error) {
          failedCount++;
          console.error('Error saving remision:', error);
        } else {
          successCount++;
        }
      } catch (error) {
        failedCount++;
        console.error('Error processing remision:', error);
      }
    }
    
    // Update UI to show results
    setBulkUploadResult({ success: successCount, failed: failedCount });
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
    setBulkUploadResult({ success: 0, failed: 0 });
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