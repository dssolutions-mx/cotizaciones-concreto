'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
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

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5 min-w-[8.5rem] flex-1 sm:flex-initial', className)}>
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      {children}
    </div>
  );
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
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 sm:px-4 shadow-sm">
      <div className="flex flex-wrap gap-4">
        <FilterField label="Periodo">
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
        </FilterField>
        <FilterField label="Ajuste de mercado">
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
        </FilterField>
        <FilterField label="f'c">
          <Select
            value={String(strengthFilter)}
            onValueChange={(v) => onStrengthFilterChange(v === 'ALL' ? 'ALL' : Number(v))}
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
        </FilterField>
      </div>
    </div>
  );
}
