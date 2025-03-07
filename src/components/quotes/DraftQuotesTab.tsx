'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { QuotesService } from '@/services/quotes';

interface DraftQuotesTabProps {
  onDataSaved?: () => void;
}

// Updated interfaces to match Supabase query structure
interface SupabaseQuote {
  id: string;
  quote_number: string;
  construction_site: string;
  created_at: string;
  client_id: string;
  clients: {
    business_name: string;
    client_code: string;
  };
  quote_details: SupabaseQuoteDetail[];
}

interface SupabaseQuoteDetail {
  id: string;
  volume: number;
  base_price: number;
  final_price: number;
  pump_service: boolean;
  pump_price: number | null;
  recipe_id: string;
  recipes: {
    recipe_code: string;
    strength_fc: number;
    placement_type: string;
    max_aggregate_size: number;
    slump: number;
    age_days: number;
  };
}

interface Quote {
  id: string;
  quote_number: string;
  construction_site: string;
  created_at: string;
  client: {
    business_name: string;
    client_code: string;
  } | null;
  quote_details: Array<{
    id: string;
    volume: number;
    base_price: number;
    final_price: number;
    pump_service: boolean;
    pump_price: number | null;
    recipe: {
      recipe_code: string;
      strength_fc: number;
      placement_type: string;
      max_aggregate_size: number;
      slump: number;
      age_days: number;
    } | null;
  }>;
}

export default function DraftQuotesTab({ onDataSaved }: DraftQuotesTabProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalQuotes, setTotalQuotes] = useState(0);
  const quotesPerPage = 25;

  // Modal state
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  // Add state for editing quote details
  const [editingQuoteDetails, setEditingQuoteDetails] = useState<Array<{
    id: string;
    volume: number;
    base_price: number;
    final_price: number;
    pump_service: boolean;
    pump_price: number | null;
    profit_margin: number;
    recipe: {
      recipe_code: string;
      strength_fc: number;
      placement_type: string;
      max_aggregate_size: number;
      slump: number;
      age_days: number;
    } | null;
  }>>([]);

  const fetchDraftQuotes = async () => {
    try {
      setIsLoading(true);
      
      // Fetch quotes with client and quote details
      const { data, count, error } = await supabase
        .from('quotes')
        .select(`
          id, 
          quote_number, 
          construction_site, 
          created_at,
          client_id,
          clients (
            business_name, 
            client_code
          ),
          quote_details (
            id, 
            volume, 
            base_price,
            final_price,
            pump_service,
            pump_price,
            recipe_id,
            recipes (
              recipe_code, 
              strength_fc, 
              placement_type,
              max_aggregate_size,
              slump,
              age_days
            )
          )
        `, { count: 'exact' })
        .eq('status', 'DRAFT')
        .range((page - 1) * quotesPerPage, page * quotesPerPage - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to match Quote interface
      const transformedQuotes: Quote[] = (data || []).map(quote => {
        const clientData = Array.isArray(quote.clients) 
          ? quote.clients[0] 
          : quote.clients;
        
        const quoteDetailsData = Array.isArray(quote.quote_details)
          ? quote.quote_details.map(detail => {
              const recipeData = Array.isArray(detail.recipes) 
                ? detail.recipes[0] 
                : detail.recipes;
              
              return {
                id: detail.id,
                volume: detail.volume,
                base_price: detail.base_price,
                final_price: detail.final_price,
                pump_service: detail.pump_service,
                pump_price: detail.pump_price,
                recipe: recipeData ? {
                  recipe_code: recipeData.recipe_code,
                  strength_fc: recipeData.strength_fc,
                  placement_type: recipeData.placement_type,
                  max_aggregate_size: recipeData.max_aggregate_size,
                  slump: recipeData.slump,
                  age_days: recipeData.age_days
                } : null
              };
            })
          : [];

        return {
          ...quote,
          client: clientData ? {
            business_name: clientData.business_name,
            client_code: clientData.client_code
          } : null,
          quote_details: quoteDetailsData
        };
      }) as Quote[];

      setQuotes(transformedQuotes);
      setTotalQuotes(count || 0);
    } catch (error) {
      console.error('Error fetching draft quotes:', error);
      alert('No se pudieron cargar las cotizaciones en borrador');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDraftQuotes();
  }, [page]);

  const sendToApproval = async (quoteId: string) => {
    console.log(`Starting to send quote ${quoteId} to approval`);
    try {
      // If we're currently editing this quote, save the changes first
      if (selectedQuote && selectedQuote.id === quoteId && editingQuoteDetails.length > 0) {
        console.log('Saving quote modifications before sending to approval');
        try {
          await saveQuoteModifications();
        } catch (saveError: any) {
          console.error('Failed to save modifications before sending to approval:', saveError);
          alert(`Error al guardar modificaciones: ${saveError.message}`);
          return;
        }
      }

      console.log('Getting current authenticated user');
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Authentication error:', authError);
        alert(`Error de autenticación: ${authError.message}`);
        return;
      }

      if (!userData.user) {
        console.error('No authenticated user found');
        alert('No se ha podido confirmar su identidad. Por favor, inicie sesión nuevamente.');
        return;
      }

      console.log(`Authenticated as user ${userData.user.id}`);

      // Use the QuotesService to send to approval
      console.log('Calling QuotesService.sendToApproval');
      try {
        const result = await QuotesService.sendToApproval(quoteId);
        console.log('Quote successfully sent to approval:', result);
        
        alert('Cotización enviada a aprobación');
        fetchDraftQuotes();
        onDataSaved?.();
      } catch (serviceError: any) {
        console.error('Detailed error in QuotesService.sendToApproval:', serviceError);
        
        // Try direct database access as a fallback
        console.log('Attempting direct database update as fallback');
        try {
          // Check if user has permission first
          const { data: quoteData, error: fetchError } = await supabase
            .from('quotes')
            .select('created_by, status')
            .eq('id', quoteId)
            .single();
            
          if (fetchError) {
            console.error('Error fetching quote data:', fetchError);
            throw new Error(`No se pudo obtener la información de la cotización: ${fetchError.message}`);
          }
          
          console.log('Quote data for permission check:', quoteData);
          
          // If user is not the creator and the quote is in draft status, show error
          if (quoteData.created_by !== userData.user.id && quoteData.status === 'DRAFT') {
            throw new Error('No tiene permiso para enviar esta cotización a aprobación. Solo el creador puede enviar a aprobación.');
          }
          
          // Attempt direct update
          const { error: updateError } = await supabase
            .from('quotes')
            .update({ 
              status: 'PENDING_APPROVAL',
              updated_at: new Date().toISOString()
            })
            .eq('id', quoteId);
            
          if (updateError) {
            console.error('Error in direct update fallback:', updateError);
            throw new Error(`Error al actualizar estado: ${updateError.message}`);
          }
          
          console.log('Successfully updated quote via direct fallback');
          alert('Cotización enviada a aprobación');
          fetchDraftQuotes();
          onDataSaved?.();
        } catch (fallbackError: any) {
          console.error('Fallback attempt also failed:', fallbackError);
          alert(`No se pudo enviar la cotización a aprobación: ${fallbackError.message}`);
        }
      }
    } catch (error: any) {
      console.error('General error sending quote to approval:', error);
      alert(`Error inesperado al enviar cotización a aprobación: ${error.message}`);
    }
  };

  // Function to update quote detail margins
  const updateQuoteDetailMargin = (detailIndex: number, newMargin: number) => {
    const updatedDetails = [...editingQuoteDetails];
    const detail = updatedDetails[detailIndex];
    
    // Remove immediate validation to allow temporary values
    const sanitizedMargin = newMargin / 100;
    
    // Maintain price calculation
    const finalPriceUnrounded = detail.base_price * (1 + sanitizedMargin);
    const finalPrice = Math.ceil(finalPriceUnrounded / 5) * 5;

    updatedDetails[detailIndex] = {
      ...detail,
      profit_margin: sanitizedMargin,
      final_price: finalPrice
    };

    setEditingQuoteDetails(updatedDetails);
  };

  // Override openQuoteDetails to prepare editing state
  const openQuoteDetails = (quote: Quote) => {
    // Create a deep copy of quote details for editing
    const editableDetails = quote.quote_details.map(detail => ({
      ...detail,
      profit_margin: detail.final_price / detail.base_price - 1
    }));
    
    setSelectedQuote(quote);
    setEditingQuoteDetails(editableDetails);
  };

  // Function to save quote modifications
  const saveQuoteModifications = async () => {
    try {
      // Update quote details in the database
      const updatePromises = editingQuoteDetails.map(async (detail) => {
        const { error } = await supabase
          .from('quote_details')
          .update({
            final_price: detail.final_price,
            profit_margin: detail.profit_margin * 100, // Convert to percentage
            pump_service: detail.pump_service,
            pump_price: detail.pump_service ? detail.pump_price : null
          })
          .eq('id', detail.id);

        if (error) throw error;
      });

      await Promise.all(updatePromises);

      // Refresh quotes
      fetchDraftQuotes();
      
      // Close modal
      closeQuoteDetails();
      
      // Notify parent component if needed
      onDataSaved?.();

      alert('Cotización actualizada exitosamente');
    } catch (error) {
      console.error('Error updating quote details:', error);
      alert('No se pudieron guardar los cambios');
    }
  };

  const closeQuoteDetails = () => {
    setSelectedQuote(null);
  };

  // Function to update pump service for the entire quote
  const updateQuotePumpService = (pumpService: boolean, pumpPrice: number | null = null) => {
    const updatedDetails = [...editingQuoteDetails].map(detail => ({
      ...detail,
      pump_service: pumpService,
      pump_price: pumpService ? (pumpPrice !== null ? pumpPrice : detail.pump_price) : null
    }));
    setEditingQuoteDetails(updatedDetails);
  };

  return (
    <div className="p-4">
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Número de Cotización</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Sitio de Construcción</th>
                  <th className="px-4 py-3">Total de Productos</th>
                  <th className="px-4 py-3">Fecha de Creación</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id} className="border-b hover:bg-gray-100">
                    <td className="px-4 py-3">{quote.quote_number}</td>
                    <td className="px-4 py-3">
                      {quote.client?.business_name || 'Sin cliente'}
                    </td>
                    <td className="px-4 py-3">{quote.construction_site}</td>
                    <td className="px-4 py-3">{quote.quote_details.length}</td>
                    <td className="px-4 py-3">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => openQuoteDetails(quote)}
                        className="text-blue-600 hover:text-blue-800 mr-2"
                      >
                        Ver Detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-gray-700">
              Mostrando {(page - 1) * quotesPerPage + 1} - {Math.min(page * quotesPerPage, totalQuotes)} de {totalQuotes} cotizaciones
            </span>
            <div className="flex space-x-2">
              <button 
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
              >
                Anterior
              </button>
              <button 
                onClick={() => setPage(prev => (prev * quotesPerPage < totalQuotes ? prev + 1 : prev))}
                disabled={page * quotesPerPage >= totalQuotes}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}

      {/* Quote Details Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-11/12 max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Detalles de Cotización</h2>
                <button 
                  onClick={closeQuoteDetails}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ✕
                </button>
              </div>

              {/* Client Information */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="font-semibold">Cliente</p>
                  <p>{selectedQuote.client?.business_name || 'Sin cliente'}</p>
                  <p>{selectedQuote.client?.client_code || 'Sin código de cliente'}</p>
                </div>
                <div>
                  <p className="font-semibold">Sitio de Construcción</p>
                  <p>{selectedQuote.construction_site}</p>
                </div>
              </div>

              {/* Pump Service Control */}
              <div className="mb-4 p-4 border rounded bg-gray-50">
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="pumpService"
                    checked={editingQuoteDetails.length > 0 && editingQuoteDetails[0].pump_service}
                    onChange={(e) => updateQuotePumpService(e.target.checked, 
                      editingQuoteDetails.length > 0 ? editingQuoteDetails[0].pump_price : null)}
                    className="mr-2 h-4 w-4"
                  />
                  <label htmlFor="pumpService" className="font-medium">
                    Incluir Servicio de Bombeo para toda la cotización
                  </label>
                </div>
                
                {editingQuoteDetails.length > 0 && editingQuoteDetails[0].pump_service && (
                  <div className="mt-2 flex items-center">
                    <label className="mr-2">Precio del Servicio:</label>
                    <input
                      type="number"
                      value={editingQuoteDetails[0].pump_price || ''}
                      onChange={(e) => {
                        const price = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        updateQuotePumpService(true, price);
                      }}
                      placeholder="0.00"
                      min="0"
                      step="1"
                      className="w-32 p-1 border rounded"
                    />
                    <span className="ml-2">MXN</span>
                  </div>
                )}
              </div>

              {/* Quote Details Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-4 py-3">Código de Receta</th>
                      <th className="px-4 py-3">Tipo de Colocación</th>
                      <th className="px-4 py-3">Resistencia</th>
                      <th className="px-4 py-3">Volumen</th>
                      <th className="px-4 py-3">Precio Base</th>
                      <th className="px-4 py-3">Margen (%)</th>
                      <th className="px-4 py-3">Precio Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editingQuoteDetails.map((detail, index) => (
                      <tr key={detail.id} className="border-b hover:bg-gray-100">
                        <td className="px-4 py-3">{detail.recipe?.recipe_code || 'Sin código'}</td>
                        <td className="px-4 py-3">{detail.recipe?.placement_type || 'Sin tipo'}</td>
                        <td className="px-4 py-3">{detail.recipe?.strength_fc || 'N/A'} fc</td>
                        <td className="px-4 py-3">{detail.volume} m³</td>
                        <td className="px-4 py-3">${detail.base_price.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            value={detail.profit_margin * 100 || ''}
                            onChange={(e) => {
                              if (e.target.value === '') {
                                updateQuoteDetailMargin(index, 0);
                                return;
                              }
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value)) updateQuoteDetailMargin(index, value);
                            }}
                            onBlur={(e) => {
                              if (e.target.value === '') {
                                updateQuoteDetailMargin(index, 4);
                                return;
                              }
                              const value = parseFloat(e.target.value);
                              updateQuoteDetailMargin(index, Math.max(4, value));
                            }}
                            placeholder="4%"
                            step="0.1"
                            className="w-20 p-1 border rounded"
                          />
                        </td>
                        <td className="px-4 py-3">${detail.final_price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-4 mt-6">
                <button 
                  onClick={closeQuoteDetails}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button 
                  onClick={saveQuoteModifications}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Guardar Cambios
                </button>
                <button 
                  onClick={() => {
                    sendToApproval(selectedQuote.id);
                    closeQuoteDetails();
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Enviar a Aprobación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 