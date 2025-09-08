'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/utils';
import { ClientQualityRemisionData } from '@/types/clientQuality';

interface ClientMuestreosTableProps {
  remisiones: ClientQualityRemisionData[];
}

export default function ClientMuestreosTable({ remisiones }: ClientMuestreosTableProps) {
  // Flatten all muestreos from all remisiones
  const allMuestreos = remisiones.flatMap(remision => 
    remision.muestreos.map(muestreo => ({
      ...muestreo,
      remisionNumber: remision.remisionNumber,
      fecha: remision.fecha,
      volume: remision.volume,
      recipeCode: remision.recipeCode,
      constructionSite: remision.constructionSite,
      rendimientoVolumetrico: remision.rendimientoVolumetrico || 0,
      totalMaterialQuantity: remision.totalMaterialQuantity || 0,
      materiales: remision.materiales || []
    }))
  );

  // Calculate total materials for each muestreo's remision
  const getTotalMaterials = (remision: ClientQualityRemisionData) => {
    // This would need to be passed from the parent or calculated here
    // For now, we'll show a placeholder
    return 0;
  };

  const getComplianceBadgeVariant = (compliance: number) => {
    if (compliance >= 95) return 'default';
    if (compliance >= 85) return 'secondary';
    return 'destructive';
  };

  const getComplianceStatus = (compliance: number) => {
    if (compliance >= 95) return 'Excelente';
    if (compliance >= 85) return 'Aceptable';
    return 'Requiere Atención';
  };

  if (allMuestreos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Muestreos Realizados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No hay muestreos registrados para este cliente en el período seleccionado.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Muestreos Realizados ({allMuestreos.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Fecha Muestreo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Remisión
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Sitio
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Receta
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Volumen (m³)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Masa Unitaria (kg/m³)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Temp. Ambiente (°C)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Temp. Concreto (°C)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Revenimiento (cm)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Materiales (kg)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Rendimiento (%)
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Tipo
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Ensayos
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Cumplimiento
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allMuestreos.map((muestreo, index) => {
                const totalEnsayos = muestreo.muestras.reduce((sum, muestra) => sum + muestra.ensayos.length, 0);
                const validEnsayos = muestreo.muestras.flatMap(muestra => 
                  muestra.ensayos.filter(ensayo => 
                    ensayo.isEdadGarantia && 
                    !ensayo.isEnsayoFueraTiempo && 
                    ensayo.resistenciaCalculada > 0
                  )
                );
                const avgCompliance = validEnsayos.length > 0 
                  ? validEnsayos.reduce((sum, e) => sum + e.porcentajeCumplimiento, 0) / validEnsayos.length
                  : 0;

                // Determine if this is a site check or actual testing
                const isSiteCheck = totalEnsayos === 0 || validEnsayos.length === 0;
                const muestreoType = isSiteCheck ? 'Site Check' : 'Ensayado';
                
                // Get the first valid ensayo for direct access
                const firstValidEnsayo = validEnsayos.length > 0 ? validEnsayos[0] : null;

                return (
                  <tr key={`${muestreo.id}-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {new Date(muestreo.fechaMuestreo).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {muestreo.remisionNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      <div className="max-w-xs truncate" title={muestreo.constructionSite}>
                        {muestreo.constructionSite}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {muestreo.recipeCode}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-b">
                      {formatNumber(muestreo.volume, 1)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-b">
                      {formatNumber(muestreo.masaUnitaria, 1)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-b">
                      {formatNumber(muestreo.temperaturaAmbiente, 1)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-b">
                      {formatNumber(muestreo.temperaturaConcreto, 1)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-b">
                      {formatNumber(muestreo.revenimientoSitio, 1)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-b">
                      {muestreo.totalMaterialQuantity > 0 ? formatNumber(muestreo.totalMaterialQuantity, 1) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-b">
                      {muestreo.rendimientoVolumetrico > 0 ? formatNumber(muestreo.rendimientoVolumetrico, 1) + '%' : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center border-b">
                      <Badge variant={isSiteCheck ? 'secondary' : 'default'}>
                        {muestreoType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-center border-b">
                      <div className="flex flex-col">
                        <span className="font-medium">{totalEnsayos}</span>
                        <span className="text-xs text-gray-500">
                          {validEnsayos.length} válidos
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-center border-b">
                      {validEnsayos.length > 0 ? (
                        <div className="flex flex-col items-center">
                          <Badge variant={getComplianceBadgeVariant(avgCompliance)}>
                            {formatNumber(avgCompliance, 1)}%
                          </Badge>
                          <span className="text-xs text-gray-500 mt-1">
                            {getComplianceStatus(avgCompliance)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Sin datos</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center border-b">
                      <div className="flex flex-col gap-1">
                        {firstValidEnsayo ? (
                          <button
                            onClick={() => {
                              // Navigate to quality details or open modal
                              window.open(`/quality/ensayos/${firstValidEnsayo.id}`, '_blank');
                            }}
                            className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded transition-colors"
                          >
                            Ver Ensayo
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Sin ensayos</span>
                        )}
                        <button
                          onClick={() => {
                            // Navigate to remision details
                            window.open(`/remisiones/${muestreo.remisionNumber}`, '_blank');
                          }}
                          className="text-xs bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors"
                        >
                          Ver Remisión
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Legend */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-800 mb-2">Leyenda de Tipos de Muestreo</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <Badge variant="default">Ensayado</Badge>
              <span>Muestreo con ensayos de resistencia realizados</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Site Check</Badge>
              <span>Revisión de sitio sin ensayos de resistencia</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            <p><strong>Acciones disponibles:</strong></p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li><strong>Ver Ensayo:</strong> Acceso directo a los detalles del ensayo de resistencia</li>
              <li><strong>Ver Remisión:</strong> Acceso directo a los detalles de la remisión</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
