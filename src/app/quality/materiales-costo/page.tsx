'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, AlertTriangle, Loader2, Package, RefreshCw } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import MaterialCostTrendCard from '@/components/quality/material-costs/MaterialCostTrendCard';
import MaterialCostKpiStrip from '@/components/quality/material-costs/MaterialCostKpiStrip';
import type { CostSource } from '@/lib/materialCostTrend';
import { MATERIAL_COST_CUTOVER } from '@/lib/materialCostTrend';

type MaterialCostSummary = {
  id: string;
  material_name: string;
  category: string;
  effective_category: string;
  subcategory?: string | null;
  plant_id?: string | null;
  plants?: { name: string; code: string } | null;
  suppliers?: { name: string } | null;
  sparkline: Array<{ date: string; value: number }>;
  lastPrice: number | null;
  priorPrice: number | null;
  pctChange: number | null;
  lastSource: CostSource | null;
  hasAlert: boolean;
  receiptCountInPeriod: number;
  missingLandedInPeriod: number;
  pendingReviewInPeriod?: number;
};

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'cemento', label: 'Cemento' },
  { value: 'aditivo', label: 'Aditivo' },
  { value: 'arena', label: 'Arena' },
  { value: 'grava', label: 'Grava' },
  { value: 'agregado', label: 'Agregado' },
];

export default function MaterialesCostoHubPage() {
  const { currentPlant } = usePlantContext();
  const [materials, setMaterials] = useState<MaterialCostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [granularity, setGranularity] = useState<'week' | 'day'>('week');

  const fetchData = useCallback(async () => {
    if (!currentPlant?.id) {
      setMaterials([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        plant_id: currentPlant.id,
        granularity,
      });
      const res = await fetch(`/api/quality/material-costs/summary?${params}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Error al cargar costos');
      }
      const json = await res.json();
      setMaterials(json.materials ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [currentPlant?.id, granularity]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered = materials.filter((m) => {
    const matchCat =
      categoryFilter === 'all' || m.effective_category === categoryFilter;
    const matchSearch =
      search === '' ||
      m.material_name.toLowerCase().includes(search.toLowerCase()) ||
      (m.suppliers?.name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const alertCount = filtered.filter((m) => m.hasAlert).length;

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <QualityBreadcrumb
        hubName="Validaciones"
        hubHref="/quality/validaciones"
        items={[{ label: 'Costos de materiales' }]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">
            Centro de costos — Materiales
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Lista mensual antes de {MATERIAL_COST_CUTOVER.slice(0, 7)} · recepciones landed después
            {currentPlant ? ` · ${currentPlant.name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => void fetchData()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Link
            href="/prices/materials"
            className="text-xs text-sky-600 hover:text-sky-700 font-medium border border-sky-200 rounded-lg px-3 py-1.5 bg-sky-50"
          >
            Editar precios de lista
          </Link>
        </div>
      </div>

      {!currentPlant?.id && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Selecciona una planta en el selector global para ver costos por material.
        </div>
      )}

      {currentPlant?.id && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500 font-medium">Recepciones:</span>
          <div className="flex rounded-lg border border-stone-200 overflow-hidden bg-white">
            {(['week', 'day'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  granularity === g
                    ? 'bg-stone-800 text-white'
                    : 'text-stone-600 hover:bg-stone-50'
                )}
              >
                {g === 'week' ? 'Semana' : 'Día'}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && currentPlant?.id && (
        <MaterialCostKpiStrip materials={materials} />
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
          <Input
            placeholder="Buscar material…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-sm h-9 bg-white"
            disabled={!currentPlant?.id}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCategoryFilter(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                categoryFilter === opt.value
                  ? 'bg-stone-800 text-white border-stone-800'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && currentPlant?.id && (
        <div className="flex items-center justify-center py-20 gap-2 text-stone-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando costos…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void fetchData()} className="ml-auto text-xs h-7">
            Reintentar
          </Button>
        </div>
      )}

      {!loading && !error && currentPlant?.id && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-stone-400">
          <Package className="h-10 w-10 text-stone-200" />
          <p className="text-sm font-medium">
            {materials.length === 0
              ? 'No hay materiales en esta planta'
              : 'Sin resultados para los filtros actuales'}
          </p>
        </div>
      )}

      {!loading && !error && currentPlant?.id && filtered.length > 0 && (
        <>
          {alertCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <p className="text-sm text-red-700 font-medium">
                {alertCount} material{alertCount > 1 ? 'es' : ''} con variación ≥10% vs período anterior
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((mat) => (
              <MaterialCostTrendCard
                key={mat.id}
                materialId={mat.id}
                materialName={mat.material_name}
                effectiveCategory={mat.effective_category}
                subcategory={mat.subcategory}
                supplier={mat.suppliers?.name}
                plantName={mat.plants?.name}
                plantId={currentPlant.id}
                sparkline={mat.sparkline}
                lastPrice={mat.lastPrice}
                pctChange={mat.pctChange}
                lastSource={mat.lastSource}
                hasAlert={mat.hasAlert}
              />
            ))}
          </div>

          <p className="text-xs text-stone-400 text-center pb-4">
            {filtered.length} material{filtered.length !== 1 ? 'es' : ''}
            {categoryFilter !== 'all'
              ? ` · ${CATEGORY_OPTIONS.find((c) => c.value === categoryFilter)?.label}`
              : ''}
          </p>
        </>
      )}
    </div>
  );
}
