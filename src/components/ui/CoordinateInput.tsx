'use client';

import React, { useState, useEffect } from 'react';
import { validateCoordinates, generateGoogleMapsUrl } from '../orders/ScheduleOrderForm';

interface CoordinateInputProps {
  latitude: string;
  longitude: string;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  required?: boolean;
  showMap?: boolean;
  showTips?: boolean;
  className?: string;
}

export default function CoordinateInput({
  latitude,
  longitude,
  onLatitudeChange,
  onLongitudeChange,
  required = false,
  showMap = true,
  showTips = true,
  className = ''
}: CoordinateInputProps) {
  const [coordinatesError, setCoordinatesError] = useState<string>('');

  // Validate coordinates whenever they change
  useEffect(() => {
    if (latitude || longitude) {
      const validation = validateCoordinates(latitude, longitude);
      setCoordinatesError(validation.error);
    } else {
      setCoordinatesError('');
    }
  }, [latitude, longitude]);

  const isValidCoordinates = latitude && longitude && !coordinatesError;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="latitude" className="block text-sm font-medium mb-1">
            Latitud {required && '*'}
          </label>
          <input
            id="latitude"
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => onLatitudeChange(e.target.value)}
            placeholder="-12.0464"
            required={required}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="longitude" className="block text-sm font-medium mb-1">
            Longitud {required && '*'}
          </label>
          <input
            id="longitude"
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => onLongitudeChange(e.target.value)}
            placeholder="-77.0428"
            required={required}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      {coordinatesError && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-md text-sm">
          {coordinatesError}
        </div>
      )}

      {isValidCoordinates && showMap && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 p-3 rounded-md">
            <p className="text-sm text-green-700 font-medium">✓ Coordenadas válidas</p>
            <p className="text-xs text-green-600 mt-1">
              Lat: {latitude}, Lng: {longitude}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
            <p className="text-sm font-medium text-blue-700 mb-2">Vista Previa del Mapa</p>
            <div className="aspect-video bg-gray-100 rounded-md overflow-hidden">
              <iframe
                src={`https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d100!2d${longitude}!3d${latitude}!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z${latitude}%2C${longitude}!5e0!3m2!1ses!2s!4v1690000000000!5m2!1ses!2s`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación"
              ></iframe>
            </div>

            <div className="mt-3 flex gap-2">
              <a
                href={generateGoogleMapsUrl(latitude, longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                </svg>
                Abrir en Google Maps
              </a>
            </div>
          </div>
        </div>
      )}

      {showTips && (
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
          <p className="text-sm text-yellow-700">
            <span className="font-medium">💡 Consejos para coordenadas:</span>
          </p>
          <ul className="text-xs text-yellow-600 mt-1 space-y-1">
            <li>• Abre Google Maps en tu dispositivo</li>
            <li>• Mantén presionado el punto exacto de entrega</li>
            <li>• Las coordenadas aparecerán en la barra de búsqueda</li>
            <li>• Copia y pega los valores aquí</li>
          </ul>
        </div>
      )}
    </div>
  );
}
