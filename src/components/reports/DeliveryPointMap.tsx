'use client';

import React, { useEffect, useMemo, memo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DeliveryPoint } from '@/services/locationReportService';
import { DEFAULT_MAP_CENTER } from '@/config/maps';
import { formatCurrency, formatNumber } from '@/lib/utils';

const fixLeafletIcon = () => {
  if (typeof window !== 'undefined') {
    delete (Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
    Icon.Default.mergeOptions({
      iconRetinaUrl: '/images/marker-icon-2x.png',
      iconUrl: '/images/marker-icon.png',
      shadowUrl: '/images/marker-shadow.png',
    });
  }
};

export type MapMetric = 'volume' | 'amount' | 'orders';

const VOLUME_COLORS = ['#BFDBFE', '#60A5FA', '#2563EB', '#1D4ED8', '#1E3A8A'];
const AMOUNT_COLORS = ['#BBF7D0', '#4ADE80', '#22C55E', '#16A34A', '#15803D'];
const ORDERS_COLORS = ['#E0E7FF', '#818CF8', '#6366F1', '#4F46E5', '#3730A3'];

function getColorForValue(
  value: number,
  maxValue: number,
  palette: string[]
): string {
  if (maxValue <= 0) return palette[0];
  const ratio = Math.min(1, value / maxValue);
  const index = Math.min(
    palette.length - 1,
    Math.floor(ratio * palette.length)
  );
  return palette[index];
}

function getMetricValue(point: DeliveryPoint, metric: MapMetric): number {
  switch (metric) {
    case 'volume':
      return point.volume;
    case 'amount':
      return point.amount;
    case 'orders':
      return 1;
    default:
      return point.volume;
  }
}

interface FitBoundsProps {
  points: DeliveryPoint[];
}

function FitBounds({ points }: FitBoundsProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;
    const latlngs = points.map((p) => [p.lat, p.lng] as [number, number]);
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [map, points]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ points: DeliveryPoint[] }>) => {
      const pts = e.detail?.points;
      if (pts?.length && map) {
        const latlngs = pts.map((p) => [p.lat, p.lng] as [number, number]);
        const bounds = L.latLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }
    };
    window.addEventListener('location-map-fit-bounds', handler as EventListener);
    return () =>
      window.removeEventListener('location-map-fit-bounds', handler as EventListener);
  }, [map]);

  return null;
}

export interface DeliveryPointMapProps {
  points: DeliveryPoint[];
  metric?: MapMetric;
  center?: [number, number];
  zoom?: number;
  height?: string;
  className?: string;
  fitBounds?: boolean;
}

const DEFAULT_CENTER: [number, number] = [
  DEFAULT_MAP_CENTER.lat,
  DEFAULT_MAP_CENTER.lng,
];

function DeliveryPointMapInner({
  points,
  metric = 'volume',
  center = DEFAULT_CENTER,
  zoom = 6,
  height = '400px',
  className = '',
  fitBounds = true,
}: DeliveryPointMapProps) {
  useEffect(() => {
    fixLeafletIcon();
  }, []);

  const { maxMetric, palette } = useMemo(() => {
    const values = points.map((p) => getMetricValue(p, metric));
    const max = Math.max(1, ...values);
    const palette =
      metric === 'volume'
        ? VOLUME_COLORS
        : metric === 'amount'
          ? AMOUNT_COLORS
          : ORDERS_COLORS;
    return { maxMetric: max, palette };
  }, [points, metric]);

  const hasPoints = points.length > 0;

  // Cap points for performance (300+ CircleMarkers can cause lag)
  const MAX_MARKERS = 300;
  const displayPoints =
    points.length <= MAX_MARKERS
      ? points
      : [...points]
          .sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric))
          .slice(0, MAX_MARKERS);

  return (
    <div className={`delivery-point-map ${className}`} style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
        />
        {hasPoints &&
          displayPoints.map((point, i) => {
            const value = getMetricValue(point, metric);
            const radius = Math.max(
              6,
              Math.sqrt(value / maxMetric) * 36
            );
            const color = getColorForValue(value, maxMetric, palette);
            const avgPrice =
              point.volume > 0 ? point.amount / point.volume : 0;

            return (
              <CircleMarker
                key={`${point.orderId}-${i}`}
                center={[point.lat, point.lng]}
                radius={radius}
                pathOptions={{
                  fillColor: color,
                  color: '#1e293b',
                  weight: 1.5,
                  opacity: 0.9,
                  fillOpacity: 0.7,
                }}
              >
                <Popup>
                  <div className="min-w-[180px] text-sm space-y-1">
                    {(point.locality || point.sublocality) && (
                      <p className="font-semibold text-label-primary">
                        {[point.locality, point.sublocality]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                    {point.administrativeArea1 && (
                      <p className="text-label-secondary">
                        {point.administrativeArea1}
                      </p>
                    )}
                    <p className="text-label-secondary">
                      Volumen: {formatNumber(point.volume, 1)} m³
                    </p>
                    <p className="text-label-secondary">
                      Monto: {formatCurrency(point.amount)}
                    </p>
                    {point.volume > 0 && (
                      <p className="text-label-secondary">
                        Precio prom.: {formatCurrency(avgPrice)}/m³
                      </p>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        {hasPoints && fitBounds && <FitBounds points={displayPoints} />}
      </MapContainer>
    </div>
  );
}

const DeliveryPointMap = memo(DeliveryPointMapInner);

export default DeliveryPointMap;
