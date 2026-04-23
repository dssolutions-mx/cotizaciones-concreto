import { useState, useEffect, useMemo } from 'react';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';
import {
  normalizeBaseAccessiblePlantIds,
  resolveEffectiveSalesPlantIds,
} from '@/lib/finanzas/resolveSalesPlantScope';

type Plant = { id: string; name?: string; code?: string };

export function useVentasPlantScope(
  availablePlants: Plant[],
  userAccess: unknown,
  isGlobalAdmin: boolean
) {
  const [baseAccessiblePlantIds, setBaseAccessiblePlantIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await plantAwareDataService.getAccessiblePlantIds({
        userAccess,
        isGlobalAdmin,
        currentPlantId: null,
      });
      const pickerIds = availablePlants.map((p) => p.id);
      const base = normalizeBaseAccessiblePlantIds(raw, pickerIds);
      if (!cancelled) setBaseAccessiblePlantIds(base);
    })();
    return () => {
      cancelled = true;
    };
  }, [userAccess, isGlobalAdmin, availablePlants]);

  return { baseAccessiblePlantIds };
}

export function useVentasEffectivePlantScope(
  selectedPlantIds: string[],
  baseAccessiblePlantIds: string[],
  availablePlants: Plant[]
) {
  const effectivePlantIds = useMemo(
    () => resolveEffectiveSalesPlantIds(selectedPlantIds, baseAccessiblePlantIds),
    [selectedPlantIds, baseAccessiblePlantIds]
  );

  const scopePlantSummary = useMemo(() => {
    if (effectivePlantIds.length === 0) return 'Sin plantas en alcance';
    const names = effectivePlantIds.map(
      (id) => availablePlants.find((p) => p.id === id)?.name || id
    );
    const preview = names.slice(0, 4).join(', ');
    const extra = names.length > 4 ? ` +${names.length - 4}` : '';
    const prefix =
      selectedPlantIds.length === 0
        ? 'Todas las plantas en su alcance'
        : `${effectivePlantIds.length} planta(s) seleccionada(s)`;
    return `${prefix}: ${preview}${extra}`;
  }, [effectivePlantIds, availablePlants, selectedPlantIds]);

  return { effectivePlantIds, scopePlantSummary };
}
