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
  
  // Construction site selection
  const [constructionSites, setConstructionSites] = useState<ConstructionSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  
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
          setSelectedSiteId(data[0].id);
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
    const loadQuotes = async () => {
      if (!selectedClientId || !selectedSiteId) return;
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('quotes')
          .select(`
            id, 
            quote_number,
            status,
            quote_details (
              id,
              recipe_id,
              volume,
              final_price,
              pump_service,
              pump_price,
              recipes:recipe_id (
                recipe_code,
                strength_fc,
                placement_type,
                max_aggregate_size
              )
            )
          `)
          .eq('client_id', selectedClientId)
          .eq('status', 'APPROVED');
        
        if (error) throw error;
        
        // Transform data to our format
        const quotes: Quote[] = data.map(quote => ({
          id: quote.id,
          quoteNumber: quote.quote_number,
          totalAmount: 0, // Will be calculated below
          products: quote.quote_details.map((detail: any) => {
            // Use type assertion to handle nested recipe data
            const recipeData = detail.recipes as {
              recipe_code?: string;
              strength_fc?: number;
              placement_type?: string;
              max_aggregate_size?: number;
            };
            return {
              id: recipeData?.recipe_code || 'Unknown', // Using recipe code as ID for display
              quoteDetailId: detail.id,
              recipeCode: recipeData?.recipe_code || 'Unknown',
              strength: recipeData?.strength_fc || 0,
              placementType: recipeData?.placement_type || '',
              maxAggregateSize: recipeData?.max_aggregate_size || 0,
              volume: detail.volume,
              unitPrice: detail.final_price,
              pumpService: detail.pump_service,
              pumpPrice: detail.pump_price
            };
          })
        }));
        
        // Calculate total amount for each quote
        quotes.forEach(quote => {
          quote.totalAmount = quote.products.reduce(
            (sum, product) => sum + product.volume * product.unitPrice, 
            0
          );
        });
        
        setAvailableQuotes(quotes);
        
        // Si hay un ID de cotización preseleccionada, seleccionar sus productos automáticamente
        if (preSelectedQuoteId && preSelectedQuoteId !== '') {
          const selectedQuote = quotes.find(q => q.id === preSelectedQuoteId);
          if (selectedQuote) {
            setSelectedProducts(selectedQuote.products.map(p => ({
              ...p,
              scheduledVolume: p.volume,
              pumpVolume: p.pumpService ? p.volume : 0
            })));
          }
        }
        // Si no hay cotización preseleccionada pero hay cotizaciones disponibles, no hacer nada especial,
        // el usuario podrá seleccionar los productos manualmente
      } catch (err) {
        console.error('Error loading quotes:', err);
        setError('No se pudieron cargar las cotizaciones aprobadas. Por favor, intente nuevamente.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadQuotes();
  }, [selectedClientId, selectedSiteId, preSelectedQuoteId]);
  
  // Go to next step
  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };
  
  // Handle client selection
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedSiteId(''); // Reset site selection
    setAvailableQuotes([]); // Reset quotes
    setSelectedProducts([]); // Reset selected products
    nextStep();
  };
  
  // Handle construction site selection
  const handleSiteSelect = (siteId: string) => {
    setSelectedSiteId(siteId);
    nextStep();
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
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
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
      
      // Get the construction site name
      const selectedSite = constructionSites.find(site => site.id === selectedSiteId);
      if (!selectedSite) {
        throw new Error('No se pudo determinar el sitio de construcción');
      }
      
      // Prepare order data
      const orderData = {
        quote_id: quoteId,
        client_id: selectedClientId,
        construction_site: selectedSite.name,
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
      
      if (onOrderCreated) {
        onOrderCreated();
      } else {
        // Ensure we're using the correct parameter for redirecting
        router.push('/orders?showOrdersList=true');
      }
    } catch (err: unknown) {
      console.error('Error creating order:', err);
      
      // Handle different types of errors with specific messages
      let errorMessage = 'Error al crear la orden';
      let isAuthError = false;
      
      if (err instanceof Error) {
        if (err.message.includes('authentication') || err.message.includes('auth') || err.message.includes('no autenticado')) {
          errorMessage = 'Error de autenticación. Por favor, vuelva a iniciar sesión e intente nuevamente.';
          isAuthError = true;
        } else if (err.message.includes('not-null')) {
          errorMessage = 'Faltan datos requeridos. Por favor, verifique los campos e intente nuevamente.';
        } else {
          errorMessage = err.message;
        }
      }
      
      // Check if the error has a Supabase error code
      const errorWithCode = err as { code?: string };
      if (errorWithCode.code) {
        if (errorWithCode.code === '23502') { // not-null constraint violation
          errorMessage = 'Faltan datos requeridos en el formulario.';
        } else if (errorWithCode.code === '23503') { // foreign key constraint violation
          errorMessage = 'La referencia a otro registro no es válida.';
        } else if (errorWithCode.code === '42703') { // undefined column
          errorMessage = 'Error en la estructura de datos. Contacte al administrador.';
        } else if (errorWithCode.code === 'PGRST301') { // JWT expired
          errorMessage = 'Su sesión ha expirado. Por favor, vuelva a iniciar sesión.';
          isAuthError = true;
        }
      }
      
      setError(`Error al crear la orden: ${errorMessage}`);
      
      // Show retry button for authentication errors
      if (isAuthError) {
        // Add retry button to the error message
        setError(prev => `${prev} 
          <button id="retryOrderCreation" class="ml-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">
            Intentar nuevamente
          </button>`);
        
        // Add event listener for retry button after rendering
        setTimeout(() => {
          const retryButton = document.getElementById('retryOrderCreation');
          if (retryButton) {
            retryButton.addEventListener('click', (e) => {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            });
          }
        }, 100);
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Render client selection step
  const renderClientSelection = () => (
    <div className="bg-white rounded-lg border shadow-xs p-6">
      <h2 className="text-xl font-semibold mb-4">Seleccionar Cliente</h2>
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(client => (
            <div 
              key={client.id}
              onClick={() => handleClientSelect(client.id)}
              className="border rounded-lg p-4 cursor-pointer hover:bg-green-50 hover:border-green-500 transition-colors"
            >
              <h3 className="font-medium">{client.business_name}</h3>
              <p className="text-sm text-gray-600">Código: {client.client_code}</p>
            </div>
          ))}
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
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-md mb-4">
          {error}
        </div>
      )}
      
      <div className="mb-4">
        <p className="text-gray-600">
          Cliente: {clients.find(c => c.id === selectedClientId)?.business_name}
        </p>
        <p className="text-gray-600">
          Obra: {constructionSites.find(s => s.id === selectedSiteId)?.name}
        </p>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
        </div>
      ) : availableQuotes.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-gray-600 mb-4">
            No hay cotizaciones aprobadas para este cliente y obra.
          </p>
          <button
            onClick={() => setCurrentStep(2)}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-xs text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Seleccionar otra obra
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product selection */}
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="font-medium mb-3">Seleccionar Productos</h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Seleccionar</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Código</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Resistencia</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Tipo de Colocación</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Volumen Disponible</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Volumen a Entregar</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Precio Unitario</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Bombeo</th>
                  </tr>
                </thead>
                <tbody>
                  {availableQuotes.flatMap(quote => 
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
                          <td className="px-4 py-2">{product.recipeCode}</td>
                          <td className="px-4 py-2">{product.strength} kg/cm²</td>
                          <td className="px-4 py-2">{product.placementType}</td>
                          <td className="px-4 py-2">{product.volume} m³</td>
                          <td className="px-4 py-2">
                            <input 
                              type="number"
                              min="0.1"
                              max={product.volume}
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
                                    min="0.1"
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
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Delivery information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="deliveryDate" className="block text-sm font-medium mb-1">
                Fecha de Entrega
              </label>
              <input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={format(tomorrow, 'yyyy-MM-dd')}
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
          
          {/* Empty truck charge */}
          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="flex items-center mb-3">
              <input
                id="hasEmptyTruckCharge"
                type="checkbox"
                checked={hasEmptyTruckCharge}
                onChange={(e) => setHasEmptyTruckCharge(e.target.checked)}
                className="h-4 w-4 text-green-600 rounded border-gray-300"
              />
              <label htmlFor="hasEmptyTruckCharge" className="ml-2 block text-sm font-medium">
                Incluir Cargo por Vacío de Olla
              </label>
            </div>
            
            {hasEmptyTruckCharge && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                  <label htmlFor="emptyTruckVolume" className="block text-sm font-medium mb-1">
                    Volumen de Vacío de Olla (m³)
                  </label>
                  <input
                    id="emptyTruckVolume"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={emptyTruckVolume}
                    onChange={(e) => setEmptyTruckVolume(parseFloat(e.target.value))}
                    required={hasEmptyTruckCharge}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                
                <div>
                  <label htmlFor="emptyTruckPrice" className="block text-sm font-medium mb-1">
                    Precio por m³
                  </label>
                  <input
                    id="emptyTruckPrice"
                    type="number"
                    min="1"
                    step="1"
                    value={emptyTruckPrice}
                    onChange={(e) => setEmptyTruckPrice(parseFloat(e.target.value))}
                    required={hasEmptyTruckCharge}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Invoice requirement */}
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
          
          {/* Special requirements */}
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
          
          {/* Total amount */}
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