/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PDFDownloadLink } from '@react-pdf/renderer';
import QuotePDF from './QuotePDF';
import { useRouter } from 'next/navigation';

interface ApprovedQuotesTabProps {
  onDataSaved?: () => void;
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
  }>;
}

export default function ApprovedQuotesTab({ onDataSaved }: ApprovedQuotesTabProps) {
  const [quotes, setQuotes] = useState<ApprovedQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<ApprovedQuote | null>(null);
  const [page, setPage] = useState(1);
  const [totalQuotes, setTotalQuotes] = useState(0);
  const [vatToggles, setVatToggles] = useState<Record<string, boolean>>({});
  const quotesPerPage = 10;
  const router = useRouter();

  const fetchApprovedQuotes = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, count, error } = await supabase
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
            recipes (
              recipe_code, 
              strength_fc, 
              placement_type,
              max_aggregate_size,
              slump,
              age_days,
              recipe_versions!inner(
                notes,
                is_current
              )
            )
          )
        `, { count: 'exact' })
        .eq('status', 'APPROVED')
        .range((page - 1) * quotesPerPage, page * quotesPerPage - 1)
        .order('approval_date', { ascending: false });

      if (error) throw error;

      // Transform data to match ApprovedQuote interface
      const transformedQuotes: ApprovedQuote[] = (data || []).map((quote) => {
        const clientData = Array.isArray(quote.clients)
          ? quote.clients[0]
          : quote.clients;

        const quoteDetailsInput = Array.isArray(quote.quote_details)
          ? quote.quote_details
          : quote.quote_details ? [quote.quote_details] : [];
        
        const quoteDetailsData = quoteDetailsInput.filter(Boolean).map(detail => {
          const recipeData = Array.isArray(detail.recipes) ? detail.recipes[0] : detail.recipes;
          const currentVersion = recipeData?.recipe_versions?.find((version: { is_current?: boolean }) => version.is_current);
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
            } : null
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
          approval_date: quote.approval_date,
          approved_by: quote.approved_by,
          client: clientData ? {
            id: clientData.id,
            business_name: clientData.business_name,
            client_code: clientData.client_code
          } : null,
          quote_details: quoteDetailsData,
          creator_initials: initials || 'XX',
          approver_name: approverFullName,
          total_amount: quoteDetailsData.reduce((sum, detail) => sum + (detail.final_price * detail.volume), 0)
        };
      });

      setQuotes(transformedQuotes);
      setTotalQuotes(count || 0);
    } catch (error) {
      console.error('Error fetching approved quotes:', error);
      alert('No se pudieron cargar las cotizaciones aprobadas');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

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
    setSelectedQuote(quote);
  };

  const closeQuoteDetails = () => {
    setSelectedQuote(null);
  };

  const toggleVAT = (quoteId: string) => {
    setVatToggles(prev => {
      const newToggles = {
        ...prev,
        [quoteId]: !prev[quoteId]
      };
      return newToggles;
    });
  };

  const createOrder = (quote: ApprovedQuote) => {
    // Navigate to orders page with quote information
    const clientId = quote.client?.id || '';
    router.push(`/orders?quoteId=${quote.id}&clientId=${clientId}&totalAmount=${quote.total_amount}`);
  };

  return (
    <div className="p-4">
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500"></div>
        </div>
      ) : quotes.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <p>No hay cotizaciones aprobadas</p>
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
                  <th className="px-4 py-3">Fecha de Aprobación</th>
                  <th className="px-4 py-3">Total</th>
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
                    <td className="px-4 py-3">
                      {new Date(quote.approval_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      ${quote.total_amount.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center space-x-2">
                        <button 
                          onClick={() => openQuoteDetails(quote)}
                          className="text-blue-500 hover:text-blue-700 mr-2"
                        >
                          Ver Detalles
                        </button>
                        <button
                          onClick={() => createOrder(quote)}
                          className="text-green-500 hover:text-green-700"
                        >
                          Crear Orden
                        </button>
                        <div className="flex flex-col items-center">
                          <PDFDownloadLink
                            key={`pdf-${quote.id}-${vatToggles[quote.id] || false}`}
                            document={<QuotePDF quote={quote} showVAT={vatToggles[quote.id] || false} />}
                            fileName={`cotizacion-${quote.quote_number}.pdf`}
                            className="text-green-500 hover:text-green-700 mb-1"
                          >
                            {({ blob, url, loading, error }) =>
                              loading ? 'Generando PDF...' : 'Descargar PDF'
                            }
                          </PDFDownloadLink>
                          <div className="flex items-center text-xs">
                            <input
                              type="checkbox"
                              id={`showVAT-${quote.id}`}
                              checked={vatToggles[quote.id] || false}
                              onChange={() => toggleVAT(quote.id)}
                              className="mr-1 h-3 w-3"
                            />
                            <label htmlFor={`showVAT-${quote.id}`}>Incluir IVA</label>
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

              {/* Approval Information */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="font-semibold">Fecha de Aprobación</p>
                  <p>{new Date(selectedQuote.approval_date).toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-semibold">Aprobado por</p>
                  <p>{selectedQuote.approver_name}</p>
                </div>
              </div>

              {/* Pump Service Information */}
              {selectedQuote.quote_details.some(detail => detail.pump_service) && (
                <div className="mb-6 p-4 border rounded bg-gray-50">
                  <div className="flex items-center mb-2">
                    <span className="font-medium">Servicio de Bombeo Incluido</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2">Precio del Servicio:</span>
                    <span className="font-semibold">
                      ${selectedQuote.quote_details.find(detail => detail.pump_service)?.pump_price?.toFixed(2) || '0.00'} MXN
                    </span>
                  </div>
                </div>
              )}

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
                      <th className="px-4 py-3">Precio Final</th>
                      <th className="px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuote.quote_details.map((detail) => (
                      <tr key={detail.id} className="border-b hover:bg-gray-100">
                        <td className="px-4 py-3">{detail.recipe?.recipe_code || 'Sin código'}</td>
                        <td className="px-4 py-3">{detail.recipe?.placement_type || 'Sin tipo'}</td>
                        <td className="px-4 py-3">{detail.recipe?.strength_fc || 'N/A'} kg/cm²</td>
                        <td className="px-4 py-3">{detail.volume} m³</td>
                        <td className="px-4 py-3">${detail.base_price.toFixed(2)}</td>
                        <td className="px-4 py-3">${detail.final_price.toFixed(2)}</td>
                        <td className="px-4 py-3">${(detail.final_price * detail.volume).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total and PDF Download */}
              <div className="mt-6 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-lg">Total: ${selectedQuote.total_amount.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
                <div className="flex items-center">
                  <div className="flex items-center mr-4">
                    <input
                      type="checkbox"
                      id={`modal-showVAT-${selectedQuote.id}`}
                      checked={vatToggles[selectedQuote.id] || false}
                      onChange={() => toggleVAT(selectedQuote.id)}
                      className="mr-2"
                    />
                    <label htmlFor={`modal-showVAT-${selectedQuote.id}`}>Incluir IVA en PDF</label>
                  </div>
                  <PDFDownloadLink
                    key={`modal-pdf-${selectedQuote.id}-${vatToggles[selectedQuote.id] || false}`}
                    document={<QuotePDF quote={selectedQuote} showVAT={vatToggles[selectedQuote.id] || false} />}
                    fileName={`cotizacion-${selectedQuote.quote_number}.pdf`}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    {({ blob, url, loading, error }) =>
                      loading ? 'Generando PDF...' : 'Descargar PDF'
                    }
                  </PDFDownloadLink>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-4 mt-6">
                <button 
                  onClick={closeQuoteDetails}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 