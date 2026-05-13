'use client';

import { useEffect, useState } from 'react';
import { MapPin, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  generateGoogleMapsUrl,
  MAPS_SHORT_LINK_HOST_PATTERN,
  parseGoogleMapsCoordinates,
  validateCoordinates,
} from '@/lib/maps/deliveryCoordinates';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Props = {
  latitude: string;
  longitude: string;
  onLatitudeChange: (v: string) => void;
  onLongitudeChange: (v: string) => void;
};

export function OptionalDeliveryLocationSection({
  latitude,
  longitude,
  onLatitudeChange,
  onLongitudeChange,
}: Props) {
  const [mapsPaste, setMapsPaste] = useState('');
  const [isParsingMapsLink, setIsParsingMapsLink] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobileViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const coordValidation = validateCoordinates(latitude, longitude);
  const hasAnyCoord = Boolean(latitude.trim() || longitude.trim());
  const showCoordError = hasAnyCoord && !coordValidation.isValid;
  const coordsOk = Boolean(latitude.trim() && longitude.trim() && coordValidation.isValid);

  const clearPin = () => {
    onLatitudeChange('');
    onLongitudeChange('');
    setMapsPaste('');
    setParseError(null);
    setGeoError(null);
  };

  const extractFromPaste = async () => {
    setParseError(null);
    setIsParsingMapsLink(true);
    try {
      const parsed = parseGoogleMapsCoordinates(mapsPaste);
      if (parsed) {
        onLatitudeChange(parsed.lat);
        onLongitudeChange(parsed.lng);
        return;
      }

      if (MAPS_SHORT_LINK_HOST_PATTERN.test(mapsPaste.trim())) {
        try {
          const { data, error } = await supabase.functions.invoke('maps-url-parser', {
            body: { url: mapsPaste.trim() },
          });
          if (!error && data) {
            const { lat, lng, finalUrl } = data as {
              lat?: number | string;
              lng?: number | string;
              finalUrl?: string;
            };
            if (lat != null && lng != null) {
              onLatitudeChange(String(lat));
              onLongitudeChange(String(lng));
              return;
            }
            const parsed3 = finalUrl ? parseGoogleMapsCoordinates(finalUrl) : null;
            if (parsed3) {
              onLatitudeChange(parsed3.lat);
              onLongitudeChange(parsed3.lng);
              return;
            }
          }
        } catch {
          /* fall through to error message */
        }
      }

      setParseError(
        'No se pudieron extraer coordenadas. Pegue un enlace de Google Maps, enlace corto (maps.app.goo.gl) o lat,lng (ej. 19.432608,-99.133209).'
      );
    } finally {
      setIsParsingMapsLink(false);
    }
  };

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('Tu navegador no permite ubicación.');
      return;
    }
    setGeoError(null);
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLatitudeChange(String(pos.coords.latitude));
        onLongitudeChange(String(pos.coords.longitude));
        setGeoLoading(false);
      },
      () => {
        setGeoError('No se pudo obtener la ubicación. Revise permisos o use enlace / coordenadas.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  return (
    <details className="group rounded-2xl border border-white/20 bg-white/[0.03] open:bg-white/[0.05]">
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3',
          'text-footnote uppercase tracking-wide text-label-tertiary',
          '[&::-webkit-details-marker]:hidden'
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="normal-case tracking-normal text-body font-semibold text-label-primary">
            Ubicación en obra <span className="font-normal text-label-secondary">(opcional)</span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-label-tertiary transition-transform group-open:rotate-180" aria-hidden />
      </summary>

      <div className="space-y-4 border-t border-white/10 px-4 pb-4 pt-3">
        <p className="text-caption text-label-secondary">
          Ayuda a la flota a ubicar el punto exacto de colación. Puede pegar un enlace de Google Maps (incluye enlaces cortos) o
          indicar coordenadas.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <input
            type="text"
            value={mapsPaste}
            onChange={(e) => setMapsPaste(e.target.value)}
            placeholder="Enlace de Maps o lat,lng"
            className="min-w-0 flex-1 rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none text-body"
            aria-label="Pegar enlace de Google Maps o coordenadas"
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 glass-thin border-white/20 sm:w-auto"
            disabled={isParsingMapsLink || !mapsPaste.trim()}
            onClick={extractFromPaste}
          >
            {isParsingMapsLink ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                Extrayendo…
              </>
            ) : (
              'Extraer'
            )}
          </Button>
        </div>

        {isMobileViewport && typeof navigator !== 'undefined' && 'geolocation' in navigator ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto border-white/25 bg-white/[0.04]"
              disabled={geoLoading}
              onClick={useCurrentLocation}
            >
              {geoLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                  Obteniendo ubicación…
                </>
              ) : (
                'Usar mi ubicación actual'
              )}
            </Button>
          </div>
        ) : null}

        {(parseError || geoError) && (
          <p className="text-callout text-amber-700 dark:text-amber-400" role="alert">
            {parseError || geoError}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="schedule-delivery-lat" className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">
              Latitud
            </label>
            <input
              id="schedule-delivery-lat"
              type="text"
              inputMode="decimal"
              value={latitude}
              onChange={(e) => onLatitudeChange(e.target.value)}
              placeholder="Ej. 19.432608"
              className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="schedule-delivery-lng" className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">
              Longitud
            </label>
            <input
              id="schedule-delivery-lng"
              type="text"
              inputMode="decimal"
              value={longitude}
              onChange={(e) => onLongitudeChange(e.target.value)}
              placeholder="Ej. -99.133209"
              className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
            />
          </div>
        </div>

        {showCoordError ? (
          <p className="text-callout text-red-600 dark:text-red-400" role="alert">
            {coordValidation.error}
          </p>
        ) : null}

        {coordsOk ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
            <p className="text-caption text-label-secondary">
              Pin listo:{' '}
              <span className="font-mono text-label-primary tabular-nums">
                {latitude}, {longitude}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={generateGoogleMapsUrl(latitude, longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-callout font-medium text-primary underline-offset-2 hover:underline"
              >
                Abrir en Google Maps
              </a>
              <button
                type="button"
                onClick={clearPin}
                className="text-callout text-label-tertiary hover:text-label-primary"
              >
                Quitar
              </button>
            </div>
          </div>
        ) : null}

        <p className="text-caption text-label-tertiary">
          Si un enlace corto no se procesa: ábralo en el navegador, copie la URL larga (google.com/maps…) y péguela aquí.
        </p>
      </div>
    </details>
  );
}
