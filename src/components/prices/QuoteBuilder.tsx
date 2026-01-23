/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
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
import { calculateDistanceInfo } from '@/lib/services/distanceService';
import { getAvailableProducts, getQuoteAdditionalProducts, addProductToQuote as addAdditionalProductToQuote, removeProductFromQuote } from '@/lib/services/additionalProductsService';
import { DistanceAnalysisPanel } from '@/components/quotes/DistanceAnalysisPanel';
import { RangeBreakdown } from '@/components/quotes/RangeBreakdown';
import { AdditionalProductsSelector } from '@/components/quotes/AdditionalProductsSelector';
import { BasePriceBreakdownDialog } from '@/components/quotes/BasePriceBreakdownDialog';
import type { DistanceCalculation } from '@/types/distance';
import type { AdditionalProduct, QuoteAdditionalProduct } from '@/types/additionalProducts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Disclosure } from '@headlessui/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Popover from '@radix-ui/react-popover';
import { CalendarIcon, AlertCircle, Search, Plus, Trash2, MapPin, Building2, User, Loader2, Info, Check } from 'lucide-react';
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
  basePriceManuallyEdited?: boolean; // Track if base price was manually edited
  finalPriceManuallyEdited?: boolean; // Track if final price was manually edited
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
  const quoteProductsRef = useRef<QuoteProduct[]>([]); // Ref to track latest quoteProducts for useEffects
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
  
  // New state for distance and additional products
  const [distanceInfo, setDistanceInfo] = useState<DistanceCalculation | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [distanceRanges, setDistanceRanges] = useState<any[]>([]);
  const [availableAdditionalProducts, setAvailableAdditionalProducts] = useState<AdditionalProduct[]>([]);
  const [quoteAdditionalProducts, setQuoteAdditionalProducts] = useState<QuoteAdditionalProduct[]>([]);
  const [currentQuoteId, setCurrentQuoteId] = useState<string | undefined>(undefined);
  
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
    // NOTE: This function is NOT used for quote creation
    // Quote builder always calculates fresh prices from materials
    // This is kept for backwards compatibility but should not be called
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

      if (!variants || variants.length === 0) {
        toast.error('Este maestro no tiene variantes vinculadas. Víncule variantes antes de cotizar.');
        return;
      }

      // IMPORTANT: Quote builder always calculates fresh prices from materials
      // product_prices table is ONLY for storing approved prices after a quote is approved
      // It should NOT be used when creating new quotes
      
      // Try variants until finding one with materials
      // This ensures: materials × current prices + admin costs (NO transport)
      let chosenVariant = variants[0];
      let basePrice: number | null = null;
      const triedVariants: string[] = [];

      for (const variant of variants) {
        triedVariants.push(variant.recipe_code || variant.id);
        try {
          basePrice = await calculateBasePrice(variant.id);
          chosenVariant = variant;
          if (triedVariants.length > 1) {
            console.log(
              `[QuoteBuilder] Fallback: Variant ${triedVariants[0]} had no materials, ` +
              `using variant ${variant.recipe_code || variant.id} (${triedVariants.length - 1} variants skipped)`
            );
          }
          break; // Found a variant with materials
        } catch (error: any) {
          // Check if error is about missing materials
          if (error?.message?.includes('No materials found')) {
            console.warn(
              `[QuoteBuilder] Variant ${variant.recipe_code || variant.id} has no materials, trying next variant`
            );
            continue; // Try next variant
          }
          // If it's a different error, throw it
          throw error;
        }
      }

      if (basePrice === null) {
        const variantCodes = triedVariants.join(', ');
        throw new Error(
          `No se encontraron materiales para ninguna variante del maestro ${master.master_code}. ` +
          `Variantes intentadas: ${variantCodes}. Por favor, asegúrese de que al menos una variante tenga materiales definidos.`
        );
      }

      // Add transport cost if distance info is available
      // IMPORTANT: Use current distanceInfo, not stale data
      // Master price should NOT include transport - it's added here
      const transportCostPerM3 = distanceInfo?.transport_cost_per_m3 || 0;
      const basePriceWithTransport = basePrice + transportCostPerM3;

      // Validate: base price should be reasonable
      if (basePriceWithTransport > 10000) {
        console.warn(`[Add Master] Unusually high base price calculated: ${basePriceWithTransport.toFixed(2)} for master ${master.master_code}`);
      }

      const finalPrice = Math.ceil((basePriceWithTransport * 1.04) / 5) * 5;

      console.log(`[Add Master] Added ${master.master_code}:`, {
        basePriceWithoutTransport: basePrice.toFixed(2),
        transportCostPerM3: transportCostPerM3.toFixed(2),
        basePriceWithTransport: basePriceWithTransport.toFixed(2),
        finalPrice: finalPrice.toFixed(2),
      });

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
        basePrice: basePriceWithTransport,
        volume: 1,
        profitMargin: 0.04,
        finalPrice: finalPrice,
        master_recipe_id: masterId,
        master_code: master.master_code,
        basePriceManuallyEdited: false, // Not manually edited initially
        finalPriceManuallyEdited: false, // Not manually edited initially
      };

      const updated = [...quoteProducts, newProduct];
      setQuoteProducts(updated);
      quoteProductsRef.current = updated;
    } catch (error) {
      console.error('Error adding master product:', error);
      toast.error('No se pudo agregar el maestro. Verifique los datos.');
    }
  };
  
  // New state variables for client and site creation
  const [showCreateClientDialog, setShowCreateClientDialog] = useState(false);
  const [showCreateSiteDialog, setShowCreateSiteDialog] = useState(false);
  const [breakdownDialogProductIndex, setBreakdownDialogProductIndex] = useState<number | null>(null);
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

  // Track if we're loading from sessionStorage to avoid saving during load
  const isLoadingFromStorageRef = useRef(false);

  // Load draft from sessionStorage on mount
  useEffect(() => {
    const savedDraft = sessionStorage.getItem(DRAFT_QUOTE_STORAGE_KEY);
    if (savedDraft) {
      try {
        isLoadingFromStorageRef.current = true;
        const draftData: DraftQuoteData = JSON.parse(savedDraft);
        setSelectedClient(draftData.selectedClient || '');
        
        // Load products but mark them as needing recalculation
        // Base prices from storage might be stale (calculated with old transport costs)
        const loadedProducts = (draftData.quoteProducts || []).map(product => ({
          ...product,
          basePriceManuallyEdited: false, // Reset manual edit flags - we'll recalculate
          finalPriceManuallyEdited: false, // Reset manual edit flags - we'll recalculate
        }));
        
        setQuoteProducts(loadedProducts);
        quoteProductsRef.current = loadedProducts;
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
        console.log('Draft quote loaded from sessionStorage. Products will be recalculated when distance info is available.');
        
        // Reset the flag after a short delay to allow state to settle
        setTimeout(() => {
          isLoadingFromStorageRef.current = false;
        }, 1000);
      } catch (error) {
        console.error('Error parsing draft quote from sessionStorage:', error);
        sessionStorage.removeItem(DRAFT_QUOTE_STORAGE_KEY); // Clear corrupted data
        isLoadingFromStorageRef.current = false;
      }
    } else {
      isLoadingFromStorageRef.current = false;
    }
  }, []);

  // Debounced save draft to sessionStorage
  const debouncedSaveDraft = useDebouncedCallback(() => {
    // Validate products before saving - check for obviously incorrect base prices
    const validProducts = quoteProducts.map(product => {
      // Base price should never exceed final price (unless manually edited)
      if (product.basePrice > product.finalPrice && !product.finalPriceManuallyEdited) {
        console.warn(`[Save Draft] Product ${product.recipe.recipe_code} has base price (${product.basePrice.toFixed(2)}) > final price (${product.finalPrice.toFixed(2)}). This might be stale data.`);
      }
      // Base price should be reasonable (not extremely high)
      if (product.basePrice > 10000) {
        console.warn(`[Save Draft] Product ${product.recipe.recipe_code} has unusually high base price: ${product.basePrice.toFixed(2)}`);
      }
      return product;
    });

    const draftData: DraftQuoteData = {
      selectedClient,
      quoteProducts: validProducts,
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
    console.log(`[Save Draft] Saved ${validProducts.length} products to sessionStorage.`);
  }, 500);

  // Trigger save draft on state change
  useEffect(() => {
    // Don't save if we're currently loading from storage
    if (isLoadingFromStorageRef.current) {
      return;
    }

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

      // Calculate base price using latest variant materials
      // calculateBasePrice will fetch the latest variant automatically if materials not provided
      // IMPORTANT: Always calculate fresh, don't use any cached/stale values
      let basePriceWithoutTransport = await calculateBasePrice(recipeId);
      
      // Add transport cost if distance info is available
      // Use current distanceInfo, not stale data
      const transportCostPerM3 = distanceInfo?.transport_cost_per_m3 || 0;
      const basePrice = basePriceWithoutTransport + transportCostPerM3;
      
      // Validate: base price should be reasonable (materials + admin + transport)
      // Log for debugging if something seems off
      if (basePrice > 10000) {
        console.warn(`[Add Product] Unusually high base price calculated: ${basePrice.toFixed(2)} for recipe ${recipe.recipe_code}`);
      }
      
      const finalPrice = Math.ceil((basePrice * 1.04) / 5) * 5;
      
      console.log(`[Add Product] Added ${recipe.recipe_code}:`, {
        basePriceWithoutTransport: basePriceWithoutTransport.toFixed(2),
        transportCostPerM3: transportCostPerM3.toFixed(2),
        basePrice: basePrice.toFixed(2),
        finalPrice: finalPrice.toFixed(2),
      });
      
      const newProduct: QuoteProduct = {
        recipe,
        basePrice,
        volume: 1,
        profitMargin: 0.04, // Minimum 4% margin
        finalPrice: finalPrice,
        basePriceManuallyEdited: false, // Not manually edited initially
        finalPriceManuallyEdited: false, // Not manually edited initially
        // Pump service is now handled at the quote level, not per product
      };

      const updated = [...quoteProducts, newProduct];
      setQuoteProducts(updated);
      quoteProductsRef.current = updated;
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
      // If base price is updated manually, mark it as manually edited
      if (updates.basePrice !== undefined && updates.basePrice !== currentProduct.basePrice) {
        newProduct.basePriceManuallyEdited = true;
        // Clear finalPriceManuallyEdited since we're recalculating finalPrice from basePrice
        newProduct.finalPriceManuallyEdited = false;
      }
      
      // If base price is updated, recalculate final price based on current margin
      let basePrice = updates.basePrice ?? currentProduct.basePrice;
      
      // Validation: basePrice should never exceed finalPrice (which includes margin)
      // If user enters a value that seems to include margin, warn them
      if (basePrice > currentProduct.finalPrice) {
        console.warn(`[Base Price Validation] Base price (${basePrice.toFixed(2)}) exceeds final price (${currentProduct.finalPrice.toFixed(2)}). This might indicate an error.`);
        // Don't prevent the update, but log it for debugging
      }
      
      // Validation: basePrice should never be less than materials + admin costs (without transport)
      // We can't easily check this here without recalculating, but we'll log if it seems wrong
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
      // If final price is updated manually, mark it as manually edited
      if (updates.finalPrice !== undefined && updates.finalPrice !== currentProduct.finalPrice) {
        newProduct.finalPriceManuallyEdited = true;
      }
      
      // If final price is updated, recalculate margin
      const basePrice = currentProduct.basePrice;
      const finalPrice = updates.finalPrice ?? currentProduct.finalPrice;
      
      // Validation: final price should be >= base price
      if (finalPrice < basePrice) {
        console.warn(`[Final Price Validation] Final price (${finalPrice.toFixed(2)}) is less than base price (${basePrice.toFixed(2)}). This might indicate an error.`);
      }
      
      // Calculate new margin based on final price (no rounding - use exact price)
      const newMargin = (finalPrice / basePrice) - 1;
      
      newProduct.profitMargin = newMargin;
      newProduct.finalPrice = finalPrice; // Keep the exact price user entered
    }
    
    updatedProducts[index] = newProduct;
    setQuoteProducts(updatedProducts);
    quoteProductsRef.current = updatedProducts;
  };

  const removeProductFromQuoteProducts = (index: number) => {
    const filtered = quoteProducts.filter((_, i) => i !== index);
    setQuoteProducts(filtered);
    quoteProductsRef.current = filtered;
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

      // Calculate distance if we have plant and construction site
      let distanceCalculation: DistanceCalculation | undefined = undefined;
      if (quotePlantId && selectedSite) {
        try {
          setIsCalculatingDistance(true);
          distanceCalculation = await calculateDistanceInfo(quotePlantId, selectedSite);
          setDistanceInfo(distanceCalculation);
        } catch (error) {
          console.warn('Error calculating distance, continuing without distance info:', error);
          toast.warning('No se pudo calcular la distancia. La cotización se creará sin información de distancia.');
        } finally {
          setIsCalculatingDistance(false);
        }
      }

      // Create quote with distance info
      const quoteData = {
        client_id: selectedClient,
        construction_site: constructionSite,
        location: location,
        validity_date: validityDate,
        plant_id: quotePlantId, // Required for distance calculation
        construction_site_id: selectedSite || undefined,
        distance_info: distanceCalculation,
        details: [], // Will be populated below
        margin_percentage: quoteProducts.length > 0 
          ? quoteProducts.reduce((sum, p) => sum + p.profitMargin, 0) / quoteProducts.length * 100
          : 0
      };

      const createdQuote = await createQuote(quoteData);
      setCurrentQuoteId(createdQuote.id);
      console.log('[QuoteBuilder] ✓ Quote created:', createdQuote.id, createdQuote.quote_number);

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
      console.log('[QuoteBuilder] ✓ Concrete details inserted:', quoteDetailsData.length);

      // IMPORTANT: Add additional products BEFORE creating product_prices
      // This ensures all products (concrete + additional) are included when creating product_prices
      // CHANGED: Removed try-catch so errors propagate and fail the entire quote creation
      if (quoteAdditionalProducts.length > 0 && createdQuote.id) {
        console.log(`[QuoteBuilder] Adding ${quoteAdditionalProducts.length} special products to quote ${createdQuote.id}`);
        console.log('[QuoteBuilder] Products:', quoteAdditionalProducts.map(p => ({
          id: p.additional_product_id, 
          name: p.product?.name,
          qty: p.quantity,
          margin: p.margin_percentage
        })));
        
        const addedProducts = [];
        for (const product of quoteAdditionalProducts) {
          console.log('[QuoteBuilder] Adding product:', {
            quoteId: createdQuote.id,
            productId: product.additional_product_id,
            quantity: product.quantity,
            margin: product.margin_percentage
          });
          
          const added = await addAdditionalProductToQuote(
            createdQuote.id,
            product.additional_product_id,
            product.quantity,
            product.margin_percentage
          );
          
          console.log('[QuoteBuilder] Product added:', added.id);
          addedProducts.push(added);
        }
        
        console.log(`[QuoteBuilder] ✓ Successfully added ${addedProducts.length} special products`);
        toast.success(`${addedProducts.length} producto(s) especial(es) agregado(s) a la cotización`);
      } else if (quoteAdditionalProducts.length > 0) {
        console.warn('[QuoteBuilder] Cannot add special products: quote ID is missing', { 
          quoteId: createdQuote.id, 
          productsCount: quoteAdditionalProducts.length 
        });
      }

      // NOW create product_prices for auto-approved quotes (AFTER all products are added)
      // Use API route to ensure server-side execution and bypass RLS issues
      if (createdQuote.auto_approved) {
        // ADDED: Verify special products were saved if we expected them
        if (quoteAdditionalProducts.length > 0) {
          console.log(`[QuoteBuilder] Verifying ${quoteAdditionalProducts.length} special products were saved...`);
          
          const { data: savedProducts, error: verifyError } = await supabase
            .from('quote_additional_products')
            .select('id')
            .eq('quote_id', createdQuote.id);
          
          if (verifyError) {
            throw new Error(`Error verificando productos especiales: ${verifyError.message}`);
          }
          
          if (!savedProducts || savedProducts.length !== quoteAdditionalProducts.length) {
            throw new Error(`Solo se guardaron ${savedProducts?.length || 0} de ${quoteAdditionalProducts.length} productos especiales`);
          }
          
          console.log(`[QuoteBuilder] ✓ Verified ${savedProducts.length} special products saved`);
        }
        
        try {
          console.log(`[QuoteBuilder] Auto-approved quote ${createdQuote.id}, creating product_prices entries via API...`);
          
          const response = await fetch('/api/quotes/approve', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ quoteId: createdQuote.id }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }

          const result = await response.json();
          console.log(`[QuoteBuilder] ✓ Successfully created ${result.pricesCreated} product_prices for auto-approved quote ${createdQuote.id}`);
        } catch (approvalError: any) {
          const errorMessage = approvalError?.message || 'Unknown error creating product prices';
          console.error('[QuoteBuilder] Error creating product_prices for auto-approved quote:', {
            quote_id: createdQuote.id,
            quote_number: createdQuote.quote_number,
            error: errorMessage,
            full_error: approvalError
          });
          
          // Show error toast to user so they know product_prices creation failed
          toast.error(`Cotización ${createdQuote.quote_number} fue auto-aprobada, pero hubo un error al crear los precios de productos. Por favor, contacte al administrador.`);
          
          // Note: We don't revert the quote status here because:
          // 1. The quote is already created and approved
          // 2. The user can manually trigger product_prices creation later if needed
          // 3. Reverting might cause confusion if the quote was already saved
        }
      }

      // Check if auto-approved
      const isAutoApproved = createdQuote.auto_approved || false;
      const thresholdUsed = includesVAT ? 8 : 14;
      const statusMessage = isAutoApproved 
        ? `Cotización ${createdQuote.quote_number} creada y auto-aprobada (margen >= ${thresholdUsed}%)`
        : `Cotización ${createdQuote.quote_number} creada y pendiente de aprobación (margen < ${thresholdUsed}%)`;

      toast.success(statusMessage);
      
      // Limpiar formulario
      setSelectedClient('');
      setQuoteProducts([]);
      quoteProductsRef.current = [];
      setConstructionSite('');
      setLocation('');
      setValidityDate('');
      setClientHistory([]);
      setIncludePumpService(false);
      setIncludesVAT(false);
      setDistanceInfo(null);
      setQuoteAdditionalProducts([]);
      setCurrentQuoteId(undefined);

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
    quoteProductsRef.current = [];
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

  // Calculate distance when plant and construction site are selected
  useEffect(() => {
    const calculateDistance = async () => {
      if (currentPlant?.id && selectedSite) {
        try {
          setIsCalculatingDistance(true);
          const info = await calculateDistanceInfo(currentPlant.id, selectedSite);
          setDistanceInfo(info);
          
          // Load distance ranges for the plant
          const { data: ranges } = await supabase
            .from('distance_range_configs')
            .select('*')
            .eq('plant_id', currentPlant.id)
            .eq('is_active', true)
            .order('min_distance_km', { ascending: true });
          setDistanceRanges(ranges || []);
        } catch (error) {
          console.error('Error calculating distance:', error);
          setDistanceInfo(null);
        } finally {
          setIsCalculatingDistance(false);
        }
      } else {
        setDistanceInfo(null);
        setDistanceRanges([]);
      }
    };

    calculateDistance();
  }, [currentPlant?.id, selectedSite]);

  // Update quoteProductsRef whenever quoteProducts changes
  useEffect(() => {
    quoteProductsRef.current = quoteProducts;
  }, [quoteProducts]);

  // Track previous transport cost to only update when it actually changes
  const previousTransportCostRef = useRef<number | null>(null);

  // Update product base prices when distance/transport cost changes
  useEffect(() => {
    const transportCostPerM3 = distanceInfo?.transport_cost_per_m3 || 0;
    
    // Only update if transport cost actually changed
    if (previousTransportCostRef.current === transportCostPerM3) {
      return; // No change, skip update
    }
    
    const currentProducts = quoteProductsRef.current;
    if (currentProducts.length === 0) {
      previousTransportCostRef.current = transportCostPerM3;
      return; // No products to update
    }

    // Recalculate base prices for all products when transport cost changes
    const updateProductPrices = async () => {
      try {
        // Use ref to get latest products, avoiding stale closure
        const productsToUpdate = quoteProductsRef.current;
        
        const updatedProducts = await Promise.all(
          productsToUpdate.map(async (product) => {
            try {
              // Get base price without transport (fresh calculation)
              const basePriceWithoutTransport = await calculateBasePrice(product.recipe.id || '');
              const basePriceWithTransport = basePriceWithoutTransport + transportCostPerM3;
              
              // Only update base price if it wasn't manually edited
              // If base price was manually edited, preserve it but warn if it seems wrong
              let newBasePrice = product.basePrice;
              if (!product.basePriceManuallyEdited) {
                newBasePrice = basePriceWithTransport;
              } else {
                // Base price was manually edited, but validate it
                const expectedBasePrice = basePriceWithoutTransport + transportCostPerM3;
                if (Math.abs(product.basePrice - expectedBasePrice) > 0.01) {
                  console.warn(`[Manual Base Price] Product ${product.recipe.recipe_code} has manually edited base price (${product.basePrice.toFixed(2)}) that differs from calculated (${expectedBasePrice.toFixed(2)})`);
                }
              }
              
              // Only recalculate final price if it wasn't manually edited
              let newFinalPrice = product.finalPrice;
              if (!product.finalPriceManuallyEdited) {
                // Recalculate final price with new base price
                newFinalPrice = Math.ceil((newBasePrice * (1 + product.profitMargin)) / 5) * 5;
              }
              
              // Validate: basePrice should never exceed finalPrice (unless finalPrice was manually edited lower)
              // This is a real error - base price should always be less than final price (which includes margin)
              if (newBasePrice > newFinalPrice) {
                if (product.finalPriceManuallyEdited) {
                  // Final price was manually edited to be lower than base price - this is unusual but allowed
                  console.warn(`[Price Warning] Product ${product.recipe.recipe_code}: Final price (${newFinalPrice.toFixed(2)}) was manually edited to be lower than base price (${newBasePrice.toFixed(2)}). This is unusual.`);
                } else {
                  // This is a real error - base price shouldn't exceed final price
                  console.error(`[Price Error] Base price (${newBasePrice.toFixed(2)}) exceeds final price (${newFinalPrice.toFixed(2)}) for product ${product.recipe.recipe_code}. Base price should be less than final price (which includes margin).`);
                }
              }
              
              // Log for debugging - only log if values seem incorrect
              const expectedBasePrice = basePriceWithoutTransport + transportCostPerM3;
              if (Math.abs(product.basePrice - expectedBasePrice) > 0.01 && !product.basePriceManuallyEdited) {
                console.warn(`[Price Mismatch] Product ${product.recipe.recipe_code}:`, {
                  currentBasePrice: product.basePrice.toFixed(2),
                  calculatedBasePriceWithoutTransport: basePriceWithoutTransport.toFixed(2),
                  transportCostPerM3: transportCostPerM3.toFixed(2),
                  expectedBasePriceWithTransport: expectedBasePrice.toFixed(2),
                  newBasePriceWithTransport: basePriceWithTransport.toFixed(2),
                  profitMargin: (product.profitMargin * 100).toFixed(2) + '%',
                  currentFinalPrice: product.finalPrice.toFixed(2),
                  newFinalPrice: newFinalPrice.toFixed(2),
                  basePriceManuallyEdited: product.basePriceManuallyEdited || false,
                  finalPriceManuallyEdited: product.finalPriceManuallyEdited || false,
                });
              }
              
              return {
                ...product,
                basePrice: newBasePrice,
                finalPrice: newFinalPrice,
              };
            } catch (error) {
              console.error(`Error updating price for product ${product.recipe.recipe_code}:`, error);
              return product; // Keep original if error
            }
          })
        );
        
        setQuoteProducts(updatedProducts);
        quoteProductsRef.current = updatedProducts;
        previousTransportCostRef.current = transportCostPerM3;
      } catch (error) {
        console.error('Error updating product prices:', error);
      }
    };
    
    updateProductPrices();
  }, [distanceInfo?.transport_cost_per_m3, distanceInfo?.distance_km]); // Only depend on transport cost

  // Load available additional products
  useEffect(() => {
    const loadProducts = async () => {
      if (currentPlant?.id) {
        try {
          const products = await getAvailableProducts(currentPlant.id);
          setAvailableAdditionalProducts(products);
        } catch (error) {
          console.error('Error loading additional products:', error);
        }
      }
    };

    loadProducts();
  }, [currentPlant?.id]);

  // Load quote additional products if quote ID exists
  useEffect(() => {
    const loadQuoteProducts = async () => {
      if (currentQuoteId) {
        try {
          const products = await getQuoteAdditionalProducts(currentQuoteId);
          setQuoteAdditionalProducts(products);
        } catch (error) {
          console.error('Error loading quote additional products:', error);
        }
      }
    };

    loadQuoteProducts();
  }, [currentQuoteId]);

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
                              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isStrengthExpanded ? 'rotate-180 text-blue-500' : ''}`} />
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
                          <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isTypeExpanded ? 'rotate-180' : ''}`} />
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
                                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isStrengthExpanded ? 'rotate-180' : ''}`} />
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

            {/* Distance Analysis */}
            {selectedSite && currentPlant && (
              <div className="pt-4 border-t border-gray-100">
                <DistanceAnalysisPanel 
                  distanceInfo={distanceInfo} 
                  isLoading={isCalculatingDistance}
                />
              </div>
            )}

            {/* Range Breakdown */}
            {distanceRanges.length > 0 && (
              <div className="pt-4">
                <RangeBreakdown 
                  ranges={distanceRanges}
                  currentRangeCode={distanceInfo?.range_code}
                  currentDistance={distanceInfo?.distance_km}
                />
              </div>
            )}

            {/* Additional Products */}
            {currentPlant && (
              <div className="pt-4 border-t border-gray-100">
                <Disclosure>
                  {({ open }) => (
                    <div>
                      <Disclosure.Button className="flex w-full justify-between rounded-lg bg-gray-50 px-4 py-2 text-left text-sm font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring focus-visible:ring-blue-500 focus-visible:ring-opacity-75">
                        <span>Productos Especiales / Adicionales</span>
                        {open ? (
                          <ChevronUp className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-500" />
                        )}
                      </Disclosure.Button>
                      <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-gray-500">
                        <AdditionalProductsSelector
                          quoteId={currentQuoteId}
                          plantId={currentPlant.id}
                          products={quoteAdditionalProducts}
                          availableProducts={availableAdditionalProducts}
                          onAddProduct={async (productId, quantity, marginPercentage) => {
                            if (currentQuoteId) {
                              await addAdditionalProductToQuote(currentQuoteId, productId, quantity, marginPercentage);
                              const updated = await getQuoteAdditionalProducts(currentQuoteId);
                              setQuoteAdditionalProducts(updated);
                            } else {
                              // For new quotes, store in state until quote is created
                              const product = availableAdditionalProducts.find(p => p.id === productId);
                              if (product) {
                                const unitPrice = product.base_price * (1 + marginPercentage / 100);
                                const newProduct: QuoteAdditionalProduct = {
                                  id: `temp-${Date.now()}`,
                                  quote_id: '',
                                  additional_product_id: productId,
                                  quantity,
                                  base_price: product.base_price,
                                  margin_percentage: marginPercentage,
                                  unit_price: unitPrice,
                                  total_price: quantity * unitPrice,
                                  product,
                                };
                                setQuoteAdditionalProducts([...quoteAdditionalProducts, newProduct]);
                              }
                            }
                          }}
                          onRemoveProduct={async (productId) => {
                            if (currentQuoteId) {
                              await removeProductFromQuote(currentQuoteId, productId);
                              const updated = await getQuoteAdditionalProducts(currentQuoteId);
                              setQuoteAdditionalProducts(updated);
                            } else {
                              setQuoteAdditionalProducts(quoteAdditionalProducts.filter(p => p.additional_product_id !== productId));
                            }
                          }}
                          isLoading={isLoading}
                        />
                      </Disclosure.Panel>
                    </div>
                  )}
                </Disclosure>
              </div>
            )}

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
                    <Check className="h-3.5 w-3.5" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <label htmlFor="includePumpService" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Incluir Servicio de Bombeo
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <Checkbox.Root
                    id="includesVAT"
                    checked={includesVAT}
                    onCheckedChange={(checked) => setIncludesVAT(checked === true)}
                    className="h-5 w-5 rounded-md border border-gray-300 bg-white data-[state=checked]:bg-blue-600 data-[state=checked]:text-white flex items-center justify-center transition-colors"
                  >
                    <Checkbox.Indicator>
                      <Check className="h-3.5 w-3.5" />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <label htmlFor="includesVAT" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                    Incluir IVA
                  </label>
                </div>
                
                {/* IVA Auto-Approval Guidance */}
                <div className="ml-8 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-900">
                      <p className="font-medium mb-1">Umbral de Auto-Aprobación</p>
                      <p className="text-blue-700">
                        {includesVAT 
                          ? "Con IVA (requiere factura): Auto-aprobación al 8% de margen"
                          : "Sin IVA (sin factura): Auto-aprobación al 14% de margen"
                        }
                      </p>
                    </div>
                  </div>
                </div>
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
                Limpiar formulario
              </Button>
              <Button onClick={saveQuote} disabled={isLoading || isCalculatingDistance} loading={isLoading || isCalculatingDistance}>
                Enviar cotización
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

          {/* Margin Status Indicator */}
          {quoteProducts.length > 0 && (() => {
            const avgMargin = quoteProducts.reduce((sum, p) => sum + p.profitMargin, 0) / quoteProducts.length * 100;
            const threshold = includesVAT ? 8 : 14;
            const meetsThreshold = avgMargin >= threshold;
            const isClose = !meetsThreshold && avgMargin >= threshold - 2; // Within 2% of threshold
            
            return (
              <div className={`mb-4 p-4 rounded-lg border-2 ${
                meetsThreshold 
                  ? 'bg-green-50 border-green-200' 
                  : isClose 
                    ? 'bg-amber-50 border-amber-200' 
                    : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      meetsThreshold 
                        ? 'bg-green-100' 
                        : isClose 
                          ? 'bg-amber-100' 
                          : 'bg-red-100'
                    }`}>
                      {meetsThreshold ? (
                        <Check className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className={`h-5 w-5 ${isClose ? 'text-amber-600' : 'text-red-600'}`} />
                      )}
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${
                        meetsThreshold 
                          ? 'text-green-900' 
                          : isClose 
                            ? 'text-amber-900' 
                            : 'text-red-900'
                      }`}>
                        {meetsThreshold 
                          ? 'Esta cotización será auto-aprobada' 
                          : isClose 
                            ? 'Cerca del umbral de auto-aprobación' 
                            : 'Requiere aprobación manual'
                        }
                      </p>
                      <p className={`text-xs mt-0.5 ${
                        meetsThreshold 
                          ? 'text-green-700' 
                          : isClose 
                            ? 'text-amber-700' 
                            : 'text-red-700'
                      }`}>
                        Margen promedio: <span className="font-bold">{avgMargin.toFixed(1)}%</span> | 
                        Umbral requerido: <span className="font-bold">{threshold}%</span>
                        {!meetsThreshold && ` (faltan ${(threshold - avgMargin).toFixed(1)}%)`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          
          <div className="space-y-4">
            {quoteProducts.map((product, index) => (
              <div key={index} className="bg-white/60 rounded-xl p-4 border border-gray-100 shadow-sm grid grid-cols-2 xl:grid-cols-12 gap-4 items-end">
                <div className="col-span-2 xl:col-span-3">
                  <p className="font-bold text-gray-900 text-sm break-words">
                    {features.masterPricingEnabled && product.master_code ? product.master_code : product.recipe.recipe_code}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{product.recipe.placement_type === 'D' ? 'Directa' : 'Bombeado'}</p>
                </div>
                
                <div className="col-span-1 xl:col-span-1">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Volumen (m³)</label>
                  <Input 
                    type="number" 
                    value={product.volume}
                    onChange={(e) => updateProductDetails(index, { volume: parseFloat(e.target.value) || 0 })}
                    className="bg-white h-9 w-full min-w-[80px]"
                  />
                </div>
                
                <div className="col-span-2 xl:col-span-3">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Precio Base</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 min-w-[100px]">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                      <Input 
                        type="number"
                        value={product.basePrice}
                        onChange={(e) => updateProductDetails(index, { basePrice: parseFloat(e.target.value) || 0 })}
                        className="bg-white pl-5 h-9 w-full"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      onClick={() => setBreakdownDialogProductIndex(index)}
                      className="h-9 w-9 shrink-0 border-gray-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-400"
                      title="Ver desglose del precio base"
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="col-span-1 xl:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Margen (%)</label>
                  <div className="relative">
                    <Input 
                      type="number"
                      value={(product.profitMargin * 100).toFixed(2)}
                      onChange={(e) => updateProductDetails(index, { profitMargin: (parseFloat(e.target.value) || 0) / 100 })}
                      className="bg-white pr-6 h-9 w-full min-w-[80px]"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                  </div>
                </div>
                
                <div className="col-span-1 xl:col-span-2">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Precio Final</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <Input 
                      type="number"
                      value={product.finalPrice}
                      onChange={(e) => updateProductDetails(index, { finalPrice: parseFloat(e.target.value) || 0 })}
                      className="bg-white pl-5 h-9 font-bold text-green-700 w-full min-w-[80px]"
                    />
                  </div>
                </div>
                
                <div className="col-span-2 xl:col-span-1 flex justify-end xl:justify-center">
                  <button
                    type="button"
                    onClick={() => removeProductFromQuoteProducts(index)} 
                    className="inline-flex items-center justify-center h-9 w-9 bg-red-600 hover:bg-red-700 text-white rounded-lg border-0 shadow-sm shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    title="Eliminar producto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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

      {/* Base Price Breakdown Dialog */}
      {breakdownDialogProductIndex !== null && quoteProducts[breakdownDialogProductIndex] && (
        <BasePriceBreakdownDialog
          open={breakdownDialogProductIndex !== null}
          onOpenChange={(open) => {
            if (!open) setBreakdownDialogProductIndex(null);
          }}
          recipeId={quoteProducts[breakdownDialogProductIndex].recipe.id || ''}
          recipeCode={
            features.masterPricingEnabled && quoteProducts[breakdownDialogProductIndex].master_code
              ? quoteProducts[breakdownDialogProductIndex].master_code || ''
              : quoteProducts[breakdownDialogProductIndex].recipe.recipe_code
          }
          basePrice={quoteProducts[breakdownDialogProductIndex].basePrice}
          distanceInfo={distanceInfo}
        />
      )}
    </div>
  );
}