'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { addDays, format, parseISO } from 'date-fns';
import { clientService } from '@/lib/supabase/clients';
import { supabase } from '@/lib/supabase';
import orderService from '@/services/orderService';
import { EmptyTruckDetails, PumpServiceDetails } from '@/types/orders';
import SiteAccessValidation, { SiteAccessRating, SiteValidationState } from '@/components/orders/SiteAccessValidation';
import { usePlantContext } from '@/contexts/PlantContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, CheckCircle2, Circle } from 'lucide-react';
// Map preview uses a simple Google Maps embed with marker; no JS API needed

interface Client {
  id: string;
  business_name: string;
  client_code: string;
}

interface ConstructionSite {
  id: string;
  name: string;
  location: string;
}

interface Product {
  id: string;
  quoteDetailId: string;
  recipeCode: string;
  strength: number;
  placementType: string;
  maxAggregateSize: number;
  volume: number;
  unitPrice: number;
  pumpService: boolean;
  pumpPrice: number | null;
  scheduledVolume?: number;
  pumpVolume?: number;
  ageDays?: number;
  slump?: number;
  hasWaterproofing?: boolean;
}

interface AdditionalProduct {
  id: string;
  quoteAdditionalProductId: string;
  additionalProductId: string;
  name: string;
  code: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  quoteId: string;
}

interface Quote {
  id: string;
  quoteNumber: string;
  totalAmount: number;
  products: Product[];
  additionalProducts: AdditionalProduct[];
}

interface ScheduleOrderFormProps {
  preSelectedQuoteId?: string;
  preSelectedClientId?: string;
  onOrderCreated?: () => void;
}

// Utility functions for coordinates and Google Maps
export const validateCoordinates = (lat: string, lng: string): { isValid: boolean; error: string } => {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (!lat.trim() || !lng.trim()) {
    return { isValid: false, error: 'Ambas coordenadas son requeridas' };
  }

  if (isNaN(latNum) || isNaN(lngNum)) {
    return { isValid: false, error: 'Las coordenadas deben ser números válidos' };
  }

  if (latNum < -90 || latNum > 90) {
    return { isValid: false, error: 'La latitud debe estar entre -90 y 90 grados' };
  }

  if (lngNum < -180 || lngNum > 180) {
    return { isValid: false, error: 'La longitud debe estar entre -180 y 180 grados' };
  }

  return { isValid: true, error: '' };
};

export const generateGoogleMapsUrl = (lat: string, lng: string): string => {
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

const generateGoogleMapsEmbedUrl = (lat: string, lng: string): string => {
  // Note: This requires a Google Maps API key for production use
  return `https://www.google.com/maps/embed/v1/view?key=YOUR_API_KEY&center=${lat},${lng}&zoom=15`;
};

// Attempts to extract coordinates from various Google Maps URL formats or raw "lat,lng"
const parseGoogleMapsCoordinates = (input: string): { lat: string; lng: string } | null => {
  if (!input) return null;
  const trimmed = input.trim();

  // Case 1: Plain "lat,lng"
  const plainMatch = trimmed.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (plainMatch) {
    return { lat: plainMatch[1], lng: plainMatch[2] };
  }

  // If it's not a URL, stop here
  let url: URL | null = null;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const href = url.href;

  // Case 2: Pattern with @lat,lng in the path (e.g., /@19.432608,-99.133209)
  const atMatch = href.match(/@\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    return { lat: atMatch[1], lng: atMatch[2] };
  }

  // Case 2b: !3dLAT!4dLNG pattern
  const bangMatch = href.match(/!3d\s*(-?\d+(?:\.\d+)?)!4d\s*(-?\d+(?:\.\d+)?)/);
  if (bangMatch) {
    return { lat: bangMatch[1], lng: bangMatch[2] };
  }

  // Case 3: Query params that may contain "lat,lng"
  const paramsToCheck = ['q', 'query', 'll', 'center', 'daddr', 'saddr'];
  for (const key of paramsToCheck) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    const val = decodeURIComponent(value);
    const m = val.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (m) {
      return { lat: m[1], lng: m[2] };
    }
  }

  // Case 4: Some URLs put coordinates in the path separated by commas without '@'
  const loose = href.match(/(-?\d+(?:\.\d+)?)%2C(-?\d+(?:\.\d+)?)/i) || href.match(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (loose) {
    const lat = parseFloat(loose[1]);
    const lng = parseFloat(loose[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat: String(lat), lng: String(lng) };
  }

  // For short links like https://maps.app.goo.gl/ we cannot resolve redirects from the browser due to CORS.
  return null;
};

export default function ScheduleOrderForm({
  preSelectedQuoteId,
  preSelectedClientId,
  onOrderCreated
}: ScheduleOrderFormProps) {
  const router = useRouter();
  const { currentPlant } = usePlantContext();
  const tomorrow = addDays(new Date(), 1);
  
  // Step tracking
  const [currentStep, setCurrentStep] = useState(1);
  
  // Client selection
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(preSelectedClientId || '');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Construction site selection
  const [constructionSites, setConstructionSites] = useState<ConstructionSite[]>([]);
  const [selectedConstructionSiteId, setSelectedConstructionSiteId] = useState('');
  const [selectedConstructionSite, setSelectedConstructionSite] = useState<ConstructionSite | null>(null);
  
  // Quotes and products
  const [availableQuotes, setAvailableQuotes] = useState<Quote[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<{
    id: string;
    quoteDetailId: string;
    recipeCode: string;
    strength: number;
    placementType: string;
    volume: number;
    scheduledVolume: number;
    unitPrice: number;
    pumpService: boolean;
    pumpPrice: number | null;
    pumpVolume: number;
    ageDays?: number;
    slump?: number;
  }[]>([]);
  
  // Additional products
  const [selectedAdditionalProducts, setSelectedAdditionalProducts] = useState<Set<string>>(new Set());
  
  // Filtering for products
  const [strengthFilter, setStrengthFilter] = useState<number | ''>('');
  const [placementTypeFilter, setPlacementTypeFilter] = useState<string>('');
  const [slumpFilter, setSlumpFilter] = useState<number | ''>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  
  // Order details
  const [deliveryDate, setDeliveryDate] = useState<string>(format(tomorrow, 'yyyy-MM-dd'));
  const [deliveryTime, setDeliveryTime] = useState<string>('10:00');
  const [requiresInvoice, setRequiresInvoice] = useState<boolean>(false);
  const [specialRequirements, setSpecialRequirements] = useState<string>('');

  // Coordinates for delivery location
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [coordinatesError, setCoordinatesError] = useState<string>('');
  const [mapsPaste, setMapsPaste] = useState<string>('');
  const [isParsingMapsLink, setIsParsingMapsLink] = useState<boolean>(false);
  
  // Order-wide pumping service (instead of per product)
  const [hasPumpService, setHasPumpService] = useState<boolean>(false);
  const [pumpVolume, setPumpVolume] = useState<number>(0);
  const [pumpPrice, setPumpPrice] = useState<number | null>(null);
  
  // Service type detection
  const [hasConcreteProducts, setHasConcreteProducts] = useState<boolean>(false);
  const [hasStandalonePumping, setHasStandalonePumping] = useState<boolean>(false);
  const [standalonePumpingProducts, setStandalonePumpingProducts] = useState<Product[]>([]);
  const [orderType, setOrderType] = useState<'concrete' | 'pumping' | 'both'>('concrete');
  
  // Empty truck details
  const [hasEmptyTruckCharge, setHasEmptyTruckCharge] = useState<boolean>(false);
  const [emptyTruckVolume, setEmptyTruckVolume] = useState<number>(0);
  const [emptyTruckPrice, setEmptyTruckPrice] = useState<number>(0);
  
  // Form state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [invoiceSelection, setInvoiceSelection] = useState<boolean | null>(null);
  
  // Site access validation state
  const [siteAccessRating, setSiteAccessRating] = useState<SiteAccessRating | null>(null);
  const [siteValidation, setSiteValidation] = useState<SiteValidationState>({ evidence_photo_urls: [] });
  const [siteValidationShowErrors, setSiteValidationShowErrors] = useState<boolean>(false);
  
  // Load clients on component mount
  useEffect(() => {
    const loadClients = async () => {
      try {
        setIsLoading(true);
        const clients = await clientService.getAllClients();
        
        setClients(clients.map(client => ({
          id: client.id,
          business_name: client.business_name,
          client_code: client.client_code
        })));
        
        // If preSelectedClientId is provided, move to next step
        if (preSelectedClientId) {
          setSelectedClientId(preSelectedClientId);
          setCurrentStep(2);
        }
      } catch (err) {
        console.error('Error loading clients:', err);
        setError('No se pudieron cargar los clientes. Por favor, intente nuevamente.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadClients();
  }, [preSelectedClientId]);
  
  // Load construction sites when client is selected
  useEffect(() => {
    const loadConstructionSites = async () => {
      if (!selectedClientId) return;
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('construction_sites')
          .select('id, name, location')
          .eq('client_id', selectedClientId);
        
        if (error) throw error;
        
        setConstructionSites(data.map(site => ({
          id: site.id,
          name: site.name,
          location: site.location
        })));
        
        // If only one construction site exists, select it automatically
        if (data.length === 1) {
          setSelectedConstructionSiteId(data[0].id);
        }
      } catch (err) {
        console.error('Error loading construction sites:', err);
        setError('No se pudieron cargar los sitios de construcción. Por favor, intente nuevamente.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadConstructionSites();
  }, [selectedClientId]);
  
  // Load approved quotes when client and site are selected
  useEffect(() => {
        if (!selectedClientId || !selectedConstructionSiteId || !selectedConstructionSite?.name) {
          setAvailableQuotes([]); // Clear quotes if client or site changes
          setSelectedProducts([]);
          setSelectedAdditionalProducts(new Set()); // Clear selected additional products
          return;
        }
    
    const loadActiveQuote = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log(`Fetching active price for Client: ${selectedClientId}, Site: ${selectedConstructionSite.name}`);
        
        // Debug log for client ID with issue
        if (selectedClientId === '5b634624-228c-4a84-8087-425a11a07146') {
          console.log('Detected problematic client ID - applying special handling');
        }
        
        // 1. Find the active master-level product prices for this client and site (master-first)
        // IMPORTANT: Filter by plant_id to ensure we only get prices from the current plant
        let activePricesQuery = supabase
          .from('product_prices')
          .select('quote_id, id, is_active, updated_at, master_recipe_id, recipe_id, plant_id')
          .eq('client_id', selectedClientId)
          .eq('construction_site', selectedConstructionSite.name)
          .eq('is_active', true);
        
        // Add plant_id filter if currentPlant is available
        if (currentPlant?.id) {
          activePricesQuery = activePricesQuery.eq('plant_id', currentPlant.id);
        }
        
        const { data: activePrices, error: activePriceError } = await activePricesQuery
          .order('updated_at', { ascending: false });
          
        if (activePriceError) {
          console.error("Error fetching active product prices:", activePriceError);
          throw activePriceError;
        }
        
        // Debug log for active prices
        console.log('Active master-level prices fetched:', activePrices);
        
        if (!activePrices || activePrices.length === 0) {
          console.log('No active master-level prices; proceeding to check standalone pumping quotes.');
        }
        
        // Double-check that all prices are actually active
        const trulyActivePrices = activePrices.filter(price => price.is_active === true);
        console.log(`Found ${trulyActivePrices.length} truly active prices out of ${activePrices.length} returned prices`);
        
        if (trulyActivePrices.length === 0) {
          console.log('No prices with is_active=true found; relying on standalone pumping quotes if available.');
        }
        
        // 1.5. Also fetch standalone pumping service quotes directly from quote_details
        const { data: standalonePumpingQuotes, error: standalonePumpingError } = await supabase
          .from('quote_details')
          .select(`
            id,
            quote_id,
            product_id,
            volume,
            final_price,
            pump_service,
            quotes!inner(
              id,
              quote_number,
              client_id,
              construction_site,
              status
            ),
            product_prices:product_id(
              id,
              code,
              description,
              type
            )
          `)
          .eq('quotes.client_id', selectedClientId)
          .eq('quotes.construction_site', selectedConstructionSite.name)
          .eq('quotes.status', 'APPROVED')
          .eq('pump_service', true)
          .not('product_id', 'is', null)
          .is('recipe_id', null);
          
        if (standalonePumpingError) {
          console.error("Error fetching standalone pumping quotes:", standalonePumpingError);
          throw standalonePumpingError;
        }
        
        console.log('Standalone pumping service quotes:', standalonePumpingQuotes);
        
        // Create a set of standalone pumping service quote IDs
        const standalonePumpingQuoteIds = new Set(
          standalonePumpingQuotes?.map(quote => quote.quote_id) || []
        );
        console.log('Standalone pumping quote IDs:', Array.from(standalonePumpingQuoteIds));
        
        // Create a set of active quote-recipe combinations
        // This ensures we only display recipes that are active for a specific quote
        // Build active quote-master combinations from both master-level prices and
        // recipe-level prices that map to a master via recipes.master_recipe_id
        // IMPORTANT: Only include the MOST RECENT quote for each product (by updated_at)
        const activeQuoteMasterCombos = new Set<string>();

        // 1) Direct master-level prices - only keep the most recent quote per master_recipe_id
        const masterPricesMap = new Map<string, any>();
        trulyActivePrices
          .filter((price: any) => price.quote_id && price.master_recipe_id)
          .forEach((price: any) => {
            const key = price.master_recipe_id;
            // Since trulyActivePrices is already ordered by updated_at DESC, first occurrence is most recent
            if (!masterPricesMap.has(key)) {
              masterPricesMap.set(key, price);
              console.log('Adding direct master combo (most recent):', `${price.quote_id}:${price.master_recipe_id}`, `updated_at: ${price.updated_at}`);
            } else {
              console.log('Skipping older master combo:', `${price.quote_id}:${price.master_recipe_id}`, `updated_at: ${price.updated_at}`);
            }
          });
        
        // Add only the most recent quote for each master
        masterPricesMap.forEach((price: any) => {
          activeQuoteMasterCombos.add(`${price.quote_id}:${price.master_recipe_id}`);
        });

        // 2) Recipe-level prices → map to masters
        const recipeIdsNeedingMaster = Array.from(
          new Set(
            trulyActivePrices
              .filter((price: any) => price.recipe_id && !price.master_recipe_id)
              .map((price: any) => price.recipe_id)
          )
        );

        let recipeIdToMasterId: Record<string, string> = {};
        if (recipeIdsNeedingMaster.length > 0) {
          console.log('Recipe IDs needing master mapping:', recipeIdsNeedingMaster);
          const { data: recipeRows, error: recipeErr } = await supabase
            .from('recipes')
            .select('id, master_recipe_id')
            .in('id', recipeIdsNeedingMaster);
          if (recipeErr) {
            console.error('Error fetching recipes for master mapping:', recipeErr);
          } else if (recipeRows) {
            for (const r of recipeRows as any[]) {
              if (r.master_recipe_id) {
                recipeIdToMasterId[r.id] = r.master_recipe_id;
                console.log('Recipe to master mapping:', `${r.id} -> ${r.master_recipe_id}`);
              }
            }
          }
        }

        // Add combos for recipe-based prices that have a master mapping - only most recent per master
        const recipeMappedMasterPricesMap = new Map<string, any>();
        trulyActivePrices
          .filter((price: any) => price.quote_id && price.recipe_id && recipeIdToMasterId[price.recipe_id])
          .forEach((price: any) => {
            const masterId = recipeIdToMasterId[price.recipe_id];
            // Since trulyActivePrices is already ordered by updated_at DESC, first occurrence is most recent
            if (!recipeMappedMasterPricesMap.has(masterId)) {
              recipeMappedMasterPricesMap.set(masterId, price);
              console.log('Adding recipe-mapped master combo (most recent):', `${price.quote_id}:${masterId}`, `updated_at: ${price.updated_at}`);
            } else {
              console.log('Skipping older recipe-mapped master combo:', `${price.quote_id}:${masterId}`, `updated_at: ${price.updated_at}`);
            }
          });
        
        // Add only the most recent quote for each master (from recipe-mapped prices)
        recipeMappedMasterPricesMap.forEach((price: any) => {
          const masterId = recipeIdToMasterId[price.recipe_id];
          activeQuoteMasterCombos.add(`${price.quote_id}:${masterId}`);
        });

        // Build fallback quote-recipe combinations for recipes WITHOUT master linkage - only most recent per recipe
        const activeQuoteRecipeFallbackCombos = new Set<string>();
        const recipeFallbackPricesMap = new Map<string, any>();
        trulyActivePrices
          .filter((price: any) => price.quote_id && price.recipe_id && !recipeIdToMasterId[price.recipe_id] && !price.master_recipe_id)
          .forEach((price: any) => {
            const key = price.recipe_id;
            // Since trulyActivePrices is already ordered by updated_at DESC, first occurrence is most recent
            if (!recipeFallbackPricesMap.has(key)) {
              recipeFallbackPricesMap.set(key, price);
              console.log('Adding recipe fallback combo (most recent):', `${price.quote_id}:${price.recipe_id}`, `updated_at: ${price.updated_at}`);
            } else {
              console.log('Skipping older recipe fallback combo:', `${price.quote_id}:${price.recipe_id}`, `updated_at: ${price.updated_at}`);
            }
          });
        
        // Add only the most recent quote for each recipe (fallback)
        recipeFallbackPricesMap.forEach((price: any) => {
          activeQuoteRecipeFallbackCombos.add(`${price.quote_id}:${price.recipe_id}`);
        });

        console.log('Active quote-master combinations:', Array.from(activeQuoteMasterCombos));
        console.log('Active quote-recipe FALLBACK combinations:', Array.from(activeQuoteRecipeFallbackCombos));
        
        // Get unique quote IDs from the most recent prices only (not all active prices)
        const mostRecentQuoteIds = new Set<string>();
        masterPricesMap.forEach((price: any) => mostRecentQuoteIds.add(price.quote_id));
        recipeMappedMasterPricesMap.forEach((price: any) => mostRecentQuoteIds.add(price.quote_id));
        recipeFallbackPricesMap.forEach((price: any) => mostRecentQuoteIds.add(price.quote_id));
        
        const standalonePumpingQuoteIdsArray = Array.from(standalonePumpingQuoteIds);
        const uniqueQuoteIds = Array.from(new Set([...Array.from(mostRecentQuoteIds), ...standalonePumpingQuoteIdsArray])).filter(Boolean);
        console.log('Most recent quote IDs from filtered prices:', Array.from(mostRecentQuoteIds));
        console.log('Standalone pumping quote IDs:', standalonePumpingQuoteIdsArray);
        console.log('All unique quote IDs (most recent only):', uniqueQuoteIds);
        
        // 1.5. Fetch additional products from most recent approved quotes for this client/site
        // Get all approved quotes for this client/site, ordered by created_at DESC
        const { data: allApprovedQuotes, error: approvedQuotesError } = await supabase
          .from('quotes')
          .select('id, quote_number, created_at')
          .eq('client_id', selectedClientId)
          .eq('construction_site', selectedConstructionSite.name)
          .eq('status', 'APPROVED')
          .order('created_at', { ascending: false });
        
        if (approvedQuotesError) {
          console.error('Error fetching approved quotes for additional products:', approvedQuotesError);
        }
        
        // Fetch additional products from these quotes, keeping only the most recent for each product
        let latestAdditionalProducts: Map<string, any> = new Map(); // key: additional_product_id, value: quote_additional_product
        
        if (allApprovedQuotes && allApprovedQuotes.length > 0) {
          const quoteIdsForAdditional = allApprovedQuotes.map(q => q.id);
          
          const { data: allAdditionalProducts, error: additionalProductsError } = await supabase
            .from('quote_additional_products')
            .select(`
              id,
              quote_id,
              additional_product_id,
              quantity,
              base_price,
              margin_percentage,
              unit_price,
              total_price,
              notes,
              additional_products (
                id,
                name,
                code,
                unit
              )
            `)
            .in('quote_id', quoteIdsForAdditional)
            .order('quote_id', { ascending: false }); // Order by quote_id to process newest quotes first
          
          if (additionalProductsError) {
            console.error('Error fetching additional products:', additionalProductsError);
          } else if (allAdditionalProducts) {
            // Process in order (newest quotes first) and keep only the first occurrence of each additional_product_id
            for (const ap of allAdditionalProducts) {
              const productId = ap.additional_product_id;
              if (!latestAdditionalProducts.has(productId)) {
                latestAdditionalProducts.set(productId, ap);
              }
            }
            console.log(`Found ${latestAdditionalProducts.size} unique additional products from ${allAdditionalProducts.length} total entries`);
          }
        }
        
        if (uniqueQuoteIds.length === 0) {
          console.log('No quotes found with active recipe prices or standalone pumping services.');
          setAvailableQuotes([]);
          setSelectedProducts([]);
          setSelectedAdditionalProducts(new Set());
          setIsLoading(false);
          return;
        }
        
        // 2. Fetch all quotes linked to active prices
        const { data: quotesData, error: quotesError } = await supabase
          .from('quotes')
          .select(`
            id,
            quote_number,
            quote_details(
              id,
              volume,
              final_price,
              pump_service,
              pump_price,
              master_recipe_id,
              recipe_id,
              product_id,
              master_recipes:master_recipe_id(
                plant_id,
                master_code,
                strength_fc,
                slump,
                age_days,
                placement_type,
                max_aggregate_size
              ),
              recipes:recipe_id(
                plant_id,
                recipe_code,
                strength_fc,
                placement_type,
                max_aggregate_size,
                age_days,
                slump,
                has_waterproofing,
                master_recipe_id,
                master_recipes:master_recipe_id(
                  plant_id,
                  master_code,
                  strength_fc,
                  slump,
                  age_days,
                  placement_type,
                  max_aggregate_size
                )
              ),
              product_prices:product_id(
                id,
                code,
                description,
                type
              )
            ),
            quote_additional_products (
              id,
              additional_product_id,
              quantity,
              base_price,
              margin_percentage,
              unit_price,
              total_price,
              additional_products (
                name,
                code,
                unit
              )
            )
          `)
          .in('id', uniqueQuoteIds)
          .eq('status', 'APPROVED'); // Ensure the linked quotes are still approved
          
        if (quotesError) {
          console.error("Error fetching the linked quotes:", quotesError);
          throw quotesError;
        }
        
        if (!quotesData || quotesData.length === 0) {
          console.log('No approved quotes found for the active prices.');
          setAvailableQuotes([]);
          setSelectedProducts([]);
          setSelectedAdditionalProducts(new Set());
          setIsLoading(false);
          return;
        }
        
        console.log('Successfully fetched linked quotes:', quotesData);
        
        // 3. Format the quotes for the form, filtering out quote details that don't have active prices
        const formattedQuotes: Quote[] = quotesData.map(quoteData => {
          // Filter quote details to include both active master-based and standalone pumping service combinations
          const activeDetails = quoteData.quote_details.filter((detail: any) => {
            // Check if this specific quote-master combination is in our active set
            let hasActiveMaster = false;
            if (detail.master_recipe_id) {
              // Check active combos first, then fall back to allowing any master_recipe_id from approved quotes
              // (this handles cases where the master price exists in the quote but not explicitly in active_prices)
              hasActiveMaster = activeQuoteMasterCombos.has(`${quoteData.id}:${detail.master_recipe_id}`) || !!detail.master_recipes;
            } else if (detail.recipe_id && detail.recipes && detail.recipes.master_recipe_id) {
              hasActiveMaster = activeQuoteMasterCombos.has(`${quoteData.id}:${detail.recipes.master_recipe_id}`);
            }
            // Check recipe-level fallback (no master linkage anywhere)
            const hasActiveRecipeFallback = detail.recipe_id && activeQuoteRecipeFallbackCombos.has(`${quoteData.id}:${detail.recipe_id}`);
            // Plant guards: only enforce plant scoping for recipe fallback items (master items are validated by active combos)
            const recipePlantOk = detail.recipes && detail.recipes.plant_id === currentPlant?.id;
            // Check if this is a standalone pumping service quote
            const isStandalonePumping = standalonePumpingQuoteIds.has(quoteData.id) && detail.product_id && !detail.recipe_id && detail.pump_service;
            return hasActiveMaster || (hasActiveRecipeFallback && recipePlantOk) || isStandalonePumping;
          });
          
          console.log(`Quote ${quoteData.quote_number}: filtered ${quoteData.quote_details.length} details to ${activeDetails.length} active details`);
          
          // Additional products are now handled separately from latest approved quotes
          // This will be populated below from latestAdditionalProducts
          const additionalProducts: AdditionalProduct[] = [];

          const formattedQuote: Quote = {
            id: quoteData.id,
            quoteNumber: quoteData.quote_number,
            totalAmount: 0, // Will be calculated below
            additionalProducts: additionalProducts,
            products: activeDetails.map((detail: any) => {
              // Handle master-based or recipe→master-mapped quote details (concrete products)
              if ((detail.master_recipe_id && detail.master_recipes) || (detail.recipes && detail.recipes.master_recipes)) {
                const masterData = (detail.master_recipes || (detail.recipes ? detail.recipes.master_recipes : null)) as {
                  master_code?: string;
                  strength_fc?: number;
                  placement_type?: string;
                  max_aggregate_size?: number;
                  age_days?: number;
                  slump?: number;
                  has_waterproofing?: boolean;
                } | null;
                return {
                  id: masterData?.master_code || 'Unknown',
                  quoteDetailId: detail.id,
                  // Reuse recipeCode field to display master_code across UI
                  recipeCode: masterData?.master_code || 'Unknown',
                  strength: masterData?.strength_fc || 0,
                  placementType: masterData?.placement_type || '',
                  maxAggregateSize: masterData?.max_aggregate_size || 0,
                  volume: detail.volume,
                  unitPrice: detail.final_price,
                  pumpService: detail.pump_service,
                  pumpPrice: detail.pump_price,
                  scheduledVolume: 0, // Initialize scheduled volume
                  pumpVolume: 0,      // Initialize pump volume
                  ageDays: masterData?.age_days || 0,
                  slump: masterData?.slump || 0,
                  hasWaterproofing: masterData?.has_waterproofing ?? undefined
                };
              }

              // Handle recipe-level FALLBACK details (no master linkage)
              if (detail.recipe_id && detail.recipes && activeQuoteRecipeFallbackCombos.has(`${quoteData.id}:${detail.recipe_id}`)) {
                const recipeData = detail.recipes as {
                  recipe_code?: string;
                  strength_fc?: number;
                  placement_type?: string;
                  max_aggregate_size?: number;
                  age_days?: number;
                  slump?: number;
                  has_waterproofing?: boolean;
                };
                return {
                  id: recipeData?.recipe_code || 'Unknown',
                  quoteDetailId: detail.id,
                  // Reuse recipeCode field for display; behaves like a master in UI
                  recipeCode: recipeData?.recipe_code || 'Unknown',
                  strength: recipeData?.strength_fc || 0,
                  placementType: recipeData?.placement_type || '',
                  maxAggregateSize: recipeData?.max_aggregate_size || 0,
                  volume: detail.volume,
                  unitPrice: detail.final_price,
                  pumpService: detail.pump_service,
                  pumpPrice: detail.pump_price,
                  scheduledVolume: 0,
                  pumpVolume: 0,
                  ageDays: recipeData?.age_days || 0,
                  slump: recipeData?.slump || 0,
                  hasWaterproofing: recipeData?.has_waterproofing ?? undefined
                };
              }
              
              // Handle product-based quote details (standalone pumping services)
              else if (detail.product_id && detail.product_prices) {
                const productData = detail.product_prices as {
                  code?: string;
                  description?: string;
                  type?: string;
                };
                return {
                  id: productData?.code || 'PUMP-SERVICE',
                  quoteDetailId: detail.id,
                  recipeCode: productData?.code || 'PUMP-SERVICE',
                  strength: 0, // No strength for pumping services
                  placementType: 'BOMBEO',
                  maxAggregateSize: 0, // No aggregate for pumping services
                  volume: detail.volume,
                  unitPrice: detail.final_price,
                  pumpService: true, // This is a pumping service
                  pumpPrice: detail.final_price, // Use final_price as pump price
                  scheduledVolume: 0, // Initialize scheduled volume
                  pumpVolume: detail.volume, // Initialize pump volume with full volume
                  ageDays: 0, // No age for pumping services
                  slump: 0 // No slump for pumping services
                };
              }
              
              // Fallback for unexpected data
              return {
                id: 'Unknown',
                quoteDetailId: detail.id,
                recipeCode: 'Unknown',
                strength: 0,
                placementType: '',
                maxAggregateSize: 0,
                volume: detail.volume,
                unitPrice: detail.final_price,
                pumpService: detail.pump_service || false,
                pumpPrice: detail.pump_price,
                scheduledVolume: 0,
                pumpVolume: 0,
                ageDays: 0,
                slump: 0
              };
            })
          };
          
          // Calculate total amount
          formattedQuote.totalAmount = formattedQuote.products.reduce(
            (sum, product) => sum + product.volume * product.unitPrice, 
            0
          );
          
          return formattedQuote;
        });
        
        // Remove any quotes that don't have any products after filtering
        const nonEmptyQuotes = formattedQuotes.filter(quote => quote.products.length > 0);
        console.log(`Filtered out ${formattedQuotes.length - nonEmptyQuotes.length} empty quotes`);
        
        // Add latest additional products to all quotes (they're shared across quotes for the client/site)
        const latestAdditionalProductsArray: AdditionalProduct[] = Array.from(latestAdditionalProducts.values()).map((ap: any) => ({
          id: ap.id,
          quoteAdditionalProductId: ap.id,
          additionalProductId: ap.additional_product_id,
          name: ap.additional_products?.name || 'Unknown',
          code: ap.additional_products?.code || 'Unknown',
          unit: ap.additional_products?.unit || 'unit',
          quantity: ap.quantity, // This is the multiplier per m³
          unitPrice: ap.unit_price,
          totalPrice: ap.total_price, // This is the quoted total, but will be recalculated based on delivered volume
          quoteId: ap.quote_id
        }));
        
        // Add additional products to all quotes (they're available for any quote from this client/site)
        nonEmptyQuotes.forEach(quote => {
          quote.additionalProducts = latestAdditionalProductsArray;
        });
        
        setAvailableQuotes(nonEmptyQuotes);
        console.log('Set available quotes:', nonEmptyQuotes);
        console.log('Latest additional products:', latestAdditionalProductsArray);
        
        // Detect service types available
        const allProducts = nonEmptyQuotes.flatMap(quote => quote.products);
        console.log('All products from quotes:', allProducts.map(p => ({ 
          code: p.recipeCode, 
          placementType: p.placementType, 
          pumpService: p.pumpService,
          quoteDetailId: p.quoteDetailId 
        })));
        
        // Deduplicate: keep only first occurrence by recipeCode (master display code)
        // This prevents showing both master and variant recipes with identical specs
        const codeDedupeMap = new Map<string, any>();
        allProducts.forEach(product => {
          // Use recipeCode (which is the master_code or recipe_code) as dedup key
          if (!codeDedupeMap.has(product.recipeCode)) {
            codeDedupeMap.set(product.recipeCode, product);
          } else {
            console.log(`Skipping duplicate recipe code: ${product.recipeCode}`);
          }
        });
        const deduplicatedProducts = Array.from(codeDedupeMap.values());
        console.log(`Deduplicated products by code: ${allProducts.length} → ${deduplicatedProducts.length}`);
        
        const concreteProducts = deduplicatedProducts.filter(p => p.placementType !== 'BOMBEO' && p.strength > 0);
        const standalonePumpingProducts = deduplicatedProducts.filter(p => p.placementType === 'BOMBEO' && p.pumpService);
        const concreteWithPumpService = deduplicatedProducts.filter(p => p.placementType !== 'BOMBEO' && p.strength > 0 && p.pumpService);
        
        console.log('Standalone pumping products filtered:', standalonePumpingProducts);
        
        // Combined pumping products (both standalone and concrete with pump service)
        const pumpingProducts = [...standalonePumpingProducts, ...concreteWithPumpService];
        
        // Remove pumping services from the main product list - they should never appear as individual products
        const filteredProducts = deduplicatedProducts.filter(p => !(p.placementType === 'BOMBEO' && p.pumpService));
        
        setHasConcreteProducts(concreteProducts.length > 0);
        setHasStandalonePumping(pumpingProducts.length > 0);
        // For pumping-only orders we should only consider true standalone pumping items
        setStandalonePumpingProducts(standalonePumpingProducts);
        
        // Determine order type based on available services
        if (concreteProducts.length > 0 && pumpingProducts.length > 0) {
          setOrderType('both');
        } else if (pumpingProducts.length > 0) {
          setOrderType('pumping');
        } else {
          setOrderType('concrete');
        }
        
        console.log('Service type detection:', {
          hasConcreteProducts: concreteProducts.length > 0,
          hasStandalonePumping: pumpingProducts.length > 0,
          orderType: concreteProducts.length > 0 && pumpingProducts.length > 0 ? 'both' : pumpingProducts.length > 0 ? 'pumping' : 'concrete',
          concreteCount: concreteProducts.length,
          standalonePumpingCount: standalonePumpingProducts.length,
          concreteWithPumpCount: concreteWithPumpService.length,
          totalPumpingCount: pumpingProducts.length,
          allProducts: allProducts.map(p => ({ code: p.recipeCode, type: p.placementType, pumpService: p.pumpService }))
        });
        
        // If preSelectedQuoteId matches any of the quotes, auto-select products (excluding pumping services)
        if (preSelectedQuoteId) {
          const selectedQuote = nonEmptyQuotes.find(quote => quote.id === preSelectedQuoteId);
          if (selectedQuote) {
            // Only auto-select concrete products, never pumping services
            const concreteProductsFromQuote = selectedQuote.products.filter(p => !(p.placementType === 'BOMBEO' && p.pumpService));
            const autoSelectedProducts = concreteProductsFromQuote.map(p => ({
              ...p,
              scheduledVolume: p.volume,
              pumpVolume: p.pumpService ? p.volume : 0
            }));
            setSelectedProducts(autoSelectedProducts);
            console.log('Auto-selected concrete products for preSelectedQuoteId:', preSelectedQuoteId, autoSelectedProducts);
          }
        }
      } catch (err) {
        console.error('Error loading active quote:', err);
        setError('No se pudo cargar la cotización activa. Verifique los precios o intente nuevamente.');
        setAvailableQuotes([]);
        setSelectedProducts([]);
        setSelectedAdditionalProducts(new Set());
      } finally {
        setIsLoading(false);
      }
    };
    
    loadActiveQuote();
    // Ensure all dependencies are included and the array size is stable
  }, [selectedClientId, selectedConstructionSiteId, selectedConstructionSite?.name, preSelectedQuoteId]);
  
  // Load pumping service pricing for client + construction site
  useEffect(() => {
    if (!selectedClientId || !selectedConstructionSite?.name) {
      setPumpPrice(null);
      return;
    }
    
    const loadPumpServicePricing = async () => {
      try {
        console.log(`Fetching pump service pricing for Client: ${selectedClientId}, Site: ${selectedConstructionSite.name}`);
        
        // PRIORITY 1: Look for standalone pumping services first (product_id IS NOT NULL, recipe_id IS NULL, master_recipe_id IS NULL)
        const { data: standalonePumpData, error: standalonePumpError } = await supabase
          .from('quote_details')
          .select(`
            pump_price,
            pump_service,
            product_id,
            recipe_id,
            master_recipe_id,
            quotes!inner(
              id,
              client_id,
              construction_site,
              status,
              created_at
            )
          `)
          .eq('pump_service', true)
          .eq('quotes.client_id', selectedClientId)
          .eq('quotes.construction_site', selectedConstructionSite.name)
          .eq('quotes.status', 'APPROVED')
          .not('product_id', 'is', null)
          .is('recipe_id', null)
          .is('master_recipe_id', null)
          .order('created_at', { ascending: false, foreignTable: 'quotes' })
          .limit(1);
          
        if (standalonePumpError) {
          console.error("Error fetching standalone pump service pricing:", standalonePumpError);
        }
        
        // PRIORITY 2: If no standalone pumping found, fall back to concrete products with pump service
        let pumpServiceData = standalonePumpData;
        if ((!standalonePumpData || standalonePumpData.length === 0) && !standalonePumpError) {
          console.log('No standalone pumping services found, checking concrete products with pump service...');
          const { data: concretePumpData, error: concretePumpError } = await supabase
            .from('quote_details')
            .select(`
              pump_price,
              pump_service,
              quotes!inner(
                id,
                client_id,
                construction_site,
                status,
                created_at
              )
            `)
            .eq('pump_service', true)
            .eq('quotes.client_id', selectedClientId)
            .eq('quotes.construction_site', selectedConstructionSite.name)
            .eq('quotes.status', 'APPROVED')
            .order('created_at', { ascending: false, foreignTable: 'quotes' })
            .limit(1);
            
          if (concretePumpError) {
            console.error("Error fetching concrete pump service pricing:", concretePumpError);
          } else {
            pumpServiceData = concretePumpData;
          }
        }
        
        console.log('Pump service data fetched:', pumpServiceData);

        // Use the most recent quote_detail with pump_service=true
        if (pumpServiceData && pumpServiceData.length > 0) {
          const firstDetailWithPrice = pumpServiceData.find((d: any) => d && d.pump_price !== null);
          if (firstDetailWithPrice) {
            const priceNumber = Number(firstDetailWithPrice.pump_price);
            setPumpPrice(priceNumber);
            console.log(`Found pump service price: $${priceNumber} for client + site combination (${standalonePumpData && standalonePumpData.length > 0 ? 'standalone' : 'concrete with pump'})`);
          } else {
            console.log('Pump service details found but without price. Allowing manual entry.');
            setPumpPrice(0);
          }
        } else {
          // Fallback: Allow manual entry for cases where no pump pricing is found
          console.log('No pump service pricing found in approved quotes for this client + site combination');
          console.log('Setting to 0 to allow manual entry.');
          setPumpPrice(0);
        }
      } catch (err) {
        console.error('Error loading pump service pricing:', err);
      }
    };
    
    loadPumpServicePricing();
  }, [selectedClientId, selectedConstructionSite?.name]);
  
  // Sync pumpPrice with standalone pumping products when available
  useEffect(() => {
    if (standalonePumpingProducts.length > 0 && orderType === 'pumping') {
      // Use price from standalone pumping product if available (more accurate than query)
      const standalonePrice = standalonePumpingProducts[0].pumpPrice || standalonePumpingProducts[0].unitPrice;
      if (standalonePrice && standalonePrice > 0) {
        console.log(`Using pump price from standalone pumping product: $${standalonePrice}`);
        setPumpPrice(standalonePrice);
      }
    }
  }, [standalonePumpingProducts, orderType]);

  // Auto-activate pump service when in pumping-only mode
  // NOTE: pumpVolume is NOT in dependencies to avoid interfering with manual checkbox clicks
  useEffect(() => {
    if (orderType === 'pumping' && pumpPrice !== null) {
      setHasPumpService(true);
      // Set default pump volume if not set (only when switching to pumping mode)
      if (pumpVolume === 0 && standalonePumpingProducts.length > 0) {
        const defaultVolume = standalonePumpingProducts[0].volume;
        setPumpVolume(defaultVolume);
      }
    }
    // DO NOT reset hasPumpService when switching to concrete mode - let user control it manually
    // Only reset pumpVolume when switching away from pumping mode
    if (orderType === 'concrete' && pumpVolume > 0 && standalonePumpingProducts.length === 0) {
      // Only reset volume if we're switching away from pumping-only mode
      // Don't reset hasPumpService - user might want to keep it for concrete orders
    }
  }, [orderType, pumpPrice, standalonePumpingProducts]);

  // Validate coordinates whenever they change
  useEffect(() => {
    if (latitude || longitude) {
      const validation = validateCoordinates(latitude, longitude);
      setCoordinatesError(validation.error);
    } else {
      setCoordinatesError('');
    }
  }, [latitude, longitude]);
  
  // Filter clients based on search query (null-safe)
  const filteredClients = clients.filter(client => {
    const name = (client.business_name || '').toLowerCase();
    const code = (client.client_code || '').toLowerCase();
    const query = (searchQuery || '').toLowerCase();
    return name.includes(query) || code.includes(query);
  });
  
  // Go to next step
  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };
  
  // Handle client selection
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedConstructionSiteId(''); // Reset site selection
    setAvailableQuotes([]); // Reset quotes
    setSelectedProducts([]); // Reset selected products
    setSelectedAdditionalProducts(new Set()); // Reset selected additional products
    nextStep();
  };
  
  // Handle construction site selection
  const handleSiteSelect = (siteId: string) => {
    setSelectedConstructionSiteId(siteId);
    const site = constructionSites.find(s => s.id === siteId);
    if (site) {
      setSelectedConstructionSite(site);
      setCurrentStep(3);
    }
  };
  
  // Handle product selection
  const handleProductSelect = (product: Product, checked: boolean) => {
    // Never allow selection of pumping services - they are handled as global services
    if (product.placementType === 'BOMBEO' && product.pumpService) {
      console.warn('Pumping services cannot be selected as individual products');
      return;
    }
    
    if (checked) {
      setSelectedProducts(prev => [
        ...prev, 
        { 
          ...product, 
          scheduledVolume: product.volume,
          pumpVolume: 0 // We no longer use this per product
        }
      ]);
    } else {
      setSelectedProducts(prev => 
        prev.filter(p => p.quoteDetailId !== product.quoteDetailId)
      );
    }
  };
  
  // Handle scheduled volume change
  const handleVolumeChange = (quoteDetailId: string, volume: number) => {
    setSelectedProducts(prev => 
      prev.map(p => 
        p.quoteDetailId === quoteDetailId 
          ? { ...p, scheduledVolume: volume } 
          : p
      )
    );
  };
  
  // Calculate total order amount
  // Get all additional products from available quotes
  const getAllAdditionalProducts = (): AdditionalProduct[] => {
    return availableQuotes.flatMap(quote => quote.additionalProducts || []);
  };

  const calculateTotalAmount = () => {
    let total = selectedProducts.reduce(
      (sum, product) => sum + product.scheduledVolume * product.unitPrice, 
      0
    );
    
    // Add order-wide pump service if enabled
    if (hasPumpService && pumpPrice) {
      total += pumpPrice * pumpVolume;
    }
    
    // Add empty truck charge if applicable
    if (hasEmptyTruckCharge) {
      total += emptyTruckVolume * emptyTruckPrice;
    }
    
    // Add selected additional products
    // Additional products are multiplied by delivered concrete volume
    // For preliminary calculation, use scheduled concrete volume
    const allAdditionalProducts = getAllAdditionalProducts();
    const totalConcreteVolume = selectedProducts.reduce((sum, p) => sum + p.scheduledVolume, 0);
    
    selectedAdditionalProducts.forEach(apId => {
      const ap = allAdditionalProducts.find(a => a.quoteAdditionalProductId === apId);
      if (ap) {
        // Multiply quantity (rate per m³) by concrete volume and unit price
        // quantity is the multiplier per m³, so: quantity * volume * unit_price
        total += ap.quantity * totalConcreteVolume * ap.unitPrice;
      }
    });
    
    return total;
  };
  
  // Update the getFilteredProducts function to include the new filters
  const getFilteredProducts = () => {
    if (!availableQuotes.length) return [];
    
    let allProducts = availableQuotes.flatMap(quote => 
      quote.products.map(product => ({
        ...product,
        quoteNumber: quote.quoteNumber,
        quoteId: quote.id
      }))
    );
    
    // Deduplicate by recipeCode - keep first occurrence (which is the master)
    const codeDedupeMap = new Map<string, any>();
    allProducts.forEach(product => {
      if (!codeDedupeMap.has(product.recipeCode)) {
        codeDedupeMap.set(product.recipeCode, product);
      }
    });
    allProducts = Array.from(codeDedupeMap.values());
    
    // Always exclude pumping services from the product list - they are handled separately as global services
    allProducts = allProducts.filter(p => !(p.placementType === 'BOMBEO' && p.pumpService));
    
    // Apply strength filter if selected
    if (strengthFilter !== '') {
      allProducts = allProducts.filter(p => p.strength === strengthFilter);
    }
    
    // Apply placement type filter if selected
    if (placementTypeFilter) {
      allProducts = allProducts.filter(p => p.placementType === placementTypeFilter);
    }

    // Apply slump filter if selected
    if (slumpFilter !== '') {
      allProducts = allProducts.filter(p => p.slump === slumpFilter);
    }

    // Apply search filter if entered
    if (searchFilter) {
      const searchTerm = searchFilter.toLowerCase();
      allProducts = allProducts.filter(p => 
        p.recipeCode.toLowerCase().includes(searchTerm) ||
        p.placementType.toLowerCase().includes(searchTerm) ||
        `${p.strength}`.includes(searchTerm)
      );
    }
    
    return allProducts;
  };
  
  // Handle order creation
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    // Only require selected products when NOT in pumping-only mode
    if (selectedProducts.length === 0 && orderType !== 'pumping') {
      setError('Debe seleccionar al menos un producto para crear la orden');
      return;
    }

    // For pumping-only mode, require pump service to be active
    if (orderType === 'pumping' && !hasPumpService) {
      setError('El servicio de bombeo debe estar activo para crear una orden de solo bombeo');
      return;
    }

    // Validate pump service: if enabled, must have valid price and volume
    if (hasPumpService && (pumpPrice === null || pumpPrice <= 0)) {
      setError('Debe ingresar un precio válido para el servicio de bombeo');
      return;
    }

    if (hasPumpService && pumpVolume <= 0) {
      setError('Debe ingresar un volumen válido para el servicio de bombeo');
      return;
    }

    if (invoiceSelection === null) {
      setError('Debe seleccionar si la orden requiere factura o no');
      return;
    }

    // Validate coordinates are required and valid
    const coordinateValidation = validateCoordinates(latitude, longitude);
    if (!coordinateValidation.isValid) {
      setError(coordinateValidation.error);
      return;
    }
    
    if (!currentPlant?.id) {
      setError('No se pudo determinar la planta. Por favor, asegúrese de estar en el contexto correcto.');
      return;
    }
    
    // Validate site access rating rules
    if (!siteAccessRating) {
      setSiteValidationShowErrors(true);
      setError('Seleccione una validación de acceso a obra (Verde/Amarillo/Rojo)');
      return;
    }

    if (siteAccessRating === 'yellow') {
      const v = siteValidation;
      if (!v.road_type || !v.road_slope || !v.recent_weather_impact || !v.route_incident_history || (v.evidence_photo_urls || []).length < 2) {
        setSiteValidationShowErrors(true);
        setError('Complete la validación de acceso (checklist y 2–3 fotos)');
        return;
      }
    }

    if (siteAccessRating === 'red') {
      const v = siteValidation;
      if (!v.road_slope || (v.road_slope !== 'moderate' && v.road_slope !== 'steep') || !v.recent_weather_impact || !v.route_incident_history || (v.evidence_photo_urls || []).length < 2) {
        setSiteValidationShowErrors(true);
        setError('Complete la validación roja (pendiente, clima, historial y 2–3 fotos)');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      // Get the quote ID
      let quoteId: string | undefined;
      
      if (orderType === 'pumping') {
        // For pumping-only mode, we need to find any quote with pump service
        // This could be either standalone pumping products OR concrete with pump service
        if (standalonePumpingProducts.length > 0) {
          // PRIORITY: Query quote_details directly using quoteDetailId to get quote_id (most reliable)
          try {
            const { data: quoteDetail, error: quoteDetailError } = await supabase
              .from('quote_details')
              .select('quote_id')
              .eq('id', standalonePumpingProducts[0].quoteDetailId)
              .single();
            
            if (!quoteDetailError && quoteDetail) {
              quoteId = quoteDetail.quote_id;
              console.log(`Found quote ID from standalone pumping product: ${quoteId}`);
            } else {
              console.warn('Failed to get quote_id from quote_details, falling back to availableQuotes search');
              // Fallback: Find the quote that contains this standalone pumping product
              quoteId = availableQuotes.find(q => 
                q.products.some(p => p.quoteDetailId === standalonePumpingProducts[0].quoteDetailId)
              )?.id;
            }
          } catch (err) {
            console.error('Error querying quote_details for quote_id:', err);
            // Fallback: Find the quote that contains this standalone pumping product
            quoteId = availableQuotes.find(q => 
              q.products.some(p => p.quoteDetailId === standalonePumpingProducts[0].quoteDetailId)
            )?.id;
          }
        } else if (availableQuotes.length > 0) {
          // If no standalone pumping products, use the first quote with pump service
          // (this handles the case where concrete products have pump service)
          const quoteWithPump = availableQuotes.find(q => 
            q.products.some(p => p.pumpService === true)
          );
          quoteId = quoteWithPump?.id;
        }
      } else {
        // For normal mode, get quote from selected products
        quoteId = availableQuotes.find(q => 
          q.products.some(p => p.quoteDetailId === selectedProducts[0].quoteDetailId)
        )?.id;
      }
      
      if (!quoteId) {
        console.error('Failed to determine quote ID:', {
          orderType,
          availableQuotes,
          standalonePumpingProducts,
          selectedProducts
        });
        throw new Error('No se pudo determinar la cotización');
      }
      
      // Get the construction site
      const selectedSite = constructionSites.find(site => site.id === selectedConstructionSiteId);
      if (!selectedSite) {
        throw new Error('No se pudo determinar el sitio de construcción');
      }
      
      // Check if this is a standalone pumping service order
      const isStandalonePumpingOrder = orderType === 'pumping';
      
      // Prepare order data
      const orderData = {
        quote_id: quoteId,
        client_id: selectedClientId,
        construction_site: selectedSite.name,
        construction_site_id: selectedConstructionSiteId,
        plant_id: currentPlant?.id,
        delivery_date: deliveryDate,
        delivery_time: deliveryTime,
        requires_invoice: requiresInvoice,
        special_requirements: specialRequirements || null,
        total_amount: calculateTotalAmount(),
        order_status: 'created',
        credit_status: 'pending',
        // Add delivery coordinates
        delivery_latitude: parseFloat(latitude),
        delivery_longitude: parseFloat(longitude),
        // Add Google Maps URL for convenience
        delivery_google_maps_url: generateGoogleMapsUrl(latitude, longitude),
        // Add selected products with volumes
        // For pumping-only orders with no standalone pumping products, pass empty array
        // The pump service will be handled by pumpServiceData below
        order_items: orderType === 'pumping'
          ? (standalonePumpingProducts.length > 0 
              ? standalonePumpingProducts.map(p => ({
                  quote_detail_id: p.quoteDetailId,
                  volume: pumpVolume // Use the pump volume from the form
                }))
              : [] // Empty array for pumping-only orders without standalone pumping products
            )
          : selectedProducts.map(p => ({
              quote_detail_id: p.quoteDetailId,
              volume: p.scheduledVolume
            })),
        // Add selected additional product IDs
        selected_additional_product_ids: Array.from(selectedAdditionalProducts)
      };
      
      // Prepare pump service data separately
      // This applies to:
      // 1. Traditional concrete orders with pump service (orderType !== 'pumping' AND hasPumpService)
      // 2. Pumping-only orders WITHOUT standalone pumping products (orderType === 'pumping' AND standalonePumpingProducts.length === 0)
      // DO NOT create pumpServiceData when standalone pumping products exist in order_items (they're already handled there)
      let pumpServiceData: PumpServiceDetails | null = null;
      const hasStandalonePumpingInItems = orderType === 'pumping' && standalonePumpingProducts.length > 0;
      if (hasPumpService && pumpVolume > 0 && pumpPrice !== null && !hasStandalonePumpingInItems) {
        pumpServiceData = {
          volume: pumpVolume,
          unit_price: pumpPrice,
          total_price: pumpPrice * pumpVolume
        };
      }
      
      // Prepare empty truck data if applicable
      let emptyTruckData: EmptyTruckDetails | null = null;
      if (hasEmptyTruckCharge) {
        emptyTruckData = {
          hasEmptyTruckCharge,
          emptyTruckVolume,
          emptyTruckPrice
        };
      }
      
      // Create order
      // Attach site access info
      const orderDataWithAccess: any = {
        ...orderData,
        site_access_rating: siteAccessRating,
        site_validation: siteAccessRating !== 'green' ? {
          ...siteValidation,
          // Ensure road_type for red
          road_type: siteAccessRating === 'red' ? 'gravel_rough' : siteValidation.road_type,
        } : undefined
      };

      const result = await orderService.createOrder(orderDataWithAccess, emptyTruckData, pumpServiceData);
      
      console.log('Order created successfully:', result);
      
      // Show success message
      alert('¡Orden creada con éxito!');
      
      // Call onOrderCreated callback if provided
      if (onOrderCreated) {
        onOrderCreated();
      } else {
        // Redirect to orders page
        router.push('/orders');
      }
    } catch (err) {
      console.error('Error creating order:', err);
      setError('Error al crear la orden. Por favor, intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Render client selection step
  const renderClientSelection = () => (
    <div className="bg-white rounded-lg border shadow-xs p-6">
      <h2 className="text-xl font-semibold mb-4">Seleccionar Cliente</h2>
      
      {/* Search bar */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o código de cliente..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md pl-10 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.length > 0 ? (
            filteredClients.map(client => (
              <div 
                key={client.id}
                onClick={() => handleClientSelect(client.id)}
                className="border rounded-lg p-4 cursor-pointer hover:bg-green-50 hover:border-green-500 transition-colors"
              >
                <h3 className="font-medium">{client.business_name}</h3>
                <p className="text-sm text-gray-600">Código: {client.client_code}</p>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-4">
              <p className="text-gray-500">No se encontraron clientes con ese criterio de búsqueda</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
  
  // Render construction site selection step
  const renderSiteSelection = () => (
    <div className="bg-white rounded-lg border shadow-xs p-6">
      <h2 className="text-xl font-semibold mb-4">Seleccionar Obra</h2>
      
      <div className="mb-4">
        <p className="text-gray-600">
          Cliente: {clients.find(c => c.id === selectedClientId)?.business_name}
        </p>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
        </div>
      ) : constructionSites.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-gray-600 mb-4">
            No hay obras registradas para este cliente.
          </p>
          <button
            onClick={() => setCurrentStep(1)}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-xs text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Seleccionar otro cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {constructionSites.map(site => (
            <div 
              key={site.id}
              onClick={() => handleSiteSelect(site.id)}
              className="border rounded-lg p-4 cursor-pointer hover:bg-green-50 hover:border-green-500 transition-colors"
            >
              <h3 className="font-medium">{site.name}</h3>
              <p className="text-sm text-gray-600">{site.location}</p>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-6">
        <button
          onClick={() => setCurrentStep(1)}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-xs text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Atrás
        </button>
      </div>
    </div>
  );
  
  // Render product selection and order details step
  const renderOrderDetails = () => (
    <div className="bg-white rounded-lg border shadow-xs p-6">
      <h2 className="text-xl font-semibold mb-4">Crear Orden</h2>
      
      <div className="space-y-6">
        <h3 className="text-xl font-semibold">Seleccione los productos para el pedido</h3>
        
        <div className="mb-4">
          <p className="text-gray-600">
            Cliente: {clients.find(c => c.id === selectedClientId)?.business_name}
          </p>
          <p className="text-gray-600">
            Obra: {constructionSites.find(s => s.id === selectedConstructionSiteId)?.name}
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-md mb-4">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
          </div>
        ) : (
        <form onSubmit={handleCreateOrder} className="space-y-6">
          {/* Invoice requirement - Made mandatory with radio buttons */}
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg shadow-sm">
            <h4 className="text-base font-bold text-gray-800 mb-3">¿Requiere Factura?</h4>
            <div className="flex gap-6">
              <div className="flex items-center">
                <input
                  id="requiresInvoiceYes"
                  name="requiresInvoice"
                  type="radio"
                  value="yes"
                  checked={invoiceSelection === true}
                  onChange={(e) => {
                    setInvoiceSelection(true);
                    setRequiresInvoice(true);
                  }}
                  className="h-5 w-5 text-green-600 border-gray-300 focus:ring-green-500"
                />
                <label htmlFor="requiresInvoiceYes" className="ml-2 block text-base font-medium text-gray-800">
                  Sí
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="requiresInvoiceNo"
                  name="requiresInvoice"
                  type="radio"
                  value="no"
                  checked={invoiceSelection === false}
                  onChange={(e) => {
                    setInvoiceSelection(false);
                    setRequiresInvoice(false);
                  }}
                  className="h-5 w-5 text-green-600 border-gray-300 focus:ring-green-500"
                />
                <label htmlFor="requiresInvoiceNo" className="ml-2 block text-base font-medium text-gray-800">
                  No
                </label>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              <span className="text-red-600 font-medium">Obligatorio:</span> Esta selección afectará el balance del cliente y es requerida para crear la orden.
            </p>
          </div>

          {/* Pumping-Only Toggle - Show when client has both concrete and pumping services */}
          {hasConcreteProducts && hasStandalonePumping && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-gray-800">Solo Bombeo</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Crear una orden únicamente de servicio de bombeo
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={orderType === 'pumping'}
                    onChange={(e) => {
                      setOrderType(e.target.checked ? 'pumping' : 'concrete');
                      setSelectedProducts([]); // Clear selection when switching
                      setSelectedAdditionalProducts(new Set()); // Clear additional products when switching
                      // Reset pump service when switching back to concrete mode
                      if (!e.target.checked) {
                        setHasPumpService(false);
                        setPumpVolume(0);
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>
            </div>
          )}



          {/* Product filtering options */}
          {availableQuotes.length > 0 && orderType !== 'pumping' && (
            <div className="space-y-3 mb-4">
              <h4 className="font-medium text-gray-700">Filtrar productos</h4>
              
              <div className="flex flex-wrap gap-2">
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Buscar productos..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md pl-10 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  onChange={(e) => {
                    setStrengthFilter(e.target.value ? Number(e.target.value) : '');
                  }}
                  value={strengthFilter}
                >
                  <option value="">Resistencia (kg/cm²)</option>
                  {Array.from(new Set(availableQuotes.flatMap(q => q.products.map(p => p.strength))))
                    .sort((a, b) => a - b)
                    .map(strength => (
                      <option key={strength} value={strength}>{strength} kg/cm²</option>
                    ))
                  }
                </select>
                
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  onChange={(e) => {
                    setSlumpFilter(e.target.value ? Number(e.target.value) : '');
                  }}
                  value={slumpFilter}
                >
                  <option value="">Revenimiento (cm)</option>
                  {Array.from(new Set(availableQuotes.flatMap(q => q.products.map(p => p.slump))))
                    .filter(slump => slump !== undefined && slump !== null)
                    .sort((a, b) => a - b)
                    .map(slump => (
                      <option key={slump} value={slump}>{slump} cm</option>
                    ))
                  }
                </select>
                
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  onChange={(e) => {
                    setPlacementTypeFilter(e.target.value);
                  }}
                  value={placementTypeFilter}
                >
                  <option value="">Tipo de colocación</option>
                  {Array.from(new Set(availableQuotes.flatMap(q => q.products.map(p => p.placementType))))
                    .filter(Boolean)
                    .map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))
                  }
                </select>
                
                {(strengthFilter !== '' || placementTypeFilter || slumpFilter !== '' || searchFilter) && (
                  <button
                    onClick={() => {
                      setStrengthFilter('');
                      setPlacementTypeFilter('');
                      setSlumpFilter('');
                      setSearchFilter('');
                    }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
              
              <div className="text-sm text-gray-600">
                {getFilteredProducts().length} de {availableQuotes.flatMap(q => q.products).length} productos mostrados
              </div>
            </div>
          )}

          {/* Product selection table - redesigned for better readability and mobile responsiveness */}
          {/* Only show when not in pumping-only mode */}
          {orderType !== 'pumping' && (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Seleccionar
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resistencia
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenimiento
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Edad
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TMA
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Volumen
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio
                  </th>
                </tr>
              </thead>
              <tbody>
                {getFilteredProducts().length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-4 text-center text-sm text-gray-500">
                      {availableQuotes.length === 0 
                        ? "No hay cotizaciones activas disponibles para este cliente y sitio de construcción."
                        : "No hay productos que coincidan con los filtros seleccionados."}
                    </td>
                  </tr>
                ) : (
                  getFilteredProducts().map((product) => {
                    const isSelected = selectedProducts.some(p => p.quoteDetailId === product.quoteDetailId);
                    const selectedProduct = selectedProducts.find(p => p.quoteDetailId === product.quoteDetailId);
                    
                    return (
                      <tr key={`${product.quoteId}-${product.quoteDetailId}-desktop`} className={`border-t ${isSelected ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-3 py-2">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => handleProductSelect(product, e.target.checked)}
                            className="h-4 w-4 text-green-600 rounded border-gray-300"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">{product.strength} kg/cm²</td>
                        <td className="px-3 py-2">{product.slump || 'N/A'} cm</td>
                        <td className="px-3 py-2">{product.ageDays || 'N/A'} días</td>
                        <td className="px-3 py-2">{product.placementType}</td>
                        <td className="px-3 py-2">{product.maxAggregateSize} mm</td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-gray-500">
                            {product.recipeCode}<br/>
                            <span className="text-xs">({product.quoteNumber})</span>
                          </span>
                          <div className="mt-1">
                            {product.hasWaterproofing ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">Impermeabilizante</span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-200">Sin imperm.</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {isSelected ? (
                            <input 
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={selectedProduct?.scheduledVolume || 0}
                              onChange={(e) => handleVolumeChange(product.quoteDetailId, parseFloat(e.target.value))}
                              className="w-20 rounded-md border border-gray-300 px-2 py-1"
                            />
                          ) : (
                            <span>{product.volume} m³</span>
                          )}
                        </td>
                        <td className="px-3 py-2">${product.unitPrice.toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="sm:hidden space-y-3">
            {getFilteredProducts().length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                {availableQuotes.length === 0 
                  ? "No hay cotizaciones activas disponibles para este cliente y sitio de construcción."
                  : "No hay productos que coincidan con los filtros seleccionados."}
              </div>
            ) : (
              getFilteredProducts().map((product) => {
                const isSelected = selectedProducts.some(p => p.quoteDetailId === product.quoteDetailId);
                const selectedProduct = selectedProducts.find(p => p.quoteDetailId === product.quoteDetailId);

                return (
                  <div 
                    key={`${product.quoteId}-${product.quoteDetailId}-mobile`}
                    onClick={() => handleProductSelect(product, !isSelected)} 
                    className={`border rounded-lg p-4 cursor-pointer transition-all duration-150 ease-in-out ${isSelected ? 'bg-green-50 border-green-400 shadow-lg ring-2 ring-green-500' : 'bg-white border-gray-200 hover:shadow-md'}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-grow">
                        <h4 className="font-semibold text-lg text-gray-800">{product.recipeCode}</h4>
                        <p className="text-xs text-gray-500">Cotización: {product.quoteNumber}</p>
                      </div>
                      {/* Visual indicator for selection, can be enhanced */}
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-3 ${isSelected ? 'bg-green-500' : 'border-2 border-gray-300'}`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-x-3 gap-y-3 text-sm mb-3">
                      <div className="p-2 rounded-md bg-gray-50 text-center">
                        <span className="block text-xs text-gray-500">Resistencia</span> 
                        <span className="block font-bold text-base text-gray-700">{product.strength}</span>
                        <span className="block text-xs text-gray-500">kg/cm²</span>
                      </div>
                      <div className="p-2 rounded-md bg-gray-50 text-center">
                        <span className="block text-xs text-gray-500">Revenimiento</span> 
                        <span className="block font-bold text-base text-gray-700">{product.slump || 'N/A'}</span>
                        <span className="block text-xs text-gray-500">cm</span>
                      </div>
                      <div className="p-2 rounded-md bg-gray-50 text-center">
                        <span className="block text-xs text-gray-500">Edad</span> 
                        <span className="block font-bold text-base text-gray-700">{product.ageDays || 'N/A'}</span>
                        <span className="block text-xs text-gray-500">días</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t pt-2 mt-2">
                      <div><span className="font-medium text-gray-500">Tipo:</span> <span className="text-gray-700">{product.placementType}</span></div>
                      <div><span className="font-medium text-gray-500">TMA:</span> <span className="text-gray-700">{product.maxAggregateSize} mm</span></div>
                      <div>
                        <span className="font-medium text-gray-500">Impermeabilizante:</span>{' '}
                        {product.hasWaterproofing ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">Sí</span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-200">No</span>
                        )}
                      </div>
                      <div className="col-span-2"><span className="font-medium text-gray-500">Precio Unitario:</span> <span className="font-semibold text-gray-700">${product.unitPrice.toFixed(2)}</span></div>
                    </div>

                    {isSelected && (
                      <div className="mt-4 border-t pt-3">
                        <label htmlFor={`volume-${product.quoteDetailId}-mobile`} className="block text-sm font-medium text-gray-700 mb-1">
                          Volumen a Programar (m³)
                        </label>
                        <input 
                          id={`volume-${product.quoteDetailId}-mobile`}
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={selectedProduct?.scheduledVolume || 0}
                          onChange={(e) => {
                            e.stopPropagation(); // Prevent card click when interacting with input
                            handleVolumeChange(product.quoteDetailId, parseFloat(e.target.value));
                          }}
                          onClick={(e) => e.stopPropagation()} // Prevent card click when interacting with input
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
                        />
                      </div>
                    )}
                    {!isSelected && (
                       <p className="mt-3 text-sm text-gray-600"><span className="font-medium">Volumen Cotizado:</span> {product.volume} m³</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
            </>
          )}

          {/* Pumping Service - available globally for client + construction site */}
          {/* Show this section when: 1) Normal mode with selected products, OR 2) Pumping-only mode */}
          {/* Always show when products are selected (pumpPrice can be null/0 for manual entry) or in pumping-only mode */}
          {((selectedProducts.length > 0 && orderType !== 'pumping') || (orderType === 'pumping')) && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-4">
              <div className="flex items-center mb-3">
                <input 
                  id="hasPumpService"
                  type="checkbox"
                  checked={orderType === 'pumping' ? true : hasPumpService}
                  disabled={orderType === 'pumping'}
                  onChange={(e) => {
                    if (orderType !== 'pumping') {
                      const newValue = e.target.checked;
                      setHasPumpService(newValue);
                      if (newValue) {
                        // When checking: Set default pump volume to total concrete volume if not set
                        if (pumpVolume === 0) {
                          const totalVolume = selectedProducts.reduce((sum, p) => sum + p.scheduledVolume, 0);
                          if (totalVolume > 0) {
                            setPumpVolume(totalVolume);
                          }
                        }
                      } else {
                        // When unchecking: Reset pump volume to 0
                        setPumpVolume(0);
                      }
                    }
                  }}
                  className="h-5 w-5 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="hasPumpService" className="ml-2 block text-base font-medium text-gray-800">
                  Servicio de Bombeo
                </label>
              </div>
              
              {hasPumpService && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 pl-7">
                  <div>
                    <label htmlFor="pumpVolume" className="block text-sm font-medium text-gray-700 mb-1">
                      Volumen a bombear (m³)
                    </label>
                    <input 
                      id="pumpVolume"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={pumpVolume}
                      onChange={(e) => setPumpVolume(parseFloat(e.target.value))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="pumpPrice" className="block text-sm font-medium text-gray-700 mb-1">
                      Precio por m³
                    </label>
                    {pumpPrice !== null && pumpPrice > 0 ? (
                    <div className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-100 text-gray-700">
                      ${pumpPrice.toFixed(2)}
                    </div>
                    ) : (
                      <div className="space-y-2">
                        <input 
                          id="pumpPrice"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={pumpPrice !== null ? pumpPrice : ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? null : parseFloat(e.target.value) || 0;
                            setPumpPrice(value);
                          }}
                          placeholder="Ingrese precio de bombeo"
                          className="w-full rounded-md border border-yellow-400 px-3 py-2 bg-yellow-50"
                        />
                        <p className="text-xs text-amber-600">
                          ⚠️ No se encontró precio de bombeo para este cliente/sitio. Ingrese manualmente.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <p className="text-xs text-gray-600 mt-2">
                {pumpPrice > 0 
                  ? "El servicio de bombeo se cobra globalmente para este cliente y sitio de construcción"
                  : "Precio manual requerido - no hay cotizaciones con bombeo para este cliente/sitio"}
              </p>
            </div>
          )}

          {/* Empty truck charge option - only show if products are selected */}
          {selectedProducts.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg border mt-4">
              <div className="flex items-center mb-3">
                <input 
                  id="emptyTruckCharge"
                  type="checkbox"
                  checked={hasEmptyTruckCharge}
                  onChange={(e) => setHasEmptyTruckCharge(e.target.checked)}
                  className="h-4 w-4 text-green-600 rounded border-gray-300"
                />
                <label htmlFor="emptyTruckCharge" className="ml-2 block text-sm font-medium text-gray-700">
                  Agregar cargo por vacío de olla
                </label>
              </div>
              
              {hasEmptyTruckCharge && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <label htmlFor="emptyTruckVolume" className="block text-sm font-medium text-gray-700 mb-1">
                      Volumen a cobrar (m³)
                    </label>
                    <input 
                      id="emptyTruckVolume"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={emptyTruckVolume}
                      onChange={(e) => setEmptyTruckVolume(parseFloat(e.target.value))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="emptyTruckPrice" className="block text-sm font-medium text-gray-700 mb-1">
                      Precio por m³
                    </label>
                    <input 
                      id="emptyTruckPrice"
                      type="number"
                      min="0"
                      step="1"
                      value={emptyTruckPrice}
                      onChange={(e) => setEmptyTruckPrice(parseFloat(e.target.value))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Additional Products Section */}
          {getAllAdditionalProducts().length > 0 && (
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 mt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Productos Adicionales</h3>
              <p className="text-sm text-gray-600 mb-4">
                Seleccione los productos adicionales que desea incluir en esta orden. Estos productos se multiplicarán por los metros cúbicos de concreto entregados.
              </p>
              
              <div className="mb-3 p-2 bg-purple-100 rounded-md">
                <p className="text-xs text-purple-800">
                  <strong>Nota:</strong> El cálculo final se realizará multiplicando la cantidad por los m³ de concreto entregados. 
                  El total mostrado aquí es una estimación basada en el volumen programado.
                </p>
              </div>
              
              <div className="space-y-3">
                {getAllAdditionalProducts().map((ap) => {
                  const isSelected = selectedAdditionalProducts.has(ap.quoteAdditionalProductId);
                  const totalConcreteVolume = selectedProducts.reduce((sum, p) => sum + p.scheduledVolume, 0);
                  const estimatedTotal = isSelected ? ap.quantity * totalConcreteVolume * ap.unitPrice : 0;
                  
                  return (
                    <div
                      key={ap.quoteAdditionalProductId}
                      className={`flex items-center justify-between p-3 rounded-md border ${
                        isSelected ? 'bg-purple-100 border-purple-400' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const newSelected = new Set(selectedAdditionalProducts);
                            if (e.target.checked) {
                              newSelected.add(ap.quoteAdditionalProductId);
                            } else {
                              newSelected.delete(ap.quoteAdditionalProductId);
                            }
                            setSelectedAdditionalProducts(newSelected);
                          }}
                          className="h-5 w-5 text-purple-600 rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-800">{ap.name}</span>
                            <span className="text-xs text-gray-500">({ap.code})</span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Cantidad por m³:</span> {ap.quantity} {ap.unit} • 
                            <span className="font-medium ml-2">Precio unitario:</span> ${ap.unitPrice.toFixed(2)}
                          </div>
                          {isSelected && totalConcreteVolume > 0 && (
                            <div className="text-sm text-purple-700 mt-1 font-medium">
                              Estimado: {ap.quantity} × {totalConcreteVolume.toFixed(2)} m³ × ${ap.unitPrice.toFixed(2)} = ${estimatedTotal.toFixed(2)}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            Precio más reciente de cotización: {availableQuotes.find(q => q.id === ap.quoteId)?.quoteNumber || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {selectedAdditionalProducts.size > 0 && (
                <div className="mt-4 pt-3 border-t border-purple-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      Total productos adicionales (estimado basado en volumen programado):
                    </span>
                    <span className="text-lg font-semibold text-purple-700">
                      ${Array.from(selectedAdditionalProducts).reduce((sum, apId) => {
                        const ap = getAllAdditionalProducts().find(a => a.quoteAdditionalProductId === apId);
                        const totalConcreteVolume = selectedProducts.reduce((s, p) => s + p.scheduledVolume, 0);
                        return sum + (ap ? ap.quantity * totalConcreteVolume * ap.unitPrice : 0);
                      }, 0).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    El cálculo final se realizará con los m³ de concreto realmente entregados.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Delivery information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-3">Información de Entrega</h3>

              <div className="space-y-4">
                {/* Paste Google Maps link or "lat,lng" */}
                <div>
                  <label htmlFor="mapsPaste" className="block text-sm font-medium text-gray-700 mb-1">
                    Pegar enlace de Google Maps o "lat,lng"
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="mapsPaste"
                      type="text"
                      value={mapsPaste}
                      onChange={(e) => setMapsPaste(e.target.value)}
                      placeholder="Ej: https://maps.app.goo.gl/jLGe1St2kHpfrGRYA?g_st=ipc o 19.432608,-99.133209"
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setIsParsingMapsLink(true);
                        try {
                          // Try direct parse first (works for most g.co/maps, www.google.com/maps, maps.app.goo.gl patterns)
                          const parsed = parseGoogleMapsCoordinates(mapsPaste);
                          if (parsed) {
                            setLatitude(parsed.lat);
                            setLongitude(parsed.lng);
                            setCoordinatesError('');
                            return;
                          }

                          // Server-side expansion via Supabase Edge Function to avoid CORS
                          if (/^https?:\/\/(maps\.app\.goo\.gl|g\.co|goo\.gl)\//i.test(mapsPaste)) {
                            try {
                              const { data, error } = await supabase.functions.invoke('maps-url-parser', {
                                body: { url: mapsPaste }
                              });
                              if (!error && data) {
                                const { lat, lng, finalUrl } = data as any;
                                if (lat && lng) {
                                  setLatitude(String(lat));
                                  setLongitude(String(lng));
                                  setCoordinatesError('');
                                  return;
                                }
                                // Try parsing finalUrl if coords not present in payload
                                const parsed3 = parseGoogleMapsCoordinates(finalUrl);
                                if (parsed3) {
                                  setLatitude(parsed3.lat);
                                  setLongitude(parsed3.lng);
                                  setCoordinatesError('');
                                  return;
                                }
                              } else if (error?.message?.includes('Missing authorization header') || error?.message?.includes('401')) {
                                // Auth issue - fall back to client-side parsing immediately
                                console.log('Edge Function auth issue, falling back to client parsing');
                              }
                            } catch (e) {
                              // Any error (auth, network, etc.) - fall back to client-side parsing
                              console.log('Edge Function error, falling back to client parsing:', e);
                            }
                          }

                          setCoordinatesError('No se pudieron extraer coordenadas del enlace. Pegue cualquier enlace de Google Maps o "lat,lng" (ej. 19.432608,-99.133209).');
                        } finally {
                          setIsParsingMapsLink(false);
                        }
                      }}
                      disabled={isParsingMapsLink || !mapsPaste}
                      className={`px-3 py-2 rounded-md text-white ${isParsingMapsLink ? 'bg-gray-400 cursor-wait' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                      {isParsingMapsLink ? 'Procesando…' : 'Usar'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Pega cualquier enlace de Google Maps (incluye <a href="https://maps.app.goo.gl/jLGe1St2kHpfrGRYA?g_st=ipc" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">maps.app.goo.gl</a>) o lat,lng. Procesamiento automático para enlaces cortos.
                  </p>
                  {/* Fallback guidance when short links cannot be expanded automatically */}
                  <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-md p-2">
                    <p className="text-xs text-yellow-800">
                      Si el enlace corto no se puede procesar automáticamente:
                    </p>
                    <ol className="mt-1 list-decimal pl-5 text-xs text-yellow-800 space-y-0.5">
                      <li>Toca el enlace para abrirlo en el navegador del teléfono.</li>
                      <li>En la barra de direcciones, copia la URL completa (debe iniciar con www.google.com/maps...)</li>
                      <li>Pégala aquí y presiona "Usar".</li>
                    </ol>
                  </div>
                </div>
                {/* Site Access Validation Step */}
                <div className="mt-2">
                  <SiteAccessValidation
                    rating={siteAccessRating}
                    onChangeRating={(r) => {
                      setSiteAccessRating(r);
                      // Auto-fill for red handled in child, but ensure local state exists
                      if (r === 'red') {
                        setSiteValidation(prev => ({ ...prev, road_type: 'gravel_rough' }));
                      }
                    }}
                    value={siteValidation}
                    onChange={(v) => setSiteValidation(v)}
                    showErrors={siteValidationShowErrors}
                  />
                </div>

                {/* Delivery date/time now after validation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label htmlFor="deliveryDate" className="block text-sm font-medium mb-1">
                      Fecha de Entrega
                    </label>
                    <input
                      id="deliveryDate"
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      min=""
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>

                  <div>
                    <label htmlFor="deliveryTime" className="block text-sm font-medium mb-1">
                      Hora de Entrega
                    </label>
                    <input
                      id="deliveryTime"
                      type="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Coordinates section */}
            <div>
              <h3 className="font-medium mb-3">Ubicación de Entrega</h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="latitude" className="block text-sm font-medium mb-1">
                      Latitud *
                    </label>
                    <input
                      id="latitude"
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="-12.0464"
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>

                  <div>
                    <label htmlFor="longitude" className="block text-sm font-medium mb-1">
                      Longitud *
                    </label>
                    <input
                      id="longitude"
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="-77.0428"
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                </div>

                {coordinatesError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-md text-sm">
                    {coordinatesError}
                  </div>
                )}

                {latitude && longitude && !coordinatesError && (
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 p-3 rounded-md">
                      <p className="text-sm text-green-700 font-medium">✓ Coordenadas válidas</p>
                      <p className="text-xs text-green-600 mt-1">
                        Lat: {latitude}, Lng: {longitude}
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                      <p className="text-sm font-medium text-blue-700 mb-2">Vista Previa del Mapa</p>
                      <div className="rounded-md overflow-hidden">
                        {/* Static Google Maps embed with pin marker at the coordinates */}
                        <iframe
                          src={`https://www.google.com/maps?q=${latitude},${longitude}&z=15&hl=es&output=embed`}
                          width="100%"
                          height="320"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title="Ubicación de entrega"
                        ></iframe>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <a
                          href={generateGoogleMapsUrl(latitude, longitude)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
                        >
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                          </svg>
                          Abrir en Google Maps
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                  <p className="text-sm text-yellow-700">
                    <span className="font-medium">💡 Consejos para coordenadas:</span>
                  </p>
                  <ul className="text-xs text-yellow-600 mt-1 space-y-1">
                    <li>• Abre Google Maps en tu dispositivo</li>
                    <li>• Mantén presionado el punto exacto de entrega</li>
                    <li>• Las coordenadas aparecerán en la barra de búsqueda</li>
                    <li>• Copia y pega los valores aquí</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-3">Opciones Adicionales</h3>
              
              <div>
                <label htmlFor="specialRequirements" className="block text-sm font-medium mb-1">
                  Requisitos Especiales (opcional)
                </label>
                <textarea
                  id="specialRequirements"
                  value={specialRequirements}
                  onChange={(e) => setSpecialRequirements(e.target.value)}
                  rows={5}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Ingrese cualquier requisito especial para esta orden..."
                />
              </div>
            </div>
          </div>
          
          {/* Order summary */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Resumen del Pedido</h3>
              <p className="text-xl font-bold text-green-700">
                Total: ${calculateTotalAmount().toFixed(2)}
              </p>
            </div>
            <div className="mt-2 space-y-2">
              <p className="text-sm text-gray-600">
                {selectedProducts.length} producto(s) seleccionado(s) •
                {invoiceSelection === true ? ' Con factura' : invoiceSelection === false ? ' Sin factura' : ' Factura pendiente'} •
                {hasPumpService ? ` Bombeo: ${pumpVolume} m³ ($${pumpPrice?.toFixed(2) || '0.00'}/m³) • ` : ''}
                Entrega: {deliveryDate.split('-').reverse().join('/')} a las {deliveryTime}
              </p>

              {/* Site Access Summary */}
              <div className="flex items-center justify-between bg-white/50 p-2 rounded-md">
                <div className="text-sm text-gray-700">
                  <span className="font-medium">🚦 Acceso:</span> {siteAccessRating ? (siteAccessRating === 'green' ? 'Verde' : siteAccessRating === 'yellow' ? 'Amarillo' : 'Rojo') : '—'}
                  {siteAccessRating && siteAccessRating !== 'green' ? ` • Fotos: ${siteValidation.evidence_photo_urls?.length || 0}` : ''}
                </div>
              </div>

              {/* Coordinates summary */}
              <div className="flex items-center justify-between bg-white/50 p-2 rounded-md">
                <div className="text-sm text-gray-700">
                  <span className="font-medium">📍 Ubicación:</span> {latitude}, {longitude}
                </div>
                <a
                  href={generateGoogleMapsUrl(latitude, longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Ver en Maps
                </a>
              </div>
            </div>
          </div>
          
          {/* Form actions */}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-xs text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Atrás
            </button>
            
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (selectedProducts.length === 0 && orderType !== 'pumping') ||
                invoiceSelection === null ||
                !latitude ||
                !longitude ||
                  !!coordinatesError ||
                  !siteAccessRating ||
                  (siteAccessRating === 'yellow' && (
                    !siteValidation.road_type ||
                    !siteValidation.road_slope ||
                    !siteValidation.recent_weather_impact ||
                    !siteValidation.route_incident_history ||
                    (siteValidation.evidence_photo_urls?.length || 0) < 2
                  )) ||
                  (siteAccessRating === 'red' && (
                    !siteValidation.road_slope ||
                    (siteValidation.road_slope !== 'moderate' && siteValidation.road_slope !== 'steep') ||
                    !siteValidation.recent_weather_impact ||
                    !siteValidation.route_incident_history ||
                    (siteValidation.evidence_photo_urls?.length || 0) < 2
                  ))
              }
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creando orden...' : 'Crear Orden'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
  
  const steps = [
    { number: 1, title: 'Cliente & Ubicación', description: 'Selecciona el cliente y la obra' },
    { number: 2, title: 'Producto & Receta', description: 'Elige productos y recetas' },
    { number: 3, title: 'Logística', description: 'Fecha, hora y servicios adicionales' }
  ];

  // Render based on current step
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Enhanced Step Indicator with Glass */}
      <GlassCard variant="thick" className="p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;
            const isClickable = currentStep >= step.number;

            return (
              <React.Fragment key={step.number}>
                <motion.button
                  onClick={() => isClickable && setCurrentStep(step.number)}
                  disabled={!isClickable}
                  className={cn(
                    'flex flex-col items-center gap-2 flex-1',
                    !isClickable && 'opacity-50 cursor-not-allowed'
                  )}
                  whileHover={isClickable ? { scale: 1.05 } : {}}
                  whileTap={isClickable ? { scale: 0.95 } : {}}
                >
                  <div className={cn(
                    'relative h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300',
                    isActive && 'glass-interactive border-2 border-systemBlue shadow-lg shadow-systemBlue/50 scale-110',
                    isCompleted && 'bg-systemGreen text-white',
                    !isActive && !isCompleted && 'glass-thin border border-gray-300 text-gray-500'
                  )}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <span>{step.number}</span>
                    )}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-systemBlue/20"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </div>
                  <div className="text-center">
                    <div className={cn(
                      'font-semibold text-sm',
                    isActive && 'text-systemBlue dark:text-systemBlue/80',
                    isCompleted && 'text-systemGreen dark:text-systemGreen/80',
                      !isActive && !isCompleted && 'text-gray-500'
                    )}>
                      {step.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{step.description}</div>
                  </div>
                </motion.button>
                {index < steps.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 mx-4 transition-all duration-300',
                    currentStep > step.number ? 'bg-systemGreen' : 'bg-gray-200'
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </GlassCard>

      {/* Step content with Focus Mode */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <GlassCard variant="thick" className="p-8 min-h-[600px]">
            {/* Navigation buttons */}
            <div className="flex justify-between items-center mb-6">
              {currentStep > 1 && (
                <motion.button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </motion.button>
              )}
              <div className="flex-1" />
              {currentStep < 3 && (
                <motion.button
                  onClick={() => {
                    // Validate current step before proceeding
                    if (currentStep === 1 && selectedClientId) {
                      setCurrentStep(2);
                    } else if (currentStep === 2 && selectedConstructionSiteId) {
                      setCurrentStep(3);
                    }
                  }}
                  disabled={
                    (currentStep === 1 && !selectedClientId) ||
                    (currentStep === 2 && !selectedConstructionSiteId)
                  }
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 glass-interactive rounded-xl font-medium',
                    'bg-systemBlue text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </motion.button>
              )}
            </div>

            {/* Step content */}
            <div className="focus-mode-content">
              {currentStep === 1 && renderClientSelection()}
              {currentStep === 2 && renderSiteSelection()}
              {currentStep === 3 && renderOrderDetails()}
            </div>
          </GlassCard>
        </motion.div>
      </AnimatePresence>
    </div>
  );
} 