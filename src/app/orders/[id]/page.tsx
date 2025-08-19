'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, XCircle, Beaker, FileText, Loader2 } from 'lucide-react';
import OrderDetailClient from '@/components/orders/OrderDetailClient';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Component to show sampling information for the order
function SamplingInfo({ orderId }: { orderId: string }) {
  const [samplingData, setSamplingData] = React.useState<{
    totalRemisiones: number;
    remisionesWithMuestreos: number;
    totalMuestreos: number;
    totalMuestras: number;
    muestrasEnsayadas: number;
    muestrasPendientes: number;
    totalOrderVolume?: number;
    totalOrderSamplings?: number;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchSamplingData = async () => {
      try {
        setLoading(true);
        // Fetch both sampling info and order totals
        const [samplingResponse, totalsResponse] = await Promise.all([
          fetch(`/api/orders/${orderId}/sampling-info`),
          fetch(`/api/orders/${orderId}/order-totals`)
        ]);
        
        if (!samplingResponse.ok) {
          throw new Error('Failed to fetch sampling data');
        }
        
        const samplingData = await samplingResponse.json();
        let totalsData = null;
        
        if (totalsResponse.ok) {
          totalsData = await totalsResponse.json();
        }
        
        setSamplingData({
          ...samplingData,
          totalOrderVolume: totalsData?.totalOrderVolume,
          totalOrderSamplings: totalsData?.totalOrderSamplings
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSamplingData();
  }, [orderId]);

  if (loading) {
    return (
      <Card className="mb-6 border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-gray-600">Cargando información de muestreos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-6 border-red-200 bg-red-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Error al cargar información de muestreos: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!samplingData || samplingData.totalRemisiones === 0) {
    return (
      <Card className="mb-6 border-gray-200 bg-gray-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-gray-600">
            <FileText className="h-4 w-4" />
            <span className="text-sm">Esta orden no tiene remisiones registradas</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border border-gray-200 bg-white shadow-sm" data-sampling-info>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Beaker className="h-5 w-5 text-gray-600" />
              Control de Calidad
            </CardTitle>
            <CardDescription>
              Estado de muestreos y ensayos para esta orden
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
            {samplingData.totalMuestras > 0 ? 
              `${Math.round((samplingData.muestrasEnsayadas / samplingData.totalMuestras) * 100)}% Completado` : 
              'Sin muestras'
            }
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{samplingData.totalRemisiones}</div>
            <div className="text-xs text-gray-600">Remisiones</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{samplingData.remisionesWithMuestreos}</div>
            <div className="text-xs text-gray-600">Con Muestreos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{samplingData.totalMuestreos}</div>
            <div className="text-xs text-gray-600">Muestreos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{samplingData.totalMuestras}</div>
            <div className="text-xs text-gray-600">Muestras</div>
          </div>
        </div>
        
        {/* Quality Progress & Order Context */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quality Progress */}
            {samplingData.totalMuestras > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Progreso de Ensayos</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-lg font-bold text-green-700">{samplingData.muestrasEnsayadas}</div>
                    <div className="text-xs text-green-600">Ensayadas</div>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-lg font-bold text-amber-700">{samplingData.muestrasPendientes}</div>
                    <div className="text-xs text-amber-600">Pendientes</div>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Completado</span>
                    <span>{Math.round((samplingData.muestrasEnsayadas / samplingData.totalMuestras) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(samplingData.muestrasEnsayadas / samplingData.totalMuestras) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Order Context */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Contexto de la Orden</h4>
              <div className="space-y-2">
                {samplingData.totalOrderVolume && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Volumen Total:</span>
                    <span className="font-semibold text-gray-900">{samplingData.totalOrderVolume} m³</span>
                  </div>
                )}
                {samplingData.totalOrderSamplings && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Muestreos:</span>
                    <span className="font-semibold text-gray-900">{samplingData.totalOrderSamplings}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Muestreos Realizados:</span>
                  <span className="font-semibold text-gray-900">{samplingData.totalMuestreos}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/quality/muestreos', '_blank')}
                className="flex items-center gap-2"
              >
                <Beaker className="h-4 w-4" />
                Ver Muestreos
              </Button>
              {samplingData.totalMuestras > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/quality/ensayos', '_blank')}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Ver Ensayos
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/quality/reportes', '_blank')}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Reportes
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
      <SamplingInfo orderId={id} />
      <ActionMessage />
      <OrderDetailClient orderId={id} />
    </div>
  );
} 