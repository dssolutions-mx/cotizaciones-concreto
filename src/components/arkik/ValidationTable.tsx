'use client';

import React, { useMemo, useState } from 'react';
import type { StagingRemision } from '@/types/arkik';
import { supabase } from '@/lib/supabase/client';
import { DebugArkikValidator } from '@/services/debugArkikValidator';
import { TrendingUp, DollarSign, MapPin, User, Zap, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

// Helper functions for date formatting without timezone conversion
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatLocalTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

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
  const [showDetails, setShowDetails] = useState<Set<string>>(new Set());
  // Simplified: no global validation stats here; rely on debug logs
  // Cache construction sites per client to avoid repeated network calls
  const sitesCacheRef = React.useRef<Map<string, any[]>>(new Map());
  const inFlightClientsRef = React.useRef<Set<string>>(new Set());
  const [lastSitesClientId, setLastSitesClientId] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    if (!showOnlyIssues) return rows;
    return rows.filter(r => (r.validation_errors?.length || 0) > 0 || r.validation_status !== 'valid');
  }, [rows, showOnlyIssues]);

  const summaryStats = useMemo(() => {
    const total = rows.length;
    const valid = rows.filter(r => r.validation_status === 'valid').length;
    const warning = rows.filter(r => r.validation_status === 'warning').length;
    const error = rows.filter(r => r.validation_status === 'error').length;
    const withPrices = rows.filter(r => r.unit_price != null).length;
    const avgPrice = rows.filter(r => r.unit_price != null).reduce((sum, r) => sum + (r.unit_price || 0), 0) / (withPrices || 1);
    
    return { total, valid, warning, error, withPrices, avgPrice };
  }, [rows]);

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const toggleDetails = (id: string) => {
    const next = new Set(showDetails);
    if (next.has(id)) next.delete(id); else next.add(id);
    setShowDetails(next);
  };

  const updateRow = (id: string, patch: Partial<StagingRemision>) => {
    const next = rows.map(r => (r.id === id ? { ...r, ...patch } : r));
    onRowsChange(next);
  };

  const validateAll = async () => {
    if (!plantId || !rows.length || validating) return;
    setValidating(true);
    try {
      console.log('[UpdatedValidationTable] Re-validating using DebugArkikValidator (simplified)');
      const validator = new DebugArkikValidator(plantId);
      const { validated } = await validator.validateBatch(rows);
      console.log('[UpdatedValidationTable] Validation completed');
      onRowsChange(validated as unknown as StagingRemision[]);
    } catch (err) {
      console.error('Price-driven validation error:', err);
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
      // Search by recipe_code (canonical ARKIK), with fallback to arkik_long_code for transition
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
        recipe_code: r.recipe_code || r.arkik_long_code
      }])).values());
      setRecipeResults(unique);
      console.log('[Arkik][ValidationTable] recipe results', { plantId, query, count: unique.length });
    } catch (e) {
      console.error('[Arkik][ValidationTable] findRecipes error', e);
    }
  };

  const getPriceSourceIcon = (source?: string) => {
    switch (source) {
      case 'client_site': return <span title="Precio específico cliente-obra"><DollarSign className="h-3 w-3 text-green-600" /></span>;
      case 'client': return <span title="Precio por cliente"><User className="h-3 w-3 text-blue-600" /></span>;
      case 'plant': return <span title="Precio general de planta"><MapPin className="h-3 w-3 text-gray-600" /></span>;
      case 'quotes': return <span title="Precio de cotización"><TrendingUp className="h-3 w-3 text-purple-600" /></span>;
      default: return <span title="Sin precio"><AlertTriangle className="h-3 w-3 text-amber-600" /></span>;
    }
  };

  const getValidationIcon = (status: StagingRemision['validation_status']) => {
    switch (status) {
      case 'valid': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="mt-4">
      {/* Enhanced Header with Stats */}
      <div className="flex items-center justify-between mb-4 p-4 bg-gray-50 rounded">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div className="text-center">
            <div className="font-bold text-lg text-green-600">{summaryStats.valid}</div>
            <div className="text-green-700">Válidas</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg text-amber-600">{summaryStats.warning}</div>
            <div className="text-amber-700">Avisos</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg text-red-600">{summaryStats.error}</div>
            <div className="text-red-700">Errores</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg text-blue-600">{summaryStats.withPrices}</div>
            <div className="text-blue-700">Con Precio</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg text-gray-600">${summaryStats.avgPrice.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</div>
            <div className="text-gray-700">Precio Prom.</div>
          </div>
        </div>
      </div>

      {/* Validation Stats */}
      {/* Simplified: remove validation stats block */}

      {/* Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showOnlyIssues} onChange={e => setShowOnlyIssues(e.target.checked)} />
            Mostrar sólo incidencias
          </label>
          <span className="text-gray-500">Mostrando: {visibleRows.length} de {rows.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 text-xs px-3 py-1 border rounded disabled:opacity-50 bg-blue-50 hover:bg-blue-100 text-gray-900"
            onClick={validateAll}
            disabled={!plantId || validating || rows.length === 0}
          >
            {validating ? (
              <>
                <Zap className="h-3 w-3 animate-pulse" />
                Validando…
              </>
            ) : (
              <>
                <Zap className="h-3 w-3" />
                Re-validar Price-Driven
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
        <div>Planta: {plantId || '—'} | Filas: {rows.length} | Mostrar Debug: <button className="underline text-blue-600 hover:text-blue-800" onClick={() => setShowDebug(v => !v)}>{showDebug ? 'Ocultar' : 'Ver'}</button></div>
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

      {/* Enhanced Table */}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-2 w-8"></th>
              <th className="p-2">Estado</th>
              <th className="p-2">Remisión</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Cliente Detectado</th>
              <th className="p-2">Obra Detectada</th>
              <th className="p-2">Precio</th>
              <th className="p-2">Receta</th>
              <th className="p-2">Vol</th>
              <th className="p-2">Detalles</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(r => (
              <React.Fragment key={r.id}>
                <tr className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={e => toggleSelect(r.id, e.target.checked)} />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      {getValidationIcon(r.validation_status)}
                      <span className="text-xs">
                        {r.validation_status === 'valid' ? 'OK' : 
                         r.validation_status === 'warning' ? 'Aviso' : 
                         r.validation_status === 'error' ? 'Error' : 'Pendiente'}
                      </span>
                    </div>
                  </td>
                  <td className="p-2 font-medium">{r.remision_number}</td>
                  <td className="p-2">
                    <div>{formatLocalDate(r.fecha)}</div>
                    <div className="text-xs text-gray-500">{formatTime(r.hora_carga)}</div>
                  </td>
                  <td className="p-2">
                    <div className="max-w-[200px]">
                      <div className="font-medium text-xs">
                        {r.suggested_client_id ? '✓ Auto-detectado' : r.cliente_name}
                      </div>
                      <div className="text-xs text-gray-600 truncate">
                        Original: {r.cliente_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        Código: {r.cliente_codigo}
                      </div>
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="max-w-[200px]">
                      <div className="font-medium text-xs">
                        {r.suggested_site_name || r.obra_name}
                      </div>
                      {r.suggested_site_name && r.suggested_site_name !== r.obra_name && (
                        <div className="text-xs text-gray-500 truncate">
                          Original: {r.obra_name}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      {getPriceSourceIcon(r.price_source)}
                      {r.unit_price != null ? (
                        <span className="text-xs font-mono">
                          ${Number(r.unit_price).toLocaleString('es-MX')}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Sin precio</span>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="max-w-[150px]">
                      <div className="text-xs font-mono truncate" title={r.product_description}>
                        {r.product_description}
                      </div>
                      {r.recipe_id && (
                        <div className="text-xs text-green-600">✓ Vinculada</div>
                      )}
                    </div>
                  </td>
                  <td className="p-2 text-center">{r.volumen_fabricado}</td>
                  <td className="p-2">
                    <button
                      className="text-xs px-2 py-1 border rounded text-gray-900 hover:bg-gray-50"
                      onClick={() => toggleDetails(r.id)}
                    >
                      {showDetails.has(r.id) ? 'Ocultar' : 'Ver'}
                    </button>
                  </td>
                </tr>

                {/* Expanded Details Row */}
                {showDetails.has(r.id) && (
                  <tr className="border-t bg-gray-50">
                    <td colSpan={10} className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        {/* Price-Driven Results */}
                        <div className="space-y-2">
                          <h4 className="font-semibold text-blue-900">Resultado Price-Driven</h4>
                          <div>
                            <span className="font-medium">Cliente ID:</span> {r.client_id || 'No asignado'}
                          </div>
                          <div>
                            <span className="font-medium">Obra ID:</span> {r.construction_site_id || 'No asignada'}
                          </div>
                          <div>
                            <span className="font-medium">Receta ID:</span> {r.recipe_id || 'No encontrada'}
                          </div>
                          <div>
                            <span className="font-medium">Fuente de precio:</span> {r.price_source || 'N/A'}
                          </div>
                        </div>

                        {/* Original Data */}
                        <div className="space-y-2">
                          <h4 className="font-semibold text-gray-900">Datos Originales</h4>
                          <div>
                            <span className="font-medium">Cliente:</span> {r.cliente_name}
                          </div>
                          <div>
                            <span className="font-medium">Código:</span> {r.cliente_codigo}
                          </div>
                          <div>
                            <span className="font-medium">Obra:</span> {r.obra_name}
                          </div>
                          <div>
                            <span className="font-medium">Conductor:</span> {r.conductor}
                          </div>
                          <div>
                            <span className="font-medium">Placas:</span> {r.placas}
                          </div>
                        </div>

                        {/* Validation Issues */}
                        <div className="space-y-2">
                          <h4 className="font-semibold text-amber-900">Incidencias ({(r.validation_errors || []).length})</h4>
                          <div className="max-h-32 overflow-auto space-y-1">
                            {(r.validation_errors || []).map((error, idx) => (
                              <div key={idx} className="text-xs p-2 bg-amber-50 border border-amber-200 rounded">
                                <div className="font-medium text-amber-800">{error.error_type}</div>
                                <div className="text-amber-700">{error.message}</div>
                              </div>
                            ))}
                            {(r.validation_errors || []).length === 0 && (
                              <div className="text-green-600">No hay incidencias</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Materials Summary */}
                      <div className="mt-4 pt-3 border-t">
                        <h4 className="font-semibold text-sm mb-2">Materiales</h4>
                        <MaterialsPreview remision={r} />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selection Actions */}
      {selected.size > 0 && (
        <div className="mt-3 p-3 bg-blue-50 rounded border flex items-center justify-between">
          <span className="text-sm text-blue-900">{selected.size} remisiones seleccionadas</span>
          <div className="flex gap-2">
            <button
              className="text-xs px-3 py-1 border rounded bg-white text-gray-900 hover:bg-gray-50"
              onClick={() => setSelected(new Set())}
            >
              Limpiar selección
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(d?: Date | string | null) {
  if (!d) return '';
  try {
    const date = d instanceof Date ? d : new Date(d);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

function MaterialsPreview({ remision }: { remision: StagingRemision }) {
  const codes = useMemo(() => {
    const s = new Set<string>();
    Object.keys(remision.materials_teorico || {}).forEach(c => s.add(c));
    Object.keys(remision.materials_real || {}).forEach(c => s.add(c));
    return Array.from(s).sort();
  }, [remision]);

  if (!codes.length) return <span className="text-xs text-gray-400">Sin materiales</span>;

  return (
    <div className="flex flex-wrap gap-2">
      {codes.map(code => (
        <div key={code} className="text-xs px-2 py-1 bg-gray-100 rounded border">
          <span className="font-mono font-medium">{code}</span>
          <span className="text-gray-600 ml-1">
            T:{remision.materials_teorico[code] || 0} R:{remision.materials_real[code] || 0}
          </span>
        </div>
      ))}
    </div>
  );
}


