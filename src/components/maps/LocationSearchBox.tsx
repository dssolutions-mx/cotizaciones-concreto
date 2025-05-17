'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

// Add type definition for the gmp-place-autocomplete element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmp-place-autocomplete': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        class?: string;
        placeholder?: string;
        'requested-fields'?: string;
        'country-codes'?: string;
        'place-types'?: string;
        'location-bias'?: string;
      };
    }
  }
}

interface LocationSearchBoxProps {
  onSelectLocation: (lat: number, lng: number, address?: string) => void;
  className?: string;
}

const LocationSearchBox = ({ onSelectLocation, className = '' }: LocationSearchBoxProps) => {
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchBoxContainerRef = useRef<HTMLDivElement>(null);

  // Store the event handler in a ref to ensure it's stable for add/removeEventListener
  const handlePlaceSelectCallbackRef = useRef<((event: Event) => void) | null>(null);
  const handleErrorCallbackRef = useRef<((event: Event) => void) | null>(null);

  useEffect(() => {
    const checkGoogleMapsStatus = () => {
      // Check if Google Maps is available
      if (!window.google) {
        console.error('Google Maps API is not available (window.google is undefined)');
        return false;
      }
      
      // Check if Google Maps Maps module is available
      if (!window.google.maps) {
        console.error('Google Maps Maps module is not available (window.google.maps is undefined)');
        return false;
      }
      
      // Check if Google Maps Places module is available
      if (!window.google.maps.places) {
        console.error('Google Maps Places API is not available (window.google.maps.places is undefined)');
        return false;
      }
      
      return true;
    };
    
    const initializeServices = () => {
      try {
        if (!checkGoogleMapsStatus()) return false;
        return true;
      } catch (error) {
        console.error('Error during simplified Google Maps services check:', error);
        toast.error('Error al inicializar servicios de Google Maps. Intente recargar la página.');
        return false;
      }
    };

    if (window.google && window.google.maps && window.google.maps.places) {
      initializeServices();
    } else {
      const retryTimes = [500, 1500, 3000, 6000];
      const timeouts = retryTimes.map((delay, index) => {
        return setTimeout(() => {
          if (initializeServices()) {
             timeouts.slice(index + 1).forEach(clearTimeout);
          }
        }, delay);
      });
      return () => timeouts.forEach(clearTimeout);
    }
  }, []);
  
  // Handler for the PlaceAutocompleteElement's 'gmp-select' event
  const handlePlaceSelect = useCallback(async (event: Event) => {
    const placeEvent = event as Event & { placePrediction?: any };
    const placePrediction = placeEvent.placePrediction;

    if (!placePrediction) {
      console.warn('[LocationSearchBox] No placePrediction found on gmp-select event.', event);
      return;
    }

    setIsSearching(true);

    try {
      const place = placePrediction.toPlace(); 
      await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress', 'id', 'viewport'] });

      let lat: number | undefined;
      let lng: number | undefined;

      if (place.location) {
        // Check if lat/lng are methods (google.maps.LatLng) or properties
        if (typeof place.location.lat === 'function' && typeof place.location.lng === 'function') {
          lat = place.location.lat();
          lng = place.location.lng();
        } else if (typeof (place.location as any).lat === 'number' && typeof (place.location as any).lng === 'number') {
          // Fallback if they are direct numeric properties (less common for official Place object after fetchFields)
          lat = (place.location as any).lat;
          lng = (place.location as any).lng;
        }
      }

      if (typeof lat === 'number' && typeof lng === 'number') {
        // Prioritize formattedAddress for the location field.
        // displayName can be a fallback if formattedAddress is not available.
        const addressString = place.formattedAddress || place.displayName;
        
        setSearchText(addressString || ''); 
        onSelectLocation(lat, lng, addressString); // Pass the prioritized address
        toast.success(`Ubicación seleccionada: ${addressString || 'Ubicación sin nombre'}`);
      } else {
        toast.error('No se pudo obtener la ubicación detallada del lugar seleccionado.');
        console.error('[LocationSearchBox] Place object missing valid location (lat/lng) after fetchFields. No fallback implemented.', place);
      }
    } catch (error) {
      console.error('[LocationSearchBox] Error processing place selection or fetching fields:', error);
      toast.error('Error al procesar la selección del lugar.');
    } finally {
      setIsSearching(false);
    }
  }, [onSelectLocation]);

  // Update the ref when handlePlaceSelect (and its dependencies) changes.
  useEffect(() => {
    handlePlaceSelectCallbackRef.current = handlePlaceSelect;
  }, [handlePlaceSelect]);

  // Error handler for PlaceAutocompleteElement
  const handleError = useCallback((event: Event) => {
    const customErrorEvent = event as CustomEvent<{ message: string; code?: string }>;
    console.error('Error from PlaceAutocompleteElement:', customErrorEvent.detail);
    toast.error(`Error en el buscador: ${customErrorEvent.detail?.message || 'Error desconocido'}`);
  }, []);

  useEffect(() => {
    handleErrorCallbackRef.current = handleError;
  }, [handleError]);

  // Create and configure the gmp-place-autocomplete element
  useEffect(() => {
    if (!searchBoxContainerRef.current) return;
    
    // Create the element
    const autocompleteElement = document.createElement('gmp-place-autocomplete');
    autocompleteElement.setAttribute('id', 'location-search-input');
    autocompleteElement.setAttribute('class', 'w-full p-2.5 pl-10 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 shadow-sm');
    autocompleteElement.setAttribute('placeholder', 'Buscar dirección o lugar...');
    autocompleteElement.setAttribute('requested-fields', 'id,displayName,formattedAddress,location');
    autocompleteElement.setAttribute('country-codes', 'MX');
    autocompleteElement.setAttribute('place-types', 'address');
    autocompleteElement.setAttribute('location-bias', 'rectangle:14.0,-118.0,33.0,-86.0'); // Example bias for Mexico
    
    // Add event listeners
    const placeSelectHandler = (event: Event) => {
      if (handlePlaceSelectCallbackRef.current) {
        handlePlaceSelectCallbackRef.current(event);
      }
    };
    
    const errorHandler = (event: Event) => {
      if (handleErrorCallbackRef.current) {
        handleErrorCallbackRef.current(event);
      }
    };

    autocompleteElement.addEventListener('gmp-select', placeSelectHandler);
    autocompleteElement.addEventListener('gmp-error', errorHandler);
    
    // Clear the container and append the element
    const container = searchBoxContainerRef.current;
    container.innerHTML = '';
    container.appendChild(autocompleteElement);
    
    // Cleanup function
    return () => {
      autocompleteElement.removeEventListener('gmp-select', placeSelectHandler);
      autocompleteElement.removeEventListener('gmp-error', errorHandler);
      
      if (container.contains(autocompleteElement)) {
        container.removeChild(autocompleteElement);
      }
    };
  }, []);

  return (
    <div className={`mb-3 ${className}`}>
      <label htmlFor="location-search-input" className="block text-sm font-medium text-gray-700 mb-1">
        Buscar ubicación
      </label>
      <div className="relative">
        {/* Container for the gmp-place-autocomplete element */}
        <div ref={searchBoxContainerRef} className="search-box-container relative"></div>
        
        <svg 
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10"
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
          />
        </svg>
        {isSearching && (
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin h-4 w-4 text-green-500 z-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
      </div>
      <div className="mt-1 text-xs flex justify-between items-center">
        <p className="text-gray-500">
          Comienza a escribir para ver sugerencias o selecciona directamente en el mapa
        </p>
        
        <a 
          href="https://www.google.com/maps" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline ml-1 inline-flex items-center"
        >
          <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Google Maps
        </a>
      </div>
    </div>
  );
};

export default LocationSearchBox; 