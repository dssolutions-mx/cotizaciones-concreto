'use client';

import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { DEFAULT_MAP_CENTER } from '@/config/maps';

// Map container style
const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

interface GoogleMapSelectorProps {
  initialPosition?: { lat: number; lng: number } | null;
  onSelectLocation: (lat: number, lng: number) => void;
  height?: string;
  className?: string;
  readOnly?: boolean;
}

export default function GoogleMapSelector({
  initialPosition,
  onSelectLocation,
  height = '300px',
  className = '',
  readOnly = false,
}: GoogleMapSelectorProps) {
  // State for component mounted status
  const [isMounted, setIsMounted] = useState(false);
  
  // State for map center and marker position
  const [center, setCenter] = useState(initialPosition || DEFAULT_MAP_CENTER);
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(
    initialPosition || null
  );
  
  // State for manual coordinate input
  const [manualLat, setManualLat] = useState(initialPosition?.lat?.toString() || '');
  const [manualLng, setManualLng] = useState(initialPosition?.lng?.toString() || '');
  
  // Ref for map
  const mapRef = useRef<google.maps.Map | null>(null);

  // Set mounted state
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Update coordinates when initialPosition changes
  useEffect(() => {
    if (initialPosition) {
      setCenter(initialPosition);
      setMarkerPosition(initialPosition);
      setManualLat(initialPosition.lat.toString());
      setManualLng(initialPosition.lng.toString());
      
      // If map already exists, pan to the new position
      if (mapRef.current) {
        mapRef.current.panTo(initialPosition);
        mapRef.current.setZoom(15);
      }
    }
  }, [initialPosition]);

  // Handler for map click
  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (readOnly || !event.latLng) return;
    
    const newPosition = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };
    
    setMarkerPosition(newPosition);
    setManualLat(newPosition.lat.toString());
    setManualLng(newPosition.lng.toString());
    onSelectLocation(newPosition.lat, newPosition.lng);
  }, [onSelectLocation, readOnly]);

  // Handler for manually updating coordinates
  const handleManualCoordinateUpdate = useCallback(() => {
    try {
      const lat = parseFloat(manualLat);
      const lng = parseFloat(manualLng);
      
      if (isNaN(lat) || isNaN(lng)) {
        toast.error('Coordenadas inválidas. Por favor ingrese números válidos.');
        return;
      }
      
      if (lat < -90 || lat > 90) {
        toast.error('Latitud debe estar entre -90 y 90 grados.');
        return;
      }
      
      if (lng < -180 || lng > 180) {
        toast.error('Longitud debe estar entre -180 y 180 grados.');
        return;
      }
      
      const newPosition = { lat, lng };
      setMarkerPosition(newPosition);
      setCenter(newPosition);
      onSelectLocation(lat, lng);
      
      if (mapRef.current) {
        mapRef.current.panTo(newPosition);
      }
    } catch (error) {
      toast.error('Error al actualizar coordenadas. Intente nuevamente.');
    }
  }, [manualLat, manualLng, onSelectLocation]);

  // Handler for map load with more debugging
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    
    // Set initial position when map loads if we have one
    if (initialPosition) {
      map.panTo(initialPosition);
      map.setZoom(15);
    }
    
    // Force multiple resizes to ensure map is properly displayed
    const resizeMap = () => {
      if (mapRef.current) {
        google.maps.event.trigger(mapRef.current, 'resize');
      }
    };

    // Inicial y con retrasos para asegurar carga completa
    resizeMap();
    [100, 300, 600, 1000].forEach(delay => {
      setTimeout(resizeMap, delay);
    });
  }, [initialPosition]);

  // Add resize event listener
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        google.maps.event.trigger(mapRef.current, 'resize');
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`google-map-container ${className}`}>
      {/* Coordinate input fields */}
      <div className="coordinate-inputs flex flex-wrap gap-2 mb-3">
        <div className="w-full sm:w-auto flex-1">
          <Label htmlFor="latitude" className="text-sm font-medium mb-1 block">
            Latitud
          </Label>
          <Input
            id="latitude"
            type="text"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            disabled={readOnly}
            placeholder="Ej. 19.4326"
            className="w-full"
          />
        </div>
        <div className="w-full sm:w-auto flex-1">
          <Label htmlFor="longitude" className="text-sm font-medium mb-1 block">
            Longitud
          </Label>
          <Input
            id="longitude"
            type="text"
            value={manualLng}
            onChange={(e) => setManualLng(e.target.value)}
            disabled={readOnly}
            placeholder="Ej. -99.1332"
            className="w-full"
          />
        </div>
        {!readOnly && (
          <div className="w-full sm:w-auto flex items-end">
            <Button 
              type="button" 
              onClick={handleManualCoordinateUpdate}
              className="h-10 w-full sm:w-auto"
            >
              Actualizar
            </Button>
          </div>
        )}
      </div>

      {/* Google Map */}
      <div 
        style={{ 
          height, 
          width: '100%',
          minHeight: '300px'
        }} 
        className="relative rounded-lg overflow-hidden border border-gray-200 shadow-md"
      >
        <GoogleMap
          mapContainerStyle={{
            width: '100%',
            height: '100%',
            minHeight: '300px'
          }}
          center={center}
          zoom={15}
          onClick={handleMapClick}
          onLoad={onMapLoad}
          options={{
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
            zoomControl: true,
            clickableIcons: false, // Avoid clicking on POIs accidentally
          }}
        >
          {markerPosition && (
            <Marker 
              position={markerPosition} 
              draggable={!readOnly}
              onDragEnd={(e) => {
                if (e.latLng) {
                  const newPos = {
                    lat: e.latLng.lat(),
                    lng: e.latLng.lng()
                  };
                  setMarkerPosition(newPos);
                  setManualLat(newPos.lat.toString());
                  setManualLng(newPos.lng.toString());
                  onSelectLocation(newPos.lat, newPos.lng);
                }
              }}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
} 