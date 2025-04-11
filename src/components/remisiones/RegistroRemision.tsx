'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import RemisionPdfExtractor from './RemisionPdfExtractor';
import VerificationModal from './VerificationModal';
import RemisionManualForm from './RemisionManualForm';
import { useAuth } from '@/contexts/AuthContext';

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
  const [extractedData, setExtractedData] = useState(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const { userProfile } = useAuth();
  
  // Solo permitir a dosificadores y roles superiores
  const canCreateRemisiones = userProfile?.role === 'DOSIFICADOR' || 
                             userProfile?.role === 'PLANT_MANAGER' || 
                             userProfile?.role === 'EXECUTIVE';
  
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
  
  const handleDataExtracted = (data: any) => {
    setExtractedData(data);
    setIsVerificationModalOpen(true);
  };
  
  const handleModalClose = () => {
    setIsVerificationModalOpen(false);
    setExtractedData(null);
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
        <Tabs defaultValue="pdf" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pdf">PDF de Remisión</TabsTrigger>
            <TabsTrigger value="manual">Registro Manual</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pdf">
            <div className="mt-4">
              <RemisionPdfExtractor onDataExtracted={handleDataExtracted} />
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