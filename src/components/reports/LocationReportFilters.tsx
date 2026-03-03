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
import { MapPin, Building2, MapPinned, ChevronDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationReportFiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  availablePlants: { id: string; name: string; code?: string }[];
  selectedPlantIds: string[];
  onPlantIdsChange: (ids: string[]) => void;
  clients: { id: string; name: string }[];
  clientIds: string[];
  onClientIdsChange: (ids: string[]) => void;
  localities: string[];
  localityFilter: string[];
  onLocalityFilterChange: (v: string[]) => void;
  administrativeAreas1: string[];
  administrativeArea1Filter: string[];
  onAdministrativeArea1FilterChange: (v: string[]) => void;
  className?: string;
}

function MultiSelectPopover<T extends string>({
  options,
  selected,
  onChange,
  placeholder,
  displayValue,
  icon: Icon,
}: {
  options: T[];
  selected: T[];
  onChange: (v: T[]) => void;
  placeholder: string;
  displayValue?: (v: T) => string;
  icon?: React.ElementType;
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
              <span className="text-sm truncate">{render(opt)}</span>
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
  localities,
  localityFilter,
  onLocalityFilterChange,
  administrativeAreas1,
  administrativeArea1Filter,
  onAdministrativeArea1FilterChange,
  className,
}: LocationReportFiltersProps) {
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
    <Card className={cn('border-border', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Filtros de ubicación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Rango de fechas
            </Label>
            <DateRangePickerWithPresets
              dateRange={dateRange}
              onDateRangeChange={onDateRangeChange}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
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
                        selectedPlantIds.length === availablePlants.length ? [] : availablePlants.map((p) => p.id)
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
                      <span className="text-sm truncate">{p.code ? `${p.code} - ${p.name}` : p.name}</span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Cliente(s)</Label>
            <MultiSelectPopover
              options={clients.map((c) => c.id)}
              selected={clientIds}
              onChange={onClientIdsChange}
              placeholder="Todos los clientes"
              displayValue={(id) => clients.find((c) => c.id === id)?.name || id}
              icon={Building2}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
              <MapPinned className="h-3.5 w-3.5" />
              Ciudad (localidad)
            </Label>
            <MultiSelectPopover
              options={localities}
              selected={localityFilter}
              onChange={onLocalityFilterChange}
              placeholder="Todas las ciudades"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Estado</Label>
            <MultiSelectPopover
              options={administrativeAreas1}
              selected={administrativeArea1Filter}
              onChange={onAdministrativeArea1FilterChange}
              placeholder="Todos los estados"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
