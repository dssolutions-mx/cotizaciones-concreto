'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, format, parseISO } from 'date-fns';
import { clientService } from '@/lib/supabase/clients';
import { supabase } from '@/lib/supabase';
import orderService from '@/services/orderService';
import { EmptyTruckDetails, PumpServiceDetails } from '@/types/orders';
import { usePlantContext } from '@/contexts/PlantContext';
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
}

interface Quote {
  id: string;
  quoteNumber: string;
  totalAmount: number;
  products: Product[];
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
        
        // 1. Find the active product prices for this client and site (recipe-based only)
        const { data: activePrices, error: activePriceError } = await supabase
          .from('product_prices')
          .select('quote_id, id, is_active, updated_at, recipe_id')
          .eq('client_id', selectedClientId)
          .eq('construction_site', selectedConstructionSite.name)
          .eq('is_active', true)
          .order('updated_at', { ascending: false });
          
        if (activePriceError) {
          console.error("Error fetching active product prices:", activePriceError);
          throw activePriceError;
        }
        
        // Debug log for active prices
        console.log('Active prices fetched:', activePrices);
        
        if (!activePrices || activePrices.length === 0) {
          console.log('No active prices/quotes found for this client/site.');
          setAvailableQuotes([]);
          setSelectedProducts([]);
          setIsLoading(false);
          return;
        }
        
        // Double-check that all prices are actually active
        const trulyActivePrices = activePrices.filter(price => price.is_active === true);
        console.log(`Found ${trulyActivePrices.length} truly active prices out of ${activePrices.length} returned prices`);
        
        if (trulyActivePrices.length === 0) {
          console.log('No prices with is_active=true found despite query filter.');
          setAvailableQuotes([]);
          setSelectedProducts([]);
          setIsLoading(false);
          return;
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
        
        // Get unique quote IDs from both active prices and standalone pumping quotes
        const recipeBasedQuoteIds = Array.from(new Set(trulyActivePrices.map(price => price.quote_id)));
        const standalonePumpingQuoteIdsArray = Array.from(standalonePumpingQuoteIds);
        const uniqueQuoteIds = Array.from(new Set([...recipeBasedQuoteIds, ...standalonePumpingQuoteIdsArray]));
        console.log('Unique quote IDs from active prices:', recipeBasedQuoteIds);
        console.log('Standalone pumping quote IDs:', standalonePumpingQuoteIdsArray);
        console.log('All unique quote IDs:', uniqueQuoteIds);
        
        // Create a set of active quote-recipe combinations
        // This ensures we only display recipes that are active for a specific quote
        const activeQuoteRecipeCombos = new Set(
          trulyActivePrices
            .filter(price => price.quote_id && price.recipe_id)
            .map(price => `${price.quote_id}:${price.recipe_id}`)
        );
        console.log('Active quote-recipe combinations:', Array.from(activeQuoteRecipeCombos));
        
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
              recipe_id,
              product_id,
              recipes:recipe_id(
                recipe_code,
                strength_fc,
                placement_type,
                max_aggregate_size,
                age_days,
                slump
              ),
              product_prices:product_id(
                id,
                code,
                description,
                type
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
          setIsLoading(false);
          return;
        }
        
        console.log('Successfully fetched linked quotes:', quotesData);
        
        // 3. Format the quotes for the form, filtering out quote details that don't have active prices
        const formattedQuotes: Quote[] = quotesData.map(quoteData => {
          // Filter quote details to include both active recipe-based and standalone pumping service combinations
          const activeDetails = quoteData.quote_details.filter((detail: any) => {
            // Check if this specific quote-recipe combination is in our active set
            const hasActiveRecipe = detail.recipe_id && activeQuoteRecipeCombos.has(`${quoteData.id}:${detail.recipe_id}`);
            // Check if this is a standalone pumping service quote
            const isStandalonePumping = standalonePumpingQuoteIds.has(quoteData.id) && detail.product_id && !detail.recipe_id && detail.pump_service;
            return hasActiveRecipe || isStandalonePumping;
          });
          
          console.log(`Quote ${quoteData.quote_number}: filtered ${quoteData.quote_details.length} details to ${activeDetails.length} active details`);
          
          const formattedQuote: Quote = {
            id: quoteData.id,
            quoteNumber: quoteData.quote_number,
            totalAmount: 0, // Will be calculated below
            products: activeDetails.map((detail: any) => {
              // Handle recipe-based quote details (concrete products)
              if (detail.recipe_id && detail.recipes) {
                const recipeData = detail.recipes as {
                  recipe_code?: string;
                  strength_fc?: number;
                  placement_type?: string;
                  max_aggregate_size?: number;
                  age_days?: number;
                  slump?: number;
                };
                return {
                  id: recipeData?.recipe_code || 'Unknown',
                  quoteDetailId: detail.id,
                  recipeCode: recipeData?.recipe_code || 'Unknown',
                  strength: recipeData?.strength_fc || 0,
                  placementType: recipeData?.placement_type || '',
                  maxAggregateSize: recipeData?.max_aggregate_size || 0,
                  volume: detail.volume,
                  unitPrice: detail.final_price,
                  pumpService: detail.pump_service,
                  pumpPrice: detail.pump_price,
                  scheduledVolume: 0, // Initialize scheduled volume
                  pumpVolume: 0,      // Initialize pump volume
                  ageDays: recipeData?.age_days || 0,
                  slump: recipeData?.slump || 0
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
        
        setAvailableQuotes(nonEmptyQuotes);
        console.log('Set available quotes:', nonEmptyQuotes);
        
        // Detect service types available
        const allProducts = nonEmptyQuotes.flatMap(quote => quote.products);
        const concreteProducts = allProducts.filter(p => p.placementType !== 'BOMBEO' && p.strength > 0);
        const standalonePumpingProducts = allProducts.filter(p => p.placementType === 'BOMBEO' && p.pumpService);
        const concreteWithPumpService = allProducts.filter(p => p.placementType !== 'BOMBEO' && p.strength > 0 && p.pumpService);
        
        // Combined pumping products (both standalone and concrete with pump service)
        const pumpingProducts = [...standalonePumpingProducts, ...concreteWithPumpService];
        
        // Remove pumping services from the main product list - they should never appear as individual products
        const filteredProducts = allProducts.filter(p => !(p.placementType === 'BOMBEO' && p.pumpService));
        
        setHasConcreteProducts(concreteProducts.length > 0);
        setHasStandalonePumping(pumpingProducts.length > 0);
        setStandalonePumpingProducts(pumpingProducts);
        
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
        
        // Look for pump service pricing directly on quote_details, inner-joining quotes for filters
        const { data: pumpServiceData, error: pumpServiceError } = await supabase
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
          
        if (pumpServiceError) {
          console.error("Error fetching pump service pricing:", pumpServiceError);
          return;
        }
        
        console.log('Pump service data fetched:', pumpServiceData);

        // Use the most recent quote_detail with pump_service=true
        if (pumpServiceData && pumpServiceData.length > 0) {
          const firstDetailWithPrice = pumpServiceData.find((d: any) => d && d.pump_price !== null);
          if (firstDetailWithPrice) {
            const priceNumber = Number(firstDetailWithPrice.pump_price);
            setPumpPrice(priceNumber);
            console.log(`Found pump service price: $${priceNumber} for client + site combination`);
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
  
  // Auto-activate pump service when in pumping-only mode
  useEffect(() => {
    if (orderType === 'pumping' && pumpPrice !== null) {
      setHasPumpService(true);
      // Set default pump volume if not set
      if (pumpVolume === 0 && standalonePumpingProducts.length > 0) {
        const defaultVolume = standalonePumpingProducts[0].volume;
        setPumpVolume(defaultVolume);
      }
    } else if (orderType === 'concrete') {
      // Reset pump service when switching back to concrete mode
      setHasPumpService(false);
      setPumpVolume(0);
    }
  }, [orderType, pumpPrice, pumpVolume, standalonePumpingProducts]);

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
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Get the quote ID
      let quoteId: string | undefined;
      
      if (orderType === 'pumping') {
        // For pumping-only mode, get quote from standalone pumping products
        quoteId = availableQuotes.find(q => 
          q.products.some(p => p.placementType === 'BOMBEO' && p.pumpService)
        )?.id;
      } else {
        // For normal mode, get quote from selected products
        quoteId = availableQuotes.find(q => 
          q.products.some(p => p.quoteDetailId === selectedProducts[0].quoteDetailId)
        )?.id;
      }
      
      if (!quoteId) {
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
        order_items: orderType === 'pumping'
          ? standalonePumpingProducts.map(p => ({
              quote_detail_id: p.quoteDetailId,
              volume: pumpVolume // Use the pump volume from the form
            }))
          : selectedProducts.map(p => ({
              quote_detail_id: p.quoteDetailId,
              volume: p.scheduledVolume
            }))
      };
      
      // Prepare pump service data separately (only for traditional concrete orders with pump service)
      let pumpServiceData: PumpServiceDetails | null = null;
      if (hasPumpService && pumpVolume > 0 && pumpPrice !== null && orderType !== 'pumping') {
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
      const result = await orderService.createOrder(orderData, emptyTruckData, pumpServiceData);
      
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
          {((selectedProducts.length > 0 && pumpPrice !== null && orderType !== 'pumping') || (orderType === 'pumping' && pumpPrice !== null)) && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-4">
              <div className="flex items-center mb-3">
                <input 
                  id="hasPumpService"
                  type="checkbox"
                  checked={orderType === 'pumping' ? true : hasPumpService}
                  disabled={orderType === 'pumping'}
                  onChange={(e) => {
                    if (orderType !== 'pumping') {
                      setHasPumpService(e.target.checked);
                      if (e.target.checked && pumpVolume === 0) {
                        // Set default pump volume to total concrete volume
                        const totalVolume = selectedProducts.reduce((sum, p) => sum + p.scheduledVolume, 0);
                        setPumpVolume(totalVolume);
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
                    {pumpPrice > 0 ? (
                    <div className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-100 text-gray-700">
                      ${pumpPrice?.toFixed(2) || '0.00'}
                    </div>
                    ) : (
                      <div className="space-y-2">
                        <input 
                          id="pumpPrice"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={pumpPrice || ''}
                          onChange={(e) => setPumpPrice(parseFloat(e.target.value) || 0)}
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
                      <li>Pégala aquí y presiona “Usar”.</li>
                    </ol>
                  </div>
                </div>
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
                !!coordinatesError
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
  
  // Render based on current step
  return (
    <div className="max-w-6xl mx-auto">
      {/* Step indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${currentStep >= 1 ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`rounded-full h-8 w-8 flex items-center justify-center ${currentStep >= 1 ? 'bg-green-100' : 'bg-gray-100'}`}>
              1
            </div>
            <span className="ml-2 font-medium">Seleccionar Cliente</span>
          </div>
          <div className={`h-0.5 w-16 ${currentStep >= 2 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center ${currentStep >= 2 ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`rounded-full h-8 w-8 flex items-center justify-center ${currentStep >= 2 ? 'bg-green-100' : 'bg-gray-100'}`}>
              2
            </div>
            <span className="ml-2 font-medium">Seleccionar Obra</span>
          </div>
          <div className={`h-0.5 w-16 ${currentStep >= 3 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center ${currentStep >= 3 ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`rounded-full h-8 w-8 flex items-center justify-center ${currentStep >= 3 ? 'bg-green-100' : 'bg-gray-100'}`}>
              3
            </div>
            <span className="ml-2 font-medium">Crear Orden</span>
          </div>
        </div>
      </div>
      
      {/* Step content */}
      {currentStep === 1 && renderClientSelection()}
      {currentStep === 2 && renderSiteSelection()}
      {currentStep === 3 && renderOrderDetails()}
    </div>
  );
} 