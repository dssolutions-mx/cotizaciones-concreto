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
    console.log('GoogleMapWrapper mounted, API key present:', !!GOOGLE_MAPS_API_KEY);
    
    // Add detailed logging for API key issues
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('Google Maps API key is missing! Please check your .env.local file.');
    } else if (GOOGLE_MAPS_API_KEY.length < 10) {
      console.error('Google Maps API key appears to be invalid or too short:', GOOGLE_MAPS_API_KEY);
    }
  }, []);

  // Debug map loading status
  useEffect(() => {
    console.log('Google Maps loading status:', { isClient, isLoaded, hasError: !!loadError });
    
    // Check for common Google Maps errors
    if (loadError) {
      console.error('Google Maps API loading error details:', loadError);
      
      // Check for specific error types
      if (loadError.message && loadError.message.includes('API key')) {
        console.error('Google Maps API key error detected. Please check your API key configuration.');
      } else if (loadError.message && loadError.message.includes('script')) {
        console.error('Google Maps script loading error. This might be a network issue or a problem with the API URL.');
      } else if (loadError.message && loadError.message.includes('library')) {
        console.error('Google Maps library error. Make sure the requested libraries are correct.');
      }
    }
    
    // Fix for modal rendering - trigger resize events
    if (isLoaded && isClient) {
      const triggerResize = () => {
        window.dispatchEvent(new Event('resize'));
      };
      
      // Trigger multiple resize events to ensure proper rendering
      triggerResize();
      const timeouts = [
        setTimeout(triggerResize, 100),
        setTimeout(triggerResize, 300),
        setTimeout(triggerResize, 500),
        setTimeout(triggerResize, 1000)
      ];
      
      return () => {
        timeouts.forEach(clearTimeout);
      };
    }
  }, [isLoaded, isClient, loadError]);

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
  
  // Handle load error with more detailed diagnostics
  if (loadError) {
    // Log detailed error information for debugging
    console.error('Google Maps API loading error details:', {
      error: loadError,
      message: loadError.message,
      stack: loadError.stack,
      name: loadError.name
    });
    
    // Check for common Google Maps errors
    let errorMessage = 'Error al cargar el mapa';
    if (loadError.message) {
      if (loadError.message.includes('API key')) {
        errorMessage = 'Error de clave API. Verifique su archivo .env.local';
        console.error('⚠️ Google Maps API key error detected. Check that your API key is correct and has the proper permissions enabled.');
      } else if (loadError.message.includes('script')) {
        errorMessage = 'Error de carga de script. Verifique su conexión a internet';
        console.error('⚠️ Google Maps script loading error. This might be a network issue or a problem with the API URL.');
      }
    }
    
    // Get more information about any network issues
    if (window.navigator && window.navigator.onLine === false) {
      errorMessage = 'Sin conexión a internet. Reconecte y recargue la página';
      console.error('⚠️ The device appears to be offline. Check internet connection.');
    }

    return (
      <div className={`w-full h-full flex items-center justify-center bg-gray-100 rounded-lg ${className}`}>
        <div className="text-center p-4">
          <p className="text-red-600 font-medium">{errorMessage}</p>
          <p className="text-gray-600 text-sm mt-2">
            {loadError.message ? `Detalles: ${loadError.message.slice(0, 100)}...` : 'Por favor, recarga la página o verifica tu conexión.'}
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-gray-200 rounded text-xs text-left overflow-auto max-h-32">
              <p className="font-bold">Información de depuración:</p>
              <p>API Key presente: {!!GOOGLE_MAPS_API_KEY ? 'Sí' : 'No'}</p>
              <p>Longitud de API Key: {GOOGLE_MAPS_API_KEY?.length || 0}</p>
              <p>Environment: {process.env.NODE_ENV}</p>
              <p>Online status: {window.navigator.onLine ? 'Online' : 'Offline'}</p>
            </div>
          )}
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