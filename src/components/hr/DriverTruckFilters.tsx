'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChevronDown, Search, X } from 'lucide-react';

type Option = { id: string; label: string; secondary?: string; count?: number };

function MultiSelectPopover({
  label,
  placeholder,
  options,
  selected,
  onChange,
  className,
}: {
  label: string;
  placeholder: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || (o.secondary ?? '').toLowerCase().includes(q));
  }, [options, query]);

  const selectedLabel = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const o = options.find((x) => x.id === selected[0]);
      return o?.label ?? '1 seleccionado';
    }
    return `${selected.length} seleccionados`;
  }, [selected, options, placeholder]);

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-sm font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-white"
          >
            <span className={cn('truncate', selected.length === 0 && 'text-gray-500')}>{selectedLabel}</span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Buscar ${label.toLowerCase()}...`}
                className="pl-8 pr-9 h-9"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuery('')}
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <ScrollArea className="h-64">
            <div className="p-3 space-y-2">
              {filtered.length === 0 ? (
                <div className="text-sm text-gray-500 py-6 text-center">No hay resultados</div>
              ) : (
                filtered.map((o) => {
                  const checked = selected.includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) => {
                          const isChecked = next === true;
                          if (isChecked) onChange([...selected, o.id]);
                          else onChange(selected.filter((id) => id !== o.id));
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{o.label}</div>
                        {o.secondary && <div className="text-xs text-gray-500 truncate">{o.secondary}</div>}
                      </div>
                      {typeof o.count === 'number' && (
                        <div className="text-xs tabular-nums text-gray-500">{o.count}</div>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </ScrollArea>
          {selected.length > 0 && (
            <div className="p-2 border-t flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => onChange([])} className="text-xs">
                Limpiar ({selected.length})
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export type DriverTruckFiltersValue = {
  drivers: string[];
  trucks: string[];
  plantIds: string[];
  day: string | null; // yyyy-mm-dd within current range
};

export default function DriverTruckFilters({
  value,
  onChange,
  drivers,
  trucks,
  plants,
  days,
}: {
  value: DriverTruckFiltersValue;
  onChange: (next: DriverTruckFiltersValue) => void;
  drivers: Array<{ display: string; count: number }>;
  trucks: Array<{ display: string; count: number }>;
  plants: Array<{ plant_id: string; name: string; code: string; count: number }>;
  days: Array<{ date: string; trips: number; volume: number }>;
}) {
  const driverOptions = useMemo<Option[]>(
    () => drivers.map((d) => ({ id: d.display, label: d.display, count: d.count })),
    [drivers]
  );
  const truckOptions = useMemo<Option[]>(
    () => trucks.map((t) => ({ id: t.display, label: t.display, count: t.count })),
    [trucks]
  );
  const plantOptions = useMemo<Option[]>(
    () =>
      plants.map((p) => ({
        id: p.plant_id,
        label: p.name,
        secondary: p.code ? `Planta ${p.code}` : undefined,
        count: p.count,
      })),
    [plants]
  );
  const dayOptions = useMemo<Option[]>(
    () => [{ id: '__all__', label: 'Todos los días' }].concat(days.map((d) => ({ id: d.date, label: d.date, count: d.trips }))),
    [days]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <MultiSelectPopover
        label="Conductor"
        placeholder="Todos los conductores"
        options={driverOptions}
        selected={value.drivers}
        onChange={(driversNext) => onChange({ ...value, drivers: driversNext })}
      />
      <MultiSelectPopover
        label="Unidad"
        placeholder="Todas las unidades"
        options={truckOptions}
        selected={value.trucks}
        onChange={(trucksNext) => onChange({ ...value, trucks: trucksNext })}
      />
      <MultiSelectPopover
        label="Planta"
        placeholder="Todas las plantas"
        options={plantOptions}
        selected={value.plantIds}
        onChange={(plantIdsNext) => onChange({ ...value, plantIds: plantIdsNext })}
      />
      <div className="space-y-2">
        <Label className="text-sm font-medium">Día</Label>
        <div className="grid grid-cols-1 gap-2">
          <select
            className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
            value={value.day ?? '__all__'}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...value, day: v === '__all__' ? null : v });
            }}
          >
            {dayOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} {typeof o.count === 'number' && o.id !== '__all__' ? `(${o.count})` : ''}
              </option>
            ))}
          </select>
          {(value.day || value.drivers.length || value.trucks.length || value.plantIds.length) ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ drivers: [], trucks: [], plantIds: [], day: null })}
              className="justify-start text-xs text-gray-600"
            >
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

