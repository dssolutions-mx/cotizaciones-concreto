'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DistanceCalculation } from '@/types/distance';

interface DistanceAnalysisPanelProps {
  distanceInfo: DistanceCalculation | null;
  isLoading?: boolean;
}

export function DistanceAnalysisPanel({ distanceInfo, isLoading }: DistanceAnalysisPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Distancia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Calculando distancia...</div>
        </CardContent>
      </Card>
    );
  }

  if (!distanceInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Distancia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Seleccione una planta y un sitio de construcción para calcular la distancia
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis de Distancia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Distance and Range Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Distancia</div>
            <div className="text-2xl font-bold">{distanceInfo.distance_km.toFixed(2)} km</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Rango</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-lg">
                {distanceInfo.range_code}
              </Badge>
              <span className="text-sm text-muted-foreground">
                (Bloque {distanceInfo.bloque_number})
              </span>
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="border-t pt-4">
          <div className="text-sm font-semibold mb-2">Desglose de Costos de Transporte</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total transporte por m³:</span>
              <span className="text-primary">
                ${distanceInfo.transport_cost_per_m3.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Costo fijo por viaje:</span>
              <span className="text-primary">
                ${distanceInfo.total_per_trip.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

