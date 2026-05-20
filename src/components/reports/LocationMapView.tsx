'use client';

import React, { memo } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { UBICACIONES_MAP_DISPLAY_CAP } from '@/lib/finanzas/ubicacionesConstants';
import type { DeliveryPoint } from '@/services/locationReportService';
import type { MapMetric } from './DeliveryPointMap';

const DeliveryPointMap = dynamic(
  () => import('./DeliveryPointMap'),
  { ssr: false, loading: () => <div className="h-[400px] animate-pulse rounded-lg bg-muted" /> }
);

export interface LocationMapViewProps {
  points: DeliveryPoint[];
  metric?: MapMetric;
  height?: string;
  className?: string;
  showFitButton?: boolean;
  totalPoints?: number;
  mapDisplayCap?: number;
}

function LocationMapViewInner({
  points,
  metric = 'volume',
  height = '500px',
  className = '',
  showFitButton = true,
  totalPoints,
  mapDisplayCap = UBICACIONES_MAP_DISPLAY_CAP,
}: LocationMapViewProps) {
  const total = totalPoints ?? points.length;
  const truncated = total > mapDisplayCap;

  return (
    <div className={`location-map-view relative ${className}`}>
      {truncated && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-2">
          Mostrando {mapDisplayCap} de {total} puntos en el mapa (ordenados por métrica). Exporte a
          Excel para ver todos.
        </p>
      )}
      <div className="relative rounded-lg overflow-hidden border border-border">
        <DeliveryPointMap
          points={points}
          metric={metric}
          height={height}
          fitBounds={true}
          maxMarkers={mapDisplayCap}
        />
        {showFitButton && points.length > 0 && (
          <div className="absolute bottom-4 right-4 z-[1000]">
            <FitToDataButton points={points} />
          </div>
        )}
      </div>
      {points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg pointer-events-none">
          <p className="text-muted-foreground text-sm font-medium">
            No hay órdenes con ubicación en el rango seleccionado
          </p>
        </div>
      )}
    </div>
  );
}

const LocationMapView = memo(LocationMapViewInner);

export default LocationMapView;

function FitToDataButton({ points }: { points: DeliveryPoint[] }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="shadow-md"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent('location-map-fit-bounds', { detail: { points } })
        );
      }}
    >
      <MapPin className="h-4 w-4 mr-2" />
      Ajustar al mapa
    </Button>
  );
}
