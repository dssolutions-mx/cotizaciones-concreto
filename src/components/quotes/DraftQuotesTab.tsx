/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { QuotesService } from '@/services/quotes';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { features } from '@/config/featureFlags';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Send, Eye, Search, Filter, X } from 'lucide-react';

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
  master_recipe_id: string;
  master_recipes: {
    master_code: string;
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
    master_code: string | null;
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
    master_code?: string | null;
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
            master_recipe_id,
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
            ),
            master_recipes (
              master_code
            )
          )
        `, { count: 'exact' });
      
      // Apply status filter
      query = query.eq('status', filterStatus);
      
      // Apply client filter if provided (from props)
      if (clientFilter && clientFilter.trim()) {
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
              
            const masterData = Array.isArray(detail.master_recipes)
              ? detail.master_recipes[0]
              : detail.master_recipes;
              
            // Provide fallback data when both recipe and master are missing
            const fallbackCode = masterData?.master_code || recipeData?.recipe_code || 'N/A';
              
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
              } : {
                recipe_code: fallbackCode,
                strength_fc: 0,
                placement_type: 'N/A',
                max_aggregate_size: 0,
                slump: 0,
                age_days: 0,
                notes: 'Datos no disponibles'
              },
              master_code: masterData?.master_code || null
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
    try {
      // If we're currently editing this quote, save the changes first
      if (selectedQuote && selectedQuote.id === quoteId && editingQuoteDetails.length > 0) {
        try {
          await saveQuoteModifications();
        } catch (saveError: unknown) {
          console.error('Failed to save modifications before sending to approval:', saveError);
          const errorMessage = saveError instanceof Error ? saveError.message : 'Error desconocido';
          alert(`Error al guardar modificaciones: ${errorMessage}`);
          return;
        }
      }

      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        alert(`Error de autenticación: ${authError.message}`);
        return;
      }

      if (!userData.user) {
        alert('No se ha podido confirmar su identidad. Por favor, inicie sesión nuevamente.');
        return;
      }

      try {
        const result = await QuotesService.sendToApproval(quoteId);
        
        alert('Cotización enviada a aprobación');
        fetchDraftQuotes();
        onDataSaved?.();
      } catch (serviceError: unknown) {
        console.error('Detailed error in QuotesService.sendToApproval:', serviceError);
        
        // Try direct database access as a fallback
        try {
          const { data: quoteData, error: fetchError } = await supabase
            .from('quotes')
            .select('created_by, status')
            .eq('id', quoteId)
            .single();
            
          if (fetchError) throw new Error(`No se pudo obtener la información: ${fetchError.message}`);
          
          if (quoteData.created_by !== userData.user.id && quoteData.status === 'DRAFT') {
            throw new Error('Solo el creador puede enviar a aprobación.');
          }
          
          const { error: updateError } = await supabase
            .from('quotes')
            .update({ 
              status: 'PENDING_APPROVAL',
              updated_at: new Date().toISOString()
            })
            .eq('id', quoteId);
            
          if (updateError) throw new Error(`Error al actualizar estado: ${updateError.message}`);
          
          alert('Cotización enviada a aprobación');
          fetchDraftQuotes();
          onDataSaved?.();
        } catch (fallbackError: unknown) {
          const errorMessage = fallbackError instanceof Error ? fallbackError.message : 'Error desconocido';
          alert(`No se pudo enviar la cotización a aprobación: ${errorMessage}`);
        }
      }
    } catch (error: unknown) {
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
      recipe: detail.recipe,
      master_code: detail.master_code
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
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <Card variant="thick" className="p-6 border-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center">
            <h2 className="text-title-3 font-bold text-gray-800">Borradores</h2>
            <span className="ml-3 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
              {totalQuotes}
            </span>
          </div>
          
          <div className="flex gap-2">
            <div className="relative">
              <Input 
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar..."
                className="w-full sm:w-64 pl-9"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {quotes.length === 0 ? (
            <Card variant="base" className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No se encontraron cotizaciones</h3>
              <p className="mt-1 text-gray-500 max-w-sm">
                {searchTerm ? 'Intenta con otros términos de búsqueda.' : 'Comienza creando una nueva cotización.'}
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {quotes.map(quote => (
                <Card key={quote.id} variant="interactive" className="p-0 bg-white shadow-sm hover:shadow-md border-0 overflow-hidden">
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">
                            {quote.client?.business_name || 'Cliente sin nombre'}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                            #{quote.quote_number}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Obra:</span> {quote.construction_site}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Fecha:</span> {new Date(quote.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900 tracking-tight">
                          ${quote.quote_details.reduce((total, detail) => total + (detail.final_price * detail.volume), 0).toLocaleString('es-MX', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {quote.quote_details.slice(0, 3).map((detail) => (
                        <span key={detail.id} className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {(features.masterPricingEnabled && detail.master_code)
                            ? detail.master_code
                            : detail.recipe?.recipe_code || 'Sin código'} • {detail.volume}m³
                        </span>
                      ))}
                      {quote.quote_details.length > 3 && (
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                          +{quote.quote_details.length - 3} más
                        </span>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openQuoteDetails(quote)}
                        className="text-gray-600"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver Detalles
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => deleteQuote(quote.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </Button>
                      <Button 
                        variant="primary" 
                        size="sm"
                        onClick={() => sendToApproval(quote.id)}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Enviar a Aprobación
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {quotes.length > 0 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-gray-500">
                Mostrando {((page - 1) * quotesPerPage) + 1}-{Math.min(page * quotesPerPage, totalQuotes)} de {totalQuotes}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * quotesPerPage >= totalQuotes}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quote Details Dialog */}
      <Dialog open={!!selectedQuote} onOpenChange={(open) => !open && closeQuoteDetails()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Detalles de Cotización</DialogTitle>
          <DialogDescription className="hidden">Detalles y edición de la cotización seleccionada</DialogDescription>
          
          {selectedQuote && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Cliente</p>
                  <p className="font-semibold text-gray-900">{selectedQuote.client?.business_name}</p>
                  <p className="text-sm text-gray-600">{selectedQuote.client?.client_code}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Obra</p>
                  <p className="font-semibold text-gray-900">{selectedQuote.construction_site}</p>
                </div>
              </div>

              {/* Pump Service */}
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox.Root
                    id="pumpService"
                    checked={editingQuoteDetails.length > 0 && editingQuoteDetails[0].pump_service}
                    onCheckedChange={(checked) => {
                      const isChecked = checked === true;
                      updateQuotePumpService(isChecked, editingQuoteDetails[0]?.pump_price);
                    }}
                    className="h-5 w-5 rounded border-blue-300 bg-white data-[state=checked]:bg-blue-600 flex items-center justify-center"
                  >
                    <Checkbox.Indicator><CheckIcon className="text-white w-3.5 h-3.5" /></Checkbox.Indicator>
                  </Checkbox.Root>
                  <label htmlFor="pumpService" className="text-sm font-medium text-blue-900">
                    Incluir Servicio de Bombeo
                  </label>
                </div>
                
                {editingQuoteDetails[0]?.pump_service && (
                  <div className="flex items-center gap-2 pl-7">
                    <span className="text-sm text-blue-700">Precio: $</span>
                    <Input
                      type="number"
                      value={editingQuoteDetails[0].pump_price || ''}
                      onChange={(e) => updateQuotePumpService(true, parseFloat(e.target.value) || 0)}
                      className="w-32 h-8 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Details Table */}
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700 font-medium">
                    <tr>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3">Volumen</th>
                      <th className="px-4 py-3">Precio Base</th>
                      <th className="px-4 py-3">Margen</th>
                      <th className="px-4 py-3 text-right">Precio Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {editingQuoteDetails.map((detail, idx) => (
                      <tr key={detail.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {(features.masterPricingEnabled && detail.master_code) ? detail.master_code : detail.recipe?.recipe_code}
                          </div>
                          <div className="text-xs text-gray-500">{detail.recipe?.strength_fc} kg/cm²</div>
                        </td>
                        <td className="px-4 py-3">{detail.volume} m³</td>
                        <td className="px-4 py-3">${detail.base_price.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <div className="relative w-24">
                            <Input
                              type="number"
                              value={(detail.margin * 100).toFixed(2)}
                              onChange={(e) => updateQuoteDetailMargin(idx, parseFloat(e.target.value) || 0)}
                              className="h-8 pr-6"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          ${detail.final_price.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <DialogClose asChild>
                  <Button variant="secondary">Cancelar</Button>
                </DialogClose>
                <Button onClick={saveQuoteModifications}>Guardar Cambios</Button>
                <Button variant="primary" onClick={() => {
                  sendToApproval(selectedQuote.id);
                  closeQuoteDetails();
                }}>
                  <Send className="w-4 h-4 mr-2" /> Enviar a Aprobación
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}