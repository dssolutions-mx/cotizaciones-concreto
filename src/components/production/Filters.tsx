'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { DateRangePickerWithPresets } from '@/components/ui/date-range-picker-with-presets';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';
import { DateRange } from 'react-day-picker';

interface FiltersProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onDateChange: (range: DateRange | undefined) => void;
  strengthFilter: string;
  onStrengthChange: (value: string) => void;
  availableStrengths: number[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function Filters(props: FiltersProps) {
  const { startDate, endDate, onDateChange, strengthFilter, onStrengthChange, availableStrengths, searchTerm, onSearchChange } = props;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-visible">
      <div className="space-y-2 relative z-[9999]">
        <Label>Planta</Label>
        <PlantContextDisplay showLabel={false} />
      </div>
      <div className="space-y-2 relative z-40">
        <Label>Rango de Fechas</Label>
        <DateRangePickerWithPresets
          dateRange={{ from: startDate || new Date(), to: endDate || new Date() }}
          onDateRangeChange={onDateChange}
        />
      </div>
      <div className="space-y-2 relative z-30">
        <Label>Resistencia</Label>
        <Select value={strengthFilter} onValueChange={onStrengthChange}>
          <SelectTrigger>
            <SelectValue placeholder="Todas las resistencias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las resistencias</SelectItem>
            {availableStrengths.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s} kg/cm²
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 relative z-20">
        <Label>Buscar</Label>
        <input
          className="w-full h-9 rounded border px-3 text-sm"
          placeholder="Código de receta..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  );
}


