'use client';

import React, { useState, useEffect } from 'react';
import { Beaker, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QualityOverviewProps {
  orderId: string;
}

export default function QualityOverview({ orderId }: QualityOverviewProps) {
  const [qualityData, setQualityData] = useState<{
    totalRemisiones: number;
    remisionesWithMuestreos: number;
    totalMuestreos: number;
    totalMuestras: number;
    muestrasEnsayadas: number;
    muestrasPendientes: number;
    totalOrderVolume?: number;
    totalOrderSamplings?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQualityData = async () => {
      try {
        setLoading(true);
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
        
        setQualityData({
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

    fetchQualityData();
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error || !qualityData) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>Error al cargar información de calidad</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">{qualityData.totalRemisiones}</div>
          <div className="text-sm text-gray-600">Remisiones</div>
        </div>
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-700">{qualityData.remisionesWithMuestreos}</div>
          <div className="text-sm text-blue-600">Con Muestreos</div>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-700">{qualityData.totalMuestreos}</div>
          <div className="text-sm text-purple-600">Muestreos</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-700">{qualityData.totalMuestras}</div>
          <div className="text-sm text-green-600">Muestras</div>
        </div>
      </div>

      {/* Quality Progress */}
      {qualityData.totalMuestras > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Progreso de Ensayos</h4>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{qualityData.muestrasEnsayadas}</div>
              <div className="text-xs text-gray-500">Ensayadas</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-600">{qualityData.muestrasPendientes}</div>
              <div className="text-xs text-gray-500">Pendientes</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Completado</span>
              <span>{Math.round((qualityData.muestrasEnsayadas / qualityData.totalMuestras) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(qualityData.muestrasEnsayadas / qualityData.totalMuestras) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Order Context */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Contexto de la Orden</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {qualityData.totalOrderVolume && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Volumen Total:</span>
              <span className="font-semibold text-gray-900">{qualityData.totalOrderVolume} m³</span>
            </div>
          )}
          {qualityData.totalOrderSamplings && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Muestreos:</span>
              <span className="font-semibold text-gray-900">{qualityData.totalOrderSamplings}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Muestreos Realizados:</span>
            <span className="font-semibold text-gray-900">{qualityData.totalMuestreos}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('/quality/muestreos', '_blank')}
          className="flex items-center gap-2"
        >
          <Beaker className="h-4 w-4" />
          Ver Muestreos
        </Button>
        {qualityData.totalMuestras > 0 && (
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
  );
}
