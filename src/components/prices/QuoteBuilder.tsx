/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { clientService } from '@/lib/supabase/clients';
import { recipeService } from '@/lib/supabase/recipes';
import { priceService } from '@/lib/supabase/prices';
import { masterRecipeService } from '@/lib/services/masterRecipeService';
import type { MasterRecipe } from '@/types/masterRecipes';
import { features } from '@/config/featureFlags';
import { calculateBasePrice } from '@/lib/utils/priceCalculator';
import { createQuote, QuotesService } from '@/services/quotes';
import { supabase } from '@/lib/supabase';
import ConstructionSiteSelect from '@/components/ui/ConstructionSiteSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Disclosure } from '@headlessui/react';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Popover from '@radix-ui/react-popover';
import { CalendarIcon, AlertCircle, Search, Plus, Trash2, MapPin, Building2, User, Loader2 } from 'lucide-react';
import 'react-day-picker/dist/style.css';
import { useDebouncedCallback, useDebounce } from 'use-debounce';
import { usePlantAwareRecipes } from '@/hooks/usePlantAwareRecipes';
import { usePlantContext } from '@/contexts/PlantContext';
import ClientCreationForm from '@/components/clients/ClientCreationForm';
import ConstructionSiteForm from '@/components/clients/ConstructionSiteForm';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
  master_recipe_id?: string; // When selecting by master
  master_code?: string; // Display name for master-first mode
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
  const [masters, setMasters] = useState<MasterRecipe[]>([]);
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
  const [debouncedRecipeSearch] = useDebounce(recipeSearch, 300);
  const [clientSearch, setClientSearch] = useState<string>('');
  const [debouncedClientSearch] = useDebounce(clientSearch, 300);
  
  // Load master recipes when feature flag is enabled
  useEffect(() => {
    const loadMasters = async () => {
      try {
        if (features.masterPricingEnabled && currentPlant?.id) {
          const data = await masterRecipeService.getMasterRecipes(currentPlant.id);
          setMasters(data);
        } else {
          setMasters([]);
        }
      } catch (e) {
        console.error('Error loading master recipes:', e);
      }
    };
    loadMasters();
  }, [currentPlant?.id]);

  const resolveMasterPrice = async (masterId: string): Promise<number | null> => {
    try {
      // IMPORTANT: PostgREST does not support `eq.null` filters (it must be `is.null`).
      // Also, avoid querying client/site scoped prices until the user has those selected.

      // 1) Exact scope: by client and site (requires both)
      if (selectedClient && constructionSite) {
        const { data: exact } = await supabase
          .from('product_prices')
          .select('base_price, effective_date')
          .eq('is_active', true)
          .eq('master_recipe_id', masterId)
          .eq('client_id', selectedClient)
          .eq('construction_site', constructionSite)
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (exact?.base_price != null) return exact.base_price as number;
      }

      // 2) Client-only scope
      if (selectedClient) {
        const { data: clientScoped } = await supabase
          .from('product_prices')
          .select('base_price, effective_date')
          .eq('is_active', true)
          .eq('master_recipe_id', masterId)
          .eq('client_id', selectedClient)
          .is('construction_site', null)
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (clientScoped?.base_price != null) return clientScoped.base_price as number;
      }

      // 3) Global (no client/site)
      const { data: global } = await supabase
        .from('product_prices')
        .select('base_price, effective_date')
        .eq('is_active', true)
        .eq('master_recipe_id', masterId)
        .is('client_id', null)
        .is('construction_site', null)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (global?.base_price != null) return global.base_price as number;

      return null;
    } catch (e) {
      console.warn('Error resolving master price:', e);
      return null;
    }
  };

  const addMasterToQuote = async (masterId: string) => {
    const master = masters.find(m => m.id === masterId);
    if (!master) {
      console.error('Master not found');
      return;
    }

    try {
      // Validate plant compatibility
      if (quoteProducts.length > 0 && master.plant_id) {
        const existingPlantId = quoteProducts[0].recipe.plant_id;
        if (existingPlantId && existingPlantId !== master.plant_id) {
          setPlantValidationError('Todas las recetas en una cotización deben pertenecer a la misma planta');
          return;
        }
      }

      setPlantValidationError(null);

      // Prevent duplicate by master
      const existsByMaster = quoteProducts.some(p => p.master_recipe_id === masterId);
      if (existsByMaster) {
        toast.error('Este maestro ya está en la cotización');
        return;
      }

      // Fetch variants for this master
      const { data: variants, error: variantsError } = await supabase
        .from('recipes')
        .select('id, recipe_code, plant_id')
        .eq('master_recipe_id', masterId)
        .order('recipe_code', { ascending: true });
      if (variantsError) throw variantsError;

      const chosenVariant = variants?.[0];
      if (!chosenVariant) {
        toast.error('Este maestro no tiene variantes vinculadas. Víncule variantes antes de cotizar.');
        return;
      }

      // Try to resolve a master price; fallback to cost-based calculation using chosen variant
      let basePrice: number | null = null;
      if (features.masterPricingEnabled) {
        basePrice = await resolveMasterPrice(masterId);
      }

      if (basePrice == null) {
        const { data: recipeDetails } = await recipeService.getRecipeById(chosenVariant.id);
        const materials = recipeDetails?.recipe_versions[0]?.materials || [];
        basePrice = await calculateBasePrice(chosenVariant.id, materials);
      }

      const finalPrice = Math.ceil((basePrice * 1.04) / 5) * 5;

      const newProduct: QuoteProduct = {
        recipe: {
          id: chosenVariant.id,
          recipe_code: (variants?.find(v => v.id === chosenVariant.id) as any)?.recipe_code || '',
          strength_fc: master.strength_fc,
          placement_type: master.placement_type,
          slump: master.slump,
          max_aggregate_size: master.max_aggregate_size,
          plant_id: master.plant_id,
        },
        basePrice: basePrice,
        volume: 1,
        profitMargin: 0.04,
        finalPrice: finalPrice,
        master_recipe_id: masterId,
        master_code: master.master_code,
      };

      setQuoteProducts([...quoteProducts, newProduct]);
    } catch (error) {
      console.error('Error adding master product:', error);
      toast.error('No se pudo agregar el maestro. Verifique los datos.');
    }
  };
  
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
        toast.error('Error al cargar datos iniciales. Por favor, actualice la página.');
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
          toast.error('Error al cargar el historial del cliente.');
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
        toast.error('Este producto ya está en la cotización');
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
      toast.error('No se pudo agregar el producto. Verifique la información de la receta.');
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
      toast.error('Por favor, seleccione un cliente');
      return false;
    }

    // Allow quotes with either concrete products or pumping service
    const hasConcreteProducts = quoteProducts.length > 0;
    const hasPumpingService = includePumpService && pumpServiceProduct.price > 0;

    if (!hasConcreteProducts && !hasPumpingService) {
      toast.error('Por favor, agregue al menos un producto de concreto o configure un servicio de bombeo');
      return false;
    }

    if (!constructionSite) {
      toast.error('Por favor, ingrese el sitio de construcción');
      return false;
    }

    if (!location) {
      toast.error('Por favor, ingrese la ubicación');
      return false;
    }

    if (!validityDate) {
      toast.error('Por favor, seleccione la fecha de validez');
      return false;
    }

    // Validate pumping service when included
    if (includePumpService) {
      if (pumpServiceProduct.price <= 0) {
        toast.error('Por favor, ingrese un precio válido para el servicio de bombeo');
        return false;
      }
      if (pumpServiceProduct.volume <= 0) {
        toast.error('Por favor, ingrese un volumen válido para el servicio de bombeo');
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
            recipe_id: product.master_recipe_id ? null : product.recipe.id,
            master_recipe_id: product.master_recipe_id || null,
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
      toast.success(`Cotización ${createdQuote.quote_number} guardada exitosamente`);
      
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
      toast.error('Error al guardar la cotización: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Add a filtered recipes function
  const filteredRecipes = recipes.filter(recipe => {
    if (!debouncedRecipeSearch.trim()) return true;
    
    const searchLower = debouncedRecipeSearch.toLowerCase();
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
    if (!debouncedClientSearch.trim()) return true;
    
    const searchLower = debouncedClientSearch.toLowerCase();
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
    toast.success('Borrador de cotización limpiado.');
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
      <Card
        variant="thick"
        className="lg:col-span-2 flex flex-col border-0 p-6 lg:h-[calc(100vh-15rem)] lg:min-h-[600px]"
      >
        <div className="mb-6 shrink-0">
          <h2 className="text-title-2 font-bold text-gray-800 mb-4">
            {features.masterPricingEnabled ? 'Catálogo de Maestros' : 'Catálogo de Productos'}
          </h2>
          <div className="relative">
            <Input
              type="text"
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              placeholder={features.masterPricingEnabled ? 'Buscar maestros...' : 'Buscar recetas...'}
              className="pl-10 w-full"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            {recipeSearch && (
              <button
                onClick={() => setRecipeSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <div className="bg-gray-200 rounded-full p-0.5">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <div className="h-full overflow-y-auto pr-2 pb-2 custom-scrollbar">
            {features.masterPricingEnabled ? (
              // Masters mode logic kept intact
              (() => {
                const filteredMasters = masters.filter(m => {
                  if (!debouncedRecipeSearch.trim()) return true;
                  const s = debouncedRecipeSearch.toLowerCase();
                  return (
                    (m.master_code || '').toLowerCase().includes(s) ||
                    String(m.strength_fc ?? '').includes(s) ||
                    String(m.slump ?? '').includes(s) ||
                    (m.placement_type || '').toLowerCase().includes(s)
                  );
                });

                const groupedMasters = filteredMasters.reduce((acc: Record<number, Record<number, MasterRecipe[]>>, m) => {
                  const strength = Number(m.strength_fc || 0);
                  const slump = Number(m.slump || 0);
                  if (!acc[strength]) acc[strength] = {};
                  if (!acc[strength][slump]) acc[strength][slump] = [];
                  acc[strength][slump].push(m);
                  return acc;
                }, {} as Record<number, Record<number, MasterRecipe[]>>);

                if (Object.keys(groupedMasters).length === 0) {
                  return (
                    <div className="p-8 text-center text-gray-500">
                      <p>No hay maestros disponibles</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6 px-2">
                    {Object.entries(groupedMasters)
                      .sort(([a], [b]) => Number(b) - Number(a))
                      .map(([strengthStr, slumpGroups]) => {
                        const strength = Number(strengthStr);
                        const isStrengthExpanded = expandedStrengths.includes(strength);
                        return (
                          <div key={strength} className="bg-white/50 rounded-xl overflow-hidden border border-gray-100 shadow-sm transition-all duration-200">
                            <button
                              onClick={() => toggleStrength(strength)}
                              className="w-full p-5 flex justify-between items-center hover:bg-white/80 transition-colors group"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isStrengthExpanded ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'} transition-colors`}>
                                  <span className="font-bold text-lg">{strength}</span>
                                </div>
                                <div className="text-left">
                                  <h4 className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">Concreto f'c {strength} kg/cm²</h4>
                                  <p className="text-xs text-gray-500">{Object.keys(slumpGroups).length} variantes de revenimiento</p>
                                </div>
                              </div>
                              <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isStrengthExpanded ? 'rotate-180 text-blue-500' : ''}`} />
                            </button>
                            {isStrengthExpanded && (
                              <div className="p-5 pt-0 space-y-6 animate-in slide-in-from-top-2">
                                {Object.entries(slumpGroups)
                                  .sort(([a], [b]) => Number(b) - Number(a))
                                  .map(([slumpStr, mastersAtSlump]) => (
                                    <div key={slumpStr} className="pl-2">
                                      <div className="flex items-center gap-2 mb-3">
                                        <span className="h-px w-4 bg-gray-300"></span>
                                        <h5 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Revenimiento {slumpStr} cm</h5>
                                        <span className="h-px flex-1 bg-gray-100"></span>
                                      </div>
                                      <div className="grid grid-cols-1 gap-4">
                                        {mastersAtSlump.map(m => (
                                          <Card key={m.id} variant="interactive" className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white shadow-sm hover:shadow-md border-gray-100 transition-all duration-200 group">
                                            <div className="flex-1">
                                              <h3 className="font-bold text-gray-900 text-base group-hover:text-blue-700 transition-colors">{m.master_code}</h3>
                                              <div className="flex flex-wrap gap-2 mt-2">
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                  {m.placement_type === 'D' ? 'Directa' : 'Bombeado'}
                                                </span>
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                  TMA: {m.max_aggregate_size}mm
                                                </span>
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                  Edad: {m.age_days ? `${m.age_days}d` : 'N/A'}
                                                </span>
                                              </div>
                                            </div>
                                            <Button
                                              onClick={() => addMasterToQuote(m.id)}
                                              disabled={isLoading}
                                              size="sm"
                                              variant="primary"
                                              className="shrink-0 h-9 px-4 shadow-sm hover:shadow-md transition-all"
                                            >
                                              <Plus className="w-4 h-4 mr-1.5" /> Agregar
                                            </Button>
                                          </Card>
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
                );
              })()
            ) : (
              // Standard recipes mode (Updated UI)
              Object.keys(groupedRecipes).length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>No hay recetas disponibles</p>
                </div>
              ) : (
                Object.entries(groupedRecipes)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([type, strengthGroups]) => {
                    const isTypeExpanded = expandedTypes.includes(type);
                    const typeName = type === 'FC' ? "Concreto Convencional F'c" : 
                                  type === 'MR' ? 'Concreto Módulo de Ruptura Mr' : type;
                    
                    return (
                      <div key={type} className="bg-white/50 rounded-xl overflow-hidden border border-gray-100 mb-4 shadow-sm">
                        <button
                          onClick={() => toggleType(type)}
                          className="w-full p-5 flex justify-between items-center hover:bg-white/80 transition-colors"
                        >
                          <h3 className="font-bold text-gray-800 text-lg">{typeName}</h3>
                          <ChevronDownIcon className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isTypeExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isTypeExpanded && (
                          <div className="p-5 pt-0 space-y-4">
                            {Object.entries(strengthGroups)
                              .sort(([a], [b]) => Number(b) - Number(a))
                              .map(([strengthStr, slumpGroups]) => {
                                const strength = Number(strengthStr);
                                const isStrengthExpanded = expandedStrengths.includes(strength);
                                const strengthLabel = type === 'MR' ? 'MR' : 'f\'c';
                                
                                return (
                                  <div key={strength} className="border-l-2 border-gray-200 pl-4 ml-1">
                                    <button
                                      onClick={() => toggleStrength(strength)}
                                      className="w-full py-3 flex justify-between items-center text-left hover:text-blue-600 transition-colors"
                                    >
                                      <h4 className="font-medium text-gray-700 text-base">{strengthLabel}: {strength} kg/cm²</h4>
                                      <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isStrengthExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    {isStrengthExpanded && (
                                      <div className="mt-3 space-y-5 animate-in slide-in-from-top-1">
                                        {Object.entries(slumpGroups)
                                          .sort(([a], [b]) => Number(b) - Number(a))
                                          .map(([slumpStr, slumpRecipes]) => (
                                            <div key={slumpStr}>
                                              <h5 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Revenimiento: {slumpStr} cm</h5>
                                              <div className="grid gap-4">
                                                {slumpRecipes.map(recipe => (
                                                  <Card key={recipe.id} variant="interactive" className="p-4 bg-white shadow-sm hover:shadow-md border-gray-100 transition-all">
                                                    <div className="flex justify-between items-center gap-4">
                                                      <div className="min-w-0 flex-1">
                                                        <h3 className="font-bold text-sm text-gray-900 truncate" title={recipe.recipe_code}>{recipe.recipe_code}</h3>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                          {recipe.has_waterproofing && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">Impermeabilizante</span>
                                                          )}
                                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">TMA: {recipe.max_aggregate_size}mm</span>
                                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">{recipe.placement_type === 'D' ? 'Directa' : 'Bombeado'}</span>
                                                        </div>
                                                      </div>
                                                      <Button 
                                                        onClick={() => recipe.id && addProductToQuote(recipe.id)}
                                                        disabled={isLoading || !recipe.id}
                                                        size="sm"
                                                        className="h-8 w-8 p-0 rounded-full shadow-sm hover:shadow shrink-0"
                                                      >
                                                        <Plus className="w-4 h-4" />
                                                      </Button>
                                                    </div>
                                                  </Card>
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
              )
            )}
          </div>
        </div>
      </Card>

      {/* Right Panel: Client Selection and History */}
      <div className="flex flex-col gap-6 lg:h-[calc(100vh-15rem)] lg:min-h-[600px] min-h-0">
        {/* Scrollable content (desktop) / natural flow (mobile) */}
        <div className="flex flex-col gap-6 flex-1 min-h-0 lg:overflow-y-auto lg:pr-2 lg:custom-scrollbar pb-6">
        <Card variant="thick" className="p-6 border-0 shrink-0">
          <h2 className="text-title-3 font-bold mb-6 text-gray-800 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-500" />
            Cliente y Obra
          </h2>
          <div className="space-y-5">
            {/* Client Search & Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Cliente</label>
              <div className="relative">
                <Input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="mb-2"
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              <div className="flex gap-2">
                <Select value={selectedClient} onValueChange={setSelectedClient} disabled={isLoading}>
                  <SelectTrigger className="w-full bg-white/50">
                    <SelectValue placeholder="Seleccionar Cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.business_name} ({client.client_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={() => setShowCreateClientDialog(true)}
                  variant="secondary"
                  size="icon"
                  className="shrink-0"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Site Selection */}
            {selectedClient && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-sm font-medium text-gray-700">Obra</label>
                <div className="flex gap-2">
                  {clientSites.length > 0 ? (
                    <Select 
                      value={selectedSite} 
                      onValueChange={(value) => {
                        setSelectedSite(value);
                        const site = clientSites.find(s => s.id === value);
                        if (site) {
                          setConstructionSite(site.name);
                          setLocation(site.location || '');
                          if (site.latitude && site.longitude) {
                            setSiteCoordinates({ lat: site.latitude, lng: site.longitude });
                          } else {
                            setSiteCoordinates({ lat: null, lng: null });
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="w-full bg-white/50">
                        <SelectValue placeholder="Seleccionar Obra" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientSites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 italic">
                      Sin obras registradas
                    </div>
                  )}
                  <Button
                    onClick={() => {
                      setShowCreateSiteDialog(true);
                      setEnableMapForSite(true);
                    }}
                    variant="secondary"
                    size="icon"
                    className="shrink-0"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Location & Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Ubicación</label>
              <div className="relative">
                <Input 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Dirección o coordenadas"
                  disabled={isLoading || !!selectedSite}
                  className="pl-9"
                />
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Vigencia</label>
              <Popover.Root>
                <Popover.Trigger asChild>
                  <Button
                    variant="secondary"
                    className={`w-full justify-start text-left font-normal ${!validityDate && "text-muted-foreground"}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {validityDate ? format(new Date(validityDate + 'T00:00:00'), 'dd/MM/yyyy') : <span>Seleccionar fecha</span>}
                  </Button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content className="w-auto p-0 bg-white rounded-xl shadow-xl border-0" align="start">
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={es}
                      initialFocus
                      classNames={{
                        day_selected: "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",
                        day_today: "bg-gray-100 font-bold text-gray-900",
                      }}
                    />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-3">
                <Checkbox.Root
                  id="includePumpService"
                  checked={includePumpService}
                  onCheckedChange={(checked) => setIncludePumpService(checked === true)}
                  className="h-5 w-5 rounded-md border border-gray-300 bg-white data-[state=checked]:bg-blue-600 data-[state=checked]:text-white flex items-center justify-center transition-colors"
                >
                  <Checkbox.Indicator>
                    <CheckIcon className="h-3.5 w-3.5" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <label htmlFor="includePumpService" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Incluir Servicio de Bombeo
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox.Root
                  id="includesVAT"
                  checked={includesVAT}
                  onCheckedChange={(checked) => setIncludesVAT(checked === true)}
                  className="h-5 w-5 rounded-md border border-gray-300 bg-white data-[state=checked]:bg-blue-600 data-[state=checked]:text-white flex items-center justify-center transition-colors"
                >
                  <Checkbox.Indicator>
                    <CheckIcon className="h-3.5 w-3.5" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <label htmlFor="includesVAT" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Incluir IVA
                </label>
              </div>
            </div>

            {/* Pump Configuration */}
            {includePumpService && (
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                <h3 className="font-semibold text-sm text-blue-800">Configuración Bombeo</h3>
                <Input
                  value={pumpServiceProduct.description || ''}
                  onChange={(e) => updatePumpServiceDetails({ description: e.target.value })}
                  placeholder="Descripción del servicio"
                  className="bg-white"
                />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Volumen (m³)</label>
                    <Input
                      type="number"
                      value={pumpServiceProduct.volume}
                      onChange={(e) => updatePumpServiceDetails({ volume: parseFloat(e.target.value) || 0 })}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Precio (MXN)</label>
                    <Input
                      type="number"
                      value={pumpServiceProduct.price}
                      onChange={(e) => updatePumpServiceDetails({ price: parseFloat(e.target.value) || 0 })}
                      className="bg-white"
                    />
                  </div>
                </div>
                <div className="text-right font-bold text-blue-700 text-sm">
                  Total: ${((pumpServiceProduct.price || 0) * (pumpServiceProduct.volume || 1)).toLocaleString('es-MX')}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Client History - simplified */}
        <Card variant="thin" className="p-4 overflow-hidden flex flex-col shrink-0">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            Historial Reciente
          </h3>
          <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
            {clientHistory.length > 0 ? (
              clientHistory.slice(0, 5).map((item, idx) => (
                <div key={idx} className="text-xs p-2 bg-white/40 rounded-lg border border-white/50">
                  <p className="font-medium text-gray-800">{item.quote_details[0]?.product?.recipe_code || 'Producto'}</p>
                  <div className="flex justify-between text-gray-500 mt-1">
                    <span>{new Date(item.delivery_date).toLocaleDateString()}</span>
                    <span>${item.quote_details[0]?.final_price?.toLocaleString() || '0'}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Sin historial disponible</p>
            )}
          </div>
        </Card>
        </div>

        {/* Actions (always visible on desktop; prominent on mobile) */}
        <div className="shrink-0 lg:mt-auto sticky bottom-0 z-10">
          <Card
            variant="thick"
            className="p-3 sm:p-4 border-0 bg-white/80 backdrop-blur-md"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="secondary" onClick={clearDraft} disabled={isLoading}>
                Limpiar borrador
              </Button>
              <Button onClick={saveQuote} disabled={isLoading} loading={isLoading}>
                Guardar cotización
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Panel: Quote Products */}
      {(quoteProducts.length > 0 || (includePumpService && pumpServiceProduct.price > 0)) && (
        <Card variant="thick" className="lg:col-span-3 border-0 p-6">
          <div className="mb-6">
            <h2 className="text-title-3 font-bold text-gray-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-green-600" />
              Detalle de la Cotización
            </h2>
          </div>
          
          <div className="space-y-4">
            {quoteProducts.map((product, index) => (
              <div key={index} className="bg-white/60 rounded-xl p-4 border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-3">
                  <p className="font-bold text-gray-900 text-sm">
                    {features.masterPricingEnabled && product.master_code ? product.master_code : product.recipe.recipe_code}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{product.recipe.placement_type === 'D' ? 'Directa' : 'Bombeado'}</p>
                </div>
                
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Volumen (m³)</label>
                  <Input 
                    type="number" 
                    value={product.volume}
                    onChange={(e) => updateProductDetails(index, { volume: parseFloat(e.target.value) || 0 })}
                    className="bg-white h-9"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Precio Base</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <Input 
                      type="number"
                      value={product.basePrice}
                      onChange={(e) => updateProductDetails(index, { basePrice: parseFloat(e.target.value) || 0 })}
                      className="bg-white pl-5 h-9"
                    />
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Margen (%)</label>
                  <div className="relative">
                    <Input 
                      type="number"
                      value={(product.profitMargin * 100).toFixed(2)}
                      onChange={(e) => updateProductDetails(index, { profitMargin: (parseFloat(e.target.value) || 0) / 100 })}
                      className="bg-white pr-6 h-9"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Precio Final</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <Input 
                      type="number"
                      value={product.finalPrice}
                      onChange={(e) => updateProductDetails(index, { finalPrice: parseFloat(e.target.value) || 0 })}
                      className="bg-white pl-5 h-9 font-bold text-green-700"
                    />
                  </div>
                </div>
                
                <div className="md:col-span-1 flex justify-end">
                  <Button variant="destructive" size="icon" onClick={() => removeProductFromQuote(index)} className="h-9 w-9">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            {quoteProducts.length === 0 && includePumpService && (
              <div className="bg-blue-50/50 rounded-xl p-6 border border-blue-100 text-center text-blue-800">
                Solo Servicio de Bombeo Seleccionado
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <Card
            variant="thick"
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="w-[min(92vw,420px)] p-8 sm:p-10 flex flex-col items-center gap-4 text-center"
          >
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600" aria-hidden="true"></div>
            <p className="font-medium text-gray-700">Procesando solicitud…</p>
          </Card>
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
          if (open) {
            setSiteCoordinates({ lat: null, lng: null });
            const triggerResize = () => window.dispatchEvent(new Event('resize'));
            setTimeout(triggerResize, 200);
            setTimeout(triggerResize, 1000);
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px] w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <DialogTitle>Crear Nueva Obra</DialogTitle>
            <DialogDescription>Detalles de la nueva obra y ubicación.</DialogDescription>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {selectedClient ? (
              <ConstructionSiteForm
                clientId={selectedClient}
                onSiteCreated={(id, name, loc, lat, lng) => handleSiteCreated(id, name, loc, lat, lng)}
                onCancel={() => setShowCreateSiteDialog(false)}
              />
            ) : (
              <div className="text-center py-10 text-gray-500">
                Seleccione un cliente primero.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}