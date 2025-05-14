'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clientService } from '@/lib/supabase/clients';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { GmpPlaceSelectEventDetail, GmpPlaceResult } from '@/types/google.maps';

// Dynamically import map component with no SSR
const GoogleMapSelector = dynamic(
  () => import('@/components/maps/GoogleMapSelector'),
  { ssr: false }
);

const GoogleMapWrapper = dynamic(
  () => import('@/components/maps/GoogleMapWrapper'),
  { ssr: false }
);

interface ConstructionSiteFormProps {
  clientId: string;
  onSiteCreated: (siteId: string, siteName: string, siteLocation?: string, siteLat?: number, siteLng?: number) => void;
  onCancel: () => void;
}

// Componente para el cuadro de búsqueda de ubicaciones
const LocationSearchBox = ({ onSelectLocation }: { onSelectLocation: (lat: number, lng: number, address?: string) => void }) => {
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);

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

  // Check if the custom element is defined
  useEffect(() => {
    if (typeof window !== 'undefined' && window.customElements) {
      const isDefined = window.customElements.get('gmp-place-autocomplete');
    } else {
    }
  }, []);

  // Callback ref for the PlaceAutocompleteElement
  const autocompleteElementRefCallback = useCallback((node: HTMLElement | null) => {
    if (node) {
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

      node.addEventListener('gmp-select', placeSelectHandler);
      node.addEventListener('gmp-error', errorHandler);

      return () => {
        node.removeEventListener('gmp-select', placeSelectHandler);
        node.removeEventListener('gmp-error', errorHandler);
      };
    } else {
    }
  }, []);

  return (
    <div className="mb-3">
      <label htmlFor="location-search-input" className="block text-sm font-medium text-gray-700 mb-1">
        Buscar ubicación
      </label>
      <div className="relative">
        {/* Replace the input with the PlaceAutocompleteElement */}
        {/* Ensure types are augmented for gmp-place-autocomplete */}
        <gmp-place-autocomplete 
          ref={autocompleteElementRefCallback}
          id="location-search-input" 
          class="w-full p-2.5 pl-10 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 shadow-sm"
          placeholder="Buscar dirección o lugar..."
          requested-fields="id,displayName,formattedAddress,location"
          country-codes="MX"
          place-types="address"
          location-bias="rectangle:14.0,-118.0,33.0,-86.0" // Example bias for Mexico, adjust as needed
          >
          {/* Slotted input removed */}
        </gmp-place-autocomplete>
        
        {/* Icons and other elements might need to be positioned relative to the new web component */}
        <svg 
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
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
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

export default function ConstructionSiteForm({ 
  clientId, 
  onSiteCreated, 
  onCancel 
}: ConstructionSiteFormProps) {
  const [siteData, setSiteData] = useState({
    name: '',
    location: '',
    access_restrictions: '',
    special_conditions: '',
    is_active: true,
    latitude: null as number | null,
    longitude: null as number | null
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted state when component mounts
  useEffect(() => {
    setIsMounted(true);
    
    const triggerResize = () => window.dispatchEvent(new Event('resize'));
    
    // Trigger resizes at different intervals
    const timeouts = [
      setTimeout(triggerResize, 300),
      setTimeout(triggerResize, 600),
      setTimeout(triggerResize, 1000),
      setTimeout(() => {
        triggerResize();
      }, 1500)
    ];
    
    return () => {
      setIsMounted(false);
      // Clean up timeouts
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setSiteData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setSiteData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // Handler for map location selection
  const handleLocationSelect = useCallback((lat: number, lng: number) => {
    setSiteData(prev => {
      const newState = {
        ...prev,
        latitude: lat,
        longitude: lng
      };
      return newState;
    });
  }, []); // Empty dependency array makes it stable

  // Handler para el componente de búsqueda - now memoized
  const handleSearchBoxSelect = useCallback((lat: number, lng: number, address?: string) => {
    handleLocationSelect(lat, lng); // handleLocationSelect is now stable
    
    if (address) {
      setSiteData(prevSiteData => {
        // Always update location with the address from search
        return { ...prevSiteData, location: address };
      });
    }
  }, [handleLocationSelect]); // Dependency on stable handleLocationSelect

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!siteData.name.trim()) {
      setError('El nombre de la obra es obligatorio');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      const { data: createdSite, error: createError } = await clientService.createSite(
        clientId, 
        {
          name: siteData.name,
          location: siteData.location,
          access_restrictions: siteData.access_restrictions,
          special_conditions: siteData.special_conditions,
          is_active: siteData.is_active,
          latitude: siteData.latitude,
          longitude: siteData.longitude
        }
      );
      
      if (createError) {
        console.error('Error from Supabase when creating site:', createError);
        if (createdSite) {
          toast.success('Obra creada exitosamente');
          onSiteCreated(
            createdSite.id, 
            siteData.name, 
            siteData.location, 
            siteData.latitude || undefined, 
            siteData.longitude || undefined
          );
          return;
        }
        throw createError;
      }
      
      if (!createdSite) {
        console.log('No createdSite data received but also no error. Attempting to verify creation...');
        
        // Try to retrieve the site that might have been created
        try {
          const recentSites = await clientService.getClientSites(clientId);
          const newSite = recentSites.find(site => site.name === siteData.name);
          
          if (newSite) {
            console.log('Site was found in database despite missing response data:', newSite);
            toast.success('Obra creada exitosamente');
            onSiteCreated(
              newSite.id, 
              siteData.name, 
              newSite.location || siteData.location, 
              newSite.latitude || siteData.latitude || undefined, 
              newSite.longitude || siteData.longitude || undefined
            );
            return;
          }
        } catch (verifyError) {
          console.error('Error verifying site creation:', verifyError);
        }
        
        // If we still can't find the site, throw the original error
        throw new Error('No se recibieron datos de la obra creada');
      }
      
      toast.success('Obra creada exitosamente');
      onSiteCreated(
        createdSite.id, 
        siteData.name, 
        siteData.location, 
        siteData.latitude || undefined, 
        siteData.longitude || undefined
      );
    } catch (err: any) {
      console.error('Error creating construction site:', err);
      setError(err.message || 'Error al crear la obra');
      
      try {
        const checkSites = await clientService.getClientSites(clientId);
        const possiblyCreatedSite = checkSites.find(site => site.name === siteData.name);
        if (possiblyCreatedSite) {
          toast.success('La obra parece haberse creado correctamente a pesar del error.');
          onSiteCreated(
            possiblyCreatedSite.id, 
            siteData.name,
            possiblyCreatedSite.location,
            possiblyCreatedSite.latitude || undefined,
            possiblyCreatedSite.longitude || undefined
          );
        }
      } catch (checkError) {
        console.error('Error checking if site was created:', checkError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xs">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 border border-red-200">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos básicos de la obra */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-800 mb-4 flex items-center gap-2">
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
            </svg>
            Información General
          </h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la Obra *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={siteData.name}
                onChange={handleChange}
                className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Ubicación
              </label>
              <input
                id="location"
                name="location"
                type="text"
                value={siteData.location}
                onChange={handleChange}
                className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                id="is_active"
                name="is_active"
                type="checkbox"
                checked={siteData.is_active}
                onChange={handleCheckboxChange}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">
                Obra Activa
              </label>
            </div>
          </div>
        </div>
        
        {/* Detalles y restricciones */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-800 mb-4 flex items-center gap-2">
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            Detalles Adicionales
          </h3>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="access_restrictions" className="block text-sm font-medium text-gray-700 mb-1">
                Restricciones de Acceso
              </label>
              <textarea
                id="access_restrictions"
                name="access_restrictions"
                value={siteData.access_restrictions}
                onChange={handleChange}
                rows={2}
                className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            <div>
              <label htmlFor="special_conditions" className="block text-sm font-medium text-gray-700 mb-1">
                Condiciones Especiales
              </label>
              <textarea
                id="special_conditions"
                name="special_conditions"
                value={siteData.special_conditions}
                onChange={handleChange}
                rows={2}
                className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>
        </div>
        
        {/* Map for selecting coordinates */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div>
            <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
              <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              Ubicación en el Mapa
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Busca una ubicación y luego haz clic en el mapa para ajustar las coordenadas exactas
            </p>
            
            {/* Componente de búsqueda de ubicaciones - Render only when isMounted is true */}
            {isMounted ? (
              <LocationSearchBox onSelectLocation={handleSearchBoxSelect} />
            ) : (
              <div className="h-[50px] flex items-center justify-center bg-gray-50 rounded-md border border-gray-200 mb-3">
                <p className="text-sm text-gray-500">Cargando buscador de ubicaciones...</p>
              </div>
            )}

            {/* Log values just before rendering the map, ensuring it doesn't render void */}
            {((): null => {
              return null;
            })()}

            <div className="h-[350px] rounded-md overflow-hidden border border-gray-300 shadow-sm">
              {isMounted ? (
                <GoogleMapWrapper>
                  <GoogleMapSelector 
                    key={siteData.latitude && siteData.longitude ? `${siteData.latitude}-${siteData.longitude}` : 'map-no-location'} 
                    onSelectLocation={handleLocationSelect} 
                    height="350px"
                    initialPosition={siteData.latitude && siteData.longitude ? 
                      { lat: siteData.latitude, lng: siteData.longitude } : null}
                    readOnly={false}
                  />
                </GoogleMapWrapper>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mx-auto mb-2"></div>
                    <p className="text-gray-600">Cargando mapa...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Display coordinates if selected */}
            {siteData.latitude && siteData.longitude && (
              <div className="mt-3 text-sm bg-gray-50 p-3 rounded-md border border-gray-200">
                <p className="font-medium text-gray-700 mb-1">Coordenadas seleccionadas:</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Lat: {siteData.latitude.toFixed(6)}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Lng: {siteData.longitude.toFixed(6)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isSubmitting}
            className="bg-white hover:bg-gray-50"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creando...
              </span>
            ) : 'Crear Obra'}
          </Button>
        </div>
      </form>
    </div>
  );
} 