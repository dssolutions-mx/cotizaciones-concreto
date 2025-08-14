'use client';

import React, { useMemo, useState } from 'react';
import type { StagingRemision } from '@/types/arkik';
import { supabase } from '@/lib/supabase/client';
import { ArkikValidator } from '@/services/arkikValidator';

type Props = {
  rows: StagingRemision[];
  onRowsChange: (rows: StagingRemision[]) => void;
  plantId?: string;
};

export default function ValidationTable({ rows, onRowsChange, plantId }: Props) {
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [siteResults, setSiteResults] = useState<any[]>([]);
  const [recipeQuery, setRecipeQuery] = useState('');
  const [recipeResults, setRecipeResults] = useState<any[]>([]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [debug, setDebug] = useState<string>('');
  const [showDebug, setShowDebug] = useState(false);
  const [autoSeeded, setAutoSeeded] = useState<Set<string>>(new Set());
  // Cache construction sites per client to avoid repeated network calls
  const sitesCacheRef = React.useRef<Map<string, any[]>>(new Map());
  const inFlightClientsRef = React.useRef<Set<string>>(new Set());
  const [lastSitesClientId, setLastSitesClientId] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    if (!showOnlyIssues) return rows;
    return rows.filter(r => (r.validation_errors?.length || 0) > 0 || r.validation_status !== 'valid');
  }, [rows, showOnlyIssues]);

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const updateRow = (id: string, patch: Partial<StagingRemision>) => {
    const next = rows.map(r => (r.id === id ? { ...r, ...patch } : r));
    onRowsChange(next);
  };

  const validateAll = async () => {
    if (!plantId || !rows.length || validating) return;
    setValidating(true);
    try {
      console.log('[Arkik][ValidationTable] validateAll start', { plantId, rowCount: rows.length });
      const validator = new ArkikValidator(plantId);
      const { validated } = await validator.validateBatch(rows);
      console.log('[Arkik][ValidationTable] validateAll result sample', validated?.[0]);
      onRowsChange(validated as unknown as StagingRemision[]);
    } catch (err) {
      console.error('Arkik validation error:', err);
      setDebug(String(err));
    } finally {
      setValidating(false);
    }
  };

  // Filter clients for this plant using product_prices (avoid huge quote IN lists)
  const findClientsForPlant = async (query: string, currentRowId?: string) => {
    try {
      if (!plantId) return setClientResults([]);
      // Get candidate client_ids from product_prices in this plant (direct clients only)
      const { data: priceRows } = await supabase
        .from('product_prices')
        .select('client_id')
        .eq('plant_id', plantId)
        .eq('is_active', true)
        .limit(10000);
      const clientIdSet = new Set<string>();
      (priceRows || []).forEach((r: any) => {
        if (r.client_id) clientIdSet.add(r.client_id);
      });

      const clientIds = Array.from(clientIdSet);
      if (clientIds.length === 0) { setClientResults([]); return; }

      let req = supabase
        .from('clients')
        .select('id, business_name, client_code')
        .in('id', clientIds)
        .limit(50);
      if (query && query.trim().length > 0) {
        const q = query.trim();
        req = req.or(`business_name.ilike.%${q}%,client_code.ilike.%${q}%`);
      }
      const { data: clients } = await req;
      setClientResults(clients || []);

      // Auto-select if single match or if suggested from validation
      if (currentRowId && clients && clients.length === 1) {
        const clientId = clients[0].id as string;
        updateRow(currentRowId, { client_id: clientId });
        await loadSitesForClientWithPlantFilter(clientId, currentRowId);
        setAutoSeeded(prev => new Set(prev).add(currentRowId));
      }
    } catch (e) {
      console.error('[Arkik][ValidationTable] findClientsForPlant error', e);
    }
  };

  // Filter construction sites for the selected client, enhanced based on ScheduleOrderForm pattern
  const loadSitesForClientWithPlantFilter = async (clientId: string, currentRowId?: string, obraQuery?: string) => {
    try {
      if (!plantId || !clientId) {
        setSiteResults([]);
        return;
      }

      // Serve from cache when available and no query filter
      if (!obraQuery && sitesCacheRef.current.has(clientId)) {
        const cached = sitesCacheRef.current.get(clientId)!;
        setSiteResults(cached);
        setLastSitesClientId(clientId);
        if (currentRowId && cached.length === 1) {
          updateRow(currentRowId, { construction_site_id: cached[0].id });
          setAutoSeeded(prev => new Set(prev).add(currentRowId));
        }
        return;
      }

      // Prevent duplicate inflight fetches for the same client
      if (inFlightClientsRef.current.has(clientId)) return;
      inFlightClientsRef.current.add(clientId);

      console.log(`[ValidationTable] Loading sites for client ${clientId}, query: "${obraQuery}"`);

      // Primary approach: Get all construction sites for this client
      let clientSites: any[] = [];
      let sitesError: any = null;
      try {
        const { data, error } = await supabase
          .from('construction_sites')
          .select('id, name, location')
          .eq('client_id', clientId)
          .limit(100);
        clientSites = data || [];
        sitesError = error;
      } catch (e) {
        sitesError = e;
      }

      if (sitesError) {
        console.error('[ValidationTable] Error loading construction sites:', sitesError);
        setSiteResults([]);
        inFlightClientsRef.current.delete(clientId);
        return;
      }

      if (!clientSites || clientSites.length === 0) {
        console.log(`[ValidationTable] No construction sites found for client ${clientId}`);
        setSiteResults([]);
        return;
      }

      // Filter by query if provided
      let filteredSites = clientSites;
      if (obraQuery && obraQuery.trim()) {
        const query = obraQuery.trim().toLowerCase();
        filteredSites = clientSites.filter(s => 
          s.name.toLowerCase().includes(query) || 
          (s.location && s.location.toLowerCase().includes(query))
        );
      }

      // Enhanced: Also check for sites mentioned in active prices for this client
      let priceRows: any[] = [];
      try {
        const { data } = await supabase
          .from('product_prices')
          .select('construction_site')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .not('construction_site', 'is', null);
        priceRows = data || [];
      } catch {
        priceRows = [];
      }

      const pricedSiteNames = new Set((priceRows || []).map(p => String(p.construction_site).trim().toLowerCase()));
      
      // Prioritize sites that have prices configured
      filteredSites.sort((a, b) => {
        const aHasPrice = pricedSiteNames.has(a.name.toLowerCase());
        const bHasPrice = pricedSiteNames.has(b.name.toLowerCase());
        if (aHasPrice && !bHasPrice) return -1;
        if (!aHasPrice && bHasPrice) return 1;
        return a.name.localeCompare(b.name);
      });

      setSiteResults(filteredSites);
      sitesCacheRef.current.set(clientId, filteredSites);
      setLastSitesClientId(clientId);
      console.log(`[ValidationTable] Found ${filteredSites.length} sites for client, ${pricedSiteNames.size} have prices`);

      // Auto-select if only one site exists
      if (currentRowId && filteredSites.length === 1) {
        updateRow(currentRowId, { construction_site_id: filteredSites[0].id });
        setAutoSeeded(prev => new Set(prev).add(currentRowId));
        console.log(`[ValidationTable] Auto-selected single site: ${filteredSites[0].name}`);
      }

      // Auto-select if query matches exactly one site
      if (currentRowId && obraQuery && filteredSites.length === 1) {
        updateRow(currentRowId, { construction_site_id: filteredSites[0].id });
        setAutoSeeded(prev => new Set(prev).add(currentRowId));
        console.log(`[ValidationTable] Auto-selected site by query match: ${filteredSites[0].name}`);
      }

    } catch (e) {
      console.error('[Arkik][ValidationTable] loadSitesForClientWithPlantFilter error', e);
      setSiteResults([]);
    } finally {
      inFlightClientsRef.current.delete(clientId);
    }
  };

  // Auto-apply validated suggestions and infer client/site (enhanced based on ScheduleOrderForm pattern)
  React.useEffect(() => {
    if (!plantId || !rows.length) return;

    // Only seed for the first 50 rows to avoid stampede on first render
    rows.slice(0, 50).forEach(r => {
      if (!autoSeeded.has(r.id)) {
        // First priority: Apply validated suggestions automatically
        if (r.suggested_client_id && !r.client_id) {
          updateRow(r.id, { client_id: r.suggested_client_id });
          console.log(`[ValidationTable] Auto-applied suggested client for row ${r.row_number}: ${r.suggested_client_id}`);
          
          // Clear any existing site selection when client changes
          if (r.construction_site_id) {
            updateRow(r.id, { construction_site_id: '' });
          }
          
          // Load sites for the new client and try to auto-apply suggested site
          if (r.suggested_site_name && !r.construction_site_id) {
            loadSitesForClientWithPlantFilter(r.suggested_client_id, r.id, r.suggested_site_name);
          } else {
            loadSitesForClientWithPlantFilter(r.suggested_client_id, r.id);
          }
          setAutoSeeded(prev => new Set(prev).add(r.id));
          return;
        }
        
        // Second priority: Text-based client matching
        const candidate = (r.cliente_name || '').trim();
        if (!r.client_id && candidate.length > 1) {
          findClientsForPlant(candidate, r.id);
        }
        
        // Third priority: Site matching for existing clients
        if ((r.client_id || r.suggested_client_id) && (r.obra_name || '').trim().length > 0 && !r.construction_site_id) {
          const clientId = r.client_id || r.suggested_client_id!;
          // Debounce site loading per client
          if (lastSitesClientId !== clientId && !inFlightClientsRef.current.has(clientId)) {
            loadSitesForClientWithPlantFilter(clientId, r.id, r.obra_name);
          }
        }
      }
    });
  }, [rows, plantId, lastSitesClientId]);

  const findClients = async (query: string) => {
    // Kept for generic search if needed elsewhere
    setClientQuery(query);
    return findClientsForPlant(query);
  };

  const loadSitesForClient = async (clientId: string) => {
    const { data } = await supabase
      .from('construction_sites')
      .select('id, name')
      .eq('client_id', clientId)
      .limit(50);
    setSiteResults(data || []);
  };

  const findRecipes = async (query: string) => {
    setRecipeQuery(query);
    if (!plantId || !query || query.length < 2) { setRecipeResults([]); return; }
    try {
      // Search by both recipe_code and arkik_long_code, restrict to recipes with active prices in this plant
      const { data } = await supabase
        .from('recipes')
        .select('id, recipe_code, arkik_long_code, product_prices!inner(id)')
        .eq('plant_id', plantId)
        .or(`recipe_code.ilike.%${query}%,arkik_long_code.ilike.%${query}%`)
        .eq('product_prices.is_active', true)
        .eq('product_prices.plant_id', plantId)
        .limit(50);
      const unique = Array.from(new Map((data || []).map((r: any) => [r.id, { 
        id: r.id, 
        recipe_code: r.recipe_code,
        arkik_long_code: r.arkik_long_code 
      }])).values());
      setRecipeResults(unique);
      console.log('[Arkik][ValidationTable] recipe results', { plantId, query, count: unique.length });
    } catch (e) {
      console.error('[Arkik][ValidationTable] findRecipes error', e);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showOnlyIssues} onChange={e => setShowOnlyIssues(e.target.checked)} />
            Mostrar sólo filas con incidencias
          </label>
          <span className="text-gray-500">Filas: {visibleRows.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs px-3 py-1 border rounded disabled:opacity-50"
            onClick={validateAll}
            disabled={!plantId || validating || rows.length === 0}
            title={!plantId ? 'Selecciona una planta' : 'Ejecutar validación y vinculación (recetas, precios, cliente/obra)'}
          >
            {validating ? 'Validando…' : 'Validar y Vincular'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
        <div>Planta: {plantId || '—'} | Filas: {rows.length} | Mostrar Debug: <button className="underline" onClick={() => setShowDebug(v => !v)}>{showDebug ? 'Ocultar' : 'Ver'}</button></div>
        {debug && <div className="text-rose-600 truncate max-w-[50%]" title={debug}>Error: {debug}</div>}
      </div>

      {showDebug && (
        <pre className="text-[11px] bg-gray-50 border rounded p-2 mb-2 max-h-48 overflow-auto">
{JSON.stringify({
  sampleRow: rows[0] ? { remision_number: rows[0].remision_number, product_description: (rows[0] as any).product_description, suggested_client_id: (rows[0] as any).suggested_client_id, suggested_site_name: (rows[0] as any).suggested_site_name } : null,
  recipeQuery,
  recipeResultsCount: recipeResults.length,
  clientQuery,
  clientResultsCount: clientResults.length,
  siteResultsCount: siteResults.length,
  autoSeededCount: autoSeeded.size,
}, null, 2)}
        </pre>
      )}

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-2 w-8"></th>
              <th className="p-2">Estado</th>
              <th className="p-2">Remisión</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Cliente</th>
              <th className="p-2">Obra</th>
              <th className="p-2">Placas</th>
              <th className="p-2">Chofer</th>
              <th className="p-2">B/NB</th>
              <th className="p-2">Receta</th>
              <th className="p-2">Materiales</th>
              <th className="p-2">Precio</th>
              <th className="p-2">Vol</th>
              <th className="p-2">Comentarios</th>
              <th className="p-2">Materiales</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(r => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={e => toggleSelect(r.id, e.target.checked)} />
                </td>
                <td className="p-2">
                  <StatusBadge status={r.validation_status} count={(r.validation_errors || []).length} />
                </td>
                <td className="p-2 font-medium">{r.remision_number}</td>
                <td className="p-2">
                  <div>{r.fecha.toISOString().split('T')[0]}</div>
                  <div className="text-xs text-gray-500">{formatTime(r.hora_carga)}</div>
                </td>
                <td className="p-2 min-w-[220px]">
                  <div className="flex flex-col gap-1">
                    <input
                      className="border rounded px-2 py-1"
                      value={r.cliente_name}
                      onChange={e => updateRow(r.id, { cliente_name: e.target.value })}
                      onBlur={e => findClientsForPlant(e.target.value, r.id)}
                    />
                    <div className="flex gap-2">
                      <select className="border rounded px-2 py-1 flex-1" onFocus={() => { setActiveRowId(r.id); findClientsForPlant('', r.id); }} onChange={async e => {
                        const clientId = e.target.value;
                        updateRow(r.id, { client_id: clientId });
                        await loadSitesForClientWithPlantFilter(clientId, r.id, r.obra_name);
                      }} value={r.client_id || r.suggested_client_id || ''}>
                        <option value="">Selecciona cliente</option>
                        {clientResults.map(c => (
                          <option key={c.id} value={c.id}>{c.business_name} {c.client_code ? `(${c.client_code})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    {r.suggested_client_id && (
                      <div className="text-[11px] text-emerald-700">
                        💰 Sugerido por precio
                        {!r.client_id && (
                          <button 
                            className="ml-2 text-xs underline"
                            onClick={() => {
                              updateRow(r.id, { client_id: r.suggested_client_id });
                              if (r.suggested_site_name) {
                                loadSitesForClientWithPlantFilter(r.suggested_client_id!, r.id, r.suggested_site_name);
                              }
                            }}
                          >
                            Aplicar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-2 min-w-[220px]">
                  <div className="flex flex-col gap-1">
                    <input
                      className="border rounded px-2 py-1"
                      value={r.obra_name}
                      onChange={e => updateRow(r.id, { obra_name: e.target.value })}
                      onBlur={e => (r.client_id || r.suggested_client_id) && loadSitesForClientWithPlantFilter((r.client_id || r.suggested_client_id)!, r.id, e.target.value)}
                    />
                    <select 
                      className="border rounded px-2 py-1" 
                      onFocus={() => {
                        const clientId = r.client_id || r.suggested_client_id;
                        if (clientId) {
                          loadSitesForClientWithPlantFilter(clientId, r.id, r.obra_name);
                        }
                      }} 
                      onChange={e => {
                        updateRow(r.id, { construction_site_id: e.target.value });
                        // Also update the obra_name to match selected site
                        if (e.target.value) {
                          const selectedSite = siteResults.find(s => s.id === e.target.value);
                          if (selectedSite) {
                            updateRow(r.id, { obra_name: selectedSite.name });
                          }
                        }
                      }} 
                      value={r.construction_site_id || ''}
                      disabled={!r.client_id && !r.suggested_client_id}
                    >
                      <option value="">{!r.client_id && !r.suggested_client_id ? 'Selecciona cliente primero' : 'Selecciona obra'}</option>
                      {/* Ensure the currently inferred site is visible even if options aren't loaded yet */}
                      {r.construction_site_id && !siteResults.some(s => s.id === r.construction_site_id) && (
                        <option value={r.construction_site_id}>{r.obra_name || 'Obra inferida'}</option>
                      )}
                      {siteResults.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.location ? `(${s.location})` : ''}</option>
                      ))}
                    </select>
                    {r.suggested_site_name && (
                      <div className="text-[11px] text-emerald-700">
                        💰 Sugerida: {r.suggested_site_name}
                        {!r.construction_site_id && r.client_id && (
                          <button 
                            className="ml-2 text-xs underline"
                            onClick={() => loadSitesForClientWithPlantFilter(r.client_id!, r.id, r.suggested_site_name!)}
                          >
                            Buscar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-2 min-w-[140px]">
                  <input className="border rounded px-2 py-1 w-full" value={r.placas || ''} onChange={e => updateRow(r.id, { placas: e.target.value })} />
                </td>
                <td className="p-2 min-w-[140px]">
                  <input className="border rounded px-2 py-1 w-full" value={r.conductor || ''} onChange={e => updateRow(r.id, { conductor: e.target.value })} />
                </td>
                <td className="p-2">
                  <input type="checkbox" checked={!!r.bombeable} onChange={e => updateRow(r.id, { bombeable: e.target.checked })} />
                </td>
                <td className="p-2 min-w-[200px]">
                  <div className="text-xs text-gray-900">
                    <div>Arkik: {r.product_description || '-'}</div>
                    <div className="text-gray-600">Recipe: {r.recipe_code || '-'}</div>
                  </div>
                  <div className="text-[11px] text-gray-400">{r.recipe_id ? `ID: ${r.recipe_id}` : ''}</div>
                </td>
                <td className="p-2">
                  <MaterialsCell remision={r} />
                </td>
                <td className="p-2 min-w-[140px]">
                  {r.unit_price != null ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                      {Number(r.unit_price).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Sin precio</span>
                  )}
                </td>
                <td className="p-2">{r.volumen_fabricado}</td>
                <td className="p-2 max-w-[280px] truncate" title={r.comentarios_externos || ''}>{r.comentarios_externos || ''}</td>
                <td className="p-2">
                  <button className="text-xs px-2 py-1 border rounded" onClick={() => setActiveRowId(r.id)}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status, count }: { status: StagingRemision['validation_status']; count: number }) {
  const color = status === 'valid' ? 'bg-emerald-100 text-emerald-700' : status === 'warning' ? 'bg-amber-100 text-amber-700' : status === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-700';
  const label = status === 'valid' ? 'Válida' : status === 'warning' ? 'Avisos' : status === 'error' ? 'Error' : 'Pendiente';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${color}`}>
      {label}{count ? <span className="text-[10px]">({count})</span> : null}
    </span>
  );
}

function formatTime(d?: Date | string | null) {
  if (!d) return '';
  try {
    const date = d instanceof Date ? d : new Date(d);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  } catch {
    return '';
  }
}

function MaterialsCell({ remision }: { remision: StagingRemision }) {
  const [open, setOpen] = useState(false);
  const codes = useMemo(() => {
    const s = new Set<string>();
    Object.keys(remision.materials_teorico || {}).forEach(c => s.add(c));
    Object.keys(remision.materials_real || {}).forEach(c => s.add(c));
    return Array.from(s).sort();
  }, [remision]);
  if (!codes.length) return <span className="text-xs text-gray-400">Sin materiales</span>;
  return (
    <div>
      <button className="text-xs px-2 py-1 border rounded" onClick={() => setOpen(v => !v)}>
        {open ? 'Ocultar' : 'Ver'} ({codes.length})
      </button>
      {open && (
        <div className="mt-2 p-2 border rounded bg-gray-50 max-h-48 overflow-auto text-[12px]">
          {codes.map(code => (
            <div key={code} className="flex justify-between py-0.5">
              <span className="font-mono mr-3">{code}</span>
              <span className="text-gray-600">T: {remision.materials_teorico[code] ?? 0}</span>
              <span className="text-gray-600">R: {remision.materials_real[code] ?? 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


