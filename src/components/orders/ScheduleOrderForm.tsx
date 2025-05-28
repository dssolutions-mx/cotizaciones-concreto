'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, format, parseISO } from 'date-fns';
import { clientService } from '@/lib/supabase/clients';
import { supabase } from '@/lib/supabase';
import orderService from '@/services/orderService';
import { EmptyTruckDetails } from '@/types/orders';

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

export default function ScheduleOrderForm({ 
  preSelectedQuoteId, 
  preSelectedClientId,
  onOrderCreated 
}: ScheduleOrderFormProps) {
  const router = useRouter();
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
  
  // Order-wide pumping service (instead of per product)
  const [hasPumpService, setHasPumpService] = useState<boolean>(false);
  const [pumpVolume, setPumpVolume] = useState<number>(0);
  const [pumpPrice, setPumpPrice] = useState<number | null>(null);
  
  // Empty truck details
  const [hasEmptyTruckCharge, setHasEmptyTruckCharge] = useState<boolean>(false);
  const [emptyTruckVolume, setEmptyTruckVolume] = useState<number>(0);
  const [emptyTruckPrice, setEmptyTruckPrice] = useState<number>(0);
  
  // Form state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
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
        
        // 1. Find the active product price for this client and site
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
        
        // Get unique quote IDs from truly active prices
        const uniqueQuoteIds = Array.from(new Set(trulyActivePrices.map(price => price.quote_id)));
        console.log('Unique quote IDs from active prices:', uniqueQuoteIds);
        
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
              recipes:recipe_id(
                recipe_code,
                strength_fc,
                placement_type,
                max_aggregate_size,
                age_days,
                slump
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
          // Filter quote details to only include those with active quote-recipe combinations
          const activeDetails = quoteData.quote_details.filter((detail: any) => 
            // Check if this specific quote-recipe combination is in our active set
            activeQuoteRecipeCombos.has(`${quoteData.id}:${detail.recipe_id}`)
          );
          
          console.log(`Quote ${quoteData.quote_number}: filtered ${quoteData.quote_details.length} details to ${activeDetails.length} active details`);
          
          const formattedQuote: Quote = {
            id: quoteData.id,
            quoteNumber: quoteData.quote_number,
            totalAmount: 0, // Will be calculated below
            products: activeDetails.map((detail: any) => {
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
        
        // If preSelectedQuoteId matches any of the quotes, auto-select products
        if (preSelectedQuoteId) {
          const selectedQuote = nonEmptyQuotes.find(quote => quote.id === preSelectedQuoteId);
          if (selectedQuote) {
            setSelectedProducts(selectedQuote.products.map(p => ({
              ...p,
              scheduledVolume: p.volume,
              pumpVolume: p.pumpService ? p.volume : 0
            })));
            console.log('Auto-selected products for preSelectedQuoteId:', preSelectedQuoteId);
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
        
        // Look for pump service pricing in quote_details that are approved for this client + site combination
        const { data: pumpServiceData, error: pumpServiceError } = await supabase
          .from('quotes')
          .select(`
            quote_details(
              pump_service,
              pump_price
            )
          `)
          .eq('status', 'APPROVED')
          .eq('client_id', selectedClientId)
          .eq('construction_site', selectedConstructionSite.name)
          .not('quote_details.pump_price', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (pumpServiceError) {
          console.error("Error fetching pump service pricing:", pumpServiceError);
          return;
        }
        
        // Find the first quote with pump service pricing
        if (pumpServiceData && pumpServiceData.length > 0) {
          const quoteWithPumpService = pumpServiceData.find(quote => 
            quote.quote_details.some((detail: any) => detail.pump_service && detail.pump_price)
          );
          
          if (quoteWithPumpService) {
            const pumpDetail = quoteWithPumpService.quote_details.find((detail: any) => 
              detail.pump_service && detail.pump_price
            );
            
            if (pumpDetail && pumpDetail.pump_price) {
              setPumpPrice(pumpDetail.pump_price);
              console.log(`Found pump service price: $${pumpDetail.pump_price} for client + site combination`);
            }
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
  
  // Filter clients based on search query
  const filteredClients = clients.filter(client => 
    client.business_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    client.client_code.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
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
    
    if (selectedProducts.length === 0) {
      setError('Debe seleccionar al menos un producto para crear la orden');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Get the quote ID (assuming all products come from the same quote)
      const quoteId = availableQuotes.find(q => 
        q.products.some(p => p.quoteDetailId === selectedProducts[0].quoteDetailId)
      )?.id;
      
      if (!quoteId) {
        throw new Error('No se pudo determinar la cotización');
      }
      
      // Get the construction site
      const selectedSite = constructionSites.find(site => site.id === selectedConstructionSiteId);
      if (!selectedSite) {
        throw new Error('No se pudo determinar el sitio de construcción');
      }
      
      // Prepare order data
      const orderData = {
        quote_id: quoteId,
        client_id: selectedClientId,
        construction_site: selectedSite.name,
        construction_site_id: selectedConstructionSiteId,
        delivery_date: deliveryDate,
        delivery_time: deliveryTime,
        requires_invoice: requiresInvoice,
        special_requirements: specialRequirements || null,
        total_amount: calculateTotalAmount(),
        order_status: 'created',
        credit_status: 'pending',
        // Add selected products with volumes, but now handle pump service at order level
        order_items: selectedProducts.map(p => ({
          quote_detail_id: p.quoteDetailId,
          volume: p.scheduledVolume,
          pump_volume: hasPumpService && pumpVolume > 0 ? pumpVolume : null // Single pump volume for the order
        }))
      };
      
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
      const result = await orderService.createOrder(orderData, emptyTruckData);
      
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
          {/* Invoice requirement - Moved up and made more prominent */}
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg shadow-sm">
            <div className="flex items-center">
              <input
                id="requiresInvoice"
                type="checkbox"
                checked={requiresInvoice}
                onChange={(e) => setRequiresInvoice(e.target.checked)}
                className="h-5 w-5 text-green-600 rounded border-gray-300"
              />
              <label htmlFor="requiresInvoice" className="ml-2 block text-base font-bold text-gray-800">
                Requiere Factura
              </label>
            </div>
            <p className="text-sm text-gray-600 mt-1 pl-7">
              Importante: Seleccionar esta opción afectará el balance del cliente
            </p>
          </div>

          {/* Product filtering options */}
          {availableQuotes.length > 0 && (
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

          {/* Pumping Service - available globally for client + construction site */}
          {selectedProducts.length > 0 && pumpPrice !== null && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-4">
              <div className="flex items-center mb-3">
                <input 
                  id="hasPumpService"
                  type="checkbox"
                  checked={hasPumpService}
                  onChange={(e) => {
                    setHasPumpService(e.target.checked);
                    if (e.target.checked && pumpVolume === 0) {
                      // Set default pump volume to total concrete volume
                      const totalVolume = selectedProducts.reduce((sum, p) => sum + p.scheduledVolume, 0);
                      setPumpVolume(totalVolume);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-3">Información de Entrega</h3>
              
              <div className="space-y-4">
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
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                {selectedProducts.length} producto(s) seleccionado(s) • 
                {requiresInvoice ? ' Con factura' : ' Sin factura'} • 
                {hasPumpService ? ` Bombeo: ${pumpVolume} m³ ($${pumpPrice?.toFixed(2) || '0.00'}/m³) • ` : ''}
                Entrega: {deliveryDate.split('-').reverse().join('/')} a las {deliveryTime}
              </p>
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
              disabled={isSubmitting || selectedProducts.length === 0}
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