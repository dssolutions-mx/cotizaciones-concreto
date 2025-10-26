/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import QuotePDF from './QuotePDF';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { features } from '@/config/featureFlags';

interface ApprovedQuotesTabProps {
  onDataSaved?: () => void;
  statusFilter?: string;
  clientFilter?: string;
}

interface SupabaseApprovedQuote {
  id: string;
  quote_number: string;
  construction_site: string;
  created_at: string;
  validity_date: string;
  approval_date: string;
  approved_by: string | null;
  clients: { 
    id: string;
    business_name: string;
    client_code: string; 
  } | { 
    id: string;
    business_name: string;
    client_code: string; 
  }[] | null;
  creator: {
    first_name: string;
    last_name: string;
  }[] | { 
    first_name: string;
    last_name: string;
  } | null;
  approver?: {
    first_name: string;
    last_name: string;
  }[] | { 
    first_name: string;
    last_name: string;
  } | null;
  quote_details: SupabaseQuoteDetail[] | SupabaseQuoteDetail | null;
}

interface SupabaseQuoteDetail {
  id: string;
  volume: number;
  base_price: number;
  final_price: number;
  pump_service: boolean;
  pump_price: number | null;
  includes_vat: boolean;
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
      is_current?: boolean;
    }[];
  } | { 
    recipe_code: string;
    strength_fc: number;
    placement_type: string;
    max_aggregate_size: number;
    slump: number;
    age_days: number;
    recipe_versions: {
      notes: string;
      is_current?: boolean;
    }[];
  }[] | null;
}

interface ApprovedQuoteDetailWithMargin {
  id: string;
  volume: number;
  base_price: number;
  final_price: number;
  profit_margin: number;
  pump_service: boolean;
  pump_price: number | null;
  includes_vat: boolean;
  recipe_id?: string;
  master_code?: string | null;
  recipe: {
    recipe_code: string;
    strength_fc: number;
    placement_type: string;
    max_aggregate_size: number;
    slump: number;
    age_days: number;
    notes?: string;
  } | null;
}

export interface ApprovedQuote {
  id: string;
  quote_number: string;
  client: {
    id: string;
    business_name: string;
    client_code: string;
  } | null;
  creator_initials: string;
  approver_name: string;
  construction_site: string;
  total_amount: number;
  created_at: string;
  validity_date: string;
  approval_date: string;
  approved_by: string | null;
  quote_details: Array<{
    id: string;
    volume: number;
    base_price: number;
    final_price: number;
    pump_service: boolean;
    pump_price: number | null;
    includes_vat: boolean;
    recipe: {
      recipe_code: string;
      strength_fc: number;
      placement_type: string;
      max_aggregate_size: number;
      slump: number;
      age_days: number;
      notes?: string;
    } | null;
    master_code?: string | null;
  }>;
}

export default function ApprovedQuotesTab({ onDataSaved, statusFilter, clientFilter }: ApprovedQuotesTabProps) {
  const [quotes, setQuotes] = useState<ApprovedQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<ApprovedQuote | null>(null);
  const [page, setPage] = useState(1);
  const [totalQuotes, setTotalQuotes] = useState(0);
  const [vatToggles, setVatToggles] = useState<Record<string, boolean>>({});
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingQuoteDetails, setEditingQuoteDetails] = useState<ApprovedQuoteDetailWithMargin[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const quotesPerPage = 10;
  const router = useRouter();

  const fetchApprovedQuotes = useCallback(async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('quotes')
        .select(`
          id, 
          quote_number, 
          construction_site, 
          created_at,
          validity_date,
          approval_date,
          approved_by,
          clients (
            id,
            business_name, 
            client_code
          ),
          creator:user_profiles!created_by (
            first_name,
            last_name
          ),
          approver:user_profiles!approved_by (
            first_name,
            last_name
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
        `, { count: 'exact' })
        .eq('status', 'APPROVED');

      // Apply client filter if provided
      if (clientFilter && clientFilter.trim()) {
        // When filtering, we need to fetch all data to handle pagination correctly
        // We'll apply the filter after fetching and then handle pagination client-side
        console.log('Client filter applied, fetching all data for proper pagination');
      } else {
        // Only apply pagination when not filtering
        query = query.range((page - 1) * quotesPerPage, page * quotesPerPage - 1);
      }

      const { data, count, error } = await query
        .order('approval_date', { ascending: false });

      if (error) throw error;

      // Transform data to match ApprovedQuote interface
      let transformedQuotes: ApprovedQuote[] = (data || []).map((quote) => {
        const clientData = Array.isArray(quote.clients)
          ? quote.clients[0]
          : quote.clients;

        const quoteDetailsInput = Array.isArray(quote.quote_details)
          ? quote.quote_details
          : quote.quote_details ? [quote.quote_details] : [];
        
        const quoteDetailsData = quoteDetailsInput.filter(Boolean).map((detail: any) => {
          const recipeData = Array.isArray(detail.recipes) ? detail.recipes[0] : detail.recipes;
          const currentVersion = recipeData?.recipe_versions?.find((version: { is_current?: boolean }) => version.is_current);
          const masterData = Array.isArray(detail.master_recipes) ? detail.master_recipes[0] : detail.master_recipes;
          
          // Provide fallback data when both recipe and master are missing
          const fallbackCode = masterData?.master_code || recipeData?.recipe_code || 'N/A';
          
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
              age_days: recipeData.age_days,
              notes: currentVersion?.notes
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
        });

        // Extract creator name and generate initials
        const creatorData = Array.isArray(quote.creator) ? quote.creator[0] : quote.creator;
        const creatorFirstName = creatorData?.first_name || '';
        const creatorLastName = creatorData?.last_name || '';
        const initials = ( (creatorFirstName ? creatorFirstName[0] : '') + (creatorLastName ? creatorLastName[0] : '') )
                           .toUpperCase();

        // Extract approver name
        const approverData = Array.isArray(quote.approver) ? quote.approver[0] : quote.approver;
        const approverFirstName = approverData?.first_name || '';
        const approverLastName = approverData?.last_name || '';
        const approverFullName = [approverFirstName, approverLastName].filter(Boolean).join(' ') || 'Sin información';

        return {
          id: quote.id,
          quote_number: quote.quote_number,
          construction_site: quote.construction_site,
          created_at: quote.created_at,
          validity_date: quote.validity_date,
          approval_date: quote.approval_date || quote.created_at || new Date().toISOString(),
          approved_by: quote.approved_by,
          client: clientData ? {
            id: clientData.id,
            business_name: clientData.business_name,
            client_code: clientData.client_code
          } : null,
          quote_details: quoteDetailsData,
          creator_initials: initials || 'XX',
          approver_name: approverFullName,
          total_amount: quoteDetailsData.reduce((sum: number, detail: {final_price: number, volume: number}) => sum + (detail.final_price * detail.volume), 0)
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
        setTotalQuotes(count || 0);
      }

      setQuotes(transformedQuotes);
    } catch (error) {
      console.error('Error fetching approved quotes:', error);
      alert('No se pudieron cargar las cotizaciones aprobadas');
    } finally {
      setIsLoading(false);
    }
  }, [page, clientFilter]);

  useEffect(() => {
    fetchApprovedQuotes();
  }, [fetchApprovedQuotes]);

  useEffect(() => {
    const initialVatToggles: Record<string, boolean> = {};
    quotes.forEach(quote => {
      // If any quote detail has includes_vat=true, initialize the toggle as true
      const hasVAT = quote.quote_details.some(detail => detail.includes_vat);
      initialVatToggles[quote.id] = hasVAT;
    });
    setVatToggles(initialVatToggles);
  }, [quotes]);

  const openQuoteDetails = (quote: ApprovedQuote) => {
    // Create a deep copy of quote details for editing
    const editableDetails = quote.quote_details.map((detail: any) => ({
      id: detail.id,
      volume: detail.volume,
      base_price: detail.base_price,
      final_price: detail.final_price,
      profit_margin: detail.final_price / detail.base_price - 1,
      pump_service: detail.pump_service,
      pump_price: detail.pump_price,
      includes_vat: detail.includes_vat,
      recipe: detail.recipe,
      master_code: detail.master_code || null
    })) as ApprovedQuoteDetailWithMargin[];
    
    setSelectedQuote(quote);
    setEditingQuoteDetails(editableDetails);
    setIsEditing(false); // Inicialmente no estamos en modo edición
  };

  const closeQuoteDetails = () => {
    setSelectedQuote(null);
    setShowConfirmDialog(false);
    setIsEditing(false);
  };

  const toggleVAT = (quoteId: string) => {
    // Solo permitir cambiar IVA si no estamos editando
    if (isEditing) return;
    
    setVatToggles(prev => {
      const newToggles = {
        ...prev,
        [quoteId]: !prev[quoteId]
      };
      return newToggles;
    });
  };

  // Function to update quote detail margins
  const updateQuoteDetailMargin = (detailIndex: number, newMargin: number) => {
    // Marcar que estamos editando al modificar márgenes
    if (!isEditing) setIsEditing(true);
    
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
    // Marcar que estamos editando al modificar servicio de bombeo
    if (!isEditing) setIsEditing(true);
    
    const updatedDetails = [...editingQuoteDetails].map(detail => ({
      ...detail,
      pump_service: pumpService,
      pump_price: pumpService ? (pumpPrice !== null ? pumpPrice : detail.pump_price) : null
    }));
    setEditingQuoteDetails(updatedDetails);
  };

  const createOrder = (quote: ApprovedQuote) => {
    // Navigate to orders page with quote information
    const clientId = quote.client?.id || '';
    router.push(`/orders?quoteId=${quote.id}&clientId=${clientId}&totalAmount=${quote.total_amount}`);
  };

  const duplicateQuoteAsPending = async (quote: ApprovedQuote, updatedDetails: ApprovedQuoteDetailWithMargin[] | null = null) => {
    try {
      setIsDuplicating(true);
      
      // Obtener el ID del usuario actual
      const { data: authData, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error('Error al obtener la sesión de usuario:', authError);
        throw authError;
      }
      
      if (!authData.session?.user?.id) {
        throw new Error('Usuario no autenticado. Debe iniciar sesión para crear cotizaciones.');
      }
      
      // Generate quote number (same implementation as in QuoteBuilder)
      const currentYear = new Date().getFullYear();
      const quoteNumberPrefix = `COT-${currentYear}`;
      const quoteNumber = `${quoteNumberPrefix}-${Math.floor(Math.random() * 9000) + 1000}`;
      
      // Create new quote with PENDING status
      const { data: newQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          client_id: quote.client?.id,
          created_by: authData.session.user.id, // Usar el ID del usuario actual
          construction_site: quote.construction_site,
          location: "N/A", // Este campo es obligatorio, usamos un valor por defecto
          validity_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(), // 30 days validity
          status: 'PENDING_APPROVAL', // Usando el valor correcto según la restricción de la BD
          quote_number: quoteNumber
        })
        .select('id')
        .single();

      if (quoteError) {
        console.error('Error al crear la nueva cotización:', quoteError);
        throw quoteError;
      }
      
      // Get original quote details with recipe_ids
      const { data: originalQuoteDetails, error: detailsQueryError } = await supabase
        .from('quote_details')
        .select('id, recipe_id')
        .eq('quote_id', quote.id);
        
      if (detailsQueryError) {
        console.error('Error al obtener detalles originales:', detailsQueryError);
        throw detailsQueryError;
      }
      
      // Create a map of detail.id to recipe_id
      const recipeIdMap = new Map();
      originalQuoteDetails?.forEach(detail => {
        recipeIdMap.set(detail.id, detail.recipe_id);
      });
      
      // Use either the updated details from editing or the original quote details
      const detailsToUse = updatedDetails || quote.quote_details;
      
      console.log('Detalles a usar para duplicación:', detailsToUse);
      
      // Insertar solo los detalles que tengan un recipe_id válido
      const quoteDetailsToInsert = detailsToUse
        .map(detail => {
          // Verificar que los valores numéricos sean válidos
          const basePrice = Number(detail.base_price) || 0;
          const finalPrice = Number(detail.final_price) || 0;
          let profitMargin = 0;
          
          // Calcular profit_margin basado en precios si no está disponible
          if ('profit_margin' in detail && (detail as any).profit_margin !== undefined) {
            profitMargin = (detail as any).profit_margin * 100;
          } else {
            profitMargin = ((finalPrice / basePrice) - 1) * 100;
          }
          
          // Asegurar que no dividamos por cero
          if (isNaN(profitMargin) || !isFinite(profitMargin)) {
            profitMargin = 0;
          }
          
          // Asegurarnos de que tenemos un recipe_id válido
          const recipeId = recipeIdMap.get(detail.id);
          
          if (!recipeId) {
            console.warn(`No se encontró recipe_id para el detalle con id ${detail.id}. Omitiendo este detalle.`);
            return null; // Retornar null para los detalles sin recipe_id
          }
          
          return {
            quote_id: newQuote.id,
            recipe_id: recipeId,
            product_id: null, // Importante: solo uno de recipe_id o product_id debe tener valor, no ambos
            volume: Number(detail.volume) || 0,
            base_price: basePrice,
            final_price: finalPrice,
            profit_margin: profitMargin,
            pump_service: !!detail.pump_service,
            pump_price: detail.pump_service ? (detail.pump_price || 0) : null,
            includes_vat: !!detail.includes_vat,
            total_amount: finalPrice * Number(detail.volume) || 0
          };
        })
        .filter(detail => detail !== null); // Filtrar los detalles nulos
      
      // Verificar que tenemos al menos un detalle válido
      if (quoteDetailsToInsert.length === 0) {
        throw new Error('No se pudieron encontrar detalles válidos para la cotización. Asegúrese de que las recetas existan.');
      }
      
      console.log('Detalles a insertar:', quoteDetailsToInsert);
      
      const { error: detailsError } = await supabase
        .from('quote_details')
        .insert(quoteDetailsToInsert);
        
      if (detailsError) {
        console.error('Error al insertar detalles de cotización:', detailsError);
        console.error('Datos que se intentaron insertar:', quoteDetailsToInsert);
        throw detailsError;
      }

      // Mostrar un mensaje de éxito
      alert('Se ha creado una nueva cotización pendiente a partir de la cotización aprobada');

      // Redirigir a la lista de cotizaciones pendientes en lugar de la página de edición
      router.push('/quotes?tab=pending');
      
      if (onDataSaved) {
        onDataSaved();
      }
      
    } catch (error) {
      console.error('Error duplicando cotización:', error);
      alert('No se pudo duplicar la cotización. Revise la consola para más detalles.');
    } finally {
      setIsDuplicating(false);
      setShowConfirmDialog(false);
      setIsEditing(false);
    }
  };

  const handleSaveClick = () => {
    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const handleConfirmSave = () => {
    if (selectedQuote) {
      duplicateQuoteAsPending(selectedQuote, editingQuoteDetails);
    }
  };

  // Función para comenzar a editar
  const startEditing = () => {
    setIsEditing(true);
  };

  // Función para cancelar la edición
  const cancelEditing = () => {
    if (selectedQuote) {
      // Restaurar los detalles originales
      const editableDetails = selectedQuote.quote_details.map((detail: any) => ({
        id: detail.id,
        volume: detail.volume,
        base_price: detail.base_price,
        final_price: detail.final_price,
        profit_margin: detail.final_price / detail.base_price - 1,
        pump_service: detail.pump_service,
        pump_price: detail.pump_price,
        includes_vat: detail.includes_vat,
        recipe: detail.recipe
      })) as ApprovedQuoteDetailWithMargin[];
      
      setEditingQuoteDetails(editableDetails);
      setIsEditing(false);
    }
  };

  // Modificar el render para mostrar total actualizado en edición
  const calculateTotal = () => {
    if (!editingQuoteDetails.length) return 0;
    return editingQuoteDetails.reduce((sum: number, detail: {final_price: number, volume: number}) => 
      sum + (detail.final_price * detail.volume), 0);
  };

  // Filter quotes based on date range - memoized for performance
  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      // Apply date filters if set
      if (filterDateFrom) {
        const quoteDate = new Date(quote.approval_date);
        const fromDate = new Date(filterDateFrom);
        if (quoteDate < fromDate) return false;
      }

      if (filterDateTo) {
        const quoteDate = new Date(quote.approval_date);
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (quoteDate > toDate) return false;
      }

      return true;
    });
  }, [quotes, filterDateFrom, filterDateTo]);

  return (
    <div className="p-4">
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500"></div>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <p>{filterDateFrom || filterDateTo ? 'No se encontraron cotizaciones con los filtros aplicados' : 'No hay cotizaciones aprobadas'}</p>
        </div>
      ) : (
        <>
          {/* Date Range Filter Only */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col gap-3">
              {/* Filter Toggle Button */}
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center justify-center px-4 py-2 border rounded-lg shadow-sm text-sm font-medium transition-all ${
                    showFilters
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filtro por Fecha
                  {(filterDateFrom || filterDateTo) && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">1</span>
                  )}
                </button>

                {(filterDateFrom || filterDateTo) && (
                  <button
                    onClick={() => {
                      setFilterDateFrom('');
                      setFilterDateTo('');
                      setPage(1);
                    }}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Limpiar Fecha
                  </button>
                )}
              </div>

              {/* Date Range Filter */}
              {showFilters && (
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha Aprobación Desde</label>
                      <input
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => {
                          setFilterDateFrom(e.target.value);
                          setPage(1);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha Aprobación Hasta</label>
                      <input
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => {
                          setFilterDateTo(e.target.value);
                          setPage(1);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Results Counter */}
              {(filterDateFrom || filterDateTo) && (
                <div className="text-sm text-gray-600 bg-blue-50 px-4 py-3 rounded-lg border border-blue-200 font-medium">
                  Se encontraron <span className="font-bold text-blue-700">{filteredQuotes.length}</span> cotizaciones
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs font-semibold text-gray-700 uppercase bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Número de Cotización</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Creada por</th>
                  <th className="px-4 py-3">Sitio de Construcción</th>
                  <th className="px-4 py-3">Fecha de Creación</th>
                  <th className="px-4 py-3">Fecha de Aprobación</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3">{quote.quote_number}</td>
                    <td className="px-4 py-3">
                      {quote.client?.business_name} ({quote.client?.client_code})
                    </td>
                    <td className="px-4 py-3">
                      {quote.creator_initials}
                    </td>
                    <td className="px-4 py-3">{quote.construction_site}</td>
                    <td className="px-4 py-3">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(quote.approval_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      ${quote.total_amount.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openQuoteDetails(quote)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-sm font-medium transition-colors"
                          title="Ver detalles"
                        >
                          Detalles
                        </button>
                        <button
                          onClick={() => createOrder(quote)}
                          className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded text-sm font-medium transition-colors"
                          title="Crear orden"
                        >
                          Orden
                        </button>
                        <div className="flex items-center gap-2">
                          <PDFDownloadLink
                            key={`pdf-${quote.id}-${vatToggles[quote.id] || false}`}
                            document={<QuotePDF quote={quote} showVAT={vatToggles[quote.id] || false} />}
                            fileName={`cotizacion-${quote.quote_number}.pdf`}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded text-sm font-medium transition-colors inline-flex items-center gap-1"
                            title="Descargar PDF"
                          >
                            {({ blob, url, loading, error }) => (
                              <>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                {loading ? 'Generando...' : 'PDF'}
                              </>
                            )}
                          </PDFDownloadLink>
                          <div className="flex items-center gap-2 border-l border-gray-200 pl-2">
                            <input
                              type="checkbox"
                              id={`showVAT-${quote.id}`}
                              checked={vatToggles[quote.id] || false}
                              onChange={() => toggleVAT(quote.id)}
                              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <label htmlFor={`showVAT-${quote.id}`} className="text-xs font-medium text-gray-700 cursor-pointer">
                              IVA
                            </label>
                          </div>
                        </div>
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
              {/* Modal Header with Quote Info */}
              <div className="mb-6 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Cotización #{selectedQuote.quote_number}</h2>
                    <p className="text-sm text-gray-600 mt-1">Cliente: {selectedQuote.client?.business_name || 'Sin cliente'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Aprobada el {new Date(selectedQuote.approval_date).toLocaleDateString('es-MX')}</p>
                    <p className="text-xs text-gray-500">Por: {selectedQuote.approver_name || 'Sistema'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">APROBADA</span>
                </div>
              </div>

              {/* Quote Details - Modern Card Style */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">Sitio de Construcción</p>
                    <p className="text-lg font-medium text-gray-900">{selectedQuote.construction_site || 'N/A'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">Vigencia</p>
                    <p className="text-lg font-medium text-gray-900">{new Date(selectedQuote.validity_date).toLocaleDateString('es-MX')}</p>
                  </div>
                </div>
              </div>

              {/* Items Table with Master/Variant Indicators */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalles de la Cotización</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-700">Producto</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Tipo</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Resistencia</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Volumen</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Precio Base</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Margen</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Precio Final</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editingQuoteDetails.map((detail, index) => {
                        const isFromMaster = features.masterPricingEnabled && (detail as any).master_code;
                        return (
                          <tr key={detail.id} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">
                                    {isFromMaster
                                      ? (detail as any).master_code
                                      : detail.recipe?.recipe_code || 'Sin código'}
                                  </p>
                                </div>
                                <span className={`inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                                  isFromMaster 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {isFromMaster ? 'MAESTRO' : 'VARIANTE'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{detail.recipe?.placement_type || 'Sin tipo'}</td>
                            <td className="px-4 py-3 text-gray-700">{detail.recipe?.strength_fc || 'N/A'} kg/cm²</td>
                            <td className="px-4 py-3 text-gray-700 font-medium">{detail.volume} m³</td>
                            <td className="px-4 py-3 text-gray-700">${detail.base_price.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input 
                                  type="number" 
                                  value={Math.round(detail.profit_margin * 1000) / 10}
                                  onChange={(e) => {
                                    const rawValue = e.target.value;
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
                                  min="4"
                                  className="w-20 p-1.5 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500"
                                  placeholder="4.0"
                                />
                              ) : (
                                `${(Math.round(detail.profit_margin * 1000) / 10).toFixed(1)}%`
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700 font-medium">${detail.final_price.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">${(detail.final_price * detail.volume).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pump Service Section */}
              {editingQuoteDetails.length > 0 && editingQuoteDetails[0].pump_service && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold mb-3 text-gray-800 flex items-center gap-2">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0118 0Z" />
                    </svg>
                    Servicio de Bombeo
                  </h3>
                  <div className="bg-white p-3 rounded border border-blue-100">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Precio del Servicio:</span>
                      <span className="font-bold text-blue-600">${(editingQuoteDetails[0].pump_price || 0).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})} MXN</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit mode notification */}
              {isEditing && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <span className="font-semibold">Modo edición activado.</span> Se está modificando una cotización aprobada. Al guardar, se creará una nueva cotización pendiente.
                  </p>
                </div>
              )}

              {/* Total Summary Card */}
              <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-600 uppercase tracking-wide font-semibold mb-1">Total de Cotización</p>
                    <p className="text-3xl font-bold text-green-700">
                      ${calculateTotal().toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                  </div>
                  {editingQuoteDetails.some(d => d.pump_service) && (
                    <div className="text-right">
                      <p className="text-xs text-gray-600 mb-1">Incluye Servicio de Bombeo</p>
                      <svg className="h-6 w-6 text-blue-500 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* PDF Download Section */}
              {!isEditing && (
                <div className="mb-6 flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`modal-showVAT-${selectedQuote.id}`}
                      checked={vatToggles[selectedQuote.id] || false}
                      onChange={() => toggleVAT(selectedQuote.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor={`modal-showVAT-${selectedQuote.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                      Incluir IVA (16%) en el documento PDF
                    </label>
                  </div>
                  <PDFDownloadLink
                    key={`modal-pdf-${selectedQuote.id}-${vatToggles[selectedQuote.id] || false}`}
                    document={<QuotePDF quote={selectedQuote} showVAT={vatToggles[selectedQuote.id] || false} />}
                    fileName={`cotizacion-${selectedQuote.quote_number}.pdf`}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center gap-2"
                  >
                    {({ blob, url, loading, error }) => (
                      <>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33A3 3 0 0116.5 19.5H6.75Z" />
                        </svg>
                        {loading ? 'Generando...' : 'Descargar PDF'}
                      </>
                    )}
                  </PDFDownloadLink>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end space-x-2 mt-6">
                {isEditing && (
                  <>
                    <button 
                      onClick={handleSaveClick}
                      disabled={isDuplicating}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isDuplicating ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Procesando...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Guardar Cambios
                        </>
                      )}
                    </button>
                    <button 
                      onClick={cancelEditing}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Cancelar
                    </button>
                  </>
                )}
                <button 
                  onClick={closeQuoteDetails}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Crear Nueva Cotización</h3>
            <div className="mb-6 text-gray-600">
              <p className="mb-3">
                Estás modificando una cotización aprobada. Al guardar los cambios:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Se creará una <strong>nueva cotización pendiente</strong> con los cambios realizados</li>
                <li>La cotización original permanecerá <strong>sin cambios</strong></li>
                <li>La nueva cotización deberá pasar por el proceso de aprobación</li>
              </ul>
              <p className="mt-3 text-sm italic">
                Nota: Este procedimiento es necesario para mantener un registro de los cambios de precios
                en cotizaciones que ya fueron aprobadas.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={isDuplicating}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {isDuplicating ? 'Procesando...' : 'Crear Nueva Cotización'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 