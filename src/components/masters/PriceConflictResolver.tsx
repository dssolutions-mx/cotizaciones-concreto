'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface PriceRow {
  source: 'product_prices' | 'quotes';
  id: string; // product_prices.id or quote_details.id
  base_price: number;
  effective_date: string;
  client_id: string | null;
  construction_site: string | null;
  variant_code: string | null;
  code?: string | null; // product price code
  quote_number?: string | null;
}

interface PriceConflictResolverProps {
  masterRecipeId: string;
  clientId?: string | null;
  constructionSite?: string | null;
  onResolved?: () => void;
}

export default function PriceConflictResolver({ masterRecipeId, clientId, constructionSite, onResolved }: PriceConflictResolverProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [strategy, setStrategy] = useState<'recent' | 'highest' | 'lowest' | 'manual'>('recent');
  const [manualPrice, setManualPrice] = useState<string>('');
  const [masterPrice, setMasterPrice] = useState<number | null>(null);
  const [recentRemisiones, setRecentRemisiones] = useState<any[]>([]);
  const [variantList, setVariantList] = useState<{ id: string; code: string }[]>([]);
  const [masterMeta, setMasterMeta] = useState<any>(null);
  const [scopeQuotes, setScopeQuotes] = useState<any[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>('new');
  const [evidenceRows, setEvidenceRows] = useState<any[]>([]);
  const [clientName, setClientName] = useState<string | null>(null);
  const [clientNameMap, setClientNameMap] = useState<Map<string, string>>(new Map());

  const generateQuoteNumber = () => {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const masterPart = (masterMeta?.master_code || 'MASTER').replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase() || 'MASTER';
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `COT-${masterPart}-${datePart}-${rand}`;
  };

  const getClientName = (id: string | null): string => {
    if (!id) return 'General';
    return clientNameMap.get(id) || id;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // 0) Master metadata
      const { data: master } = await supabase
        .from('master_recipes')
        .select('master_code, strength_fc, age_days, placement_type, max_aggregate_size, slump, plant_id')
        .eq('id', masterRecipeId)
        .single();
      setMasterMeta(master || null);

      // 0.5) Fetch client name if clientId provided
      if (clientId) {
        const { data: client } = await supabase
          .from('clients')
          .select('business_name')
          .eq('id', clientId)
          .single();
        setClientName(client?.business_name || clientId);
      }

      // 1) Variants for this master
      const { data: variants } = await supabase
        .from('recipes')
        .select('id, recipe_code')
        .eq('master_recipe_id', masterRecipeId);
      const recipeIds = (variants || []).map(v => v.id);
      setVariantList((variants || []).map((v: any) => ({ id: v.id, code: v.recipe_code })));

      // 2) Variant-level active prices (scope filtered)
      const { data: pp } = await supabase
        .from('product_prices')
        .select('id, code, base_price, effective_date, client_id, construction_site, recipe_id, recipes:recipe_id(recipe_code)')
        .eq('is_active', true)
        .in('recipe_id', recipeIds.length ? recipeIds : ['00000000-0000-0000-0000-000000000000']);

      // 3) Approved quotes for those variants (scope filtered)
      const { data: qd } = await supabase
        .from('quote_details')
        .select('id, final_price, recipe_id, quotes:quote_id(quote_number, created_at, status, client_id, construction_site), recipes:recipe_id(recipe_code)')
        .in('recipe_id', recipeIds.length ? recipeIds : ['00000000-0000-0000-0000-000000000000']);

      const scopeFilter = (cId: string | null, site: string | null) => (row: any) => {
        const rowClient = row.client_id ?? row.quotes?.client_id ?? null;
        const rowSite = row.construction_site ?? row.quotes?.construction_site ?? null;
        const clientMatches = clientId ? String(rowClient || '') === String(clientId || '') : true;
        const siteMatches = constructionSite ? String(rowSite || '') === String(constructionSite || '') : true;
        return clientMatches && siteMatches;
      };

      const ppRows: PriceRow[] = (pp || []).filter(scopeFilter(clientId ?? null, constructionSite ?? null)).map((r: any) => ({
        source: 'product_prices',
        id: r.id,
        base_price: r.base_price,
        effective_date: r.effective_date,
        client_id: r.client_id ?? null,
        construction_site: r.construction_site ?? null,
        variant_code: r.recipes?.recipe_code || null,
        code: r.code || null
      }));
      const approvedFiltered = (qd || []).filter((r: any) => r.quotes?.status === 'APPROVED').filter(scopeFilter(clientId ?? null, constructionSite ?? null));

      const qdRows: PriceRow[] = approvedFiltered.map((r: any) => ({
        source: 'quotes',
        id: r.id,
        base_price: r.final_price,
        effective_date: r.quotes?.created_at,
        client_id: r.quotes?.client_id || null,
        construction_site: r.quotes?.construction_site || null,
        variant_code: r.recipes?.recipe_code || null,
        quote_number: r.quotes?.quote_number || null
      }));

      setRows([...ppRows, ...qdRows]);

      // Fetch client names for all unique client IDs in rows
      const allClientIds = Array.from(new Set([...(ppRows.map(r => r.client_id)), ...(qdRows.map(r => r.client_id))].filter(Boolean)));
      if (allClientIds.length > 0) {
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, business_name')
          .in('id', allClientIds);
        const newMap = new Map<string, string>();
        (clientsData || []).forEach((c: any) => {
          newMap.set(c.id, c.business_name);
        });
        setClientNameMap(newMap);
      }

      // 4) Skip author lookup to avoid RLS errors on profiles

      // 5) Existing master price for this scope
      const { data: mp } = await supabase
        .from('product_prices')
        .select('base_price')
        .eq('is_active', true)
        .eq('master_recipe_id', masterRecipeId)
        .eq('client_id', clientId ?? null)
        .eq('construction_site', constructionSite ?? null)
        .limit(1)
        .maybeSingle();
      setMasterPrice(mp?.base_price ?? null);

      // 6) Recent remisiones (last 90 days) for variants
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const since = ninetyDaysAgo.toISOString().split('T')[0];
      let evidence: any[] = [];
      
      // Query remisiones directly and join orders for client/site
      try {
        const { data, error } = await supabase
          .from('remisiones')
          .select('id, fecha, remision_number, volumen_fabricado, recipe_id, order_id, orders!inner(client_id, construction_site), recipes(recipe_code)')
          .in('recipe_id', recipeIds.length ? recipeIds : ['00000000-0000-0000-0000-000000000000'])
          .gte('fecha', since)
          .order('fecha', { ascending: false })
          .limit(100);
        
        if (!error && data) {
          // Fetch order_items to get prices linked to remisiones
          const remData = data as any[];
          const orderIds = Array.from(new Set(remData.map((r: any) => r.order_id).filter(Boolean)));
          const { data: itemRows } = await supabase
            .from('order_items')
            .select('order_id, recipe_id, unit_price')
            .in('order_id', orderIds.length ? orderIds : ['00000000-0000-0000-0000-000000000000']);
          
          const itemMap = new Map<string, Map<string, number>>();
          (itemRows || []).forEach((item: any) => {
            if (!itemMap.has(item.order_id)) {
              itemMap.set(item.order_id, new Map());
            }
            itemMap.get(item.order_id)!.set(item.recipe_id, item.unit_price);
          });

          evidence = remData.map((r: any) => {
            const recipePrice = itemMap.get(r.order_id)?.get(r.recipe_id) ?? null;
            return {
              remision_id: r.id,
              id: r.id,
              fecha: r.fecha,
              remision_number: r.remision_number,
              volumen_fabricado: r.volumen_fabricado,
              recipe_id: r.recipe_id,
              recipe_code: r.recipes?.recipe_code,
              order_id: r.order_id,
              client_id: r.orders?.client_id || null,
              construction_site: r.orders?.construction_site || null,
              unit_price_resolved: recipePrice
            };
          });
        } else if (error) {
          throw error;
        }
      } catch (e: any) {
        console.warn('Error loading remisiones:', e.message);
        evidence = [];
      }

      // Enrich with client/site via orders if missing
      const scoped = evidence.filter(r => {
        if (clientId && String(r.client_id || '') !== String(clientId)) return false;
        if (constructionSite && String(r.construction_site || '') !== String(constructionSite)) return false;
        return true;
      });
      setRecentRemisiones(scoped);
      setEvidenceRows(scoped);

      // 7) Existing approved quotes for this scope (for inspiration)
      if (clientId) {
      const { data: scopeQs } = await supabase
        .from('quotes')
        .select('id, quote_number, created_at, status')
        .eq('client_id', clientId)
        .eq('construction_site', constructionSite ?? null)
        .order('created_at', { ascending: false })
        .limit(10);
        setScopeQuotes(scopeQs || []);
      } else {
        setScopeQuotes([]);
      }
    } catch (e: any) {
      setError(e.message || 'Error cargando precios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [masterRecipeId, clientId, constructionSite]);

  const resolvePrice = (): number | null => {
    if (rows.length === 0) return null;
    if (strategy === 'manual') return parseFloat(manualPrice) || null;
    if (strategy === 'recent') {
      return rows.slice().sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())[0].base_price;
    }
    if (strategy === 'highest') {
      return rows.slice().sort((a, b) => b.base_price - a.base_price)[0].base_price;
    }
    if (strategy === 'lowest') {
      return rows.slice().sort((a, b) => a.base_price - b.base_price)[0].base_price;
    }
    return null;
  };

  const applyResolution = async () => {
    const price = resolvePrice();
    if (!price) return;
    setLoading(true);
    setError(null);
    try {
      // Get current user for created_by
      const { data: userData } = await supabase.auth.getUser();
      const createdBy = userData?.user?.id || null;

      // Create a new consolidation quote (approved) with one item tied to the master
      const validity = new Date();
      validity.setDate(validity.getDate() + 30);

      const quoteNumber = generateQuoteNumber();

      const { data: newQuote, error: qErr } = await supabase
        .from('quotes')
        .insert({
          client_id: clientId ?? null,
          construction_site: constructionSite ?? null,
          location: constructionSite || 'Consolidación Maestro',
          plant_id: masterMeta?.plant_id ?? null,
          status: 'APPROVED',
          validity_date: validity.toISOString(),
          approval_date: new Date().toISOString(),
          approved_by: createdBy,
          created_by: createdBy,
          quote_number: quoteNumber
        })
        .select('id')
        .single();
      if (qErr) throw new Error(`Cotización: ${qErr.message}`);

      // Now create master-level product price with the quote_id
      const baseQuote = scopeQuotes.find(q => q.id === selectedQuoteId);
      const code = `M-${masterMeta?.master_code || masterRecipeId}-${baseQuote?.quote_number || quoteNumber}`;
      const description = `Precio maestro ${masterMeta?.master_code || ''}${baseQuote ? ` (inspirado en cot ${baseQuote.quote_number})` : ''}`;
      const { error: ppErr } = await supabase
        .from('product_prices')
        .insert({
          master_recipe_id: masterRecipeId,
          quote_id: newQuote.id,
          code,
          description,
          type: 'QUOTED',
          fc_mr_value: masterMeta?.strength_fc ?? null,
          age_days: masterMeta?.age_days ?? null,
          placement_type: masterMeta?.placement_type ?? null,
          max_aggregate_size: masterMeta?.max_aggregate_size ?? null,
          slump: masterMeta?.slump ?? null,
          base_price: price,
          is_active: true,
          effective_date: new Date().toISOString(),
          client_id: clientId ?? null,
          construction_site: constructionSite ?? null,
          plant_id: masterMeta?.plant_id ?? null
        });
      if (ppErr) throw new Error(`Producto precio: ${ppErr.message}`);

      const { error: qdErr } = await supabase
        .from('quote_details')
        .insert({
          quote_id: newQuote.id,
          master_recipe_id: masterRecipeId,
          product_id: null,
          volume: 1,
          base_price: price,
          profit_margin: 0,
          final_price: price,
          total_amount: price,
          includes_vat: false,
          pump_service: false,
          pump_price: null
        });
      if (qdErr) throw new Error(`Detalle cotización: ${qdErr.message}`);
      
      setError(null);
      onResolved?.();
    } catch (e: any) {
      const msg = e.message || 'Error desconocido aplicando resolución';
      console.error('Apply resolution error:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="text-sm text-gray-600">
        Resolver precios a nivel maestro. Alcance: cliente {clientName || getClientName(clientId)} / obra {constructionSite || 'General'}. {masterPrice !== null && (
          <span className="text-green-700">Precio maestro vigente: ${masterPrice.toFixed(2)}</span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 max-h-56 overflow-auto text-xs">
        {loading ? (
          <div className="flex items-center gap-2 text-blue-600"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div>
        ) : (
          rows.map((r, i) => (
            <div key={i} className="p-2 border rounded bg-white flex items-center justify-between">
              <div>
                <div className="font-mono">{r.variant_code || '—'}</div>
                <div className="text-[11px] text-gray-600">{r.source} • {new Date(r.effective_date).toLocaleDateString()} • ${r.base_price.toFixed(2)}</div>
              </div>
              <div className="text-[11px] text-gray-600">{getClientName(r.client_id)} / {r.construction_site || '—'}</div>
            </div>
          ))
        )}
      </div>
      {/* Evidence table using remisiones_with_pricing */}
      {evidenceRows.length > 0 && (
        <div className="mt-2">
          <div className="text-xs font-medium text-gray-700 mb-1">Evidencia (remisiones_with_pricing, últimos 90 días)</div>
          <div className="max-h-40 overflow-auto border rounded">
            {rows.map(row => {
              const usage = evidenceRows.filter(e => (row.source === 'product_prices' ? e.product_price_id === row.id : e.quote_detail_id === row.id));
              if (usage.length === 0) return null;
              return (
                <div key={`usage-${row.source}-${row.id}`} className="border-b last:border-b-0">
                  <div className="px-2 py-1 text-[11px] bg-gray-50 flex items-center justify-between">
                    <div className="font-mono truncate mr-2">{row.variant_code}</div>
                    <div className="text-gray-600">{row.source === 'quotes' ? (`Cot ${row.quote_number || ''}`) : (row.code || 'product_price')}</div>
                    <div className="text-gray-700">{usage.length} usos</div>
                  </div>
                  {usage.slice(0, 5).map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between text-xs px-2 py-1">
                      <div className="font-mono">{e.recipe_code}</div>
                      <div>#{e.remision_number} • {new Date(e.fecha).toLocaleDateString()} • {Number(e.volumen_fabricado||0).toFixed(2)} m³</div>
                      <div>${Number(e.matched_price ?? e.unit_price_resolved ?? 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Inspiration quote selector */}
      <div className="text-xs text-gray-700">
        <div className="mt-2 font-medium">Inspirar en cotización</div>
        <select className="border rounded px-2 py-1 text-sm" value={selectedQuoteId} onChange={e=>setSelectedQuoteId(e.target.value)}>
          <option value="new">Crear nueva cotización (consolidación)</option>
          {scopeQuotes.map(q => (
            <option key={q.id} value={q.id}>{q.quote_number || q.id} • {new Date(q.created_at).toLocaleDateString()} • {q.status}</option>
          ))}
        </select>
      </div>
      {/* Recent evidence */}
      {recentRemisiones.length > 0 && (
        <div className="text-xs text-gray-700">
          <div className="mt-2 font-medium">Remisiones recientes (90 días)</div>
          <div className="max-h-40 overflow-auto border rounded bg-white">
            {recentRemisiones.slice(0, 10).map((r: any) => (
              <div key={r.id} className="px-2 py-1 flex items-center justify-between border-b last:border-b-0">
                <div className="font-mono">{r.recipe?.recipe_code}</div>
                <div>{new Date(r.fecha).toLocaleDateString()} • #{r.remision_number} • {r.volumen_fabricado.toFixed(2)} m³</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2"><input type="radio" checked={strategy==='recent'} onChange={()=>setStrategy('recent')} />Más reciente</label>
        <label className="inline-flex items-center gap-2"><input type="radio" checked={strategy==='highest'} onChange={()=>setStrategy('highest')} />Más alto</label>
        <label className="inline-flex items-center gap-2"><input type="radio" checked={strategy==='lowest'} onChange={()=>setStrategy('lowest')} />Más bajo</label>
        <label className="inline-flex items-center gap-2"><input type="radio" checked={strategy==='manual'} onChange={()=>setStrategy('manual')} />Manual</label>
        {strategy==='manual' && (
          <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Precio" value={manualPrice} onChange={e=>setManualPrice(e.target.value)} />
        )}
      </div>
      <div className="flex justify-end">
        <Button onClick={applyResolution} disabled={loading}>Aplicar</Button>
      </div>
    </div>
  );
}


