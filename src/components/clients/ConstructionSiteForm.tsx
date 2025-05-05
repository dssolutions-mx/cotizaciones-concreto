'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clientService } from '@/lib/supabase/clients';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

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
  onSiteCreated: (siteId: string, siteName: string) => void;
  onCancel: () => void;
}

// Componente para el cuadro de búsqueda de ubicaciones
const LocationSearchBox = ({ onSelectLocation }: { onSelectLocation: (lat: number, lng: number, address?: string) => void }) => {
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Inicializar servicios de Google cuando el componente se monta
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
      // Necesitamos un elemento del DOM para inicializar el PlacesService
      const placesDiv = document.createElement('div');
      placesService.current = new window.google.maps.places.PlacesService(placesDiv);
      sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
    }
  }, []);

  // Cerrar sugerencias cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) && 
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Búsqueda de sugerencias mientras se escribe
  const searchSuggestions = useCallback((text: string) => {
    if (!text.trim() || !autocompleteService.current || !sessionToken.current) return;

    setIsSearching(true);
    autocompleteService.current.getPlacePredictions(
      {
        input: text,
        sessionToken: sessionToken.current,
      },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions && predictions.length > 0) {
          setSuggestions(predictions);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
        setIsSearching(false);
      }
    );
  }, []);

  // Manejar cambios en el input con debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchText.trim().length > 2) {
        searchSuggestions(searchText);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchText, searchSuggestions]);

  // Manejar selección de un lugar
  const handleSelectPlace = useCallback((placeId: string, description: string) => {
    if (!placesService.current || !sessionToken.current) return;

    setIsSearching(true);
    placesService.current.getDetails(
      {
        placeId: placeId,
        fields: ['geometry', 'formatted_address'],
        sessionToken: sessionToken.current
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          
          // Actualizar el valor del input
          setSearchText(place.formatted_address || description);
          
          // Cerrar sugerencias
          setShowSuggestions(false);
          
          // Llamar al callback con la ubicación
          onSelectLocation(lat, lng, place.formatted_address);
          
          // Generar un nuevo token para la siguiente búsqueda
          sessionToken.current = new google.maps.places.AutocompleteSessionToken();
          
          toast.success(`Ubicación seleccionada: ${place.formatted_address}`);
        } else {
          toast.error("No se pudo obtener la ubicación seleccionada.");
        }
        setIsSearching(false);
      }
    );
  }, [onSelectLocation]);

  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Buscar ubicación
      </label>
      <div className="relative">
        <div className="flex shadow-sm">
          <div className="relative flex-grow flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar dirección o lugar..."
              className="w-full p-2.5 pl-10 border border-r-0 border-gray-300 rounded-l-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
            />
            <svg 
              className="absolute left-3 top-3 h-4 w-4 text-gray-400"
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
              <svg className="absolute right-3 top-3 animate-spin h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (suggestions.length === 1) {
                handleSelectPlace(suggestions[0].place_id, suggestions[0].description);
              } else if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            disabled={isSearching || !searchText.trim()}
            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-r-md border border-green-600 transition-colors"
          >
            <span>Buscar</span>
          </button>
        </div>

        {/* Dropdown de sugerencias */}
        {showSuggestions && suggestions.length > 0 && (
          <div 
            ref={suggestionsRef}
            className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg max-h-60 overflow-auto border border-gray-200"
          >
            <ul className="py-1">
              {suggestions.map((suggestion) => (
                <li 
                  key={suggestion.place_id}
                  className="px-4 py-2 hover:bg-green-50 cursor-pointer flex items-start border-b border-gray-100 last:border-b-0"
                  onClick={() => handleSelectPlace(suggestion.place_id, suggestion.description)}
                >
                  <span className="text-sm text-gray-800">{suggestion.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Comienza a escribir para ver sugerencias o selecciona directamente en el mapa
      </p>
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
    console.log('ConstructionSiteForm mounted, checking Google Maps availability');
    
    // Force window resize events to help render the map
    const triggerResize = () => window.dispatchEvent(new Event('resize'));
    
    // Trigger resizes at different intervals
    const timeouts = [
      setTimeout(triggerResize, 300),
      setTimeout(triggerResize, 600),
      setTimeout(triggerResize, 1000),
      setTimeout(() => {
        triggerResize();
        console.log('Final resize event triggered');
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
  const handleLocationSelect = (lat: number, lng: number) => {
    setSiteData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng
    }));
  };

  // Handler para el componente de búsqueda
  const handleSearchBoxSelect = (lat: number, lng: number, address?: string) => {
    // Actualizar las coordenadas
    handleLocationSelect(lat, lng);
    
    // Si tenemos una dirección formateada, actualizar el campo de ubicación si está vacío
    if (address && !siteData.location.trim()) {
      setSiteData(prev => ({
        ...prev,
        location: address
      }));
    }
  };

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
      
      if (createError) throw createError;
      if (!createdSite) throw new Error('No se recibieron datos de la obra creada');
      
      toast.success('Obra creada exitosamente');
      onSiteCreated(createdSite.id, siteData.name);
    } catch (err: any) {
      console.error('Error creating construction site:', err);
      setError(err.message || 'Error al crear la obra');
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
            
            {/* Componente de búsqueda de ubicaciones */}
            <LocationSearchBox onSelectLocation={handleSearchBoxSelect} />

            <div className="h-[350px] rounded-md overflow-hidden border border-gray-300 shadow-sm">
              {isMounted ? (
                <GoogleMapWrapper>
                  <GoogleMapSelector 
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