/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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
import { Check, X, MoreVertical, Eye, FileText, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getEffectiveFloorPrice } from '@/lib/supabase/listPrices';
import { format } from 'date-fns';

const RANGE_ORDER: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G', number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7,
};
const DEFAULT_ZONE_SURCHARGE: Record<'C' | 'D' | 'E' | 'F' | 'G', number> = {
  C: 200, D: 200, E: 200, F: 200, G: 200,
};
function isZoneCOrHigher(code?: string | null): code is 'C' | 'D' | 'E' | 'F' | 'G' {
  if (!code) return false;
  const c = code as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  return (RANGE_ORDER[c] ?? 0) >= RANGE_ORDER.C;
}
function getZoneSurcharge(
  rangeCode: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | undefined,
  distanceRanges: Array<{ range_code?: string; diferencial?: number | null }>
): number {
  if (!rangeCode || !isZoneCOrHigher(rangeCode)) return 0;
  const row = distanceRanges.find((r) => r.range_code === rangeCode);
  const diferencial = Number(row?.diferencial ?? 0);
  if (Number.isFinite(diferencial) && diferencial > 0) return diferencial;
  return DEFAULT_ZONE_SURCHARGE[rangeCode];
}

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface PendingApprovalTabProps {
  onDataSaved?: () => void;
  statusFilter?: string;
  clientFilter?: string;
  initialQuoteId?: string;
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
  validity_date?: string;
  distance_range_code?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  plant_id?: string;
  quote_details: Array<{
    id: string;
    volume: number;
    base_price: number;
    final_price: number;
    pump_service: boolean;
    pump_price: number | null;
    includes_vat?: boolean;
    pricing_path?: 'LIST_PRICE' | 'COST_DERIVED';
    profit_margin?: number;
    master_recipe_id?: string | null;
    base_list_price?: number | null;
    effective_floor?: number | null;
    zone_range_code?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
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
  quote_additional_products: Array<{
    id: string;
    quantity: number;
    base_price: number;
    margin_percentage: number;
    unit_price: number;
    total_price: number;
    additional_products: {
      name: string;
      code: string;
      unit: string;
    } | null;
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
  pricing_path?: string;
  profit_margin?: number;
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

export default function PendingApprovalTab({ onDataSaved, statusFilter, clientFilter, initialQuoteId }: PendingApprovalTabProps) {
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
    pricing_path?: 'LIST_PRICE' | 'COST_DERIVED';
    base_list_price?: number | null;
    effective_floor?: number | null;
    zone_range_code?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
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
  const [cashOverpricePct, setCashOverpricePct] = useState(10);
  const [distanceRanges, setDistanceRanges] = useState<Array<{ range_code?: string; diferencial?: number | null }>>([]);
  const [listPriceLoading, setListPriceLoading] = useState(false);

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
          validity_date,
          distance_range_code,
          plant_id,
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
            pricing_path,
            profit_margin,
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
          ),
          quote_additional_products (
            id,
            additional_product_id,
            quantity,
            base_price,
            margin_percentage,
            unit_price,
            total_price,
            additional_products (
              name,
              code,
              unit
            )
          )
        `, { count: 'exact' })
        .eq('status', 'PENDING_APPROVAL')
        .eq('is_active', true);

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
          validity_date: (quote as any).validity_date,
          distance_range_code: (quote as any).distance_range_code,
          plant_id: (quote as any).plant_id,
          creator_name: creatorFullName || undefined,
          client: clientData ? {
            business_name: clientData.business_name,
            client_code: clientData.client_code
          } : null,
          total_amount: quote.quote_details.reduce((sum: number, detail: SupabaseQuoteDetail) => {
            const detailTotal = detail.final_price * detail.volume;
            const pumpTotal = detail.pump_service && detail.pump_price ? detail.pump_price * detail.volume : 0;
            return sum + detailTotal + pumpTotal;
          }, 0) + (quote.quote_additional_products?.reduce((sum: number, prod: any) => sum + (prod.total_price || 0), 0) || 0),
          quote_additional_products: quote.quote_additional_products || [],
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
              pricing_path: (detail.pricing_path || 'COST_DERIVED') as 'LIST_PRICE' | 'COST_DERIVED',
              profit_margin: detail.profit_margin,
              master_recipe_id: detail.master_recipe_id,
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

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'cash_overprice_pct')
          .single();
        if (data?.value) {
          const n = Number(data.value);
          if (Number.isFinite(n) && n >= 0) setCashOverpricePct(n);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // When landing with ?id=xxx, fetch and open that quote
  useEffect(() => {
    if (!initialQuoteId || selectedQuote) return;

    let cancelled = false;
    (async () => {
      try {
        const { data: quote, error: fetchError } = await supabase
          .from('quotes')
          .select(`
            id,
            quote_number,
            construction_site,
            created_at,
            validity_date,
            distance_range_code,
            plant_id,
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
              pricing_path,
              profit_margin,
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
            ),
            quote_additional_products (
              id,
              additional_product_id,
              quantity,
              base_price,
              margin_percentage,
              unit_price,
              total_price,
              additional_products (
                name,
                code,
                unit
              )
            )
          `)
          .eq('id', initialQuoteId)
          .eq('status', 'PENDING_APPROVAL')
          .eq('is_active', true)
          .single();

        if (cancelled || fetchError || !quote) {
          if (fetchError) toast.error('No se encontró la cotización');
          return;
        }

        const clientData = Array.isArray(quote.clients) ? quote.clients[0] : quote.clients;
        const creatorData = Array.isArray((quote as any).creator) ? (quote as any).creator[0] : (quote as any).creator;
        const creatorFullName = [creatorData?.first_name, creatorData?.last_name].filter(Boolean).join(' ');

        const pendingQuote: PendingQuote = {
          id: quote.id,
          quote_number: quote.quote_number,
          construction_site: quote.construction_site,
          created_at: quote.created_at,
          validity_date: (quote as any).validity_date,
          distance_range_code: (quote as any).distance_range_code,
          plant_id: (quote as any).plant_id,
          creator_name: creatorFullName || undefined,
          client: clientData ? { business_name: clientData.business_name, client_code: clientData.client_code } : null,
          total_amount: (quote.quote_details || []).reduce((sum: number, detail: SupabaseQuoteDetail) => {
            const detailTotal = detail.final_price * detail.volume;
            const pumpTotal = detail.pump_service && detail.pump_price ? detail.pump_price * detail.volume : 0;
            return sum + detailTotal + pumpTotal;
          }, 0) + ((quote.quote_additional_products || []) as any[]).reduce((s: number, p: any) => s + (p.total_price || 0), 0),
          quote_additional_products: (quote.quote_additional_products || []) as PendingQuote['quote_additional_products'],
          quote_details: (quote.quote_details || []).map((detail: SupabaseQuoteDetail) => {
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
              pricing_path: (detail.pricing_path || 'COST_DERIVED') as 'LIST_PRICE' | 'COST_DERIVED',
              profit_margin: detail.profit_margin,
              master_recipe_id: detail.master_recipe_id,
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

        openQuoteDetails(pendingQuote);
      } catch (err) {
        if (!cancelled) toast.error('No se pudo cargar la cotización');
      }
    })();
    return () => { cancelled = true; };
  }, [initialQuoteId]);

  const approveQuote = async (quoteId: string) => {
    try {
      // Save changes first if editing
      if (selectedQuote && selectedQuote.id === quoteId && editingQuoteDetails.length > 0) {
        await saveQuoteModifications(false); // false = don't close modal or alert yet
      }

      const res = await fetch('/api/quotes/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al aprobar');

      toast.success('Cotización aprobada');
      fetchPendingQuotes();
      onDataSaved?.();
      closeQuoteDetails();
    } catch (error: unknown) {
      console.error('Error approving quote:', error instanceof Error ? error.message : error);
      toast.error(`No se pudo aprobar la cotización: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  const rejectQuote = async (quoteId: string, reason: string) => {
    try {
      if (selectedQuote && selectedQuote.id === quoteId && editingQuoteDetails.length > 0) {
        await saveQuoteModifications(false);
      }
      await QuotesService.updateStatus(quoteId, 'REJECTED', { rejection_reason: reason });
      toast.success('Cotización rechazada');
      fetchPendingQuotes();
      onDataSaved?.();
      closeQuoteDetails();
    } catch (error) {
      console.error('Error rejecting quote:', error);
      toast.error('No se pudo rechazar la cotización');
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
      toast.success('Cotización eliminada correctamente');
    } catch (error: any) {
      console.error('Error deleting quote:', error);
      toast.error(`Error al eliminar cotización: ${error.message}`);
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

  const openQuoteDetails = async (quote: PendingQuote) => {
    const editableDetails = quote.quote_details.map(detail => ({
      ...detail,
      profit_margin: detail.base_price > 0 ? detail.final_price / detail.base_price - 1 : 0,
      includes_vat: (detail as any).includes_vat ?? false,
      master_code: detail.master_code,
      pricing_path: detail.pricing_path ?? 'COST_DERIVED',
      base_list_price: undefined as number | null | undefined,
      effective_floor: undefined as number | null | undefined,
      zone_range_code: quote.distance_range_code,
    }));
    
    setSelectedQuote(quote);
    setEditingQuoteDetails(editableDetails);
    setListPriceLoading(true);

    const validityDate = quote.validity_date || format(new Date(), 'yyyy-MM-dd');
    const floorLookupDate = validityDate && validityDate < '2026-01-01' ? format(new Date(), 'yyyy-MM-dd') : validityDate;

    try {
      let ranges: Array<{ range_code?: string; diferencial?: number | null }> = [];
      if (quote.plant_id) {
        const { data: r } = await supabase
          .from('distance_range_configs')
          .select('range_code, diferencial')
          .eq('plant_id', quote.plant_id)
          .eq('is_active', true)
          .order('min_distance_km', { ascending: true });
        ranges = r || [];
      }
      setDistanceRanges(ranges);

      const enriched = await Promise.all(
        editableDetails.map(async (d) => {
          const isListPrice = d.pricing_path === 'LIST_PRICE' && d.master_recipe_id;
          if (!isListPrice) return d;

          const floorInfo = await getEffectiveFloorPrice(d.master_recipe_id!, floorLookupDate);
          const rawFloor = floorInfo?.floor_price ?? null;
          const includesVat = d.includes_vat ?? false;
          const baseListPrice =
            rawFloor != null && !includesVat && cashOverpricePct > 0
              ? rawFloor * (1 + cashOverpricePct / 100)
              : rawFloor;
          const zoneCode = quote.distance_range_code as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | undefined;
          const zoneSurcharge = getZoneSurcharge(zoneCode, ranges);
          const effectiveFloor =
            baseListPrice != null
              ? baseListPrice + (isZoneCOrHigher(zoneCode) ? zoneSurcharge : 0)
              : null;

          return {
            ...d,
            base_list_price: baseListPrice,
            effective_floor: effectiveFloor,
            zone_range_code: zoneCode,
          };
        })
      );
      setEditingQuoteDetails(enriched);
    } catch (err) {
      console.error('Error loading list price info:', err);
    } finally {
      setListPriceLoading(false);
    }
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
        toast.success('Cotización actualizada exitosamente');
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
                          size="sm" 
                          className="!bg-green-600 hover:!bg-green-700 !text-white border-0"
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
          <DialogContent className="max-w-[95vw] sm:max-w-5xl max-h-[95vh] sm:h-[90vh] p-0 overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 border-b bg-white shrink-0">
              <DialogTitle className="text-lg sm:text-xl font-bold">Revisión de Cotización</DialogTitle>
              <DialogDescription>Edite los precios o márgenes antes de aprobar.</DialogDescription>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50 min-h-0">
              {/* Header Info - compact on mobile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <Card variant="thin" className="p-3 sm:p-4 bg-white">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-0.5 sm:mb-1">Cliente</p>
                  <p className="font-semibold text-gray-900 text-base sm:text-lg">{selectedQuote?.client?.business_name}</p>
                  <p className="text-xs sm:text-sm text-gray-500">{selectedQuote?.client?.client_code}</p>
                </Card>
                <Card variant="thin" className="p-3 sm:p-4 bg-white">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-0.5 sm:mb-1">Obra</p>
                  <p className="font-semibold text-gray-900 text-base sm:text-lg">{selectedQuote?.construction_site}</p>
                  <p className="text-xs sm:text-sm text-gray-500">Creado por: {selectedQuote?.creator_name}</p>
                </Card>
              </div>

              {/* Items - Mobile: cards, Desktop: table */}
              <Card variant="base" className="overflow-hidden bg-white border-0 shadow-sm mb-6">
                {/* Mobile: stacked cards - full vertical layout, generous spacing */}
                <div className="sm:hidden space-y-6 p-5">
                  {listPriceLoading ? (
                    <div className="py-8 text-center text-gray-500 text-sm">Cargando datos de precios de lista…</div>
                  ) : (
                    editingQuoteDetails.map((detail, idx) => {
                      const isListPriced = detail.pricing_path === 'LIST_PRICE';
                      const resolvedFloor = detail.effective_floor ?? null;
                      const deltaVsFloor = resolvedFloor != null ? detail.final_price - resolvedFloor : null;
                      const rawListPrice =
                        detail.base_list_price != null && !(detail.includes_vat ?? false) && cashOverpricePct > 0
                          ? detail.base_list_price / (1 + cashOverpricePct / 100)
                          : detail.base_list_price ?? null;
                      const upliftAmount = rawListPrice != null && detail.base_list_price != null
                        ? detail.base_list_price - rawListPrice
                        : null;

                      return (
                        <div key={detail.id} className="bg-gray-50/80 rounded-xl p-5 space-y-5 border border-gray-100">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {(features.masterPricingEnabled && detail.master_code) ? detail.master_code : detail.recipe?.recipe_code}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {detail.recipe?.placement_type === 'D' ? 'Directa' : 'Bombeado'}
                              {isListPriced && detail.zone_range_code && (
                                <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-600">
                                  Zona {detail.zone_range_code}
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex flex-col gap-5">
                            <div>
                              <label className="text-xs font-medium text-gray-500 block mb-1">Volumen</label>
                              <div className="text-sm font-medium text-gray-900">{detail.volume} m³</div>
                            </div>
                            {isListPriced ? (
                              <>
                                <div>
                                  <label className="text-xs font-medium text-gray-500 block mb-1">Lista base</label>
                                  <div className="text-sm font-semibold tabular-nums text-slate-700">
                                    ${fmt(detail.base_list_price)}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-500 block mb-1">Piso efectivo</label>
                                  <span className="font-bold tabular-nums text-slate-800">${fmt(resolvedFloor)}</span>
                                </div>
                                <div className="rounded-lg border-2 border-green-200 bg-white/80 p-3">
                                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Precio de venta</label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                    <Input
                                      type="number"
                                      value={detail.final_price.toFixed(2)}
                                      onChange={(e) => updateQuoteDetailFinalPrice(idx, parseFloat(e.target.value) || 0)}
                                      className="pl-7 h-11 bg-white font-bold text-right w-full"
                                    />
                                  </div>
                                  {resolvedFloor != null && deltaVsFloor != null && (
                                    <p className={`mt-1.5 text-xs font-medium ${deltaVsFloor >= 0 ? 'text-systemGreen' : 'text-systemOrange'}`}>
                                      {deltaVsFloor >= 0 ? `$${fmt(deltaVsFloor)} sobre piso` : `$${fmt(Math.abs(deltaVsFloor))} bajo piso`}
                                    </p>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <label className="text-xs font-medium text-gray-500 block mb-1">Precio Base</label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                    <Input
                                      type="number"
                                      value={detail.base_price.toFixed(2)}
                                      onChange={(e) => updateQuoteDetailBasePrice(idx, parseFloat(e.target.value) || 0)}
                                      className="pl-6 h-11 bg-white w-full"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-500 block mb-1">Margen %</label>
                                  <div className="relative">
                                    <Input
                                      type="number"
                                      value={(detail.profit_margin * 100).toFixed(2)}
                                      onChange={(e) => updateQuoteDetailMargin(idx, parseFloat(e.target.value) || 0)}
                                      className="pr-8 h-11 bg-white w-full"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                                  </div>
                                </div>
                                <div className="rounded-lg border-2 border-green-200 bg-white/80 p-3">
                                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Precio Final</label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                    <Input
                                      type="number"
                                      value={detail.final_price.toFixed(2)}
                                      onChange={(e) => updateQuoteDetailFinalPrice(idx, parseFloat(e.target.value) || 0)}
                                      className="pl-6 h-11 bg-white font-bold text-right w-full"
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Producto</th>
                        <th className="px-4 py-3 text-left font-semibold">Volumen</th>
                        <th className="px-4 py-3 text-left font-semibold">
                          {(() => {
                            const hasList = editingQuoteDetails.some(d => d.pricing_path === 'LIST_PRICE');
                            const hasCost = editingQuoteDetails.some(d => d.pricing_path !== 'LIST_PRICE');
                            return hasList && hasCost ? 'Lista base / Precio Base' : hasList ? 'Lista base' : 'Precio Base';
                          })()}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold">
                          {(() => {
                            const hasList = editingQuoteDetails.some(d => d.pricing_path === 'LIST_PRICE');
                            const hasCost = editingQuoteDetails.some(d => d.pricing_path !== 'LIST_PRICE');
                            return hasList && hasCost ? 'Piso efectivo / Margen' : hasList ? 'Piso efectivo' : 'Margen';
                          })()}
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          {(() => {
                            const hasList = editingQuoteDetails.some(d => d.pricing_path === 'LIST_PRICE');
                            const hasCost = editingQuoteDetails.some(d => d.pricing_path !== 'LIST_PRICE');
                            return hasList && hasCost ? 'Precio de venta / Final' : hasList ? 'Precio de venta' : 'Precio Final';
                          })()}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {listPriceLoading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            Cargando datos de precios de lista…
                          </td>
                        </tr>
                      ) : (
                        editingQuoteDetails.map((detail, idx) => {
                          const isListPriced = detail.pricing_path === 'LIST_PRICE';
                          const resolvedFloor = detail.effective_floor ?? null;
                          const deltaVsFloor = resolvedFloor != null ? detail.final_price - resolvedFloor : null;
                          const rawListPrice =
                            detail.base_list_price != null && !(detail.includes_vat ?? false) && cashOverpricePct > 0
                              ? detail.base_list_price / (1 + cashOverpricePct / 100)
                              : detail.base_list_price ?? null;
                          const upliftAmount = rawListPrice != null && detail.base_list_price != null
                            ? detail.base_list_price - rawListPrice
                            : null;

                          return (
                            <tr key={detail.id} className="hover:bg-blue-50/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">
                                  {(features.masterPricingEnabled && detail.master_code) ? detail.master_code : detail.recipe?.recipe_code}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {detail.recipe?.placement_type === 'D' ? 'Directa' : 'Bombeado'}
                                  {isListPriced && detail.zone_range_code && (
                                    <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                      Zona {detail.zone_range_code}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">{detail.volume} m³</td>
                              {isListPriced ? (
                                <>
                                  <td className="px-4 py-3">
                                    <div className="space-y-0.5 text-xs">
                                      {rawListPrice != null && upliftAmount != null && !(detail.includes_vat ?? false) && cashOverpricePct > 0 ? (
                                        <>
                                          <div className="flex justify-between gap-2">
                                            <span className="text-slate-500">Lista catálogo</span>
                                            <span className="font-medium tabular-nums text-slate-600">${fmt(rawListPrice)}</span>
                                          </div>
                                          <div className="flex justify-between gap-2">
                                            <span className="text-systemGreen">+{cashOverpricePct}% contado</span>
                                            <span className="font-medium tabular-nums text-systemGreen">+${fmt(upliftAmount)}</span>
                                          </div>
                                          <div className="flex justify-between gap-2 pt-0.5 border-t border-slate-100">
                                            <span className="font-semibold text-slate-600">Lista base</span>
                                            <span className="font-semibold tabular-nums text-slate-700">${fmt(detail.base_list_price)}</span>
                                          </div>
                                        </>
                                      ) : (
                                        <span className="font-semibold tabular-nums text-slate-700">${fmt(detail.base_list_price)}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="font-bold tabular-nums text-slate-800">${fmt(resolvedFloor)}</span>
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
                                      {resolvedFloor != null && deltaVsFloor != null && (
                                        <p className={`mt-1 text-[11px] font-medium ${deltaVsFloor >= 0 ? 'text-systemGreen' : 'text-systemOrange'}`}>
                                          {deltaVsFloor >= 0 ? `$${fmt(deltaVsFloor)} sobre piso` : `$${fmt(Math.abs(deltaVsFloor))} bajo piso`}
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
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
                                </>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Additional Products */}
              <Card variant="base" className="overflow-hidden bg-white border-0 shadow-sm mb-6">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-700">Productos Adicionales / Especiales</h3>
                </div>
                {selectedQuote?.quote_additional_products && selectedQuote.quote_additional_products.length > 0 ? (
                  <>
                    {/* Mobile: cards */}
                    <div className="sm:hidden divide-y divide-gray-100">
                      {selectedQuote.quote_additional_products.map((prod) => (
                        <div key={prod.id} className="p-5 space-y-2">
                          <div className="font-medium text-gray-900">{prod.additional_products?.name || 'Producto desconocido'}</div>
                          <div className="text-xs text-gray-500">{prod.additional_products?.code}</div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">{prod.quantity} {prod.additional_products?.unit}</span>
                            <span className="font-bold text-gray-900">${prod.total_price.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Base ${prod.base_price.toFixed(2)} · {prod.margin_percentage.toFixed(1)}% margen</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop: table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Producto</th>
                            <th className="px-4 py-3 text-left font-semibold">Cantidad</th>
                            <th className="px-4 py-3 text-left font-semibold">Precio Base</th>
                            <th className="px-4 py-3 text-left font-semibold">Margen</th>
                            <th className="px-4 py-3 text-right font-semibold">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedQuote.quote_additional_products.map((prod) => (
                            <tr key={prod.id} className="hover:bg-blue-50/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{prod.additional_products?.name || 'Producto desconocido'}</div>
                                <div className="text-xs text-gray-500">{prod.additional_products?.code}</div>
                              </td>
                              <td className="px-4 py-3">{prod.quantity} {prod.additional_products?.unit}</td>
                              <td className="px-4 py-3">${prod.base_price.toFixed(2)}</td>
                              <td className="px-4 py-3">{prod.margin_percentage.toFixed(1)}%</td>
                              <td className="px-4 py-3 text-right font-bold text-gray-900">${prod.total_price.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-gray-500">
                    No hay productos adicionales en esta cotización
                  </div>
                )}
              </Card>

              {/* Pump Service & VAT - larger touch targets on mobile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card variant="thin" className="p-4 bg-blue-50/30 border-blue-100 min-h-[52px] sm:min-h-0 flex flex-col justify-center">
                  <div className="flex items-center gap-3 py-2 sm:py-0 min-h-[44px]">
                    <Checkbox.Root
                      id="pumpService"
                      checked={editingQuoteDetails.length > 0 && editingQuoteDetails[0].pump_service}
                      onCheckedChange={(checked) => updateQuotePumpService(checked === true, editingQuoteDetails[0]?.pump_price)}
                      className="h-5 w-5 shrink-0 rounded border-blue-300 bg-white data-[state=checked]:bg-blue-600 flex items-center justify-center"
                    >
                      <Checkbox.Indicator><CheckIcon className="text-white w-3 h-3" /></Checkbox.Indicator>
                    </Checkbox.Root>
                    <label htmlFor="pumpService" className="text-sm font-medium text-blue-900 flex-1 cursor-pointer">Incluir Bombeo</label>
                  </div>
                  {editingQuoteDetails[0]?.pump_service && (
                    <Input
                      type="number"
                      placeholder="Precio"
                      value={editingQuoteDetails[0].pump_price || ''}
                      onChange={(e) => updateQuotePumpService(true, parseFloat(e.target.value) || 0)}
                      className="bg-white h-11 mt-2 sm:h-8 sm:mt-2"
                    />
                  )}
                </Card>

                <Card variant="thin" className="p-4 bg-gray-50 min-h-[52px] sm:min-h-0 flex flex-col justify-center">
                  <div className="flex items-center gap-3 py-2 sm:py-0 min-h-[44px]">
                    <Checkbox.Root
                      id="vat"
                      checked={editingQuoteDetails.every(d => d.includes_vat)}
                      onCheckedChange={(checked) => {
                        const isChecked = checked === true;
                        setEditingQuoteDetails(prev => prev.map(d => ({ ...d, includes_vat: isChecked })));
                      }}
                      className="h-5 w-5 shrink-0 rounded border-gray-300 bg-white data-[state=checked]:bg-gray-800 flex items-center justify-center"
                    >
                      <Checkbox.Indicator><CheckIcon className="text-white w-3 h-3" /></Checkbox.Indicator>
                    </Checkbox.Root>
                    <label htmlFor="vat" className="text-sm font-medium text-gray-700 flex-1 cursor-pointer">Incluir IVA (16%)</label>
                  </div>
                </Card>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:p-6 border-t bg-white flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 shrink-0">
              <Button variant="ghost" onClick={closeQuoteDetails} className="w-full sm:w-auto order-2 sm:order-1">
                Cancelar
              </Button>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2">
                <Button variant="secondary" onClick={() => saveQuoteModifications(true)} className="w-full sm:w-auto">
                  Guardar Cambios
                </Button>
                <Button
                  className="!bg-green-600 hover:!bg-green-700 !text-white border-0 w-full sm:w-auto"
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