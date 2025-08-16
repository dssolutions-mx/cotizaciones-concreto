/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { productPriceService } from '@/lib/supabase/product-prices';
import { QuotesService } from '@/services/quotes';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import * as Dialog from '@radix-ui/react-dialog';
import * as Checkbox from '@radix-ui/react-checkbox';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';

interface PendingApprovalTabProps {
  onDataSaved?: () => void;
  statusFilter?: string;
  clientFilter?: string;
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
  includes_vat?: boolean;
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
    includes_vat?: boolean;
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

export default function PendingApprovalTab({ onDataSaved, statusFilter, clientFilter }: PendingApprovalTabProps) {
  const [quotes, setQuotes] = useState<PendingQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalQuotes, setTotalQuotes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const quotesPerPage = 10;
  const { hasRole } = useAuthBridge();

  // Modal state
  const [selectedQuote, setSelectedQuote] = useState<PendingQuote | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showQuoteDetails, setShowQuoteDetails] = useState(false);
  const [editingQuoteDetails, setEditingQuoteDetails] = useState<Array<{
    id: string;
    profit_margin: number;
    final_price: number;
    pump_service: boolean;
    pump_price: number | null;
    includes_vat?: boolean;
    base_price: number;
    volume: number;
    recipe?: {
      recipe_code: string;
      strength_fc: number;
      placement_type: string;
      max_aggregate_size: number;
      slump: number;
      age_days: number;
    } | null;
  }>>([]);

  const fetchPendingQuotes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let query = supabase
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
            includes_vat,
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
        `)
        .eq('status', 'PENDING_APPROVAL');

      // Apply client filter if provided
      if (clientFilter && clientFilter.trim()) {
        // When filtering, we need to fetch all data to handle pagination correctly
        // We'll apply the filter after fetching and then handle pagination client-side
        console.log('Client filter applied, fetching all data for proper pagination');
      } else {
        // Only apply pagination when not filtering
        query = query.range(page * quotesPerPage, (page + 1) * quotesPerPage - 1);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      // Transform the data to match our PendingQuote interface
      let transformedQuotes: PendingQuote[] = (data || []).map(quote => {
        // Handle potential array or object response format
        const clientData = Array.isArray(quote.clients) 
          ? quote.clients[0] 
          : quote.clients;
        
        return {
          id: quote.id,
          quote_number: quote.quote_number,
          construction_site: quote.construction_site,
          created_at: quote.created_at,
          client: clientData ? {
            business_name: clientData.business_name,
            client_code: clientData.client_code
          } : null,
          total_amount: quote.quote_details.reduce((sum: number, detail: SupabaseQuoteDetail) => {
            const detailTotal = detail.final_price * detail.volume;
            const pumpTotal = detail.pump_service && detail.pump_price ? detail.pump_price * detail.volume : 0;
            return sum + detailTotal + pumpTotal;
          }, 0),
          quote_details: quote.quote_details.map((detail: SupabaseQuoteDetail) => {
            // Handle potential array or object response format for recipes
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
            includes_vat: detail.includes_vat,
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
        };
      });
      
      // Apply client-side filtering if clientFilter is provided
      if (clientFilter && clientFilter.trim()) {
        const filterLower = clientFilter.toLowerCase();
        transformedQuotes = transformedQuotes.filter(quote => 
          quote.client?.business_name?.toLowerCase().includes(filterLower) ||
          quote.client?.client_code?.toLowerCase().includes(filterLower)
        );
        
        // Handle pagination for filtered results
        const startIndex = page * quotesPerPage;
        const endIndex = startIndex + quotesPerPage;
        transformedQuotes = transformedQuotes.slice(startIndex, endIndex);
        
        // Set total count to the total filtered results (before pagination)
        const totalFiltered = (data || []).filter(quote => {
          const clientData = Array.isArray(quote.clients) ? quote.clients[0] : quote.clients;
          return clientData && (
            clientData.business_name?.toLowerCase().includes(filterLower) ||
            clientData.client_code?.toLowerCase().includes(filterLower)
          );
        }).length;
        setTotalQuotes(totalFiltered);
      } else {
        // Count total quotes for pagination
        let countQuery = supabase
          .from('quotes')
          .select('id', { count: 'exact' })
          .eq('status', 'PENDING_APPROVAL');
        
        const { count, error: countError } = await countQuery;
        
        if (countError) {
          console.error('Error counting quotes:', countError);
        } else {
          setTotalQuotes(count || 0);
        }
      }
      
      setQuotes(transformedQuotes);
    } catch (err) {
      setError('Error al cargar las cotizaciones pendientes de aprobación');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [page, quotesPerPage, clientFilter]);

  useEffect(() => {
    fetchPendingQuotes();
  }, [fetchPendingQuotes]);

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
                base_price: detail.base_price,
                final_price: detail.final_price,
                profit_margin: detail.profit_margin * 100, // Convert to percentage
                pump_service: detail.pump_service,
                pump_price: detail.pump_service ? detail.pump_price : null,
                includes_vat: detail.includes_vat ?? false
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
                base_price: detail.base_price,
                final_price: detail.final_price,
                profit_margin: detail.profit_margin * 100, // Convert to percentage
                pump_service: detail.pump_service,
                pump_price: detail.pump_service ? detail.pump_price : null,
                includes_vat: detail.includes_vat ?? false
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

  // Add deleteQuote function
  const deleteQuote = async (quoteId: string) => {
    try {
      // Confirm deletion with the user
      if (!confirm("¿Estás seguro de que deseas eliminar esta cotización? Esta acción no se puede deshacer.")) {
        return;
      }

      // Delete all related quote_details first
      const { error: detailsError } = await supabase
        .from('quote_details')
        .delete()
        .eq('quote_id', quoteId);

      if (detailsError) {
        throw new Error(`Error al eliminar detalles de la cotización: ${detailsError.message}`);
      }

      // Then delete the quote itself
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (error) {
        throw new Error(`Error al eliminar cotización: ${error.message}`);
      }

      // Refresh the list
      fetchPendingQuotes();
      onDataSaved?.();
      alert('Cotización eliminada correctamente');
    } catch (error: unknown) {
      console.error('Error deleting quote:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error al eliminar cotización: ${errorMessage}`);
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

  // Function to update base price directly
  const updateQuoteDetailBasePrice = (detailIndex: number, newBasePrice: number) => {
    const updatedDetails = [...editingQuoteDetails];
    const detail = updatedDetails[detailIndex];
    
    // Recalculate margin based on new base price and existing final price
    const newMargin = detail.final_price / newBasePrice - 1;
    
    updatedDetails[detailIndex] = {
      ...detail,
      base_price: newBasePrice,
      profit_margin: newMargin
    };

    setEditingQuoteDetails(updatedDetails);
  };

  // Function to update final price directly
  const updateQuoteDetailFinalPrice = (detailIndex: number, newFinalPrice: number) => {
    const updatedDetails = [...editingQuoteDetails];
    const detail = updatedDetails[detailIndex];
    
    // Recalculate margin based on new final price and existing base price
    const newMargin = newFinalPrice / detail.base_price - 1;
    
    updatedDetails[detailIndex] = {
      ...detail,
      final_price: newFinalPrice,
      profit_margin: newMargin
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

  // Function to toggle VAT for the entire quote
  const updateQuoteVAT = (includesVAT: boolean) => {
    const updatedDetails = [...editingQuoteDetails].map(detail => ({
      ...detail,
      includes_vat: includesVAT,
    }));
    setEditingQuoteDetails(updatedDetails);
  };

  // Override openQuoteDetails to prepare editing state
  const openQuoteDetails = (quote: PendingQuote) => {
    // Create a deep copy of quote details for editing
    const editableDetails = quote.quote_details.map(detail => ({
      ...detail,
      profit_margin: detail.final_price / detail.base_price - 1,
      includes_vat: (detail as any).includes_vat ?? false
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
            base_price: detail.base_price,
            final_price: detail.final_price,
            profit_margin: detail.profit_margin * 100, // Convert to percentage
            pump_service: detail.pump_service,
            pump_price: detail.pump_service ? detail.pump_price : null,
            includes_vat: detail.includes_vat ?? false
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

  // Wrap the component with RoleProtectedSection
  return (
    <RoleProtectedSection 
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
      <div className="p-6">
        {/* Header and Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center">
            <h2 className="text-xl font-semibold text-gray-800">Cotizaciones Pendientes de Aprobación</h2>
            <span className="ml-3 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
              {totalQuotes}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
            <p className="ml-3 text-gray-700">Cargando cotizaciones...</p>
          </div>
        ) : (
          <>
            {quotes.length === 0 ? (
              <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
                <svg className="h-12 w-12 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No se encontraron cotizaciones</h3>
                <p className="mt-1 text-gray-500">
                  No hay cotizaciones pendientes de aprobación.
                </p>
              </div>
            ) : (
              <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <ul className="divide-y divide-gray-200">
                  {quotes.map(quote => (
                    <li key={quote.id} className="hover:bg-gray-50 transition-colors">
                      <div className="px-4 py-5 sm:px-6 @container">
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                          <div className="col-span-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                              <div className="flex items-center">
                                <h3 className="text-lg font-medium text-gray-900">
                                  {quote.client?.business_name || 'Cliente sin nombre'}
                                </h3>
                                <span className="ml-2 text-sm text-gray-500">#{quote.quote_number}</span>
                              </div>
                              
                              <div className="text-sm text-gray-500 mt-1 sm:mt-0">
                                {new Date(quote.created_at).toLocaleDateString()} 
                              </div>
                            </div>
                            
                            <div className="mt-2 flex flex-col sm:flex-row sm:gap-x-6 text-sm">
                              <div>
                                <span className="font-medium text-gray-500">Obra:</span> {quote.construction_site}
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Código:</span> {quote.client?.client_code || 'Sin código'}
                              </div>
                            </div>
                            
                            <div className="mt-2 flex flex-wrap gap-2">
                              {quote.quote_details.slice(0, 3).map((detail) => (
                                <span key={detail.id} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                  {detail.recipe?.recipe_code || 'Sin código'} - {detail.volume}m³
                                </span>
                              ))}
                              {quote.quote_details.length > 3 && (
                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                  +{quote.quote_details.length - 3} más
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:items-end sm:justify-center gap-3">
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">
                                ${quote.total_amount.toLocaleString('es-MX', { 
                                  minimumFractionDigits: 2, 
                                  maximumFractionDigits: 2 
                                })}
                              </p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                onClick={() => openQuoteDetails(quote)}
                                className="inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 bg-white rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                              >
                                <svg className="h-4 w-4 mr-1.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Ver
                              </button>
                              <button
                                onClick={() => approveQuote(quote.id)}
                                className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent bg-green-600 rounded-md text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                              >
                                <svg className="h-4 w-4 mr-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                                Aprobar
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt('Razón de rechazo:');
                                  if (reason) rejectQuote(quote.id, reason);
                                }}
                                className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent bg-red-600 rounded-md text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                              >
                                <svg className="h-4 w-4 mr-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Rechazar
                              </button>
                              <button
                                onClick={() => deleteQuote(quote.id)}
                                className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent bg-gray-600 rounded-md text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                              >
                                <svg className="h-4 w-4 mr-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pagination - Improved version */}
            {quotes.length > 0 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">{((page) * quotesPerPage) + 1}</span> a <span className="font-medium">{Math.min((page + 1) * quotesPerPage, totalQuotes)}</span> de <span className="font-medium">{totalQuotes}</span> cotizaciones
                </div>
                
                <nav className="flex items-center space-x-1" aria-label="Pagination">
                  <button
                    onClick={() => setPage(prev => Math.max(prev - 1, 0))}
                    disabled={page === 0}
                    className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="sr-only">Anterior</span>
                  </button>
                  
                  {/* Page number buttons */}
                  {Array.from({ length: Math.min(5, Math.ceil(totalQuotes / quotesPerPage)) }, (_, i) => {
                    // Calculate the page number to display (show current page in middle when possible)
                    const pageCount = Math.ceil(totalQuotes / quotesPerPage);
                    let pageNum = 0;
                    
                    if (pageCount <= 5) {
                      // If 5 or fewer pages, just display all pages
                      pageNum = i;
                    } else if (page <= 2) {
                      // At start, show first 5 pages
                      pageNum = i;
                    } else if (page >= pageCount - 3) {
                      // At end, show last 5 pages
                      pageNum = pageCount - 5 + i;
                    } else {
                      // In middle, show current page and 2 on each side
                      pageNum = page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={i}
                        onClick={() => setPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${
                          page === pageNum
                            ? 'z-10 bg-green-50 border-green-500 text-green-600'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        } border rounded-md`}
                      >
                        {pageNum + 1}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setPage(prev => ((prev + 1) * quotesPerPage < totalQuotes ? prev + 1 : prev))}
                    disabled={(page + 1) * quotesPerPage >= totalQuotes}
                    className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <span className="sr-only">Siguiente</span>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </nav>
              </div>
            )}
          </>
        )}

        {/* Quote Details Modal */}
        {selectedQuote && (
          <Dialog.Root open={!!selectedQuote} onOpenChange={(open) => !open && closeQuoteDetails()}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
              <Dialog.Content className="fixed inset-0 flex justify-center items-end sm:items-center z-50 p-0 sm:p-4">
                <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:w-11/12 md:max-w-4xl h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in duration-200">
                  <Dialog.Title className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <div className="text-xl font-bold text-gray-800">Detalles de Cotización</div>
                    <Dialog.Close className="text-gray-500 hover:text-gray-700 focus:outline-none" aria-label="Cerrar">
                      <Cross2Icon className="h-5 w-5" />
                    </Dialog.Close>
                  </Dialog.Title>

                  <div className="p-6 overflow-y-auto flex-grow">
                    {/* Client Information */}
                    <div className="grid grid-cols-1 @md:grid-cols-2 gap-6 mb-6 bg-gray-50 p-4 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-500 text-sm mb-1">Cliente</p>
                        <p className="font-semibold text-gray-900">{selectedQuote.client?.business_name || 'Sin cliente'}</p>
                        <p className="text-gray-700">{selectedQuote.client?.client_code || 'Sin código de cliente'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500 text-sm mb-1">Sitio de Construcción</p>
                        <p className="font-semibold text-gray-900">{selectedQuote.construction_site}</p>
                      </div>
                    </div>

                    {/* Pump Service Control */}
                    <div className="mb-4 p-4 border rounded-lg bg-gray-50 @container">
                      <div className="flex items-center mb-2">
                        <Checkbox.Root
                          id="pumpService"
                          checked={editingQuoteDetails.length > 0 && editingQuoteDetails[0].pump_service}
                          onCheckedChange={(checked: boolean | 'indeterminate') => {
                            const isChecked = checked === true;
                            updateQuotePumpService(isChecked, 
                              editingQuoteDetails.length > 0 ? editingQuoteDetails[0].pump_price : null);
                          }}
                          className="h-4 w-4 bg-white border border-gray-300 rounded flex items-center justify-center data-[state=checked]:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                          <Checkbox.Indicator>
                            <CheckIcon className="h-3 w-3 text-white" />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <label htmlFor="pumpService" className="ms-2 font-medium text-gray-700">
                          Incluir Servicio de Bombeo para toda la cotización
                        </label>
                      </div>
                      
                      {editingQuoteDetails.length > 0 && editingQuoteDetails[0].pump_service && (
                        <div className="mt-3 flex flex-col @md:flex-row @md:items-center gap-2">
                          <label className="text-sm text-gray-700 font-medium">Precio del Servicio:</label>
                          <div className="flex items-center">
                            <span className="text-gray-500 pe-2">$</span>
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
                              className="w-32 p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                            <span className="text-gray-500 ps-2">MXN</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* VAT Control */}
                    <div className="mb-6 p-4 border rounded-lg bg-gray-50 @container">
                      <div className="flex items-center">
                        <Checkbox.Root
                          id="includesVAT"
                          checked={editingQuoteDetails.length > 0 && editingQuoteDetails.every(d => d.includes_vat)}
                          onCheckedChange={(checked: boolean | 'indeterminate') => {
                            const isChecked = checked === true;
                            const updated = editingQuoteDetails.map(d => ({ ...d, includes_vat: isChecked }));
                            setEditingQuoteDetails(updated);
                          }}
                          className="h-4 w-4 bg-white border border-gray-300 rounded flex items-center justify-center data-[state=checked]:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                          <Checkbox.Indicator>
                            <CheckIcon className="h-3 w-3 text-white" />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <label htmlFor="includesVAT" className="ms-2 font-medium text-gray-700">
                          Incluir IVA en la cotización
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Esta opción aplicará IVA a todos los conceptos de la cotización.</p>
                    </div>

                    {/* Quote Details Table - Responsive */}
                    <div className="rounded-lg border border-gray-200 shadow-sm">
                      {/* Desktop/Table view */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600">
                          <thead className="text-xs uppercase bg-gray-50 text-gray-700">
                            <tr>
                              <th className="px-4 py-3 font-medium">Código de Receta</th>
                              <th className="px-4 py-3 font-medium">Tipo de Colocación</th>
                              <th className="px-4 py-3 font-medium">Resistencia</th>
                              <th className="px-4 py-3 font-medium">Volumen</th>
                              <th className="px-4 py-3 font-medium">Precio Base</th>
                              <th className="px-4 py-3 font-medium">Margen (%)</th>
                              <th className="px-4 py-3 font-medium">Precio Final</th>
                              <th className="px-4 py-3 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {editingQuoteDetails.map((detail, index) => (
                              <tr key={detail.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">{detail.recipe?.recipe_code || 'Sin código'}</td>
                                <td className="px-4 py-3">{detail.recipe?.placement_type || 'Sin tipo'}</td>
                                <td className="px-4 py-3">{detail.recipe?.strength_fc || 'N/A'} fc</td>
                                <td className="px-4 py-3">{detail.volume} m³</td>
                                <td className="px-4 py-3">
                                  <input 
                                    type="number" 
                                    value={detail.base_price.toFixed(2)}
                                    onChange={(e) => {
                                      if (e.target.value === '') {
                                        updateQuoteDetailBasePrice(index, 0);
                                        return;
                                      }
                                      const value = parseFloat(e.target.value);
                                      if (!isNaN(value)) updateQuoteDetailBasePrice(index, value);
                                    }}
                                    placeholder="0.00"
                                    step="0.01"
                                    className="w-24 p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input 
                                    type="number" 
                                    value={Math.round(detail.profit_margin * 10000) / 100}
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
                                    step="0.01"
                                    className="w-24 p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                  />
                                </td>
                                <td className="px-4 py-3 font-medium">${detail.final_price.toFixed(2)}</td>
                                <td className="px-4 py-3 font-medium">${(detail.final_price * detail.volume).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile card view */}
                      <div className="md:hidden divide-y divide-gray-200">
                        {editingQuoteDetails.map((detail, index) => (
                          <div key={detail.id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-gray-500">Código</p>
                                <p className="font-medium text-gray-900">{detail.recipe?.recipe_code || 'Sin código'}</p>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${detail.includes_vat ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>
                                {detail.includes_vat ? 'IVA incluido' : 'Sin IVA'}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-3 text-sm text-gray-600">
                              <div>
                                <p className="text-gray-500">Tipo</p>
                                <p>{detail.recipe?.placement_type || 'Sin tipo'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Resistencia</p>
                                <p>{detail.recipe?.strength_fc || 'N/A'} fc</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Volumen</p>
                                <p>{detail.volume} m³</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Total</p>
                                <p className="font-medium">${(detail.final_price * detail.volume).toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Precio Base</label>
                                <input
                                  type="number"
                                  value={detail.base_price.toFixed(2)}
                                  onChange={(e) => {
                                    if (e.target.value === '') {
                                      updateQuoteDetailBasePrice(index, 0);
                                      return;
                                    }
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value)) updateQuoteDetailBasePrice(index, value);
                                  }}
                                  placeholder="0.00"
                                  step="0.01"
                                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Margen (%)</label>
                                <input
                                  type="number"
                                  value={Math.round(detail.profit_margin * 10000) / 100}
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
                                  step="0.01"
                                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Precio Final</label>
                                <input
                                  type="number"
                                  value={detail.final_price.toFixed(2)}
                                  onChange={(e) => {
                                    if (e.target.value === '') {
                                      updateQuoteDetailFinalPrice(index, 0);
                                      return;
                                    }
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value)) updateQuoteDetailFinalPrice(index, value);
                                  }}
                                  placeholder="0.00"
                                  step="0.01"
                                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Modal Actions */}
                  <div className="p-6 border-t border-gray-200 bg-gray-50 flex flex-col @sm:flex-row @sm:justify-end gap-3">
                    <Dialog.Close 
                      className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Cancelar
                    </Dialog.Close>
                    <button 
                      onClick={saveQuoteModifications}
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="h-4 w-4 me-1.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v6" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14h6" />
                      </svg>
                      Guardar Cambios
                    </button>
                    <button 
                      onClick={() => {
                        approveQuote(selectedQuote.id);
                        closeQuoteDetails();
                      }}
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <svg className="h-4 w-4 me-1.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
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
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <svg className="h-4 w-4 me-1.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Rechazar
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm("¿Estás seguro de que deseas eliminar esta cotización? Esta acción no se puede deshacer.")) {
                          deleteQuote(selectedQuote.id);
                          closeQuoteDetails();
                        }
                      }}
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      <svg className="h-4 w-4 me-1.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar
                    </button>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </div>
    </RoleProtectedSection>
  );
} 