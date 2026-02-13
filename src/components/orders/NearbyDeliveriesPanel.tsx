'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

type NearbyDelivery = {
  id: string;
  order_number: string;
  site_access_rating: 'green' | 'yellow' | 'red';
  delivery_date: string | null;
  days_ago: number | null;
};

type Props = {
  latitude: string;
  longitude: string;
  radiusMeters?: number;
};

const RATING_LABELS: Record<string, string> = {
  green: 'Verde',
  yellow: 'Amarillo',
  red: 'Rojo',
};


export default function NearbyDeliveriesPanel({ latitude, longitude, radiusMeters = 1000 }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ nearby: NearbyDelivery[]; total_found: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      setLoading(false);
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      ...(radiusMeters !== 1000 && { radius: String(radiusMeters) }),
    });

    fetch(`/api/orders/nearby-deliveries?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Error al buscar entregas cercanas');
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, radiusMeters]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Buscando entregas cercanas…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
        No se pudo cargar el historial de entregas cercanas.
      </div>
    );
  }

  if (!data || data.total_found === 0) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600">
        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          No hay entregas previas registradas dentro de {radiusMeters} m de este punto.
        </span>
      </div>
    );
  }

  const greenCount = data.nearby.filter((n) => n.site_access_rating === 'green').length;
  const yellowCount = data.nearby.filter((n) => n.site_access_rating === 'yellow').length;
  const redCount = data.nearby.filter((n) => n.site_access_rating === 'red').length;
  const mostRecent = data.nearby[0];

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-4">
      <div className="flex items-start gap-2 mb-2">
        <MapPin className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-900">
            {data.total_found} entrega{data.total_found !== 1 ? 's' : ''} cercana
            {data.total_found !== 1 ? 's' : ''} dentro de {radiusMeters} m
          </p>
          <p className="text-xs text-blue-700 mt-1">
            {greenCount > 0 && (
              <span className="mr-2">
                <span className="font-medium">{greenCount}</span> verde{greenCount !== 1 ? 's' : ''}
              </span>
            )}
            {yellowCount > 0 && (
              <span className="mr-2">
                <span className="font-medium">{yellowCount}</span> amarillo
                {yellowCount !== 1 ? 's' : ''}
              </span>
            )}
            {redCount > 0 && (
              <span>
                <span className="font-medium">{redCount}</span> rojo{redCount !== 1 ? 's' : ''}
              </span>
            )}
            {mostRecent?.days_ago != null && (
              <span className="block mt-0.5 text-blue-600">
                Más reciente: hace {mostRecent.days_ago} día{mostRecent.days_ago !== 1 ? 's' : ''}
                {mostRecent.site_access_rating && (
                  <span> ({RATING_LABELS[mostRecent.site_access_rating] || mostRecent.site_access_rating})</span>
                )}
              </span>
            )}
          </p>
        </div>
      </div>
      {data.nearby.some((n) => n.site_access_rating === 'yellow' || n.site_access_rating === 'red') && (
        <p className="text-xs text-blue-700 mt-2">
          Revisa el historial para elegir una clasificación similar si las condiciones no han cambiado.
        </p>
      )}
    </div>
  );
}
