'use client';

import React from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker-with-presets";
import { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

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

  // PowerBI Filters
  layoutType: 'current' | 'powerbi';
  resistanceFilter: string;
  efectivoFiscalFilter: string;
  tipoFilter: string;
  codigoProductoFilter: string;
  resistances: string[];
  tipos: string[];
  productCodes: string[];
  onResistanceFilterChange: (value: string) => void;
  onEfectivoFiscalFilterChange: (value: string) => void;
  onTipoFilterChange: (value: string) => void;
  onCodigoProductoFilterChange: (value: string) => void;

  // VAT Toggle
  includeVAT: boolean;
  onIncludeVATChange: (checked: boolean) => void;
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

  // PowerBI Filters
  layoutType,
  resistanceFilter,
  efectivoFiscalFilter,
  tipoFilter,
  codigoProductoFilter,
  resistances,
  tipos,
  productCodes,
  onResistanceFilterChange,
  onEfectivoFiscalFilterChange,
  onTipoFilterChange,
  onCodigoProductoFilterChange,

  // VAT Toggle
  includeVAT,
  onIncludeVATChange,
}) => {
  return (
      <div className="space-y-6">
        {/* Current Layout Filters - Only show when layoutType is 'current' */}
        {layoutType === 'current' && (
          <div className="flex flex-col md:flex-row gap-4">
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

            {/* VAT Toggle for Current Layout */}
            <div className="flex flex-col">
              <Label className="mb-1">Incluir IVA</Label>
              <div className="flex items-center space-x-2 h-10">
                <Switch
                  id="vat-toggle-current"
                  checked={includeVAT}
                  onCheckedChange={onIncludeVATChange}
                />
                <Label htmlFor="vat-toggle-current" className="text-sm">
                  {includeVAT ? 'Sí' : 'No'}
                </Label>
              </div>
            </div>
          </div>
        )}

      {/* PowerBI Filters Section */}
      {layoutType === 'powerbi' && (
        <Card className='border-gray-300'>
          <CardHeader className='pb-2 pt-2'>
            <CardTitle className='text-sm font-medium'>FILTROS AVANZADOS</CardTitle>
          </CardHeader>
          <CardContent className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pb-4'>
            {/* Plant Context Display */}
            <div className="flex flex-col space-y-1">
              <Label className="text-xs font-semibold">PLANTA</Label>
              <PlantContextDisplay showLabel={false} />
              {currentPlant && (
                <div className="text-xs text-muted-foreground">
                  Filtrando por: {currentPlant.name}
                </div>
              )}
            </div>

            {/* Date Range Picker */}
            <div className="flex flex-col space-y-1 lg:col-span-2">
              <Label htmlFor="dateRange" className="text-xs font-semibold">RANGO DE FECHA</Label>
              <DateRangePickerWithPresets
                dateRange={{
                  from: startDate || new Date(),
                  to: endDate || new Date()
                }}
                onDateRangeChange={onDateRangeChange}
                className="h-[40px]"
              />
            </div>

            {/* Resistencia Filter */}
            <div className="flex flex-col space-y-1">
              <Label htmlFor="resistenciaFilter" className="text-xs font-semibold">RESISTENCIA</Label>
              <Select value={resistanceFilter} onValueChange={onResistanceFilterChange}>
                <SelectTrigger id="resistenciaFilter" className="w-full h-8">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {resistances.map(res => <SelectItem key={res} value={res}>{res}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Cliente Filter */}
            <div className="flex flex-col space-y-1">
              <Label htmlFor="clientFilterPowerBI" className="text-xs font-semibold">CLIENTE</Label>
              <Select value={clientFilter} onValueChange={onClientFilterChange}>
                <SelectTrigger id="clientFilterPowerBI" className="w-full h-8">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {clients.map((client, index) => (
                    <SelectItem key={`${client.id}`} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Efectivo/Fiscal Filter */}
            <div className="flex flex-col space-y-1">
              <Label htmlFor="efectivoFiscalFilter" className="text-xs font-semibold">EFECTIVO/FISCAL</Label>
              <Select value={efectivoFiscalFilter} onValueChange={onEfectivoFiscalFilterChange}>
                <SelectTrigger id="efectivoFiscalFilter" className="w-full h-8">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="fiscal">Fiscal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo Filter */}
            <div className="flex flex-col space-y-1">
              <Label htmlFor="tipoFilter" className="text-xs font-semibold">TIPO</Label>
              <Select value={tipoFilter} onValueChange={onTipoFilterChange}>
                <SelectTrigger id="tipoFilter" className="w-full h-8">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {tipos.map(tipo => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Codigo Producto Filter */}
            <div className="flex flex-col space-y-1">
              <Label htmlFor="codigoProductoFilter" className="text-xs font-semibold">CODIGO PRODUCTO</Label>
              <Select value={codigoProductoFilter} onValueChange={onCodigoProductoFilterChange}>
                <SelectTrigger id="codigoProductoFilter" className="w-full h-8">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {productCodes.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* VAT Toggle */}
            <div className="flex flex-col space-y-1">
              <Label className="text-xs font-semibold">INCLUIR IVA</Label>
              <div className="flex items-center space-x-2 h-8">
                <Switch
                  id="vat-toggle"
                  checked={includeVAT}
                  onCheckedChange={onIncludeVATChange}
                />
                <Label htmlFor="vat-toggle" className="text-xs">
                  {includeVAT ? 'Sí' : 'No'}
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
