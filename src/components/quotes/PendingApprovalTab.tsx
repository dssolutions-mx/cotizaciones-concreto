'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { productPriceService } from '@/lib/supabase/product-prices';
import { QuotesService } from '@/services/quotes';
import { useAuth } from '@/contexts/AuthContext';
import RoleGuard from '@/components/auth/RoleGuard';

interface PendingApprovalTabProps {
  onDataSaved?: () => void;
}

interface SupabasePendingQuote {
  id: string;
  quote_number: string;
  construction_site: string;
  created_at: string;
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

interface PendingQuote {
  id: string;
  quote_number: string;
  client: {
    business_name: string;
    client_code: string;
  } | null;
  construction_site: string;
  total_amount: number;
  created_at: string;
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

export default function PendingApprovalTab({ onDataSaved }: PendingApprovalTabProps) {
  const [quotes, setQuotes] = useState<PendingQuote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalQuotes, setTotalQuotes] = useState(0);
  const quotesPerPage = 25;
  const { hasRole } = useAuth();

  // Modal state
  const [selectedQuote, setSelectedQuote] = useState<PendingQuote | null>(null);

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

  const fetchPendingQuotes = async () => {
    try {
      setIsLoading(true);
      const { data, count, error } = await supabase
        .from('quotes')
        .select(`
          id, 
          quote_number, 
          construction_site, 
          created_at,
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
        .eq('status', 'PENDING_APPROVAL')
        .range((page - 1) * quotesPerPage, page * quotesPerPage - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to match PendingQuote interface
      const transformedQuotes: PendingQuote[] = (data || []).map(quote => {
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
          quote_details: quoteDetailsData,
          total_amount: quoteDetailsData.reduce((sum, detail) => sum + (detail.final_price * detail.volume), 0)
        };
      });

      setQuotes(transformedQuotes);
      setTotalQuotes(count || 0);
    } catch (error) {
      console.error('Error fetching pending quotes:', error);
      alert('No se pudieron cargar las cotizaciones pendientes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingQuotes();
  }, [page]);

  const approveQuote = async (quoteId: string) => {
    try {
      // If we're currently editing this quote, save the changes first
      if (selectedQuote && selectedQuote.id === quoteId && editingQuoteDetails.length > 0) {
        // Save changes but don't close the modal
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
        } catch (error) {
          console.error('Error updating quote details before approval:', error);
          throw new Error('No se pudieron guardar los cambios antes de aprobar');
        }
      }

      // Use QuotesService to approve the quote
      try {
        await QuotesService.updateStatus(quoteId, 'APPROVED');
      } catch (updateError) {
        console.error('Error updating quote status:', updateError);
        throw updateError;
      }

      // Handle price history
      try {
        await productPriceService.handleQuoteApproval(quoteId);
      } catch (priceError: any) {
        // If price history fails, revert the quote status
        try {
          await QuotesService.updateStatus(quoteId, 'PENDING_APPROVAL');
        } catch (revertError) {
          console.error('Error reverting quote status:', revertError);
        }
        
        throw new Error(`Error handling price history: ${priceError.message}`);
      }

      alert('Cotización aprobada');
      fetchPendingQuotes();
      onDataSaved?.();
    } catch (error: any) {
      console.error('Error approving quote:', error.message);
      alert(`No se pudo aprobar la cotización: ${error.message}`);
    }
  };

  const rejectQuote = async (quoteId: string, reason: string) => {
    try {
      // If we're currently editing this quote, save the changes first
      if (selectedQuote && selectedQuote.id === quoteId && editingQuoteDetails.length > 0) {
        // Save changes but don't close the modal
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
        } catch (error) {
          console.error('Error updating quote details before rejection:', error);
          throw new Error('No se pudieron guardar los cambios antes de rechazar');
        }
      }

      // Use QuotesService to reject the quote
      await QuotesService.updateStatus(quoteId, 'REJECTED', { rejection_reason: reason });

      alert('Cotización rechazada');
      fetchPendingQuotes();
      onDataSaved?.();
    } catch (error) {
      console.error('Error rejecting quote:', error);
      alert('No se pudo rechazar la cotización');
    }
  };

  // Function to update quote detail margins
  const updateQuoteDetailMargin = (detailIndex: number, newMargin: number) => {
    const updatedDetails = [...editingQuoteDetails];
    const detail = updatedDetails[detailIndex];
    
    // Remove immediate clamping to allow temporary values
    const sanitizedMargin = newMargin / 100;
    
    // Recalculate final price
    const finalPriceUnrounded = detail.base_price * (1 + sanitizedMargin);
    const finalPrice = Math.ceil(finalPriceUnrounded / 5) * 5;

    updatedDetails[detailIndex] = {
      ...detail,
      profit_margin: sanitizedMargin,
      final_price: finalPrice
    };

    setEditingQuoteDetails(updatedDetails);
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

  // Override openQuoteDetails to prepare editing state
  const openQuoteDetails = (quote: PendingQuote) => {
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
      fetchPendingQuotes();
      
      // Close modal
      closeQuoteDetails();

      alert('Cotización actualizada exitosamente');
    } catch (error) {
      console.error('Error updating quote details:', error);
      alert('No se pudieron guardar los cambios');
    }
  };

  const closeQuoteDetails = () => {
    setSelectedQuote(null);
  };

  // Wrap the component with RoleGuard
  return (
    <RoleGuard 
      allowedRoles={['PLANT_MANAGER', 'EXECUTIVE']}
      fallback={
        <div className="p-8 text-center bg-gray-50 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Acceso Restringido</h3>
          <p className="text-gray-600">
            Solo los gerentes de planta y ejecutivos pueden aprobar cotizaciones.
          </p>
        </div>
      }
    >
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
                    <th className="px-4 py-3">Fecha de Creación</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">{quote.quote_number}</td>
                      <td className="px-4 py-3">
                        {quote.client?.business_name} ({quote.client?.client_code})
                      </td>
                      <td className="px-4 py-3">{quote.construction_site}</td>
                      <td className="px-4 py-3">
                        {new Date(quote.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center space-x-2">
                          <button 
                            onClick={() => openQuoteDetails(quote)}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            Ver Detalles
                          </button>
                          {hasRole(['PLANT_MANAGER', 'EXECUTIVE']) && (
                            <button 
                              onClick={() => approveQuote(quote.id)}
                              className="text-green-500 hover:text-green-700"
                            >
                              Aprobar
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              const reason = prompt('Razón de rechazo:');
                              if (reason) rejectQuote(quote.id, reason);
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            Rechazar
                          </button>
                        </div>
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
                        <th className="px-4 py-3">Total</th>
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
                                const rawValue = e.target.value;
                                // Allow empty input during editing
                                if (rawValue === '') {
                                  updateQuoteDetailMargin(index, 0);
                                  return;
                                }
                                const value = parseFloat(rawValue);
                                if (!isNaN(value)) {
                                  updateQuoteDetailMargin(index, value);
                                }
                              }}
                              onBlur={(e) => {
                                const rawValue = e.target.value;
                                if (rawValue === '') {
                                  // Set to minimum if left empty
                                  updateQuoteDetailMargin(index, 4);
                                  return;
                                }
                                const value = parseFloat(rawValue);
                                if (!isNaN(value)) {
                                  const clampedValue = Math.max(4, value);
                                  updateQuoteDetailMargin(index, clampedValue);
                                }
                              }}
                              step="0.1"
                              className="w-20 p-1 border rounded"
                              placeholder="4%"
                            />
                          </td>
                          <td className="px-4 py-3">${detail.final_price.toFixed(2)}</td>
                          <td className="px-4 py-3">${(detail.final_price * detail.volume).toFixed(2)}</td>
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
                      approveQuote(selectedQuote.id);
                      closeQuoteDetails();
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Aprobar
                  </button>
                  <button 
                    onClick={() => {
                      const reason = prompt('Razón de rechazo:');
                      if (reason) {
                        rejectQuote(selectedQuote.id, reason);
                        closeQuoteDetails();
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
} 