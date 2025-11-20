'use client';

import React, { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Search, Building2, MapPin, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker-with-presets";
import { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { motion } from 'framer-motion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Enhanced Plant Multi-Selector Component
interface PlantMultiSelectorProps {
  availablePlants: any[];
  businessUnits?: any[];
  selectedPlantIds: string[];
  onPlantsChange: (plantIds: string[]) => void;
}

const PlantMultiSelector: React.FC<PlantMultiSelectorProps> = ({
  availablePlants,
  businessUnits = [],
  selectedPlantIds,
  onPlantsChange,
}) => {
  const [buFilter, setBuFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter plants by business unit and search term
  const filteredPlants = availablePlants.filter((plant) => {
    const matchesBU = !buFilter || plant.business_unit_id === buFilter;
    const matchesSearch = !searchTerm || 
      plant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plant.code?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesBU && matchesSearch;
  });

  // Group plants by business unit for better organization
  const plantsByBU = filteredPlants.reduce((acc, plant) => {
    const buId = plant.business_unit_id || 'none';
    if (!acc[buId]) {
      acc[buId] = [];
    }
    acc[buId].push(plant);
    return acc;
  }, {} as Record<string, any[]>);

  const handlePlantToggle = (plantId: string) => {
    if (selectedPlantIds.includes(plantId)) {
      onPlantsChange(selectedPlantIds.filter(id => id !== plantId));
    } else {
      onPlantsChange([...selectedPlantIds, plantId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedPlantIds.length === filteredPlants.length) {
      onPlantsChange([]);
    } else {
      onPlantsChange(filteredPlants.map(p => p.id));
    }
  };

  const handleSelectBU = (buId: string) => {
    const buPlants = filteredPlants.filter(p => p.business_unit_id === buId);
    const buPlantIds = buPlants.map(p => p.id);
    const allSelected = buPlantIds.every(id => selectedPlantIds.includes(id));
    
    if (allSelected) {
      // Deselect all plants from this BU
      onPlantsChange(selectedPlantIds.filter(id => !buPlantIds.includes(id)));
    } else {
      // Select all plants from this BU
      const newSelection = [...selectedPlantIds];
      buPlantIds.forEach(id => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      onPlantsChange(newSelection);
    }
  };

  const getDisplayText = () => {
    if (selectedPlantIds.length === 0) {
      return "Todas las plantas";
    }
    if (selectedPlantIds.length === 1) {
      const plant = availablePlants.find(p => p.id === selectedPlantIds[0]);
      return plant?.name || "1 planta seleccionada";
    }
    return `${selectedPlantIds.length} plantas seleccionadas`;
  };

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full h-10 justify-between text-sm font-normal glass-thick rounded-2xl border border-label-tertiary/10 hover:border-systemBlue/30"
          >
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-systemBlue" />
              <span>{getDisplayText()}</span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 z-[9999]" align="start">
          <div className="p-3 space-y-3">
            {/* Header with search and clear */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-label-primary">Seleccionar Plantas</span>
                {selectedPlantIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onPlantsChange([])}
                  >
                    Limpiar
                  </Button>
                )}
              </div>
              
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-label-tertiary" />
                <Input
                  placeholder="Buscar planta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>

              {/* Business Unit Filter */}
              {businessUnits.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={buFilter === null ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setBuFilter(null)}
                  >
                    Todas
                  </Button>
                  {businessUnits.map((bu) => (
                    <Button
                      key={bu.id}
                      variant={buFilter === bu.id ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setBuFilter(bu.id)}
                    >
                      <Building2 className="h-3 w-3 mr-1" />
                      {bu.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Select All */}
            {filteredPlants.length > 0 && (
              <div className="flex items-center space-x-2 pb-2 border-b">
                <Checkbox
                  checked={selectedPlantIds.length === filteredPlants.length && filteredPlants.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <label className="text-sm font-medium cursor-pointer flex-1">
                  Seleccionar todas ({filteredPlants.length})
                </label>
              </div>
            )}

            {/* Plants List */}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {Object.entries(plantsByBU).map(([buId, plants]) => {
                const bu = businessUnits.find(b => b.id === buId);
                const buPlantIds = plants.map(p => p.id);
                const allBuSelected = buPlantIds.length > 0 && buPlantIds.every(id => selectedPlantIds.includes(id));
                
                return (
                  <div key={buId} className="space-y-1">
                    {/* Business Unit Header */}
                    {bu && (
                      <div className="flex items-center space-x-2 px-2 py-1 bg-label-tertiary/5 rounded">
                        <Checkbox
                          checked={allBuSelected}
                          onCheckedChange={() => handleSelectBU(buId)}
                        />
                        <Building2 className="h-3 w-3 text-label-tertiary" />
                        <span className="text-xs font-semibold text-label-secondary">{bu.name}</span>
                        <span className="text-xs text-label-tertiary ml-auto">
                          ({plants.length})
                        </span>
                      </div>
                    )}
                    
                    {/* Plants in this BU */}
                    {plants.map((plant) => (
                      <div key={plant.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-label-tertiary/5 rounded">
                        <Checkbox
                          checked={selectedPlantIds.includes(plant.id)}
                          onCheckedChange={() => handlePlantToggle(plant.id)}
                        />
                        <MapPin className="h-3 w-3 text-label-tertiary" />
                        <label className="text-sm cursor-pointer flex-1">
                          {plant.name}
                          {plant.code && (
                            <span className="text-xs text-label-tertiary ml-1">({plant.code})</span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                );
              })}
              
              {filteredPlants.length === 0 && (
                <div className="text-center py-4 text-sm text-label-tertiary">
                  No se encontraron plantas
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected Plants Badges */}
      {selectedPlantIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedPlantIds.slice(0, 3).map((plantId) => {
            const plant = availablePlants.find(p => p.id === plantId);
            if (!plant) return null;
            return (
              <Badge
                key={plantId}
                variant="secondary"
                className="text-xs px-2 py-0.5 h-6 bg-systemBlue/10 text-systemBlue border-systemBlue/20"
              >
                <MapPin className="h-3 w-3 mr-1" />
                {plant.name}
                <X
                  className="ml-1.5 h-3 w-3 cursor-pointer hover:text-red-500"
                  onClick={() => handlePlantToggle(plantId)}
                />
              </Badge>
            );
          })}
          {selectedPlantIds.length > 3 && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 h-6">
              +{selectedPlantIds.length - 3} más
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

interface SalesFiltersProps {
  currentPlant: any;
  availablePlants: any[];
  businessUnits?: any[];
  selectedPlantIds?: string[];
  onPlantChange?: (plantId: string | null) => void;
  onPlantsChange?: (plantIds: string[]) => void;
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
  tipoFilter: string[];  // Changed to array for multi-select (CONCRETO, BOMBEO, VACÍO DE OLLA)
  codigoProductoFilter: string[];  // Multi-select product codes
  resistances: string[];
  tipos: string[];
  productCodes: string[];
  onResistanceFilterChange: (value: string) => void;
  onEfectivoFiscalFilterChange: (value: string) => void;
  onTipoFilterChange: (values: string[]) => void;  // Changed signature for multi-select
  onCodigoProductoFilterChange: (values: string[]) => void;

  // VAT Toggle
  includeVAT: boolean;
  onIncludeVATChange: (checked: boolean) => void;
}

export const SalesFilters: React.FC<SalesFiltersProps> = ({
  currentPlant,
  availablePlants,
  businessUnits = [],
  selectedPlantIds = [],
  onPlantChange,
  onPlantsChange,
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
  // Safety checks: ensure arrays are always arrays
  const safeTipoFilter = Array.isArray(tipoFilter) ? tipoFilter : [];
  const safeCodigoProductoFilter = Array.isArray(codigoProductoFilter) ? codigoProductoFilter : [];
  
  return (
      <div className="space-y-6">
        {/* Current Layout Filters - Only show when layoutType is 'current' */}
        {layoutType === 'current' && (
          <div className="flex flex-col md:flex-row gap-4">
            {/* Enhanced Plant Selector - Multi-select */}
            <div className="flex flex-col">
              <Label className="mb-1">Planta</Label>
              <PlantMultiSelector
                availablePlants={availablePlants}
                businessUnits={businessUnits}
                selectedPlantIds={selectedPlantIds.length > 0 ? selectedPlantIds : (currentPlant?.id ? [currentPlant.id] : [])}
                onPlantsChange={(ids) => {
                  if (onPlantsChange) {
                    onPlantsChange(ids);
                  } else if (onPlantChange) {
                    // Fallback to single selection mode
                    onPlantChange(ids.length > 0 ? ids[0] : null);
                  }
                }}
              />
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

      {/* PowerBI Filters Section - Apple HIG Style */}
      {layoutType === 'powerbi' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
          className="glass-thick rounded-3xl p-8 border border-label-tertiary/10 relative"
        >
          <h2 className="text-title-3 font-semibold text-label-primary mb-6">
            Filtros Avanzados
          </h2>
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 relative'>
            {/* Enhanced Plant Selector - Multi-select with Business Unit filter */}
            <div className="flex flex-col space-y-2 relative">
              <Label className="text-caption font-semibold text-label-secondary uppercase tracking-wide">Planta</Label>
              <PlantMultiSelector
                availablePlants={availablePlants}
                businessUnits={businessUnits}
                selectedPlantIds={selectedPlantIds.length > 0 ? selectedPlantIds : (currentPlant?.id ? [currentPlant.id] : [])}
                onPlantsChange={(ids) => {
                  if (onPlantsChange) {
                    onPlantsChange(ids);
                  } else if (onPlantChange) {
                    // Fallback to single selection mode
                    onPlantChange(ids.length > 0 ? ids[0] : null);
                  }
                }}
              />
            </div>

            {/* Date Range Picker */}
            <div className="flex flex-col space-y-2 lg:col-span-2">
              <Label htmlFor="dateRange" className="text-caption font-semibold text-label-secondary uppercase tracking-wide">Rango de Fecha</Label>
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
            <div className="flex flex-col space-y-2">
              <Label htmlFor="resistenciaFilter" className="text-caption font-semibold text-label-secondary uppercase tracking-wide">Resistencia</Label>
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
            <div className="flex flex-col space-y-2">
              <Label htmlFor="clientFilterPowerBI" className="text-caption font-semibold text-label-secondary uppercase tracking-wide">Cliente</Label>
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
            <div className="flex flex-col space-y-2">
              <Label htmlFor="efectivoFiscalFilter" className="text-caption font-semibold text-label-secondary uppercase tracking-wide">Efectivo/Fiscal</Label>
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

            {/* Tipo Filter - Multi-select */}
            <div className="flex flex-col space-y-2">
              <Label className="text-caption font-semibold text-label-secondary uppercase tracking-wide">Tipo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full h-8 justify-between text-xs font-normal"
                  >
                    {safeTipoFilter.length === 0 ? (
                      "Todos"
                    ) : safeTipoFilter.length === 1 ? (
                      safeTipoFilter[0]
                    ) : (
                      `${safeTipoFilter.length} seleccionados`
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 z-[9999]" align="start">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b">
                      <span className="text-xs font-semibold">Seleccionar Tipos</span>
                      {safeTipoFilter.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => onTipoFilterChange([])}
                        >
                          Limpiar
                        </Button>
                      )}
                    </div>
                    {tipos.map((tipo) => (
                      <div key={tipo} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tipo-${tipo}`}
                          checked={safeTipoFilter.includes(tipo)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              onTipoFilterChange([...safeTipoFilter, tipo]);
                            } else {
                              onTipoFilterChange(
                                safeTipoFilter.filter((t) => t !== tipo)
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={`tipo-${tipo}`}
                          className="text-xs cursor-pointer flex-1"
                        >
                          {tipo}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {safeTipoFilter.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {safeTipoFilter.map((tipo) => (
                    <Badge
                      key={tipo}
                      variant="secondary"
                      className="text-xs px-1.5 py-0 h-5"
                    >
                      {tipo}
                      <X
                        className="ml-1 h-3 w-3 cursor-pointer"
                        onClick={() =>
                          onTipoFilterChange(
                            safeTipoFilter.filter((t) => t !== tipo)
                          )
                        }
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Codigo Producto Filter - Multi-select */}
            <div className="flex flex-col space-y-2">
              <Label className="text-caption font-semibold text-label-secondary uppercase tracking-wide">Código Producto</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full h-8 justify-between text-xs font-normal"
                  >
                    {safeCodigoProductoFilter.length === 0 ? (
                      "Todos"
                    ) : safeCodigoProductoFilter.length === 1 ? (
                      safeCodigoProductoFilter[0]
                    ) : (
                      `${safeCodigoProductoFilter.length} seleccionados`
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 z-[9999]" align="start">
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    <div className="flex items-center justify-between pb-2 border-b">
                      <span className="text-xs font-semibold">Seleccionar Productos</span>
                      {safeCodigoProductoFilter.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => onCodigoProductoFilterChange([])}
                        >
                          Limpiar
                        </Button>
                      )}
                    </div>
                    {productCodes.map((code) => (
                      <div key={code} className="flex items-center space-x-2">
                        <Checkbox
                          id={`product-${code}`}
                          checked={safeCodigoProductoFilter.includes(code)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              onCodigoProductoFilterChange([...safeCodigoProductoFilter, code]);
                            } else {
                              onCodigoProductoFilterChange(
                                safeCodigoProductoFilter.filter((c) => c !== code)
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={`product-${code}`}
                          className="text-xs cursor-pointer flex-1"
                        >
                          {code}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {safeCodigoProductoFilter.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {safeCodigoProductoFilter.map((code) => (
                    <Badge
                      key={code}
                      variant="secondary"
                      className="text-xs px-1.5 py-0 h-5"
                    >
                      {code}
                      <X
                        className="ml-1 h-3 w-3 cursor-pointer"
                        onClick={() =>
                          onCodigoProductoFilterChange(
                            safeCodigoProductoFilter.filter((c) => c !== code)
                          )
                        }
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* VAT Toggle */}
            <div className="flex flex-col space-y-2">
              <Label className="text-caption font-semibold text-label-secondary uppercase tracking-wide">Incluir IVA</Label>
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
          </div>
        </motion.div>
      )}
    </div>
  );
};
