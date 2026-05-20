'use client';

import FinanzasFilterBar, { FinanzasFilterField } from '@/components/finanzas/FinanzasFilterBar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { InsightsDatePreset, MarketFit } from '../shared';

export type MarketFitFilter = MarketFit | 'ALL';

interface Props {
  datePreset: InsightsDatePreset;
  onDatePresetChange: (v: InsightsDatePreset) => void;
  marketFitFilter: MarketFitFilter;
  onMarketFitFilterChange: (v: MarketFitFilter) => void;
  strengthFilter: number | 'ALL';
  onStrengthFilterChange: (v: number | 'ALL') => void;
  strengthOptions: number[];
}

export function InsightsFiltersBar({
  datePreset,
  onDatePresetChange,
  marketFitFilter,
  onMarketFitFilterChange,
  strengthFilter,
  onStrengthFilterChange,
  strengthOptions,
}: Props) {
  return (
    <FinanzasFilterBar>
      <FinanzasFilterField label="Periodo">
        <Select value={datePreset} onValueChange={(v) => onDatePresetChange(v as InsightsDatePreset)}>
          <SelectTrigger className="h-9 w-full min-w-[10rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="90d">Últimos 90 días</SelectItem>
            <SelectItem value="6m">Últimos 6 meses</SelectItem>
            <SelectItem value="12m">Últimos 12 meses</SelectItem>
            <SelectItem value="since_effective">Desde vigencia de lista</SelectItem>
          </SelectContent>
        </Select>
      </FinanzasFilterField>
      <FinanzasFilterField label="Ajuste de mercado">
        <Select
          value={marketFitFilter}
          onValueChange={(v) => onMarketFitFilterChange(v as MarketFitFilter)}
        >
          <SelectTrigger className="h-9 w-full min-w-[10rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="UNDERSET">Subestimado</SelectItem>
            <SelectItem value="FIT">Competitivo</SelectItem>
            <SelectItem value="OVERSET">Sobrevaluado</SelectItem>
            <SelectItem value="NO_DATA">Sin datos</SelectItem>
          </SelectContent>
        </Select>
      </FinanzasFilterField>
      <FinanzasFilterField label="f&apos;c">
        <Select
          value={String(strengthFilter)}
          onValueChange={(v) =>
            onStrengthFilterChange(v === 'ALL' ? 'ALL' : Number(v))
          }
        >
          <SelectTrigger className="h-9 w-full min-w-[8rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            {strengthOptions.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s} kg/cm²
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FinanzasFilterField>
    </FinanzasFilterBar>
  );
}
