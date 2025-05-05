'use client';

import React, { ReactNode, useState, useEffect } from 'react';
import { useJsApiLoader, Libraries } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/config/maps';

// Google Maps API libraries to load
const libraries: Libraries = ['places'];

// Create a context to track if the script is loaded
export const GoogleMapsScriptContext = React.createContext<boolean>(false);

interface GoogleMapWrapperProps {
  children: ReactNode;
  className?: string;
}

export default function GoogleMapWrapper({ children, className = '' }: GoogleMapWrapperProps) {
  // Track if window is defined (client-side only)
  const [isClient, setIsClient] = useState(false);
  
  // Use the built-in hook to properly load the API
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
    // This option prevents the warning about API already being loaded
    preventGoogleFontsLoading: true,
  });

  // Only run on client-side to avoid SSR issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // For debugging
  useEffect(() => {
    if (loadError) {
      console.error('Error loading Google Maps API:', loadError);
    }
  }, [loadError]);

  // If not on client, show loading placeholder
  if (!isClient) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gray-100 rounded-lg ${className}`}>
        <div className="text-center p-4">
          <p className="text-gray-600">Inicializando mapa...</p>
        </div>
      </div>
    );
  }
  
  // Handle load error
  if (loadError) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gray-100 rounded-lg ${className}`}>
        <div className="text-center p-4">
          <p className="text-red-600 font-medium">Error al cargar el mapa</p>
          <p className="text-gray-600 text-sm mt-2">Por favor, recarga la página o verifica tu conexión.</p>
        </div>
      </div>
    );
  }
  
  // Show loading indicator while API is loading
  if (!isLoaded) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gray-100 rounded-lg ${className}`}>
        <div className="text-center p-4">
          <p className="text-gray-600">Cargando mapa...</p>
          <div className="mt-2 w-8 h-8 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // API is loaded, render the children with improved container
  return (
    <div className={`google-maps-wrapper relative ${className}`}>
      <GoogleMapsScriptContext.Provider value={true}>
        {children}
      </GoogleMapsScriptContext.Provider>
    </div>
  );
} 