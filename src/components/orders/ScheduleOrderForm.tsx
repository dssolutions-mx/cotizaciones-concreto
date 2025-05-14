'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, format } from 'date-fns';
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
  }[]>([]);
  
  // Order details
  const [deliveryDate, setDeliveryDate] = useState<string>(format(tomorrow, 'yyyy-MM-dd'));
  const [deliveryTime, setDeliveryTime] = useState<string>('10:00');
  const [requiresInvoice, setRequiresInvoice] = useState<boolean>(false);
  const [specialRequirements, setSpecialRequirements] = useState<string>('');
  
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
                max_aggregate_size
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
                pumpVolume: 0      // Initialize pump volume
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
          pumpVolume: product.pumpService ? product.volume : 0
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
  
  // Handle pump volume change
  const handlePumpVolumeChange = (quoteDetailId: string, volume: number) => {
    setSelectedProducts(prev => 
      prev.map(p => 
        p.quoteDetailId === quoteDetailId 
          ? { ...p, pumpVolume: volume } 
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
    
    // Add pump service if any product has it - use pumpVolume for calculation
    const productsWithPump = selectedProducts.filter(p => p.pumpService);
    if (productsWithPump.length > 0) {
      productsWithPump.forEach(product => {
        const pumpPrice = product.pumpPrice || 0;
        total += pumpPrice * product.pumpVolume; // Use pump volume for calculation
      });
    }
    
    // Add empty truck charge if applicable
    if (hasEmptyTruckCharge) {
      total += emptyTruckVolume * emptyTruckPrice;
    }
    
    return total;
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
        // Add selected products with volumes
        order_items: selectedProducts.map(p => ({
          quote_detail_id: p.quoteDetailId,
          volume: p.scheduledVolume,
          pump_volume: p.pumpService ? p.pumpVolume : null
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
          {/* Product selection */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Seleccionar
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resistencia
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo de colocación
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Volumen Cotizado
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Volumen a Programar
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio Unitario
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Servicio de Bombeo
                  </th>
                </tr>
              </thead>
              <tbody>
                {availableQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-4 text-center text-sm text-gray-500">
                      No hay cotizaciones activas disponibles para este cliente y sitio de construcción.
                    </td>
                  </tr>
                ) : (
                  availableQuotes.flatMap(quote => 
                    quote.products.map((product) => {
                      const isSelected = selectedProducts.some(p => p.quoteDetailId === product.quoteDetailId);
                      const selectedProduct = selectedProducts.find(p => p.quoteDetailId === product.quoteDetailId);
                      
                      return (
                        <tr key={`${quote.id}-${product.quoteDetailId}`} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={(e) => handleProductSelect(product, e.target.checked)}
                              className="h-4 w-4 text-green-600 rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <span className="font-medium">{product.recipeCode}</span>
                            <div className="text-xs text-gray-500">Cotización: {quote.quoteNumber}</div>
                          </td>
                          <td className="px-4 py-2">{product.strength} kg/cm²</td>
                          <td className="px-4 py-2">{product.placementType}</td>
                          <td className="px-4 py-2">{product.volume} m³</td>
                          <td className="px-4 py-2">
                            <input 
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={selectedProduct?.scheduledVolume || 0}
                              onChange={(e) => handleVolumeChange(product.quoteDetailId, parseFloat(e.target.value))}
                              disabled={!isSelected}
                              className="w-20 rounded-md border border-gray-300 px-3 py-1"
                            />
                          </td>
                          <td className="px-4 py-2">${product.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-2">
                            {product.pumpService ? (
                              <div className="flex items-center space-x-2">
                                <span>Sí (${product.pumpPrice?.toFixed(2) || '0.00'})</span>
                                {isSelected && (
                                  <input 
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={selectedProduct?.pumpVolume || 0}
                                    onChange={(e) => handlePumpVolumeChange(product.quoteDetailId, parseFloat(e.target.value))}
                                    className="w-20 rounded-md border border-gray-300 px-3 py-1 ml-2"
                                    placeholder="Vol. bombeo"
                                  />
                                )}
                              </div>
                            ) : 'No'}
                          </td>
                        </tr>
                      );
                    })
                  )
                )}
              </tbody>
            </table>
          </div>

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
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    id="requiresInvoice"
                    type="checkbox"
                    checked={requiresInvoice}
                    onChange={(e) => setRequiresInvoice(e.target.checked)}
                    className="h-4 w-4 text-green-600 rounded border-gray-300"
                  />
                  <label htmlFor="requiresInvoice" className="ml-2 block text-sm">
                    Requiere Factura
                  </label>
                </div>
                
                <div>
                  <label htmlFor="specialRequirements" className="block text-sm font-medium mb-1">
                    Requisitos Especiales (opcional)
                  </label>
                  <textarea
                    id="specialRequirements"
                    value={specialRequirements}
                    onChange={(e) => setSpecialRequirements(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="Ingrese cualquier requisito especial para esta orden..."
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg border">
            <p className="text-lg font-semibold">
              Total: ${calculateTotalAmount().toFixed(2)}
            </p>
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
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
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