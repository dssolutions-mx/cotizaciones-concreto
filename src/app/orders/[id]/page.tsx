'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import OrderDetailClient from '@/components/orders/OrderDetailClient';

// Component to show success/error messages when redirected from email actions
function ActionMessage() {
  const searchParams = useSearchParams();
  const action = searchParams.get('action');
  
  if (!action) return null;
  
  // Handle credit action redirects
  if (action === 'approved') {
    return (
      <Alert className="mb-6 bg-green-50 border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Crédito Aprobado</AlertTitle>
        <AlertDescription className="text-green-700">
          Has aprobado exitosamente el crédito para esta orden a través del email.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (action === 'rejected') {
    return (
      <Alert className="mb-6 bg-red-50 border-red-200">
        <XCircle className="h-4 w-4 text-red-600" />
        <AlertTitle className="text-red-800">Crédito Rechazado</AlertTitle>
        <AlertDescription className="text-red-700">
          Has rechazado el crédito para esta orden a través del email.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (action === 'error') {
    return (
      <Alert className="mb-6 bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800">Error en la Acción</AlertTitle>
        <AlertDescription className="text-amber-700">
          Hubo un problema al procesar tu acción. Por favor, intenta de nuevo desde el sitio web.
        </AlertDescription>
      </Alert>
    );
  }
  
  return null;
}

// Main component that renders both the ActionMessage and OrderDetailClient
export default function OrderDetails({ params }: { params: Promise<{ id: string }> }) {
  // Use React.use() to unwrap the params promise
  const unwrappedParams = React.use(params);
  const { id } = unwrappedParams;
  
  return (
    <div className="container mx-auto py-6">
      <ActionMessage />
      <OrderDetailClient orderId={id} />
    </div>
  );
} 