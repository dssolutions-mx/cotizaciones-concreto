'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { FCROverrides, Recipe, RoundingModeKg5, DesignType } from '@/types/calculator';

const roundingLabels: Record<RoundingModeKg5, string> = {
  CEIL_5: 'Redondeo: hacia arriba (×5)',
  MROUND_5: 'Redondeo: al más cercano (×5)',
  FLOOR_5: 'Redondeo: hacia abajo (×5)',
  NONE: 'Redondeo: sin paso de 5 kg/m³'
};

type RowFilter = 'all' | 'overrides' | 'drift';

type Props = {
  recipes: Recipe[];
  selectedCodes: Set<string>;
  fcrOverrides: FCROverrides;
  roundingMode: RoundingModeKg5;
  designType: DesignType;
  acDriftEpsilon: number;
  rowFilter: RowFilter;
  onRowFilterChange: (f: RowFilter) => void;
  tableDensity: 'comfortable' | 'compact';
  onTableDensityChange: (d: 'comfortable' | 'compact') => void;
};

const cell = 'rounded-lg border p-3 text-sm';
const label = 'text-xs font-medium text-stone-500';
const value = 'text-lg font-semibold tabular-nums text-stone-900';

export function CalculatorRecipeKpiStrip({
  recipes,
  selectedCodes,
  fcrOverrides,
  roundingMode,
  designType,
  acDriftEpsilon,
  rowFilter,
  onRowFilterChange,
  tableDensity,
  onTableDensityChange
}: Props) {
  const manualFcrCount = useMemo(
    () => recipes.filter((r) => fcrOverrides[r.code] !== undefined).length,
    [recipes, fcrOverrides]
  );

  const driftCount = useMemo(
    () =>
      recipes.filter((r) => {
        if (typeof r.acRatioFormula !== 'number' || Number.isNaN(r.acRatioFormula)) return false;
        return Math.abs(r.acRatio - r.acRatioFormula) > acDriftEpsilon;
      }).length,
    [recipes, acDriftEpsilon]
  );

  const acStats = useMemo(() => {
    if (recipes.length === 0) return null;
    const ratios = recipes.map((r) => r.acRatio);
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    return { min, max, mean };
  }, [recipes]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className={cn(cell, 'border-stone-200 bg-white')}>
          <div className={label}>Recetas</div>
          <div className={value}>{recipes.length}</div>
        </div>
        <div className={cn(cell, 'border-stone-200 bg-white')}>
          <div className={label}>Seleccionadas</div>
          <div className={value}>{selectedCodes.size}</div>
        </div>
        <div
          className={cn(
            cell,
            manualFcrCount > 0 ? 'border-amber-200 bg-amber-50/80' : 'border-stone-200 bg-white'
          )}
        >
          <div className={label}>F&apos;cr manual</div>
          <div className={value}>{manualFcrCount}</div>
        </div>
        <div
          className={cn(
            cell,
            driftCount > 0 ? 'border-sky-200 bg-sky-50/80' : 'border-stone-200 bg-white'
          )}
        >
          <div className={label}>A/C ≠ curva</div>
          <div className={value}>{driftCount}</div>
        </div>
        <div className={cn(cell, 'border-stone-200 bg-white col-span-2 lg:col-span-1')}>
          <div className={label}>Diseño</div>
          <div className={value}>{designType}</div>
        </div>
        <div className={cn(cell, 'border-stone-200 bg-white col-span-2 lg:col-span-2')}>
          <div className={label}>Modo de cálculo</div>
          <div className="text-sm font-medium text-stone-800 leading-snug">{roundingLabels[roundingMode]}</div>
        </div>
      </div>

      {acStats && recipes.length > 0 && (
        <div className={cn(cell, 'border-stone-200 bg-stone-50/50')}>
          <div className={label}>A/C efectivo (rango en vista)</div>
          <div className="text-sm text-stone-800 tabular-nums">
            min {acStats.min.toFixed(3)} — max {acStats.max.toFixed(3)} — prom. {acStats.mean.toFixed(3)}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-stone-600">Filas:</span>
        {(
          [
            ['all', 'Todas'],
            ['overrides', 'Solo F′cr manual'],
            ['drift', 'Solo A/C ≠ curva']
          ] as const
        ).map(([id, lab]) => (
          <button
            key={id}
            type="button"
            onClick={() => onRowFilterChange(id)}
            className={cn(
              'text-xs rounded-md border px-2.5 py-1 transition-colors',
              rowFilter === id
                ? 'border-sky-600 bg-sky-50 text-sky-900'
                : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
            )}
          >
            {lab}
          </button>
        ))}
        <span className="text-xs text-stone-400 mx-1">|</span>
        <span className="text-xs font-medium text-stone-600">Densidad:</span>
        {(
          [
            ['comfortable', 'Cómoda'],
            ['compact', 'Compacta']
          ] as const
        ).map(([id, lab]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTableDensityChange(id)}
            className={cn(
              'text-xs rounded-md border px-2.5 py-1 transition-colors',
              tableDensity === id
                ? 'border-sky-600 bg-sky-50 text-sky-900'
                : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
            )}
          >
            {lab}
          </button>
        ))}
      </div>
    </div>
  );
}

export type { RowFilter };
