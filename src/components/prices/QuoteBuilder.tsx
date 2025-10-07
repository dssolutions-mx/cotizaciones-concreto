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
import { CalendarIcon, AlertCircle } from 'lucide-react';
import 'react-day-picker/dist/style.css';
import { useDebouncedCallback } from 'use-debounce';
import { usePlantAwareRecipes } from '@/hooks/usePlantAwareRecipes';
import { usePlantContext } from '@/contexts/PlantContext';
import ClientCreationForm from '@/components/clients/ClientCreationForm';
import ConstructionSiteForm from '@/components/clients/ConstructionSiteForm';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Client {
  id: string;
  business_name: string;
  client_code: string;
}

interface Recipe {
  id?: string;
  recipe_code: string;
  strength_fc: number;
  placement_type: string;
  slump: number;
  max_aggregate_size: number;
  recipe_type?: string;
  age_days?: number;
  has_waterproofing?: boolean;
  plant_id?: string;
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

interface PumpServiceProduct {
  product_type: 'SERVICIO_DE_BOMBEO';
  volume: number;
  price: number;
  description: string;
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
  includesVAT: boolean;
  pumpServiceProduct?: PumpServiceProduct;
}

export default function QuoteBuilder() {
  const { userAccess, isGlobalAdmin, currentPlant } = usePlantContext();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  
  // Use plant-aware recipes hook
  const { recipes: allRecipes, isLoading: recipesLoading, error: recipesError } = usePlantAwareRecipes({
    autoRefresh: true
  });
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [quoteProducts, setQuoteProducts] = useState<QuoteProduct[]>([]);
  const [plantValidationError, setPlantValidationError] = useState<string | null>(null);
  const [clientHistory, setClientHistory] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [constructionSite, setConstructionSite] = useState('');
  const [location, setLocation] = useState('');
  const [validityDate, setValidityDate] = useState(format(new Date(2025, 7, 31), 'yyyy-MM-dd')); // Default date
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(2025, 7, 31)); // Default date
  const [isLoading, setIsLoading] = useState(false);
  const [expandedStrengths, setExpandedStrengths] = useState<number[]>([]);
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);
  const [includePumpService, setIncludePumpService] = useState<boolean>(false);
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

  // State for pumping service configuration
  const [pumpServiceProduct, setPumpServiceProduct] = useState<PumpServiceProduct>({
    product_type: 'SERVICIO_DE_BOMBEO',
    volume: 1,
    price: 0,
    description: 'Servicio de Bombeo'
  });

  // Load initial data - clients
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        const clientsData = await clientService.getAllClients();
        setClients(clientsData);
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
    // Default date is now set in useState initialization
  }, []);

  // Update recipes when plant-aware recipes change
  useEffect(() => {
    if (allRecipes) {
      setRecipes(allRecipes.map(r => ({
        id: r.id,
        recipe_code: r.recipe_code,
        strength_fc: r.strength_fc,
        placement_type: r.placement_type,
        slump: r.slump,
        max_aggregate_size: r.max_aggregate_size,
        recipe_type: (r as any).recipe_type || 'N/A',
        age_days: r.age_days,
        has_waterproofing: (r as any).has_waterproofing,
        plant_id: (r as any).plant_id // Include plant_id for validation
      }) as Recipe));
    }
  }, [allRecipes]);

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
        setValidityDate(draftData.validityDate || format(new Date(2025, 7, 31), 'yyyy-MM-dd'));
        setSelectedDate(draftData.selectedDate ? new Date(draftData.selectedDate) : new Date(2025, 7, 31));
        setIncludePumpService(draftData.includePumpService || false);
        setIncludesVAT(draftData.includesVAT || false);
        setPumpServiceProduct({
          product_type: 'SERVICIO_DE_BOMBEO',
          volume: draftData.pumpServiceProduct?.volume || 1,
          price: draftData.pumpServiceProduct?.price || 0,
          description: draftData.pumpServiceProduct?.description || 'Servicio de Bombeo'
        });
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
      includesVAT,
      pumpServiceProduct,
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
    includesVAT,
    pumpServiceProduct,
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
      // Validate plant compatibility if there are already products in the quote
      if (quoteProducts.length > 0 && recipe.plant_id) {
        const existingPlantId = quoteProducts[0].recipe.plant_id;
        if (existingPlantId && existingPlantId !== recipe.plant_id) {
          setPlantValidationError('Todas las recetas en una cotización deben pertenecer a la misma planta');
          return;
        }
      }
      
      // Clear any previous plant validation errors
      setPlantValidationError(null);

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
        finalPrice: Math.ceil((basePrice * 1.04) / 5) * 5 // Initial calculation: round to nearest 5
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
    
    // Handle different update scenarios
    if ('basePrice' in updates) {
      // If base price is updated, recalculate final price based on current margin
      const basePrice = updates.basePrice ?? currentProduct.basePrice;
      const profitMargin = currentProduct.profitMargin;
      
      // Calculate final price: round up to nearest 5 after applying profit margin
      const finalPrice = Math.ceil((basePrice * (1 + profitMargin)) / 5) * 5;
      
      newProduct.finalPrice = finalPrice;
    } else if ('profitMargin' in updates) {
      // If margin is updated, recalculate final price
      const basePrice = currentProduct.basePrice;
      const profitMargin = updates.profitMargin ?? currentProduct.profitMargin;
      
      // Calculate final price: round up to nearest 5 after applying profit margin
      const finalPrice = Math.ceil((basePrice * (1 + profitMargin)) / 5) * 5;
      
      newProduct.finalPrice = finalPrice;
    } else if ('finalPrice' in updates) {
      // If final price is updated, recalculate margin
      const basePrice = currentProduct.basePrice;
      const finalPrice = updates.finalPrice ?? currentProduct.finalPrice;
      
      // Calculate new margin based on final price (no rounding - use exact price)
      const newMargin = (finalPrice / basePrice) - 1;
      
      newProduct.profitMargin = newMargin;
      newProduct.finalPrice = finalPrice; // Keep the exact price user entered
    }
    
    updatedProducts[index] = newProduct;
    setQuoteProducts(updatedProducts);
  };

  const removeProductFromQuote = (index: number) => {
    setQuoteProducts(quoteProducts.filter((_, i) => i !== index));
  };

  // Simple function to update pumping service details
  const updatePumpServiceDetails = (updates: Partial<PumpServiceProduct>) => {
    setPumpServiceProduct(prev => ({ ...prev, ...updates }));
  };

  const validateQuote = () => {
    if (!selectedClient) {
      alert('Por favor, seleccione un cliente');
      return false;
    }

    // Allow quotes with either concrete products or pumping service
    const hasConcreteProducts = quoteProducts.length > 0;
    const hasPumpingService = includePumpService && pumpServiceProduct.price > 0;

    if (!hasConcreteProducts && !hasPumpingService) {
      alert('Por favor, agregue al menos un producto de concreto o configure un servicio de bombeo');
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



    // Validate pumping service when included
    if (includePumpService) {
      if (pumpServiceProduct.price <= 0) {
        alert('Por favor, ingrese un precio válido para el servicio de bombeo');
        return false;
      }
      if (pumpServiceProduct.volume <= 0) {
        alert('Por favor, ingrese un volumen válido para el servicio de bombeo');
        return false;
      }
    }

    return true;
  };

  const saveQuote = async () => {
    if (!validateQuote()) return;

    try {
      setIsLoading(true);
      
      // Determine plant_id from the first recipe in the quote, or from current plant context for pumping-only quotes
      let quotePlantId: string | undefined;
      if (quoteProducts.length > 0) {
        quotePlantId = quoteProducts[0].recipe.plant_id;
        
        // Validate all recipes belong to the same plant
        const differentPlant = quoteProducts.find(p => p.recipe.plant_id !== quotePlantId);
        if (differentPlant) {
          setPlantValidationError('Todas las recetas en una cotización deben pertenecer a la misma planta');
          return;
        }
      } else if (includePumpService && pumpServiceProduct.price > 0) {
        // For pumping-only quotes, use current plant context
        quotePlantId = currentPlant?.id;
        if (!quotePlantId) {
          setPlantValidationError('No se pudo determinar la planta para la cotización de bombeo');
          return;
        }
      }
      
      // Ensure we have a plant_id
      if (!quotePlantId) {
        setPlantValidationError('No se pudo determinar la planta para la cotización');
        return;
      }
      
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
        plant_id: quotePlantId, // Include plant_id from recipes
        details: [] // Adding empty details array to match CreateQuoteData interface
      };

      const createdQuote = await createQuote(quoteData);

      // Preparar detalles de la cotización de forma más eficiente, sin múltiples llamadas anidadas a la API
      // Mapear todos los productos a detalles para una sola operación de inserción
      let quoteDetailsData: any[] = [];

      // Handle concrete products
      if (quoteProducts.length > 0) {
        quoteDetailsData = quoteProducts.map(product => {
          // Use the current final price from the product (which may have been manually edited)
          const finalPrice = product.finalPrice;
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
            pump_price: includePumpService ? pumpServiceProduct.price : null,
            includes_vat: includesVAT
          };
        });
      }

      // Handle standalone pumping service (when no concrete products but pumping service is included)
      if (quoteProducts.length === 0 && includePumpService && pumpServiceProduct.price > 0) {
        const pumpDetail = {
          quote_id: createdQuote.id,
          product_id: '6bd1949f-50c8-4505-a9aa-c113627bcb40', // Special pumping service product
          recipe_id: null, // No recipe needed
          volume: pumpServiceProduct.volume,
          base_price: pumpServiceProduct.price, // Use price as base_price
          profit_margin: 0, // No margin calculation needed
          final_price: pumpServiceProduct.price,
          total_amount: pumpServiceProduct.price * pumpServiceProduct.volume,
          pump_service: true, // This IS a pump service
          pump_price: pumpServiceProduct.price,
          includes_vat: includesVAT
        };
        quoteDetailsData.push(pumpDetail);
      }

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
      (recipe.recipe_code || '').toLowerCase().includes(searchLower) ||
      String(recipe.strength_fc ?? '').includes(searchLower) ||
      String(recipe.age_days ?? '').includes(searchLower) ||
      (recipe.placement_type || '').toLowerCase().includes(searchLower) ||
      String(recipe.max_aggregate_size ?? '').includes(searchLower) ||
      String(recipe.slump ?? '').includes(searchLower)
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
      (client.business_name || '').toLowerCase().includes(searchLower) ||
      (client.client_code || '').toLowerCase().includes(searchLower)
    );
  });

  // Update validityDate when date is selected
  useEffect(() => {
    if (selectedDate) {
      // Create a new date in local timezone at midnight to avoid timezone shifts
      const localDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setValidityDate(format(localDate, 'yyyy-MM-dd'));
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
    setIncludesVAT(false);
    setSelectedSite(''); // Also reset selected site ID
    setPumpServiceProduct({
      product_type: 'SERVICIO_DE_BOMBEO',
      volume: 1,
      price: 0,
      description: 'Servicio de Bombeo'
    });
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
  const handleSiteCreated = (siteId: string, siteName: string, siteLocation?: string, siteLat?: number, siteLng?: number) => {
    // Add the new site to the list with proper formatting
    setClientSites(prev => [
      ...prev,
      { 
        id: siteId, 
        name: siteName, 
        latitude: siteLat ?? null, 
        longitude: siteLng ?? null,
        is_active: true, // Ensure the site is marked as active
        location: siteLocation ?? '' // Populate location field, ensure it's a string
      }
    ]);
    
    // Select the newly created site
    setSelectedSite(siteId);
    setConstructionSite(siteName);
    if (siteLocation) {
      setLocation(siteLocation); // Auto-fill location
    }
    if (siteLat && siteLng) {
      setSiteCoordinates({ lat: siteLat, lng: siteLng });
    } else {
      setSiteCoordinates({ lat: null, lng: null}); // Clear if not provided
    }
    
    // Close the dialog
    setShowCreateSiteDialog(false);
    
    // Log successful creation
    console.log('Site created successfully with ID:', siteId, 'Name:', siteName, 'Location:', siteLocation, 'Coords:', { lat: siteLat, lng: siteLng });
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
          <div className="h-full overflow-y-auto pr-2 pb-2 max-h-[50vh] md:max-h-[calc(70vh-110px)]">
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
                                                    <div>
                                                      {recipe.has_waterproofing ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">Impermeabilizante</span>
                                                      ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">Sin impermeabilizante</span>
                                                      )}
                                                    </div>
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
                                                    onClick={() => recipe.id && addProductToQuote(recipe.id)}
                                                    className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center justify-center gap-1"
                                                    disabled={isLoading || !recipe.id}
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
              <label htmlFor="construction-site-display" className="block text-sm font-medium text-gray-700 mb-1">Obra</label>
              <div className="flex space-x-2 items-center">
                {clientSites.length > 0 ? (
                  <Select.Root
                    value={selectedSite}
                    onValueChange={(value) => {
                      setSelectedSite(value);
                      const site = clientSites.find(s => s.id === value);
                      if (site) {
                        setConstructionSite(site.name);
                        setLocation(site.location || ''); // Ensure location is set, fallback to empty string
                        if (site.latitude && site.longitude) {
                          setSiteCoordinates({
                            lat: site.latitude,
                            lng: site.longitude
                          });
                        } else {
                          setSiteCoordinates({ lat: null, lng: null });
                        }
                      }
                    }}
                  >
                    <Select.Trigger
                      id="construction-site-select" // Changed ID for clarity
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
                  <div id="construction-site-display" className="w-full p-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 shadow-sm min-h-[38px] flex items-center">
                    {constructionSite || <span className="text-gray-500">No hay obras, cree una nueva.</span>}
                  </div>
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
              disabled={isLoading || !!selectedSite} // Disable if a site is selected from dropdown or isLoading
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

          {/* Pumping Service Configuration */}
          {includePumpService && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold mb-4 text-gray-800 flex items-center gap-2">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Configuración del Servicio de Bombeo
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="pumpServiceDescription" className="block text-sm font-medium text-gray-700 mb-1">Descripción del Servicio</label>
                  <input
                    id="pumpServiceDescription"
                    type="text"
                    value={pumpServiceProduct.description || ''}
                    onChange={(e) => updatePumpServiceDetails({ description: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    placeholder="Ej: Servicio de Bombeo Estándar"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="pumpVolume" className="block text-sm font-medium text-gray-700 mb-1">Volumen (m³)</label>
                    <input
                      id="pumpVolume"
                      type="number"
                      value={pumpServiceProduct.volume || 1}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        updatePumpServiceDetails({
                          volume: isNaN(value) ? 1 : value
                        });
                      }}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label htmlFor="pumpPrice" className="block text-sm font-medium text-gray-700 mb-1">Precio por m³ (MXN)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">$</span>
                      <input
                        id="pumpPrice"
                        type="number"
                        value={pumpServiceProduct.price || 0}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          updatePumpServiceDetails({
                            price: isNaN(value) ? 0 : value
                          });
                        }}
                        className="w-full p-2.5 pl-8 pr-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-blue-100 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Total del Servicio:</span>
                    <span className="font-bold text-blue-600">
                      ${((pumpServiceProduct.price || 0) * (pumpServiceProduct.volume || 1)).toLocaleString('es-MX', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} MXN
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                    {validityDate ? format(new Date(validityDate + 'T00:00:00'), 'dd/MM/yyyy') : 'Seleccionar fecha'}
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
      {(quoteProducts.length > 0 || (includePumpService && pumpServiceProduct.price > 0)) && (
        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
            {(quoteProducts.length === 0 && includePumpService && pumpServiceProduct.price > 0) ? (
              <>
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Servicio de Bombeo
              </>
            ) : (
              <>
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                Productos de la Cotización
              </>
            )}
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
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">$</span>
                      <input 
                        type="number" 
                        value={product.basePrice} 
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          updateProductDetails(index, { 
                            basePrice: isNaN(value) ? 0 : value 
                          });
                        }}
                        className="w-full p-2 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm"
                        title="Edita el precio base para ajustar el precio final"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Margen (%)</label>
                    <div className="relative">
                      <input 
                        type="number"
                        step="0.01"
                        value={Math.round((product.profitMargin * 100) * 100) / 100}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            updateProductDetails(index, { 
                              profitMargin: value / 100 
                            });
                          }
                        }}
                        onBlur={() => {
                          // Ensure minimum 4% margin
                          const current = product.profitMargin * 100;
                          const clamped = Math.max(4, current);
                          if (clamped !== current) {
                            updateProductDetails(index, { 
                              profitMargin: clamped / 100 
                            });
                          }
                        }}
                        placeholder="4.0"
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm"
                        disabled={isLoading}
                        title="Edita el margen para ajustar automáticamente el precio final"
                      />
                      {product.profitMargin > 0.04 && (
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-green-600 font-medium">
                          ✓
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Precio Final</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">$</span>
                      <input 
                        type="number"
                        value={product.finalPrice}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value) && value > 0) {
                            updateProductDetails(index, { 
                              finalPrice: value 
                            });
                          }
                        }}
                        onBlur={() => {
                          // Validate that the price is positive
                          if (product.finalPrice <= 0) {
                            updateProductDetails(index, { 
                              finalPrice: product.basePrice * (1 + product.profitMargin) 
                            });
                          }
                        }}
                        className="w-full p-2 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm"
                        title="Edita el precio final para ajustar automáticamente el margen"
                        disabled={isLoading}
                      />
                      {product.finalPrice % 5 === 0 && Math.abs(product.finalPrice - (product.basePrice * (1 + product.profitMargin))) < 0.01 && (
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-blue-600 font-medium" title="Precio calculado automáticamente">
                          ✓
                        </div>
                      )}
                      {Math.abs(product.finalPrice - (product.basePrice * (1 + product.profitMargin))) >= 0.01 && (
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-orange-600 font-medium" title="Precio establecido manualmente">
                          ✎
                        </div>
                      )}
                    </div>
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

            {/* Pumping Service Display for standalone pumping service */}
            {quoteProducts.length === 0 && includePumpService && pumpServiceProduct.price > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 py-5 @container bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="md:col-span-1">
                  <p className="font-semibold text-blue-800 mb-1 flex items-center gap-2">
                    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    SERVICIO DE BOMBEO
                  </p>
                  <p className="text-xs text-blue-600">{pumpServiceProduct.description || 'Servicio de Bombeo'}</p>
                </div>
                <div className="@md:col-span-5 grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">Volumen (m³)</label>
                    <div className="bg-white p-2 rounded border border-blue-300">
                      <span className="font-medium">{pumpServiceProduct.volume || 1}</span>
                    </div>
                  </div>


                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">Precio por m³</label>
                    <div className="bg-white p-2 rounded border border-blue-300">
                      <span className="font-medium">${(pumpServiceProduct.price || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <div className="bg-blue-100 p-3 rounded border border-blue-300 w-full">
                      <div className="text-center">
                        <p className="text-xs font-medium text-blue-700 mb-1">Total</p>
                        <p className="font-bold text-blue-800">
                          ${((pumpServiceProduct.price || 0) * (pumpServiceProduct.volume || 1)).toLocaleString('es-MX', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
            console.log('Opening site creation dialog with Google Maps');
            
            // Clear existing coordinates when opening the dialog
            setSiteCoordinates({ lat: null, lng: null });
            
            // More robust approach with multiple resize events
            const triggerResize = () => {
              window.dispatchEvent(new Event('resize'));
              console.log('Resize event triggered for map initialization');
            };
            
            // Trigger multiple resize events with increasing delays
            const timeouts = [
              setTimeout(triggerResize, 200),
              setTimeout(triggerResize, 500),
              setTimeout(triggerResize, 800),
              setTimeout(triggerResize, 1200),
              setTimeout(() => {
                triggerResize();
                console.log('Final resize event triggered for map');
              }, 1500)
            ];
            
            // Return cleanup function that will run if the component unmounts
            return () => {
              console.log('Cleaning up resize timeouts');
              timeouts.forEach(clearTimeout);
            };
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px] w-[90vw] h-[90vh] overflow-hidden p-0 flex flex-col">
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <DialogTitle>Crear Nueva Obra</DialogTitle>
            <DialogDescription>
              Completa los detalles de la nueva obra y selecciona su ubicación en el mapa.
            </DialogDescription>
          </div>
          <div className="flex-1 overflow-hidden p-4">
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
                  onSiteCreated={(id: string, name: string, loc?: string, lat?: number, lng?: number) => handleSiteCreated(id, name, loc, lat, lng)}
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}