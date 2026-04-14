'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import EnhancedPlantSelector from '@/components/plants/EnhancedPlantSelector';
import { MonthNavigator } from '@/components/prices/MonthNavigator';
import { MaterialPriceGrid, type PriceRow } from '@/components/prices/MaterialPriceGrid';
import { MaterialPriceEvolution } from '@/components/prices/MaterialPriceEvolution';
import { CopyPricesDialog } from '@/components/prices/CopyPricesDialog';
import { Button } from '@/components/ui/button';
import { recipeService } from '@/lib/supabase/recipes';
import { priceService } from '@/lib/supabase/prices';
import { addMonths, startOfMonthDate, type MaterialPriceRow } from '@/lib/materialPricePeriod';
import type { Material } from '@/types/recipes';
import { toast } from 'sonner';
import { Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MaterialPriceManager() {
  const { profile, hasRole, isLoading: authLoading } = useAuthBridge();
  const { currentPlant } = usePlantContext();

  // hasRole() reads persisted profile on the client before isInitialized flips true, while SSR
  // always sees profile null — gate on auth ready so the first paint matches server HTML.
  const canEdit = !authLoading && hasRole(['PLANT_MANAGER', 'EXECUTIVE']);

  const [plantId, setPlantId] = useState<string | null>(currentPlant?.id ?? null);
  const [businessUnitId, setBusinessUnitId] = useState<string | null>(currentPlant?.business_unit_id ?? null);
  const [periodStart, setPeriodStart] = useState(() => startOfMonthDate(new Date()));

  const [materials, setMaterials] = useState<Material[]>([]);
  const [periodPrices, setPeriodPrices] = useState<Map<string, PriceRow>>(new Map());
  const [prevPrices, setPrevPrices] = useState<Map<string, number>>(new Map());
  const [allHistoryRows, setAllHistoryRows] = useState<MaterialPriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  useEffect(() => {
    if (currentPlant?.id && !plantId) {
      setPlantId(currentPlant.id);
      setBusinessUnitId(currentPlant.business_unit_id ?? null);
    }
  }, [currentPlant?.id, currentPlant?.business_unit_id, plantId]);

  const loadAll = useCallback(async () => {
    if (!plantId) {
      setMaterials([]);
      setPeriodPrices(new Map());
      setPrevPrices(new Map());
      setAllHistoryRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [mats, cur, prev, hist] = await Promise.all([
        recipeService.getMaterials(plantId),
        priceService.getMaterialPricesForPeriod(plantId, periodStart),
        priceService.getMaterialPricesForPeriod(plantId, addMonths(periodStart, -1)),
        priceService.getMaterialPricesForPlantAllPeriods(plantId),
      ]);

      setMaterials(mats || []);

      const curMap = new Map<string, PriceRow>();
      for (const r of cur.data || []) {
        if (r.material_id) {
          curMap.set(r.material_id, {
            material_id: r.material_id,
            price_per_unit: Number(r.price_per_unit) || 0,
            material_type: (r as { material_type?: string }).material_type,
          });
        }
      }
      setPeriodPrices(curMap);

      const prevMap = new Map<string, number>();
      for (const r of prev.data || []) {
        if (r.material_id) prevMap.set(r.material_id, Number(r.price_per_unit) || 0);
      }
      setPrevPrices(prevMap);

      if (hist.error) {
        console.error(hist.error);
        setAllHistoryRows([]);
      } else {
        setAllHistoryRows((hist.data as MaterialPriceRow[]) || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar precios');
    } finally {
      setLoading(false);
    }
  }, [plantId, periodStart]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const historySeries = useMemo(() => {
    const byMaterial = new Map<string, MaterialPriceRow[]>();
    for (const r of allHistoryRows) {
      if (!r.material_id || !r.period_start) continue;
      const list = byMaterial.get(r.material_id) || [];
      list.push(r);
      byMaterial.set(r.material_id, list);
    }
    const series = new Map<string, number[]>();
    const maxPoints = 14;
    for (const [mid, list] of byMaterial) {
      const sorted = [...list].sort((a, b) => (a.period_start || '').localeCompare(b.period_start || ''));
      const prices = sorted.slice(-maxPoints).map((x) => Number(x.price_per_unit) || 0);
      series.set(mid, prices);
    }
    return series;
  }, [allHistoryRows]);

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId),
    [materials, selectedMaterialId]
  );

  const handleSavePrice = async (materialId: string, price: number, materialType: string) => {
    if (!plantId || !profile?.id) return;
    setSavingId(materialId);
    try {
      const { error } = await priceService.saveMaterialPriceForPeriod({
        material_id: materialId,
        plant_id: plantId,
        period_start: periodStart,
        price_per_unit: price,
        material_type: materialType || 'MATERIAL',
        effective_date: periodStart,
        created_by: profile.id,
        updated_by: profile.id,
      });
      if (error) {
        toast.error('No se pudo guardar el precio');
        console.error(error);
        return;
      }
      toast.success('Precio guardado');
      setPeriodPrices((prev) => {
        const next = new Map(prev);
        next.set(materialId, {
          material_id: materialId,
          price_per_unit: price,
          material_type: materialType || 'MATERIAL',
        });
        return next;
      });
      void loadAll();
    } finally {
      setSavingId(null);
    }
  };

  const prevPeriod = addMonths(periodStart, -1);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <Link href="/prices" className="text-emerald-700 hover:underline">
              ← Gestión de precios
            </Link>
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Precios de materiales por mes</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Administra precios históricos por planta y mes. Los reportes financieros usan el precio vigente según la
            fecha de cada remisión.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading || !plantId}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
            Actualizar
          </Button>
          {canEdit && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!plantId}
              onClick={() => setCopyOpen(true)}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copiar desde mes anterior
            </Button>
          )}
          {!authLoading && hasRole(['EXECUTIVE']) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!plantId}
              title="Actualiza la vista materializada de análisis financiero (puede tardar varios minutos)"
              onClick={async () => {
                const { error } = await priceService.refreshPlantFinancialAnalysisMv();
                if (error) {
                  toast.error('No se pudo refrescar el análisis financiero');
                  console.error(error);
                  return;
                }
                toast.success('Vista de análisis financiero en actualización');
              }}
            >
              Refrescar reportes (MV)
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/50 backdrop-blur-md p-4 md:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end gap-4 justify-between">
          <div className="space-y-2 min-w-[260px]">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Planta</span>
            <EnhancedPlantSelector
              mode="CREATE"
              selectedPlantId={plantId}
              selectedBusinessUnitId={businessUnitId}
              onPlantChange={(id) => {
                setPlantId(id);
                setSelectedMaterialId(null);
              }}
              onBusinessUnitChange={setBusinessUnitId}
              showLabel={false}
            />
          </div>
          <MonthNavigator periodStart={periodStart} onChange={setPeriodStart} className="xl:justify-end" />
        </div>
        {!canEdit && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
            Solo lectura. Tu rol no incluye edición de precios de materiales por mes.
          </p>
        )}
      </div>

      {loading && !plantId ? (
        <div className="text-center py-16 text-muted-foreground">Selecciona una planta para continuar.</div>
      ) : loading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando…</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(380px,460px)] gap-6 items-start">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Pulsa un material para abrir el panel derecho: ahí puedes <strong className="font-medium text-foreground">editar cualquier mes</strong> o{' '}
              <strong className="font-medium text-foreground">agregar precios en meses que falten</strong>. La tabla de abajo sigue sirviendo para ajustar rápido el mes seleccionado en la barra.
            </p>
            <MaterialPriceGrid
              materials={materials}
              periodPrices={periodPrices}
              previousPrices={prevPrices}
              historySeries={historySeries}
              canEdit={canEdit}
              savingId={savingId}
              selectedMaterialId={selectedMaterialId}
              onSelectMaterial={setSelectedMaterialId}
              onSavePrice={handleSavePrice}
              search={search}
              onSearchChange={setSearch}
            />
          </div>
          <MaterialPriceEvolution
            materialId={selectedMaterialId}
            plantId={plantId}
            materialLabel={
              selectedMaterial
                ? `${selectedMaterial.material_code} — ${selectedMaterial.material_name}`
                : 'Material'
            }
            canEdit={canEdit}
            userId={profile?.id}
            defaultMaterialType={selectedMaterialId ? periodPrices.get(selectedMaterialId)?.material_type || 'MATERIAL' : 'MATERIAL'}
            gridPeriodStart={periodStart}
            onHistoryChanged={() => void loadAll()}
          />
        </div>
      )}

      {plantId && (
        <CopyPricesDialog
          open={copyOpen}
          onOpenChange={setCopyOpen}
          plantId={plantId}
          fromPeriodStart={prevPeriod}
          toPeriodStart={periodStart}
          createdBy={profile?.id}
          onCopied={() => void loadAll()}
        />
      )}
    </div>
  );
}
