/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { QuotesService } from '@/services/quotes';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as Dialog from '@radix-ui/react-dialog';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';

interface DraftQuotesTabProps {
  onDataSaved?: () => void;
  statusFilter?: string;
  clientFilter?: string;
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
  }[];
  quote_details: SupabaseQuoteDetail[];
}

interface SupabaseQuoteDetail {
  id: string;
  volume: number;
  base_price: number;
  final_price: number;
  profit_margin: number;
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
    recipe_versions: {
      notes: string;
      is_current: boolean;
    }[];
  }[];
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
    profit_margin: number;
    pump_service: boolean;
    pump_price: number | null;
    recipe: {
      recipe_code: string;
      strength_fc: number;
      placement_type: string;
      max_aggregate_size: number;
      slump: number;
      age_days: number;
      notes: string;
    } | null;
  }>;
}

export default function DraftQuotesTab({ onDataSaved, statusFilter, clientFilter }: DraftQuotesTabProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalQuotes, setTotalQuotes] = useState(0);
  const quotesPerPage = 10;
  // Add state for search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('DRAFT'); // Default to DRAFT
  const [showSearch, setShowSearch] = useState(false);

  // Modal state
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  
  // Add state for editing quote details
  const [editingQuoteDetails, setEditingQuoteDetails] = useState<Array<{
    id: string;
    margin: number;
    base_price: number;
    final_price: number;
    pump_service: boolean;
    pump_price: number | null;
    volume: number;
    recipe?: {
      recipe_code: string;
      strength_fc: number;
      placement_type: string;
      max_aggregate_size: number;
      slump: number;
      age_days: number;
      notes: string;
    } | null;
  }>>([]);

  const fetchDraftQuotes = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Calculate the correct range based on page (1-indexed)
      const from = (page - 1) * quotesPerPage;
      const to = from + quotesPerPage - 1;
      
      // Start building the query
      let query = supabase
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
            profit_margin,
            pump_service,
            pump_price,
            recipe_id,
            recipes (
              recipe_code,
              strength_fc,
              placement_type,
              max_aggregate_size,
              slump,
              age_days,
              recipe_versions(
                notes,
                is_current
              )
            )
          )
        `, { count: 'exact' });
      
      // Apply status filter
      query = query.eq('status', filterStatus);
      
      // Apply client filter if provided (from props)
      if (clientFilter && clientFilter.trim()) {
        // When filtering, we need to fetch all data to handle pagination correctly
        // We'll apply the filter after fetching and then handle pagination client-side
        console.log('Client filter applied, fetching all data for proper pagination');
      } else {
        // Only apply pagination when not filtering
        query = query.range(from, to);
      }
      
      // Apply search filter if present (local search)
      if (searchTerm.trim()) {
        query = query.or(`
          clients.business_name.ilike.%${searchTerm}%,
          clients.client_code.ilike.%${searchTerm}%,
          quote_number.ilike.%${searchTerm}%,
          construction_site.ilike.%${searchTerm}%
        `);
      }
      
      // Add sorting and pagination
      const { data, error, count } = await query
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      // Transform the data to match our Quote interface, following ApprovedQuotesTab pattern
      let transformedQuotes: Quote[] = (data || []).map(quote => {
        // Access the client data properly
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
          quote_details: quote.quote_details.map((detail: SupabaseQuoteDetail) => {
            // Handle recipe data properly like in ApprovedQuotesTab
            const recipeData = Array.isArray(detail.recipes) 
              ? detail.recipes[0] 
              : detail.recipes;
              
            return {
              id: detail.id,
              volume: detail.volume,
              base_price: detail.base_price,
              final_price: detail.final_price,
              profit_margin: detail.profit_margin,
              pump_service: detail.pump_service,
              pump_price: detail.pump_price,
              recipe: recipeData ? {
                recipe_code: recipeData.recipe_code,
                strength_fc: recipeData.strength_fc,
                placement_type: recipeData.placement_type,
                max_aggregate_size: recipeData.max_aggregate_size,
                slump: recipeData.slump,
                age_days: recipeData.age_days,
                notes: recipeData.recipe_versions?.find((version: {is_current: boolean, notes: string}) => version.is_current)?.notes
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
        const startIndex = (page - 1) * quotesPerPage;
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
        // Set the total quotes count for pagination
        if (count !== null) {
          setTotalQuotes(count);
        }
      }
      
      setQuotes(transformedQuotes);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      alert('No se pudieron cargar las cotizaciones');
    } finally {
      setIsLoading(false);
    }
  }, [page, filterStatus, searchTerm, clientFilter]);

  // Call our fetchDraftQuotes when component mounts or dependencies change
  useEffect(() => {
    fetchDraftQuotes();
  }, [fetchDraftQuotes]);

  // Count total quotes for pagination - this is now handled in the fetchDraftQuotes function
  useEffect(() => {
    async function countDraftQuotes() {
      try {
        let query = supabase
          .from('quotes')
          .select('*', { count: 'exact', head: true })
          .eq('status', filterStatus);
          
        // Apply search if present
        if (searchTerm.trim()) {
          query = query.or(`
            clients.business_name.ilike.%${searchTerm}%,
            clients.client_code.ilike.%${searchTerm}%,
            quote_number.ilike.%${searchTerm}%,
            construction_site.ilike.%${searchTerm}%
          `);
        }
        
        const { count, error } = await query;
        
        if (error) {
          throw error;
        }
        
        if (count !== null) {
          setTotalQuotes(count);
        }
      } catch (error) {
        console.error('Error counting quotes:', error);
      }
    }
    
    // Only run this if we don't already have the count from the main query
    if (totalQuotes === 0) {
      countDraftQuotes();
    }
  }, [filterStatus, searchTerm, totalQuotes]);

  const sendToApproval = async (quoteId: string) => {
    console.log(`Starting to send quote ${quoteId} to approval`);
    try {
      // If we're currently editing this quote, save the changes first
      if (selectedQuote && selectedQuote.id === quoteId && editingQuoteDetails.length > 0) {
        console.log('Saving quote modifications before sending to approval');
        try {
          await saveQuoteModifications();
        } catch (saveError: unknown) {
          console.error('Failed to save modifications before sending to approval:', saveError);
          const errorMessage = saveError instanceof Error ? saveError.message : 'Error desconocido';
          alert(`Error al guardar modificaciones: ${errorMessage}`);
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
      } catch (serviceError: unknown) {
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
        } catch (fallbackError: unknown) {
          console.error('Fallback attempt also failed:', fallbackError);
          const errorMessage = fallbackError instanceof Error ? fallbackError.message : 'Error desconocido';
          alert(`No se pudo enviar la cotización a aprobación: ${errorMessage}`);
        }
      }
    } catch (error: unknown) {
      console.error('General error sending quote to approval:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error inesperado al enviar cotización a aprobación: ${errorMessage}`);
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
      margin: sanitizedMargin,
      final_price: finalPrice
    };

    setEditingQuoteDetails(updatedDetails);
  };

  // Override openQuoteDetails to prepare editing state
  const openQuoteDetails = (quote: Quote) => {
    // Create a deep copy of quote details for editing
    const editableDetails = quote.quote_details.map(detail => ({
      id: detail.id,
      volume: detail.volume,
      base_price: detail.base_price,
      final_price: detail.final_price,
      // Calculate margin from final_price/base_price or use profit_margin if available
      margin: detail.profit_margin !== undefined ? 
        detail.profit_margin / 100 : 
        (detail.final_price / detail.base_price - 1),
      pump_service: detail.pump_service || false,
      pump_price: detail.pump_price || 0,
      recipe: detail.recipe
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
            profit_margin: detail.margin * 100, // Convert to percentage
            pump_service: detail.pump_service,
            // Only include pump_price if pump_service is true
            pump_price: detail.pump_service ? detail.pump_price : null,
            total_amount: detail.final_price * detail.volume
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
    const updatedDetails = [...editingQuoteDetails].map(detail => {
      // Keep the original pump_price if it's being enabled and no new price is provided
      const newPumpPrice = pumpService 
        ? (pumpPrice !== null ? pumpPrice : (detail.pump_price || 0)) 
        : null;
        
      return {
        ...detail,
        pump_service: pumpService,
        pump_price: newPumpPrice
      };
    });
    
    setEditingQuoteDetails(updatedDetails);
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
      fetchDraftQuotes();
      onDataSaved?.();
      alert('Cotización eliminada correctamente');
    } catch (error: unknown) {
      console.error('Error deleting quote:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error al eliminar cotización: ${errorMessage}`);
    }
  };

  return (
    <div className="p-6">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center">
          <h2 className="text-xl font-semibold text-gray-800">Cotizaciones Borrador</h2>
          <span className="ml-3 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
            {totalQuotes}
          </span>
        </div>
        
        <div className="flex flex-1 sm:flex-none gap-2">
          {showSearch ? (
            <div className="relative w-full sm:w-64">
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1); // Reset to first page on search
                }}
                placeholder="Buscar cotizaciones..."
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setShowSearch(false);
                }}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 bg-white rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <svg
                className="h-4 w-4 mr-2 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Buscar
            </button>
          )}

          {/* Add status filter if needed 
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1); // Reset to first page on filter change
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="DRAFT">Borrador</option>
            <option value="PENDING">Pendiente</option>
            <option value="APPROVED">Aprobada</option>
            <option value="REJECTED">Rechazada</option>
          </select>
          */}
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
                {searchTerm ? 'No hay resultados para tu búsqueda.' : 'Aún no hay cotizaciones borrador.'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 text-sm text-green-600 hover:text-green-800"
                >
                  Limpiar búsqueda
                </button>
              )}
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
                              ${quote.quote_details.reduce((total, detail) => total + (detail.final_price * detail.volume), 0).toLocaleString('es-MX', { 
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
                              onClick={() => sendToApproval(quote.id)}
                              className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent bg-green-600 rounded-md text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                              <svg className="h-4 w-4 mr-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              Enviar a aprobación
                            </button>
                            <button
                              onClick={() => deleteQuote(quote.id)}
                              className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent bg-red-600 rounded-md text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
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
                Mostrando <span className="font-medium">{((page - 1) * quotesPerPage) + 1}</span> a <span className="font-medium">{Math.min(page * quotesPerPage, totalQuotes)}</span> de <span className="font-medium">{totalQuotes}</span> cotizaciones
              </div>
              
              <nav className="flex items-center space-x-1" aria-label="Pagination">
                <button
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  disabled={page === 1}
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
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    // At start, show first 5 pages
                    pageNum = i + 1;
                  } else if (page >= pageCount - 2) {
                    // At end, show last 5 pages
                    pageNum = pageCount - 4 + i;
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
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setPage(prev => (prev * quotesPerPage < totalQuotes ? prev + 1 : prev))}
                  disabled={page * quotesPerPage >= totalQuotes}
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
            <Dialog.Content className="fixed inset-0 flex justify-center items-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-11/12 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in duration-200">
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
                  <div className="mb-6 p-4 border rounded-lg bg-gray-50 @container">
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

                  {/* Quote Details Table */}
                  <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
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
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {editingQuoteDetails.map((detail, index) => (
                          <tr key={detail.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">{detail.recipe?.recipe_code || 'Sin código'}</td>
                            <td className="px-4 py-3">{detail.recipe?.placement_type || 'Sin tipo'}</td>
                            <td className="px-4 py-3">{detail.recipe?.strength_fc || 'N/A'} fc</td>
                            <td className="px-4 py-3">{detail.volume} m³</td>
                            <td className="px-4 py-3">${detail.base_price.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <input 
                                type="number" 
                                value={Math.round(detail.margin * 10000) / 100}
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                      sendToApproval(selectedQuote.id);
                      closeQuoteDetails();
                    }}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <svg className="h-4 w-4 me-1.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Enviar a Aprobación
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm("¿Estás seguro de que deseas eliminar esta cotización? Esta acción no se puede deshacer.")) {
                        deleteQuote(selectedQuote.id);
                        closeQuoteDetails();
                      }
                    }}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
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
  );
} 