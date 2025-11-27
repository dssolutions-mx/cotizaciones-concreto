/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { productPriceService } from '@/lib/supabase/product-prices';
import { QuotesService } from '@/services/quotes';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { features } from '@/config/featureFlags';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X, MoreVertical, Eye, FileText, Search } from 'lucide-react';

interface PendingApprovalTabProps {
  onDataSaved?: () => void;
  statusFilter?: string;
  clientFilter?: string;
}

// Interfaces kept intact
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
  creator_name?: string;
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
    master_code: string | null;
  }>;
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
  master_recipe_id: string;
  master_recipes: {
    master_code: string;
  }[];
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
    master_code?: string | null;
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
          creator:user_profiles!created_by (
            first_name,
            last_name
          ),
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
            master_recipe_id,
            recipes (
              recipe_code,
              strength_fc,
              placement_type,
              max_aggregate_size,
              slump,
              age_days
            ),
            master_recipes (
              master_code
            )
          )
        `, { count: 'exact' })
        .eq('status', 'PENDING_APPROVAL');

      // Apply client filter if provided
      if (clientFilter && clientFilter.trim()) {
        console.log('Client filter applied, fetching all data for proper pagination');
      } else {
        query = query.range(page * quotesPerPage, (page + 1) * quotesPerPage - 1);
      }

      const { data, error, count } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform data...
      let transformedQuotes: PendingQuote[] = (data || []).map(quote => {
        const clientData = Array.isArray(quote.clients) ? quote.clients[0] : quote.clients;
        const creatorData = Array.isArray((quote as any).creator) ? (quote as any).creator[0] : (quote as any).creator;
        const creatorFullName = [creatorData?.first_name, creatorData?.last_name].filter(Boolean).join(' ');
        
        return {
          id: quote.id,
          quote_number: quote.quote_number,
          construction_site: quote.construction_site,
          created_at: quote.created_at,
          creator_name: creatorFullName || undefined,
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
            const recipeData = Array.isArray(detail.recipes) ? detail.recipes[0] : detail.recipes;
            const masterData = Array.isArray(detail.master_recipes) ? detail.master_recipes[0] : detail.master_recipes;
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
                age_days: recipeData.age_days
              } : {
                recipe_code: fallbackCode,
                strength_fc: 0,
                placement_type: 'N/A',
                max_aggregate_size: 0,
                slump: 0,
                age_days: 0
              },
              master_code: masterData?.master_code || null
            };
          })
        };
      });
      
      // Client-side filtering
      if (clientFilter && clientFilter.trim()) {
        const filterLower = clientFilter.toLowerCase();
        transformedQuotes = transformedQuotes.filter(quote => 
          quote.client?.business_name?.toLowerCase().includes(filterLower) ||
          quote.client?.client_code?.toLowerCase().includes(filterLower)
        );
        const startIndex = page * quotesPerPage;
        const endIndex = startIndex + quotesPerPage;
        setTotalQuotes(transformedQuotes.length);
        transformedQuotes = transformedQuotes.slice(startIndex, endIndex);
      } else {
        setTotalQuotes(count || 0);
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
      // Save changes first if editing
      if (selectedQuote && selectedQuote.id === quoteId && editingQuoteDetails.length > 0) {
        await saveQuoteModifications(false); // false = don't close modal or alert yet
      }

      await QuotesService.updateStatus(quoteId, 'APPROVED');
      try {
        await productPriceService.handleQuoteApproval(quoteId);
      } catch (priceError: any) {
        await QuotesService.updateStatus(quoteId, 'PENDING_APPROVAL'); // Revert
        throw new Error(`Error handling price history: ${priceError.message}`);
      }

      alert('Cotización aprobada');
      fetchPendingQuotes();
      onDataSaved?.();
      closeQuoteDetails();
    } catch (error: any) {
      console.error('Error approving quote:', error.message);
      alert(`No se pudo aprobar la cotización: ${error.message}`);
    }
  };

  const rejectQuote = async (quoteId: string, reason: string) => {
    try {
      if (selectedQuote && selectedQuote.id === quoteId && editingQuoteDetails.length > 0) {
        await saveQuoteModifications(false);
      }
      await QuotesService.updateStatus(quoteId, 'REJECTED', { rejection_reason: reason });
      alert('Cotización rechazada');
      fetchPendingQuotes();
      onDataSaved?.();
      closeQuoteDetails();
    } catch (error) {
      console.error('Error rejecting quote:', error);
      alert('No se pudo rechazar la cotización');
    }
  };

  const deleteQuote = async (quoteId: string) => {
    try {
      if (!confirm("¿Estás seguro de que deseas eliminar esta cotización? Esta acción no se puede deshacer.")) return;

      const { error: detailsError } = await supabase.from('quote_details').delete().eq('quote_id', quoteId);
      if (detailsError) throw new Error(detailsError.message);

      const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
      if (error) throw new Error(error.message);

      fetchPendingQuotes();
      onDataSaved?.();
      alert('Cotización eliminada correctamente');
    } catch (error: any) {
      console.error('Error deleting quote:', error);
      alert(`Error al eliminar cotización: ${error.message}`);
    }
  };

  const updateQuoteDetailMargin = (detailIndex: number, newMargin: number) => {
    const updatedDetails = [...editingQuoteDetails];
    const detail = updatedDetails[detailIndex];
    const sanitizedMargin = newMargin / 100;
    const finalPrice = Math.ceil((detail.base_price * (1 + sanitizedMargin)) / 5) * 5;

    updatedDetails[detailIndex] = {
      ...detail,
      profit_margin: sanitizedMargin,
      final_price: finalPrice
    };
    setEditingQuoteDetails(updatedDetails);
  };

  const updateQuoteDetailBasePrice = (detailIndex: number, newBasePrice: number) => {
    const updatedDetails = [...editingQuoteDetails];
    const detail = updatedDetails[detailIndex];
    const newMargin = detail.final_price / newBasePrice - 1;
    
    updatedDetails[detailIndex] = {
      ...detail,
      base_price: newBasePrice,
      profit_margin: newMargin
    };
    setEditingQuoteDetails(updatedDetails);
  };

  const updateQuoteDetailFinalPrice = (detailIndex: number, newFinalPrice: number) => {
    const updatedDetails = [...editingQuoteDetails];
    const detail = updatedDetails[detailIndex];
    const newMargin = newFinalPrice / detail.base_price - 1;
    
    updatedDetails[detailIndex] = {
      ...detail,
      final_price: newFinalPrice,
      profit_margin: newMargin
    };
    setEditingQuoteDetails(updatedDetails);
  };

  const updateQuotePumpService = (pumpService: boolean, pumpPrice: number | null = null) => {
    const updatedDetails = [...editingQuoteDetails].map(detail => ({
      ...detail,
      pump_service: pumpService,
      pump_price: pumpService ? (pumpPrice !== null ? pumpPrice : detail.pump_price) : null
    }));
    setEditingQuoteDetails(updatedDetails);
  };

  const openQuoteDetails = (quote: PendingQuote) => {
    const editableDetails = quote.quote_details.map(detail => ({
      ...detail,
      profit_margin: detail.final_price / detail.base_price - 1,
      includes_vat: (detail as any).includes_vat ?? false,
      master_code: detail.master_code
    }));
    
    setSelectedQuote(quote);
    setEditingQuoteDetails(editableDetails);
  };

  const saveQuoteModifications = async (showAlert = true) => {
    try {
      const updatePromises = editingQuoteDetails.map(async (detail) => {
        const { error } = await supabase
          .from('quote_details')
          .update({
            base_price: detail.base_price,
            final_price: detail.final_price,
            profit_margin: detail.profit_margin * 100,
            pump_service: detail.pump_service,
            pump_price: detail.pump_service ? detail.pump_price : null,
            includes_vat: detail.includes_vat ?? false
          })
          .eq('id', detail.id);
        if (error) throw error;
      });

      await Promise.all(updatePromises);
      fetchPendingQuotes();
      onDataSaved?.();
      if (showAlert) {
        alert('Cotización actualizada exitosamente');
        closeQuoteDetails();
      }
    } catch (error) {
      console.error('Error updating quote details:', error);
      throw error;
    }
  };

  const closeQuoteDetails = () => {
    setSelectedQuote(null);
  };

  return (
    <RoleProtectedSection 
      allowedRoles={['PLANT_MANAGER', 'EXECUTIVE']}
      fallback={
        <div className="p-8 text-center bg-gray-50 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Acceso Restringido</h3>
          <p className="text-gray-600">Solo los gerentes de planta y ejecutivos pueden aprobar cotizaciones.</p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header Summary */}
        <Card variant="thick" className="p-6 border-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-full text-yellow-700">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Pendientes de Aprobación</h2>
                <p className="text-xs text-gray-500">{totalQuotes} cotizaciones requieren revisión</p>
              </div>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="flex justify-center h-64 items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {quotes.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center shadow-sm">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">¡Todo al día!</h3>
                <p className="text-gray-500 mt-1">No hay cotizaciones pendientes de aprobación.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {quotes.map(quote => (
                  <Card key={quote.id} variant="interactive" className="p-0 border-0 bg-white shadow-sm hover:shadow-md overflow-hidden group">
                    <div className="p-5">
                      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-bold text-gray-900">
                              {quote.client?.business_name || 'Cliente sin nombre'}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-xs font-medium border border-yellow-100">
                              #{quote.quote_number}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 space-y-1">
                            <p>Obra: <span className="font-medium text-gray-700">{quote.construction_site}</span></p>
                            <p>Creada por: <span className="font-medium text-gray-700">{quote.creator_name}</span></p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Total</p>
                          <p className="text-2xl font-bold text-gray-900 tracking-tight">
                            ${quote.total_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">{new Date(quote.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" onClick={() => openQuoteDetails(quote)}>
                          <Eye className="w-4 h-4 mr-2" /> Revisar
                        </Button>
                        <Button 
                          variant="primary" 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => approveQuote(quote.id)}
                        >
                          <Check className="w-4 h-4 mr-2" /> Aprobar
                        </Button>
                        
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content className="min-w-[160px] bg-white rounded-lg shadow-lg border p-1 z-50" align="end">
                            <DropdownMenu.Item 
                              className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer"
                              onSelect={() => {
                                const reason = prompt('Razón de rechazo:');
                                if (reason) rejectQuote(quote.id, reason);
                              }}
                            >
                              <X className="w-4 h-4 mr-2" /> Rechazar
                            </DropdownMenu.Item>
                            <DropdownMenu.Item 
                              className="flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              onSelect={() => deleteQuote(quote.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Root>
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
                  Página {page + 1} de {Math.ceil(totalQuotes / quotesPerPage)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * quotesPerPage >= totalQuotes}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Review Modal */}
        <Dialog open={!!selectedQuote} onOpenChange={(open) => !open && closeQuoteDetails()}>
          <DialogContent className="max-w-5xl h-[90vh] p-0 overflow-hidden flex flex-col">
            <div className="p-6 border-b bg-white">
              <DialogTitle className="text-xl font-bold">Revisión de Cotización</DialogTitle>
              <DialogDescription>Edite los precios o márgenes antes de aprobar.</DialogDescription>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Card variant="thin" className="p-4 bg-white">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1">Cliente</p>
                  <p className="font-semibold text-gray-900 text-lg">{selectedQuote?.client?.business_name}</p>
                  <p className="text-sm text-gray-500">{selectedQuote?.client?.client_code}</p>
                </Card>
                <Card variant="thin" className="p-4 bg-white">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1">Obra</p>
                  <p className="font-semibold text-gray-900 text-lg">{selectedQuote?.construction_site}</p>
                  <p className="text-sm text-gray-500">Creado por: {selectedQuote?.creator_name}</p>
                </Card>
              </div>

              {/* Items Table */}
              <Card variant="base" className="overflow-hidden bg-white border-0 shadow-sm mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Producto</th>
                        <th className="px-4 py-3 text-left font-semibold">Volumen</th>
                        <th className="px-4 py-3 text-left font-semibold">Precio Base</th>
                        <th className="px-4 py-3 text-left font-semibold">Margen</th>
                        <th className="px-4 py-3 text-right font-semibold">Precio Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {editingQuoteDetails.map((detail, idx) => (
                        <tr key={detail.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {(features.masterPricingEnabled && detail.master_code) ? detail.master_code : detail.recipe?.recipe_code}
                            </div>
                            <div className="text-xs text-gray-500">{detail.recipe?.placement_type === 'D' ? 'Directa' : 'Bombeado'}</div>
                          </td>
                          <td className="px-4 py-3">{detail.volume} m³</td>
                          <td className="px-4 py-3">
                            <div className="relative max-w-[120px]">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                              <Input
                                type="number"
                                value={detail.base_price.toFixed(2)}
                                onChange={(e) => updateQuoteDetailBasePrice(idx, parseFloat(e.target.value) || 0)}
                                className="pl-5 h-8 bg-white"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="relative max-w-[100px]">
                              <Input
                                type="number"
                                value={(detail.profit_margin * 100).toFixed(2)}
                                onChange={(e) => updateQuoteDetailMargin(idx, parseFloat(e.target.value) || 0)}
                                className="pr-6 h-8 bg-white"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="relative max-w-[120px] ml-auto">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                              <Input
                                type="number"
                                value={detail.final_price.toFixed(2)}
                                onChange={(e) => updateQuoteDetailFinalPrice(idx, parseFloat(e.target.value) || 0)}
                                className="pl-5 h-8 bg-white font-bold text-right"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Pump Service & VAT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card variant="thin" className="p-4 bg-blue-50/30 border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox.Root
                      id="pumpService"
                      checked={editingQuoteDetails.length > 0 && editingQuoteDetails[0].pump_service}
                      onCheckedChange={(checked) => updateQuotePumpService(checked === true, editingQuoteDetails[0]?.pump_price)}
                      className="h-4 w-4 rounded border-blue-300 bg-white data-[state=checked]:bg-blue-600 flex items-center justify-center"
                    >
                      <Checkbox.Indicator><CheckIcon className="text-white w-3 h-3" /></Checkbox.Indicator>
                    </Checkbox.Root>
                    <label htmlFor="pumpService" className="text-sm font-medium text-blue-900">Incluir Bombeo</label>
                  </div>
                  {editingQuoteDetails[0]?.pump_service && (
                    <Input
                      type="number"
                      placeholder="Precio"
                      value={editingQuoteDetails[0].pump_price || ''}
                      onChange={(e) => updateQuotePumpService(true, parseFloat(e.target.value) || 0)}
                      className="bg-white h-8 mt-2"
                    />
                  )}
                </Card>
                
                <Card variant="thin" className="p-4 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Checkbox.Root
                      id="vat"
                      checked={editingQuoteDetails.every(d => d.includes_vat)}
                      onCheckedChange={(checked) => {
                        const isChecked = checked === true;
                        setEditingQuoteDetails(prev => prev.map(d => ({ ...d, includes_vat: isChecked })));
                      }}
                      className="h-4 w-4 rounded border-gray-300 bg-white data-[state=checked]:bg-gray-800 flex items-center justify-center"
                    >
                      <Checkbox.Indicator><CheckIcon className="text-white w-3 h-3" /></Checkbox.Indicator>
                    </Checkbox.Root>
                    <label htmlFor="vat" className="text-sm font-medium text-gray-700">Incluir IVA (16%)</label>
                  </div>
                </Card>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t bg-white flex justify-between items-center gap-4">
              <Button variant="ghost" onClick={closeQuoteDetails}>Cancelar</Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => saveQuoteModifications(true)}>Guardar Cambios</Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white" 
                  onClick={() => approveQuote(selectedQuote?.id as string)}
                >
                  <Check className="w-4 h-4 mr-2" /> Aprobar Cotización
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RoleProtectedSection>
  );
}