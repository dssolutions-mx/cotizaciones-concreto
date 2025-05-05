'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';

// Fix for Leaflet default marker icon in Next.js
// This is necessary because Leaflet expects the marker images to be in a specific location
const DEFAULT_CENTER: [number, number] = [19.4326, -99.1332]; // Mexico City as default

interface MapSelectorProps {
  initialPosition?: [number, number] | null;
  onSelectLocation: (lat: number, lng: number) => void;
  height?: string;
  className?: string;
  readOnly?: boolean;
}

// Component to handle map click events
function LocationMarker({ position, setPosition, readOnly }: { 
  position: [number, number] | null, 
  setPosition: (position: [number, number]) => void,
  readOnly?: boolean
}) {
  const map = useMapEvents({
    click(e) {
      if (readOnly) return;
      
      const newPos: [number, number] = [e.latlng.lat, e.latlng.lng];
      setPosition(newPos);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  // Center map on marker position when it changes
  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom(), { animate: true, duration: 1 });
    }
  }, [map, position]);

  return position ? <Marker position={position} /> : null;
}

// Fix Leaflet default icon issue in Next.js
const fixLeafletIcon = () => {
  // Only run this on the client side
  if (typeof window !== 'undefined') {
    // Fix the icon issue
    delete (Icon.Default.prototype as any)._getIconUrl;
    Icon.Default.mergeOptions({
      iconRetinaUrl: '/images/marker-icon-2x.png',
      iconUrl: '/images/marker-icon.png',
      shadowUrl: '/images/marker-shadow.png',
    });
  }
};

export default function MapSelector({ 
  initialPosition, 
  onSelectLocation, 
  height = '400px', 
  className = '',
  readOnly = false
}: MapSelectorProps) {
  const [position, setPosition] = useState<[number, number] | null>(initialPosition || null);
  const mapRef = useRef(null);
  const positionRef = useRef(position);
  
  // Fix the icon issue
  useEffect(() => {
    fixLeafletIcon();
  }, []);

  // Update position state when initialPosition changes
  useEffect(() => {
    if (initialPosition && 
        (position === null || 
         initialPosition[0] !== position[0] || 
         initialPosition[1] !== position[1])) {
      setPosition(initialPosition);
    }
  }, [initialPosition]);

  // Memoize the position change handler to prevent recreation on each render
  const handlePositionChange = useCallback((newPos: [number, number]) => {
    setPosition(newPos);
    // Only call parent update if the position has actually changed
    if (!positionRef.current || 
        newPos[0] !== positionRef.current[0] || 
        newPos[1] !== positionRef.current[1]) {
      onSelectLocation(newPos[0], newPos[1]);
      positionRef.current = newPos;
    }
  }, [onSelectLocation]);

  return (
    <div className={`map-container ${className}`} style={{ height }}>
      <MapContainer 
        center={position || DEFAULT_CENTER} 
        zoom={15} 
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        scrollWheelZoom={true}
      >
        {/* Use Mapbox or ESRI tiles for better quality */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
        />
        <LocationMarker 
          position={position} 
          setPosition={handlePositionChange}
          readOnly={readOnly}
        />
      </MapContainer>
      
      {position && (
        <div className="coordinates-display mt-2 text-sm text-gray-600">
          Latitud: {position[0].toFixed(6)}, Longitud: {position[1].toFixed(6)}
        </div>
      )}
    </div>
  );
} 