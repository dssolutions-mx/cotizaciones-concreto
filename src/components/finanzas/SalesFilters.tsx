'use client';

import React from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker-with-presets";
import { DateRange } from "react-day-picker";

interface SalesFiltersProps {
  currentPlant: any;
  startDate: Date | undefined;
  endDate: Date | undefined;
  clientFilter: string;
  searchTerm: string;
  clients: { id: string; name: string }[];
  onDateRangeChange: (range: DateRange | undefined) => void;
  onClientFilterChange: (value: string) => void;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const SalesFilters: React.FC<SalesFiltersProps> = ({
  currentPlant,
  startDate,
  endDate,
  clientFilter,
  searchTerm,
  clients,
  onDateRangeChange,
  onClientFilterChange,
  onSearchChange,
}) => {
  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      {/* Plant Context Display */}
      <div className="flex flex-col">
        <Label className="mb-1">Planta</Label>
        <PlantContextDisplay showLabel={false} />
        {currentPlant && (
          <div className="mt-1 text-xs text-muted-foreground">
            Filtrando por: {currentPlant.name}
          </div>
        )}
      </div>

      {/* Date Range Picker */}
      <div className="flex flex-col flex-1">
        <Label htmlFor="dateRange" className="mb-1">Rango de Fechas</Label>
        <DateRangePickerWithPresets
          dateRange={{
            from: startDate || new Date(),
            to: endDate || new Date()
          }}
          onDateRangeChange={onDateRangeChange}
        />
      </div>

      {/* Client Filter */}
      <div className="flex flex-col flex-1">
        <Label htmlFor="clientFilter" className="mb-1">Cliente</Label>
        <Select value={clientFilter} onValueChange={onClientFilterChange}>
          <SelectTrigger id="clientFilter" className="w-full">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((client, index) => (
              <SelectItem key={`${client.id}-${index}`} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search Input */}
      <div className="flex flex-col flex-1">
        <Label htmlFor="search" className="mb-1">Buscar</Label>
        <div className="relative">
          <Input
            id="search"
            type="text"
            placeholder="Buscar por remisión, cliente o producto..."
            value={searchTerm}
            onChange={onSearchChange}
            className="pl-9"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
