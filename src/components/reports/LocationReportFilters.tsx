'use client';

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DateRangePickerWithPresets } from '@/components/ui/date-range-picker-with-presets';
import { DateRange } from 'react-day-picker';
import { MapPin, Building2, MapPinned, ChevronDown, Calendar, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LOCATION_DATA_STATUS_LABELS,
  type LocationDataFilterValue,
} from '@/lib/finanzas/locationReportFilters';
import type { LocationReportFacets } from '@/lib/finanzas/locationReportCore';
import {
  finanzasHubCardClass,
  finanzasHubFilterLabelClass,
  finanzasHubOutlineNeutralClass,
} from '@/components/finanzas/finanzasHubUi';
interface LocationReportFiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  availablePlants: { id: string; name: string; code?: string }[];
  selectedPlantIds: string[];
  onPlantIdsChange: (ids: string[]) => void;
  clients: { id: string; name: string }[];
  clientIds: string[];
  onClientIdsChange: (ids: string[]) => void;
  clientsLoading?: boolean;
  localities: string[];
  localityFilter: string[];
  onLocalityFilterChange: (v: string[]) => void;
  sublocalities: string[];
  sublocalityFilter: string[];
  onSublocalityFilterChange: (v: string[]) => void;
  administrativeAreas1: string[];
  administrativeArea1Filter: string[];
  onAdministrativeArea1FilterChange: (v: string[]) => void;
  administrativeAreas2: string[];
  administrativeArea2Filter: string[];
  onAdministrativeArea2FilterChange: (v: string[]) => void;
  locationDataFilter: LocationDataFilterValue;
  onLocationDataFilterChange: (v: LocationDataFilterValue) => void;
  facets?: LocationReportFacets | null;
  onResetFilters?: () => void;
  className?: string;
}

function MultiSelectPopover<T extends string>({
  options,
  selected,
  onChange,
  placeholder,
  displayValue,
  icon: Icon,
  disabled,
  countByValue,
}: {
  options: T[];
  selected: T[];
  onChange: (v: T[]) => void;
  placeholder: string;
  displayValue?: (v: T) => string;
  icon?: React.ElementType;
  disabled?: boolean;
  countByValue?: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const render = displayValue || ((v: T) => v);

  const handleToggle = (opt: T) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? render(selected[0])
        : `${selected.length} seleccionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            selected.length > 0 && 'border-primary/50'
          )}
        >
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4" />}
            <span className="truncate">{label}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1 max-h-64 overflow-y-auto">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={handleSelectAll}
          >
            {selected.length === options.length ? 'Desmarcar todos' : 'Seleccionar todos'}
          </Button>
          {options.map((opt) => (
            <div
              key={opt}
              className={cn(
                'flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-muted',
                selected.includes(opt) && 'bg-muted'
              )}
              onClick={() => handleToggle(opt)}
            >
              <div
                className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center',
                  selected.includes(opt) ? 'bg-primary border-primary' : 'border-input'
                )}
              >
                {selected.includes(opt) && (
                  <span className="text-primary-foreground text-xs">✓</span>
                )}
              </div>
              <span className="text-sm truncate flex-1">{render(opt)}</span>
              {countByValue?.[opt] != null ? (
                <span className="text-xs text-stone-400 tabular-nums">{countByValue[opt]}</span>
              ) : null}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function LocationReportFilters({
  dateRange,
  onDateRangeChange,
  availablePlants,
  selectedPlantIds,
  onPlantIdsChange,
  clients,
  clientIds,
  onClientIdsChange,
  clientsLoading = false,
  localities,
  localityFilter,
  onLocalityFilterChange,
  sublocalities,
  sublocalityFilter,
  onSublocalityFilterChange,
  administrativeAreas1,
  administrativeArea1Filter,
  onAdministrativeArea1FilterChange,
  administrativeAreas2,
  administrativeArea2Filter,
  onAdministrativeArea2FilterChange,
  locationDataFilter,
  onLocationDataFilterChange,
  facets,
  onResetFilters,
  className,
}: LocationReportFiltersProps) {
  const localityCounts = Object.fromEntries(
    (facets?.localities ?? []).map((f) => [f.value, f.count])
  );
  const sublocalityCounts = Object.fromEntries(
    (facets?.sublocalities ?? []).map((f) => [f.value, f.count])
  );
  const admin1Counts = Object.fromEntries(
    (facets?.administrativeAreas1 ?? []).map((f) => [f.value, f.count])
  );
  const admin2Counts = Object.fromEntries(
    (facets?.administrativeAreas2 ?? []).map((f) => [f.value, f.count])
  );
  const clientCounts = Object.fromEntries(
    (facets?.clients ?? []).map((f) => [f.id, f.count])
  );
  const handlePlantToggle = (id: string) => {
    if (selectedPlantIds.includes(id)) {
      onPlantIdsChange(selectedPlantIds.filter((x) => x !== id));
    } else {
      onPlantIdsChange([...selectedPlantIds, id]);
    }
  };

  const plantLabel =
    selectedPlantIds.length === 0
      ? 'Todas las plantas'
      : selectedPlantIds.length === 1
        ? availablePlants.find((p) => p.id === selectedPlantIds[0])?.name || '1 planta'
        : `${selectedPlantIds.length} plantas`;

  return (
    <Card className={cn(finanzasHubCardClass, className)}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold text-stone-900 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Filtros
        </CardTitle>
        {onResetFilters ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={finanzasHubOutlineNeutralClass}
            onClick={onResetFilters}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Limpiar
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className={finanzasHubFilterLabelClass}>
              <Calendar className="h-3.5 w-3.5" />
              Rango de fechas
            </Label>
            <DateRangePickerWithPresets
              dateRange={dateRange}
              onDateRangeChange={onDateRangeChange}
            />
          </div>

          <div className="space-y-2">
            <Label className={finanzasHubFilterLabelClass}>
              <Building2 className="h-3.5 w-3.5" />
              Planta(s)
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  <span>{plantLabel}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() =>
                      onPlantIdsChange(
                        selectedPlantIds.length === availablePlants.length
                          ? []
                          : availablePlants.map((p) => p.id)
                      )
                    }
                  >
                    {selectedPlantIds.length === availablePlants.length
                      ? 'Desmarcar todas'
                      : 'Seleccionar todas'}
                  </Button>
                  {availablePlants.map((p) => (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-muted',
                        selectedPlantIds.includes(p.id) && 'bg-muted'
                      )}
                      onClick={() => handlePlantToggle(p.id)}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center',
                          selectedPlantIds.includes(p.id) ? 'bg-primary border-primary' : 'border-input'
                        )}
                      >
                        {selectedPlantIds.includes(p.id) && (
                          <span className="text-primary-foreground text-xs">✓</span>
                        )}
                      </div>
                      <span className="text-sm truncate">
                        {p.code ? `${p.code} - ${p.name}` : p.name}
                      </span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className={finanzasHubFilterLabelClass}>Cliente(s)</Label>
            <MultiSelectPopover
              options={clients.map((c) => c.id)}
              selected={clientIds}
              onChange={onClientIdsChange}
              placeholder="Todos los clientes"
              displayValue={(id) => {
                const c = clients.find((x) => x.id === id);
                const n = clientCounts[id];
                return c ? `${c.name}${n != null ? ` (${n})` : ''}` : id;
              }}
              icon={clientsLoading ? Loader2 : Building2}
              disabled={clientsLoading}
              countByValue={clientCounts}
            />
          </div>

          <div className="space-y-2">
            <Label className={finanzasHubFilterLabelClass}>
              <MapPinned className="h-3.5 w-3.5" />
              Ciudad (localidad)
            </Label>
            <MultiSelectPopover
              options={localities}
              selected={localityFilter}
              onChange={onLocalityFilterChange}
              placeholder="Todas las ciudades"
              countByValue={localityCounts}
            />
          </div>

          <div className="space-y-2">
            <Label className={finanzasHubFilterLabelClass}>Colonia</Label>
            <MultiSelectPopover
              options={sublocalities}
              selected={sublocalityFilter}
              onChange={onSublocalityFilterChange}
              placeholder="Todas las colonias"
              countByValue={sublocalityCounts}
            />
          </div>

          <div className="space-y-2">
            <Label className={finanzasHubFilterLabelClass}>Estado</Label>
            <MultiSelectPopover
              options={administrativeAreas1}
              selected={administrativeArea1Filter}
              onChange={onAdministrativeArea1FilterChange}
              placeholder="Todos los estados"
              countByValue={admin1Counts}
            />
          </div>

          <div className="space-y-2">
            <Label className={finanzasHubFilterLabelClass}>Municipio</Label>
            <MultiSelectPopover
              options={administrativeAreas2}
              selected={administrativeArea2Filter}
              onChange={onAdministrativeArea2FilterChange}
              placeholder="Todos los municipios"
              countByValue={admin2Counts}
            />
          </div>

          <div className="space-y-2">
            <Label className={finanzasHubFilterLabelClass}>Calidad de ubicación</Label>
            <Select
              value={locationDataFilter}
              onValueChange={(v) =>
                onLocationDataFilterChange(v as LocationDataFilterValue)
              }
            >
              <SelectTrigger className="h-9 sm:h-8 min-h-[2.25rem]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LOCATION_DATA_STATUS_LABELS) as LocationDataFilterValue[]).map(
                  (key) => {
                    const facetCount = facets?.locationDataStatuses.find(
                      (s) => s.value === key
                    )?.count;
                    return (
                      <SelectItem key={key} value={key}>
                        {LOCATION_DATA_STATUS_LABELS[key]}
                        {facetCount != null ? ` (${facetCount})` : ''}
                      </SelectItem>
                    );
                  }
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
