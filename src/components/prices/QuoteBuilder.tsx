/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { clientService } from '@/lib/supabase/clients';
import { recipeService } from '@/lib/supabase/recipes';
import { priceService } from '@/lib/supabase/prices';
import { calculateBasePrice } from '@/lib/utils/priceCalculator';
import { createQuote, QuotesService } from '@/services/quotes';
import { supabase } from '@/lib/supabase';
import ConstructionSiteSelect from '@/components/ui/ConstructionSiteSelect';
import * as Select from '@radix-ui/react-select';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Disclosure } from '@headlessui/react';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Popover from '@radix-ui/react-popover';
import { CalendarIcon } from 'lucide-react';
import 'react-day-picker/dist/style.css';
import { useDebouncedCallback } from 'use-debounce';
import ClientCreationForm from '@/components/clients/ClientCreationForm';
import ConstructionSiteForm from '@/components/clients/ConstructionSiteForm';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface Client {
  id: string;
  business_name: string;
  client_code: string;
}

interface Recipe {
  id: string;
  recipe_code: string;
  strength_fc: number;
  placement_type: string;
  slump: number;
  max_aggregate_size: number;
  recipe_type?: string;
  age_days?: number;
}

interface RecipeVersion {
  id: string;
  version_number: number;
  is_current: boolean;
  materials: { 
    material_type: string; 
    quantity: number; 
    unit: string; 
  }[];
  recipe_id?: string;
  strength_fc?: number;
  placement_type?: string;
}

interface QuoteProduct {
  recipe: Recipe;
  basePrice: number;
  volume: number;
  profitMargin: number;
  finalPrice: number;
  // Pump service is now handled at the quote level, not per product
}

// Define a storage key
const DRAFT_QUOTE_STORAGE_KEY = 'draftQuoteData';

// Interface for the data to be stored
interface DraftQuoteData {
  selectedClient: string;
  quoteProducts: QuoteProduct[];
  selectedSite: string;
  constructionSite: string;
  location: string;
  validityDate: string;
  selectedDate?: string; // Store ISO string
  includePumpService: boolean;
  pumpServicePrice: number;
  includesVAT: boolean;
}

export default function QuoteBuilder() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [quoteProducts, setQuoteProducts] = useState<QuoteProduct[]>([]);
  const [clientHistory, setClientHistory] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [constructionSite, setConstructionSite] = useState('');
  const [location, setLocation] = useState('');
  const [validityDate, setValidityDate] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedStrengths, setExpandedStrengths] = useState<number[]>([]);
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);
  const [includePumpService, setIncludePumpService] = useState<boolean>(false);
  const [pumpServicePrice, setPumpServicePrice] = useState<number>(0);
  const [includesVAT, setIncludesVAT] = useState<boolean>(false);
  const [recipeSearch, setRecipeSearch] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  
  // New state variables for client and site creation
  const [showCreateClientDialog, setShowCreateClientDialog] = useState(false);
  const [showCreateSiteDialog, setShowCreateSiteDialog] = useState(false);
  const [clientSites, setClientSites] = useState<any[]>([]);
  const [enableMapForSite, setEnableMapForSite] = useState(false);
  const [siteCoordinates, setSiteCoordinates] = useState<{lat: number | null, lng: number | null}>({
    lat: null,
    lng: null
  });

  // Load initial data - clients and recipes
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        const [clientsData, recipesResponse] = await Promise.all([
          clientService.getAllClients(),
          recipeService.getRecipes()
        ]);
        
        setClients(clientsData);
        
        const recipesData = recipesResponse.data || [];
        setRecipes(recipesData.map(r => ({
          id: r.id,
          recipe_code: r.recipe_code,
          strength_fc: r.strength_fc,
          placement_type: r.placement_type,
          slump: r.slump,
          max_aggregate_size: r.max_aggregate_size,
          recipe_type: r.recipe_type || 'N/A',
          age_days: r.age_days
        })));
      } catch (error) {
        console.error('Error loading initial data:', error);
        alert('Error loading initial data. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();

    // Debug Google Maps API Key
    console.log('Google Maps API Key set?', !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  }, []);

  // Load client history when client is selected
  useEffect(() => {
    const loadClientHistory = async () => {
      if (selectedClient) {
        try {
          setIsLoading(true);
          const history = await priceService.getClientQuoteHistory(selectedClient);
          setClientHistory(history);
        } catch (error) {
          console.error('Error loading client history:', error);
          alert('Error loading client history.');
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadClientHistory();
  }, [selectedClient]);

  // Load draft from sessionStorage on mount
  useEffect(() => {
    const savedDraft = sessionStorage.getItem(DRAFT_QUOTE_STORAGE_KEY);
    if (savedDraft) {
      try {
        const draftData: DraftQuoteData = JSON.parse(savedDraft);
        setSelectedClient(draftData.selectedClient || '');
        setQuoteProducts(draftData.quoteProducts || []);
        setSelectedSite(draftData.selectedSite || '');
        setConstructionSite(draftData.constructionSite || '');
        setLocation(draftData.location || '');
        setValidityDate(draftData.validityDate || '');
        setSelectedDate(draftData.selectedDate ? new Date(draftData.selectedDate) : undefined);
        setIncludePumpService(draftData.includePumpService || false);
        setPumpServicePrice(draftData.pumpServicePrice || 0);
        setIncludesVAT(draftData.includesVAT || false);
        console.log('Draft quote loaded from sessionStorage.');
      } catch (error) {
        console.error('Error parsing draft quote from sessionStorage:', error);
        sessionStorage.removeItem(DRAFT_QUOTE_STORAGE_KEY); // Clear corrupted data
      }
    }
  }, []);

  // Debounced save draft to sessionStorage
  const debouncedSaveDraft = useDebouncedCallback(() => {
    const draftData: DraftQuoteData = {
      selectedClient,
      quoteProducts,
      selectedSite,
      constructionSite,
      location,
      validityDate,
      selectedDate: selectedDate?.toISOString(), // Store as ISO string
      includePumpService,
      pumpServicePrice,
      includesVAT,
    };
    sessionStorage.setItem(DRAFT_QUOTE_STORAGE_KEY, JSON.stringify(draftData));
    console.log('Draft quote saved to sessionStorage.');
  }, 500);

  // Trigger save draft on state change
  useEffect(() => {
    // Don't save immediately on mount if loading from storage
    // Only save after initial load and subsequent user interactions
    const timeoutId = setTimeout(() => {
      // Check if component is still mounted and data is not default empty state
      // Avoid saving empty state right after clearing or initial load
      if (selectedClient || quoteProducts.length > 0 || constructionSite || location || validityDate || includePumpService || includesVAT) {
         debouncedSaveDraft();
      }
    }, 100); // Small delay to prevent saving initial empty state right after loading

    return () => clearTimeout(timeoutId); // Cleanup timeout

  }, [
    selectedClient, 
    quoteProducts, 
    selectedSite, 
    constructionSite, 
    location, 
    validityDate, 
    selectedDate, 
    includePumpService, 
    pumpServicePrice, 
    includesVAT,
    debouncedSaveDraft // Include debounced function in dependency array
  ]);

  // Toggle function for expansion
  const toggleStrength = (strength: number) => {
    setExpandedStrengths(prev => 
      prev.includes(strength)
        ? prev.filter(s => s !== strength)
        : [...prev, strength]
    );
  };

  const toggleType = (type: string) => {
    setExpandedTypes(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const addProductToQuote = async (recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) {
      console.error('Recipe not found');
      return;
    }

    try {
      // Check if product already exists in quote
      const existingProduct = quoteProducts.find(p => p.recipe.id === recipeId);
      if (existingProduct) {
        alert('This product is already in the quote');
        return;
      }

      // Get recipe details for price calculation
      const { data: recipeDetails } = await recipeService.getRecipeById(recipeId);
      const materials = recipeDetails?.recipe_versions[0]?.materials || [];

      const basePrice = await calculateBasePrice(recipeId, materials);
      const newProduct: QuoteProduct = {
        recipe,
        basePrice,
        volume: 1,
        profitMargin: 0.04, // Minimum 4% margin
        finalPrice: Math.ceil((basePrice * 1.04) / 5) * 5 // Round to nearest 5
        // Pump service is now handled at the quote level, not per product
      };

      setQuoteProducts([...quoteProducts, newProduct]);
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Could not add product. Please verify recipe data.');
    }
  };

  const updateProductDetails = (index: number, updates: Partial<QuoteProduct>) => {
    const updatedProducts = [...quoteProducts];
    const currentProduct = updatedProducts[index];
    
    // Merge updates
    const newProduct = { ...currentProduct, ...updates };
    
    // If base price or profit margin is updated, recalculate final price
    if ('basePrice' in updates || 'profitMargin' in updates) {
      const basePrice = updates.basePrice ?? currentProduct.basePrice;
      const profitMargin = updates.profitMargin ?? currentProduct.profitMargin;
      
      // Calculate final price: round up to nearest 5 after applying profit margin
      const finalPrice = Math.ceil((basePrice * (1 + profitMargin)) / 5) * 5;
      
      newProduct.finalPrice = finalPrice;
    }
    
    updatedProducts[index] = newProduct;
    setQuoteProducts(updatedProducts);
  };

  const removeProductFromQuote = (index: number) => {
    setQuoteProducts(quoteProducts.filter((_, i) => i !== index));
  };

  const validateQuote = () => {
    if (!selectedClient) {
      alert('Por favor, seleccione un cliente');
      return false;
    }

    if (quoteProducts.length === 0) {
      alert('Por favor, agregue al menos un producto a la cotización');
      return false;
    }

    if (!constructionSite) {
      alert('Por favor, ingrese el sitio de construcción');
      return false;
    }

    if (!location) {
      alert('Por favor, ingrese la ubicación');
      return false;
    }

    if (!validityDate) {
      alert('Por favor, seleccione la fecha de validez');
      return false;
    }

    if (includePumpService && (!pumpServicePrice || pumpServicePrice <= 0)) {
      alert('Por favor, ingrese un precio válido para el servicio de bombeo');
      return false;
    }

    return true;
  };

  const saveQuote = async () => {
    if (!validateQuote()) return;

    try {
      setIsLoading(true);
      
      // Generate quote number (simple implementation, you might want a more robust method)
      const currentYear = new Date().getFullYear();
      const quoteNumberPrefix = `COT-${currentYear}`;

      // Create quote
      const quoteData = {
        client_id: selectedClient,
        construction_site: constructionSite,
        location: location,
        validity_date: validityDate,
        status: 'DRAFT',
        quote_number: `${quoteNumberPrefix}-${Math.floor(Math.random() * 9000) + 1000}`, // Generate 4-digit random number
        details: [] // Adding empty details array to match CreateQuoteData interface
      };

      const createdQuote = await createQuote(quoteData);

      // Preparar detalles de la cotización de forma más eficiente, sin múltiples llamadas anidadas a la API
      // Mapear todos los productos a detalles para una sola operación de inserción
      const quoteDetailsData = quoteProducts.map(product => {
        // Calcular precio final y monto total una sola vez
        const finalPrice = Math.ceil((product.basePrice * (1 + product.profitMargin)) / 5) * 5;
        const totalAmount = finalPrice * product.volume;

        return {
          quote_id: createdQuote.id,
          recipe_id: product.recipe.id,
          volume: product.volume,
          base_price: product.basePrice,
          profit_margin: product.profitMargin * 100, // Convertir a porcentaje para almacenamiento
          final_price: finalPrice,
          total_amount: totalAmount,
          pump_service: includePumpService,
          pump_price: includePumpService ? pumpServicePrice : null,
          includes_vat: includesVAT
        };
      });

      // Insertar todos los detalles en una sola operación para mayor eficiencia
      const { data: insertedDetails, error: detailsError } = await supabase
        .from('quote_details')
        .insert(quoteDetailsData);

      if (detailsError) {
        console.error('Error inserting quote details:', detailsError);
        throw new Error(`Error al guardar detalles de cotización: ${detailsError.message}`);
      }

      // Mostrar mensaje de éxito
      alert(`Cotización ${createdQuote.quote_number} guardada exitosamente`);
      
      // Limpiar formulario
      setSelectedClient('');
      setQuoteProducts([]);
      setConstructionSite('');
      setLocation('');
      setValidityDate('');
      setClientHistory([]);
      setIncludePumpService(false);
      setPumpServicePrice(0);
      setIncludesVAT(false);

      // Clear draft from sessionStorage after successful save
      sessionStorage.removeItem(DRAFT_QUOTE_STORAGE_KEY);
      console.log('Draft quote cleared from sessionStorage after saving.');

      return createdQuote;
    } catch (error) {
      console.error('Error al guardar la cotización:', error);
      alert('Error al guardar la cotización: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Add a filtered recipes function
  const filteredRecipes = recipes.filter(recipe => {
    if (!recipeSearch.trim()) return true;
    
    const searchLower = recipeSearch.toLowerCase();
    return (
      recipe.recipe_code.toLowerCase().includes(searchLower) ||
      recipe.strength_fc.toString().includes(searchLower) ||
      (recipe.age_days?.toString() || '').includes(searchLower) ||
      recipe.placement_type.toLowerCase().includes(searchLower) ||
      recipe.max_aggregate_size.toString().includes(searchLower) ||
      recipe.slump.toString().includes(searchLower)
    );
  });

  // Update the grouping logic to use filtered recipes
  const groupedRecipes = filteredRecipes.reduce((acc, recipe) => {
    const type = recipe.recipe_type || 'N/A';
    const strength = recipe.strength_fc;
    const slump = recipe.slump;
    
    if (!acc[type]) acc[type] = {};
    if (!acc[type][strength]) acc[type][strength] = {};
    if (!acc[type][strength][slump]) acc[type][strength][slump] = [];
    
    acc[type][strength][slump].push(recipe);
    return acc;
  }, {} as Record<string, Record<number, Record<number, Recipe[]>>>);

  // Filtered clients function
  const filteredClients = clients.filter(client => {
    if (!clientSearch.trim()) return true;
    
    const searchLower = clientSearch.toLowerCase();
    return (
      client.business_name.toLowerCase().includes(searchLower) ||
      client.client_code.toLowerCase().includes(searchLower)
    );
  });

  // Update validityDate when date is selected
  useEffect(() => {
    if (selectedDate) {
      setValidityDate(format(selectedDate, 'yyyy-MM-dd'));
    }
  }, [selectedDate]);

  // Clear draft function
  const clearDraft = () => {
    setSelectedClient('');
    setQuoteProducts([]);
    setConstructionSite('');
    setLocation('');
    setValidityDate('');
    setSelectedDate(undefined);
    setClientHistory([]);
    setIncludePumpService(false);
    setPumpServicePrice(0);
    setIncludesVAT(false);
    setSelectedSite(''); // Also reset selected site ID
    sessionStorage.removeItem(DRAFT_QUOTE_STORAGE_KEY);
    alert('Borrador de cotización limpiado.');
    console.log('Draft quote cleared from state and sessionStorage.');
  };

  // Load client sites when a client is selected
  useEffect(() => {
    const loadClientSites = async () => {
      if (selectedClient) {
        try {
          const sites = await clientService.getClientSites(selectedClient);
          setClientSites(sites);
        } catch (error) {
          console.error('Error loading client sites:', error);
        }
      } else {
        setClientSites([]);
      }
    };

    loadClientSites();
  }, [selectedClient]);

  // Handle new client creation
  const handleClientCreated = (clientId: string, clientName: string) => {
    // Add the new client to the list
    setClients(prev => [
      ...prev,
      { id: clientId, business_name: clientName, client_code: '' } as Client
    ]);
    
    // Select the newly created client
    setSelectedClient(clientId);
    
    // Close the dialog
    setShowCreateClientDialog(false);
  };

  // Handle new site creation
  const handleSiteCreated = (siteId: string, siteName: string) => {
    // Add the new site to the list
    setClientSites(prev => [
      ...prev,
      { id: siteId, name: siteName, latitude: siteCoordinates.lat, longitude: siteCoordinates.lng }
    ]);
    
    // Select the newly created site
    setSelectedSite(siteId);
    setConstructionSite(siteName);
    
    // Close the dialog
    setShowCreateSiteDialog(false);
    
    // Debug log
    console.log('Site created with coordinates:', siteCoordinates);
  };

  // Handle map coordinates selection
  const handleMapCoordinatesSelected = (lat: number, lng: number) => {
    setSiteCoordinates({ lat, lng });
    console.log('Map coordinates selected:', { lat, lng });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 @container">
      {/* Left Panel: Product Catalog */}
      <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Catálogo de Productos</h2>
          <div className="relative">
            <input
              type="text"
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              placeholder="Buscar recetas por código, resistencia, edad..."
              className="w-full p-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm"
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
            {recipeSearch && (
              <button
                onClick={() => setRecipeSearch('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-6 @container">
          <div className="h-full overflow-y-auto pr-2 pb-2" style={{ maxHeight: 'calc(70vh - 110px)' }}>
            {Object.keys(groupedRecipes).length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {recipeSearch ? (
                  <div>
                    <p className="mb-2">No se encontraron recetas con "{recipeSearch}"</p>
                    <button 
                      onClick={() => setRecipeSearch('')}
                      className="text-blue-500 hover:underline"
                    >
                      Limpiar búsqueda
                    </button>
                  </div>
                ) : (
                  <p>No hay recetas disponibles</p>
                )}
              </div>
            ) : (
              Object.entries(groupedRecipes)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([type, strengthGroups]) => {
                  const isTypeExpanded = expandedTypes.includes(type);
                  const typeName = type === 'FC' ? "Concreto Convencional F'c" : 
                                type === 'MR' ? 'Concreto Módulo de Ruptura Mr' : type;
                  
                  return (
                    <div key={type} className="border rounded-lg overflow-hidden mb-4 shadow-sm">
                      <button
                        onClick={() => toggleType(type)}
                        className="w-full p-4 bg-gray-50 hover:bg-gray-100 flex justify-between items-center transition-colors"
                        aria-expanded={isTypeExpanded}
                      >
                        <h3 className="text-lg font-semibold text-gray-800">{typeName}</h3>
                        <svg
                          className={`w-5 h-5 transform transition-transform text-gray-500 ${
                            isTypeExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      
                      {isTypeExpanded && (
                        <div className="p-4 space-y-6 animate-in fade-in slide-in-from-top-5 duration-300">
                          {Object.entries(strengthGroups)
                            .sort(([a], [b]) => Number(b) - Number(a))
                            .map(([strengthStr, slumpGroups]) => {
                              const strength = Number(strengthStr);
                              const isStrengthExpanded = expandedStrengths.includes(strength);
                              
                              // Use different label based on recipe type
                              const strengthLabel = type === 'MR' ? 'MR' : 'f\'c';
                              
                              return (
                                <div key={strength} className="border rounded-lg overflow-hidden shadow-sm">
                                  <button
                                    onClick={() => toggleStrength(strength)}
                                    className="w-full p-3 bg-gray-100 hover:bg-gray-200 flex justify-between items-center transition-colors"
                                    aria-expanded={isStrengthExpanded}
                                  >
                                    <h4 className="font-medium text-gray-700">{strengthLabel}: {strength} kg/cm²</h4>
                                    <svg
                                      className={`w-4 h-4 transform transition-transform text-gray-500 ${
                                        isStrengthExpanded ? 'rotate-180' : ''
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </button>
                                  
                                  {isStrengthExpanded && (
                                    <div className="p-3 space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
                                      {Object.entries(slumpGroups)
                                        .sort(([a], [b]) => Number(b) - Number(a))
                                        .map(([slumpStr, slumpRecipes]) => (
                                          <div key={slumpStr} className="space-y-3">
                                            <h5 className="font-medium text-gray-600">
                                              Revenimiento: {slumpStr} cm
                                            </h5>
                                            <div className="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3 gap-4">
                                              {slumpRecipes.map(recipe => (
                                                <div key={recipe.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                                                  <h3 className="font-semibold text-gray-800">{recipe.recipe_code}</h3>
                                                  <div className="text-sm space-y-2 mt-2 text-gray-600">
                                                    <p className="flex items-center gap-1">
                                                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714a2.25 2.25 0 0 0 .659 1.591L19.5 14.5" />
                                                      </svg>
                                                      <span>Tamaño máx.: {recipe.max_aggregate_size} mm</span>
                                                    </p>
                                                    <p className="flex items-center gap-1">
                                                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12v-8.25M12 12.75h.008v.008H12v-.008Z" />
                                                      </svg>
                                                      <span>Revenimiento: {recipe.slump} cm</span>
                                                    </p>
                                                    {recipe.age_days && (
                                                      <p className="flex items-center gap-1">
                                                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                                        </svg>
                                                        <span>Edad: {recipe.age_days} días</span>
                                                      </p>
                                                    )}
                                                    <p className="flex items-center gap-1">
                                                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                                                      </svg>
                                                      <span>Colocación: {recipe.placement_type === 'D' ? 'Directa' : 'Bombeado'}</span>
                                                    </p>
                                                  </div>
                                                  <button 
                                                    onClick={() => addProductToQuote(recipe.id)}
                                                    className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center justify-center gap-1"
                                                    disabled={isLoading}
                                                  >
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                                    </svg>
                                                    Agregar a Cotización
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* Right Panel: Client Selection and History */}
      <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col border border-gray-100 @container h-min">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Seleccionar Cliente</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="client-search" className="block text-sm font-medium text-gray-700 mb-1">Buscar Cliente</label>
            <div className="relative mb-3">
              <input
                type="text"
                id="client-search"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Nombre o código del cliente..."
                className="w-full p-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm"
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
              {clientSearch && (
                <button
                  onClick={() => setClientSearch('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="client-select" className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <div className="flex space-x-2 items-center">
              <Select.Root
                value={selectedClient}
                onValueChange={setSelectedClient}
                disabled={isLoading}
              >
                <Select.Trigger
                  id="client-select"
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-lg flex items-center justify-between text-sm shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 data-[placeholder]:text-gray-500"
                  aria-label="Cliente"
                >
                  <Select.Value placeholder="Seleccionar Cliente" />
                  <Select.Icon>
                    <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="overflow-hidden bg-white rounded-md shadow-lg border">
                    <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-white text-gray-700 cursor-default">
                      <ChevronUpIcon />
                    </Select.ScrollUpButton>
                    <Select.Viewport className="p-1">
                      {filteredClients.map((client) => (
                        <Select.Item
                          key={client.id}
                          value={client.id}
                          className="relative flex items-center h-8 py-2 pl-7 pr-2 text-sm rounded select-none hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                        >
                          <Select.ItemText>{client.business_name} ({client.client_code})</Select.ItemText>
                          <Select.ItemIndicator className="absolute left-1 inline-flex items-center justify-center">
                            <CheckIcon className="h-4 w-4" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-white text-gray-700 cursor-default">
                      <ChevronDownIcon />
                    </Select.ScrollDownButton>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
              
              <button
                type="button"
                onClick={() => setShowCreateClientDialog(true)}
                className="px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-xs flex items-center justify-center"
                aria-label="Crear nuevo cliente"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            </div>
          </div>

          {selectedClient && (
            <div>
              <label htmlFor="construction-site" className="block text-sm font-medium text-gray-700 mb-1">Obra</label>
              <div className="flex space-x-2 items-center">
                {clientSites.length > 0 ? (
                  <Select.Root
                    value={selectedSite}
                    onValueChange={(value) => {
                      setSelectedSite(value);
                      const site = clientSites.find(s => s.id === value);
                      if (site) {
                        setConstructionSite(site.name);
                        if (site.latitude && site.longitude) {
                          setSiteCoordinates({
                            lat: site.latitude,
                            lng: site.longitude
                          });
                        }
                      }
                    }}
                  >
                    <Select.Trigger
                      id="construction-site"
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-lg flex items-center justify-between text-sm shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 data-[placeholder]:text-gray-500"
                      aria-label="Obra"
                    >
                      <Select.Value placeholder="Seleccionar Obra" />
                      <Select.Icon>
                        <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="overflow-hidden bg-white rounded-md shadow-lg border">
                        <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-white text-gray-700 cursor-default">
                          <ChevronUpIcon />
                        </Select.ScrollUpButton>
                        <Select.Viewport className="p-1">
                          {clientSites.map((site) => (
                            <Select.Item
                              key={site.id}
                              value={site.id}
                              className="relative flex items-center h-8 py-2 pl-7 pr-2 text-sm rounded select-none hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                            >
                              <Select.ItemText>{site.name}</Select.ItemText>
                              <Select.ItemIndicator className="absolute left-1 inline-flex items-center justify-center">
                                <CheckIcon className="h-4 w-4" />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                        <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-white text-gray-700 cursor-default">
                          <ChevronDownIcon />
                        </Select.ScrollDownButton>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                ) : (
                  <input
                    type="text"
                    id="construction-site"
                    value={constructionSite}
                    onChange={(e) => setConstructionSite(e.target.value)}
                    placeholder="Nombre de la obra"
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                )}
                
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateSiteDialog(true);
                    setEnableMapForSite(true);
                  }}
                  className="px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-xs flex items-center justify-center"
                  aria-label="Crear nueva obra"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
            <input 
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm"
              placeholder="Dirección o coordenadas"
              disabled={isLoading}
            />
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center mb-4">
              <Checkbox.Root
                id="includePumpService"
                checked={includePumpService}
                onCheckedChange={(checked: boolean | 'indeterminate') => 
                  setIncludePumpService(checked === true)}
                disabled={isLoading}
                className="h-4 w-4 bg-white border border-gray-300 rounded flex items-center justify-center data-[state=checked]:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
              >
                <Checkbox.Indicator>
                  <CheckIcon className="h-3 w-3 text-white" />
                </Checkbox.Indicator>
              </Checkbox.Root>
              <label htmlFor="includePumpService" className="ms-2 text-sm font-medium text-gray-700">
                Incluir Servicio de Bombeo para toda la cotización
              </label>
            </div>
            
            {includePumpService && (
              <div className="mt-2">
                <label htmlFor="pumpPrice" className="block mb-1 text-sm font-medium text-gray-700">Precio del Servicio de Bombeo</label>
                <div className="flex items-center">
                  <span className="text-gray-500 pe-2">$</span>
                  <input
                    id="pumpPrice"
                    type="number"
                    value={pumpServicePrice}
                    onChange={(e) => setPumpServicePrice(Number(e.target.value))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm"
                    placeholder="Precio del servicio"
                    min="0"
                    disabled={isLoading}
                  />
                  <span className="text-gray-500 ps-2">MXN</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <Checkbox.Root
                id="includesVAT"
                checked={includesVAT}
                onCheckedChange={(checked: boolean | 'indeterminate') => 
                  setIncludesVAT(checked === true)}
                disabled={isLoading}
                className="h-4 w-4 bg-white border border-gray-300 rounded flex items-center justify-center data-[state=checked]:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
              >
                <Checkbox.Indicator>
                  <CheckIcon className="h-3 w-3 text-white" />
                </Checkbox.Indicator>
              </Checkbox.Root>
              <label htmlFor="includesVAT" className="ms-2 text-sm font-medium text-gray-700">
                Incluir IVA en la cotización
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="validityDate" className="block text-sm font-medium text-gray-700 mb-1">Fecha de Validez</label>
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  id="validityDate"
                  className={`w-full p-2.5 border text-left border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm flex justify-between items-center ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={isLoading}
                >
                  <span className={validityDate ? 'text-gray-900' : 'text-gray-500'}>
                    {validityDate ? format(new Date(validityDate), 'dd/MM/yyyy') : 'Seleccionar fecha'}
                  </span>
                  <CalendarIcon className="h-4 w-4 text-gray-500" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content 
                  className="bg-white p-2 rounded-lg shadow-lg border border-gray-200 z-50"
                  sideOffset={5}
                >
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={es}
                    className="p-2"
                    classNames={{
                      day_selected: 'bg-green-600 text-white',
                      day_today: 'bg-gray-100 font-bold',
                      button_reset: 'hidden'
                    }}
                    footer={
                      <div className="pt-2 text-center text-sm text-gray-500">
                        {selectedDate && (
                          <p>Has seleccionado {format(selectedDate, 'PPP', { locale: es })}</p>
                        )}
                      </div>
                    }
                  />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          <div className="mt-4">
            <h3 className="font-semibold mb-3 text-gray-800 flex items-center gap-1">
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Historial Reciente
            </h3>
            <div className="max-h-[250px] overflow-y-auto rounded-lg border border-gray-200">
              {clientHistory.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {clientHistory.slice(0, 10).map((item, index) => (
                    <div key={index} className="p-3 hover:bg-gray-50">
                      <p className="font-medium text-gray-800">
                        {item.quote_details[0]?.product?.recipe_code || 'Sin tipo'} - 
                        ${item.quote_details[0]?.final_price 
                          ? item.quote_details[0].final_price.toLocaleString('es-MX', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            }) 
                          : '0.00'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.delivery_date && new Date(item.delivery_date).toLocaleDateString()}
                      </p>
                      {item.delivery_site && (
                        <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                          <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                          </svg>
                          {item.delivery_site} ({item.location})
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center p-4">Sin historial de pedidos</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-6">
          <button
            onClick={clearDraft}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={isLoading}
          >
            <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            Limpiar Borrador
          </button>
          <button
            onClick={saveQuote}
            className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Guardando...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 14h6" />
                </svg>
                Guardar Cotización
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Bottom Panel: Quote Products */}
      {quoteProducts.length > 0 && (
        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            Productos de la Cotización
          </h2>
          <div className="divide-y divide-gray-200">
            {quoteProducts.map((product, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-4 py-5 @container">
                <div className="md:col-span-1">
                  <p className="font-semibold text-gray-800 mb-1">{product.recipe.recipe_code}</p>
                  <p className="text-xs text-gray-500">{product.recipe.placement_type === 'D' ? 'Colocación directa' : 'Bombeado'}</p>
                </div>
                <div className="@md:col-span-5 grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Volumen (m³)</label>
                    <input 
                      type="number" 
                      value={product.volume} 
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        updateProductDetails(index, { 
                          volume: isNaN(value) ? 1 : value 
                        });
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Precio Base (MXN)</label>
                    <input 
                      type="number" 
                      value={product.basePrice} 
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        updateProductDetails(index, { 
                          basePrice: isNaN(value) ? 0 : value 
                        });
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Margen (%)</label>
                    <input 
                      type="number"
                      step="0.1"
                      value={product.profitMargin * 100}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value)) {
                          updateProductDetails(index, { 
                            profitMargin: value / 100 
                          });
                        }
                      }}
                      onBlur={() => {
                        // Round to 1 decimal and ensure minimum 4%
                        const current = product.profitMargin * 100;
                        const rounded = Math.round(current * 10) / 10;
                        const clamped = Math.max(4, rounded);
                        updateProductDetails(index, { 
                          profitMargin: clamped / 100 
                        });
                      }}
                      placeholder="4.0"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Precio Final</label>
                    <p className="font-semibold text-lg text-gray-800">
                      $ {product.finalPrice.toLocaleString('es-MX', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                    </p>
                  </div>
                  <div className="flex items-end">
                    <button 
                      onClick={() => removeProductFromQuote(index)}
                      className="inline-flex items-center gap-1 justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 w-full"
                      disabled={isLoading}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-center font-medium text-gray-700">Procesando...</p>
          </div>
        </div>
      )}

      {/* Client Creation Dialog */}
      <Dialog open={showCreateClientDialog} onOpenChange={setShowCreateClientDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogTitle>Crear Nuevo Cliente</DialogTitle>
          <ClientCreationForm
            onClientCreated={handleClientCreated}
            onCancel={() => setShowCreateClientDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Construction Site Creation Dialog */}
      <Dialog 
        open={showCreateSiteDialog} 
        onOpenChange={(open) => {
          setShowCreateSiteDialog(open);
          // If opening the dialog, trigger a resize event after a small delay
          // to ensure Google Maps renders correctly
          if (open) {
            // Trigger multiple resize events to ensure the map renders
            setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
            setTimeout(() => window.dispatchEvent(new Event('resize')), 500);
            setTimeout(() => window.dispatchEvent(new Event('resize')), 1000);
            // Log the state
            console.log('Opening site creation dialog with Google Maps');
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px] w-[90vw] max-h-[90vh] overflow-y-auto p-4">
          <DialogTitle>Crear Nueva Obra</DialogTitle>
          {selectedClient ? (
            <>
              {/* Show debug info */}
              {process.env.NODE_ENV === 'development' && (
                <div className="bg-blue-50 p-2 mb-4 text-sm">
                  <p>Google Maps API cargada: {typeof google !== 'undefined' && google.maps ? 'Sí' : 'No'}</p>
                  <p>API Key presente: {!!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? 'Sí' : 'No'}</p>
                </div>
              )}
              <ConstructionSiteForm
                clientId={selectedClient}
                onSiteCreated={handleSiteCreated}
                onCancel={() => setShowCreateSiteDialog(false)}
              />
            </>
          ) : (
            <div className="p-4 text-center">
              <p>Por favor, selecciona un cliente primero.</p>
              <button
                onClick={() => setShowCreateSiteDialog(false)}
                className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md"
              >
                Cerrar
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}