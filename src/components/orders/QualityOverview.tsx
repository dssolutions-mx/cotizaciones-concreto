'use client';

import React, { useState, useEffect } from 'react';
import { Beaker, CheckCircle2, Clock, AlertTriangle, TrendingUp, FileText, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QualityOverviewProps {
  orderId: string;
}

interface QualityData {
  totalRemisiones: number;
  remisionesWithMuestreos: number;
  totalMuestreos: number;
  totalMuestras: number;
  muestrasEnsayadas: number;
  muestrasPendientes: number;
  totalOrderVolume?: number;
  totalOrderSamplings?: number;
  complianceData?: {
    compliantSamples: number;
    nonCompliantSamples: number;
    complianceRate: number;
    guaranteeAgeTests: number;
    averageResistance: number;
    minResistance: number;
    maxResistance: number;
  };
  samplingFrequency?: {
    volumePerSampling: number;
    totalVolume: number;
    samplingCount: number;
  };
  muestreosDetallados?: Array<{
    id: string;
    numeroMuestreo: string;
    fechaMuestreo: string;
    planta: string;
    remisionId: string;
    remisionNumber: string;
    fechaRemision: string;
    volumenFabricado: number;
    recipeCode: string;
    strengthFc: number;
  }>;
}

export default function QualityOverview({ orderId }: QualityOverviewProps) {
  const [qualityData, setQualityData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQualityData = async () => {
      try {
        setLoading(true);
        const [samplingResponse, totalsResponse, complianceResponse] = await Promise.all([
          fetch(`/api/orders/${orderId}/sampling-info`),
          fetch(`/api/orders/${orderId}/order-totals`),
          fetch(`/api/orders/${orderId}/quality-compliance`).catch((error) => {
            console.error('Error fetching compliance data:', error);
            return new Response('', { status: 500 });
          })
        ]);
        
        if (!samplingResponse.ok) {
          throw new Error('Failed to fetch sampling data');
        }
        
        const samplingData = await samplingResponse.json();
        let totalsData = null;
        let complianceData = null;
        
        if (totalsResponse.ok) {
          totalsData = await totalsResponse.json();
        }
        
        if (complianceResponse.ok) {
          complianceData = await complianceResponse.json();
        } else {
          console.warn('Compliance API returned error:', complianceResponse.status);
        }
        
        // Calculate sampling frequency
        let samplingFrequency = null;
        if (totalsData?.totalOrderVolume && samplingData.totalMuestreos > 0) {
          samplingFrequency = {
            volumePerSampling: totalsData.totalOrderVolume / samplingData.totalMuestreos,
            totalVolume: totalsData.totalOrderVolume,
            samplingCount: samplingData.totalMuestreos
          };
        }
        
        setQualityData({
          ...samplingData,
          totalOrderVolume: totalsData?.totalOrderVolume,
          totalOrderSamplings: totalsData?.totalOrderSamplings,
          complianceData,
          samplingFrequency
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
      <div className="flex justify-center items-center py-12">
        <div className="relative">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error || !qualityData) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 rounded-full mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <p className="text-red-600 font-medium">Error al cargar información de calidad</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  const hasQualityData = qualityData.totalMuestras > 0;
  const testingProgress = qualityData.totalMuestras > 0 
    ? (qualityData.muestrasEnsayadas / qualityData.totalMuestras) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Beaker className="w-5 h-5 text-gray-600" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">Control de Calidad</h3>
            <p className="text-sm text-gray-500">Estado de muestreos y ensayos para esta orden</p>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Remisiones */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow duration-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
              <FileText className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-900">{qualityData.totalRemisiones}</div>
              <div className="text-sm text-gray-600">Remisiones</div>
            </div>
          </div>
        </div>

        {/* Muestreos */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow duration-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
              <Beaker className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-900">{qualityData.totalMuestreos}</div>
              <div className="text-sm text-gray-600">Muestreos</div>
              <div className="text-xs text-gray-500">
                {qualityData.remisionesWithMuestreos} de {qualityData.totalRemisiones}
              </div>
            </div>
          </div>
        </div>

        {/* Muestras */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow duration-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-900">{qualityData.totalMuestras}</div>
              <div className="text-sm text-gray-600">Muestras</div>
            </div>
          </div>
        </div>

        {/* Ensayadas */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow duration-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-900">{qualityData.muestrasEnsayadas}</div>
              <div className="text-sm text-gray-600">Ensayadas</div>
              <div className="text-xs text-gray-500">
                {qualityData.muestrasPendientes} pendientes
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sampling Frequency Section */}
      {qualityData.samplingFrequency && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-gray-600" />
            </div>
            <h4 className="text-sm font-medium text-gray-900">Frecuencia de Muestreo</h4>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xl font-semibold text-gray-900">
                {qualityData.samplingFrequency.volumePerSampling.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">m³ por muestreo</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xl font-semibold text-gray-900">
                {qualityData.samplingFrequency.totalVolume}
              </div>
              <div className="text-sm text-gray-600">m³ total</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xl font-semibold text-gray-900">
                {qualityData.samplingFrequency.samplingCount}
              </div>
              <div className="text-sm text-gray-600">muestreos</div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Frecuencia:</strong> Se realizó un muestreo cada {qualityData.samplingFrequency.volumePerSampling.toFixed(1)} m³ de concreto suministrado.
            </p>
          </div>
        </div>
      )}

      {/* Testing Progress */}
      {hasQualityData && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">Progreso de Ensayos</h4>
            <span className="text-lg font-semibold text-gray-900">{Math.round(testingProgress)}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Muestras ensayadas</span>
              <span>{qualityData.muestrasEnsayadas} / {qualityData.totalMuestras}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gray-600 h-2 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${testingProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Test Results Section - Show whenever we have test data */}
      {qualityData.complianceData ? (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">Resultados de Ensayos</h4>
            {qualityData.complianceData.guaranteeAgeTests > 0 && (
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-lg font-semibold text-gray-900">
                  {Math.round(qualityData.complianceData.complianceRate)}%
                </span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {qualityData.complianceData.guaranteeAgeTests > 0 ? (
              <>
                <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-xl font-semibold text-gray-900">{qualityData.complianceData.compliantSamples}</div>
                  <div className="text-sm text-gray-600">Cumplen</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-xl font-semibold text-gray-900">{qualityData.complianceData.nonCompliantSamples}</div>
                  <div className="text-sm text-gray-600">No cumplen</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-xl font-semibold text-gray-900">{qualityData.complianceData.guaranteeAgeTests}</div>
                  <div className="text-sm text-gray-600">Total ensayos</div>
                </div>
              </>
            ) : (
              <div className="col-span-3 text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600">No hay ensayos a edad garantía disponibles</div>
              </div>
            )}
            
            <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xl font-semibold text-gray-900">
                {qualityData.complianceData.averageResistance && qualityData.complianceData.averageResistance > 0 
                  ? qualityData.complianceData.averageResistance.toFixed(1) 
                  : 'N/A'}
              </div>
              <div className="text-sm text-gray-600">Resistencia promedio (kg/cm²)</div>
            </div>
          </div>

          {/* Resistance Range - Show if we have resistance data */}
          {qualityData.complianceData.minResistance && qualityData.complianceData.maxResistance && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-sm font-medium text-gray-600 mb-1">Resistencia Mínima</div>
                <div className="text-lg font-semibold text-gray-900">
                  {qualityData.complianceData.minResistance.toFixed(1)} kg/cm²
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-sm font-medium text-gray-600 mb-1">Resistencia Máxima</div>
                <div className="text-lg font-semibold text-gray-900">
                  {qualityData.complianceData.maxResistance.toFixed(1)} kg/cm²
                </div>
              </div>
            </div>
          )}

          {/* General Resistance Information */}
          {qualityData.complianceData.guaranteeAgeTests === 0 && qualityData.complianceData.averageResistance > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Los valores de resistencia mostrados corresponden a todos los ensayos disponibles, 
                no solo a los realizados a edad garantía.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-yellow-100 rounded-md flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
            </div>
            <h4 className="text-sm font-medium text-gray-900">Información de Ensayos</h4>
          </div>
          <p className="text-sm text-gray-600">
            No se pudo cargar la información de resistencia y compliance. Esto puede deberse a que no hay ensayos disponibles o a un error en el servidor.
          </p>
        </div>
      )}

      {/* Remisiones Muestreadas Section */}
      {qualityData.remisionesWithMuestreos > 0 && qualityData.muestreosDetallados && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <h4 className="text-sm font-medium text-gray-900">Remisiones Muestreadas</h4>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {qualityData.remisionesWithMuestreos} de {qualityData.totalRemisiones}
            </span>
          </div>
          
          <div className="space-y-3">
            {/* Individual Sampling Links */}
            <div className="space-y-2">
              {qualityData.muestreosDetallados.map((muestreo) => (
                <div key={muestreo.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center">
                          <Beaker className="w-3 h-3 text-blue-600" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            Muestreo {muestreo.numeroMuestreo}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            Remisión {muestreo.remisionNumber}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-gray-600">
                        <div>
                          <span className="font-medium">Fecha:</span> {new Date(muestreo.fechaMuestreo).toLocaleDateString('es-ES')}
                        </div>
                        <div>
                          <span className="font-medium">Planta:</span> {muestreo.planta}
                        </div>
                        <div>
                          <span className="font-medium">Volumen:</span> {muestreo.volumenFabricado} m³
                        </div>
                        <div>
                          <span className="font-medium">Receta:</span> {muestreo.recipeCode} (fc{muestreo.strengthFc})
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/quality/muestreos/${muestreo.id}`, '_blank')}
                      className="border-blue-300 text-blue-700 hover:bg-blue-50 ml-4"
                    >
                      Ver Detalle
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">{qualityData.totalMuestreos}</div>
                <div className="text-xs text-gray-600">Total muestreos</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">{qualityData.totalMuestras}</div>
                <div className="text-xs text-gray-600">Total muestras</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Quality Data Message */}
      {!hasQualityData && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Clock className="w-6 h-6 text-gray-500" />
          </div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Sin datos de calidad</h4>
          <p className="text-gray-600 mb-6">
            Esta orden aún no tiene muestras o ensayos registrados
          </p>
          <Button
            variant="outline"
            onClick={() => window.open('/quality/muestreos', '_blank')}
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <Beaker className="w-4 h-4 mr-2" />
            Crear Muestreo
          </Button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('/quality/muestreos', '_blank')}
          className="border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <Beaker className="w-4 h-4 mr-2" />
          Ver Muestreos
        </Button>
        
        {hasQualityData && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/quality/ensayos', '_blank')}
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            Ver Ensayos
          </Button>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('/quality/reportes', '_blank')}
          className="border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Reportes
        </Button>
      </div>
    </div>
  );
}
