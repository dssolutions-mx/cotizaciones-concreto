import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface QualityDashboardFiltersProps {
  // Filter data
  clients: any[];
  constructionSites: any[];
  recipes: any[];
  plants: string[];
  availableAges: Array<{value: string, label: string}>;
  fcValues: Array<{value: string, label: string}>;
  specimenTypes: Array<{value: string, label: string}>;

  // Selection states
  selectedClient: string;
  selectedConstructionSite: string;
  selectedRecipe: string;
  selectedPlant: string;
  selectedClasificacion: 'all' | 'FC' | 'MR';
  selectedSpecimenType: string;
  selectedFcValue: string;
  selectedAge: string;
  soloEdadGarantia: boolean;
  incluirEnsayosFueraTiempo: boolean;

  // Popover states
  openClient: boolean;
  openSite: boolean;
  openRecipe: boolean;
  openPlant: boolean;
  openFcValue: boolean;
  openAge: boolean;

  // Setters
  setSelectedClient: (value: string) => void;
  setSelectedConstructionSite: (value: string) => void;
  setSelectedRecipe: (value: string) => void;
  setSelectedPlant: (value: string) => void;
  setSelectedClasificacion: (value: 'all' | 'FC' | 'MR') => void;
  setSelectedSpecimenType: (value: string) => void;
  setSelectedFcValue: (value: string) => void;
  setSelectedAge: (value: string) => void;
  setSoloEdadGarantia: (value: boolean) => void;
  setIncluirEnsayosFueraTiempo: (value: boolean) => void;

  // Popover setters
  setOpenClient: (value: boolean) => void;
  setOpenSite: (value: boolean) => void;
  setOpenRecipe: (value: boolean) => void;
  setOpenPlant: (value: boolean) => void;
  setOpenFcValue: (value: boolean) => void;
  setOpenAge: (value: boolean) => void;

  // Utility functions
  getFilteredConstructionSites: () => any[];
  resetAllFilters: () => void;
}

export function QualityDashboardFilters({
  clients,
  constructionSites,
  recipes,
  plants,
  availableAges,
  fcValues,
  specimenTypes,
  selectedClient,
  selectedConstructionSite,
  selectedRecipe,
  selectedPlant,
  selectedClasificacion,
  selectedSpecimenType,
  selectedFcValue,
  selectedAge,
  soloEdadGarantia,
  incluirEnsayosFueraTiempo,
  openClient,
  openSite,
  openRecipe,
  openPlant,
  openFcValue,
  openAge,
  setSelectedClient,
  setSelectedConstructionSite,
  setSelectedRecipe,
  setSelectedPlant,
  setSelectedClasificacion,
  setSelectedSpecimenType,
  setSelectedFcValue,
  setSelectedAge,
  setSoloEdadGarantia,
  setIncluirEnsayosFueraTiempo,
  setOpenClient,
  setOpenSite,
  setOpenRecipe,
  setOpenPlant,
  setOpenFcValue,
  setOpenAge,
  getFilteredConstructionSites,
  resetAllFilters
}: QualityDashboardFiltersProps) {
  // Check if any filters are active
  const hasActiveFilters = selectedClient !== 'all' ||
    selectedConstructionSite !== 'all' ||
    selectedRecipe !== 'all' ||
    selectedPlant !== 'all' ||
    selectedClasificacion !== 'all' ||
    selectedSpecimenType !== 'all' ||
    selectedFcValue !== 'all' ||
    selectedAge !== 'all' ||
    soloEdadGarantia ||
    incluirEnsayosFueraTiempo;

  return (
    <>
      {/* Enhanced Filter Bar */}
      <Card className="mb-6 bg-white/80 backdrop-blur border border-slate-200/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-gray-800">Filtros de Análisis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Client Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Cliente</Label>
              <Popover open={openClient} onOpenChange={setOpenClient}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedClient === 'all' ? 'Todos los clientes' : (clients.find(c => c.id === selectedClient)?.business_name || 'Cliente')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[320px]">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedClient('all'); setOpenClient(false); }}>Todos</CommandItem>
                        {clients.filter(c => c.id && c.business_name).map(c => (
                          <CommandItem key={c.id} onSelect={() => { setSelectedClient(c.id); setOpenClient(false); }}>
                            {c.business_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Construction Site Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Obra</Label>
              <Popover open={openSite} onOpenChange={setOpenSite}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedConstructionSite === 'all' ? 'Todas las obras' : (getFilteredConstructionSites().find(s => s.id === selectedConstructionSite)?.name || 'Obra')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[320px]">
                  <Command>
                    <CommandInput placeholder="Buscar obra..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedConstructionSite('all'); setOpenSite(false); }}>Todas</CommandItem>
                        {getFilteredConstructionSites().filter(s => s.id && s.name).map(s => (
                          <CommandItem key={s.id} onSelect={() => { setSelectedConstructionSite(s.id); setOpenSite(false); }}>
                            {s.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Recipe Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Receta</Label>
              <Popover open={openRecipe} onOpenChange={setOpenRecipe}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedRecipe === 'all' ? 'Todas las recetas' : selectedRecipe}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[280px]">
                  <Command>
                    <CommandInput placeholder="Buscar receta..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedRecipe('all'); setOpenRecipe(false); }}>Todas</CommandItem>
                        {recipes.filter(r => r.recipe_code?.trim()).map(r => (
                          <CommandItem key={r.id} onSelect={() => { setSelectedRecipe(r.recipe_code); setOpenRecipe(false); }}>
                            {r.recipe_code}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Plant Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Planta</Label>
              <Popover open={openPlant} onOpenChange={setOpenPlant}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedPlant === 'all' ? 'Todas las plantas' : selectedPlant}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[240px]">
                  <Command>
                    <CommandInput placeholder="Buscar planta..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedPlant('all'); setOpenPlant(false); }}>Todas</CommandItem>
                        {plants.map((plant) => (
                          <CommandItem key={plant} onSelect={() => { setSelectedPlant(plant); setOpenPlant(false); }}>
                            {plant}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Second Row of Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
            {/* Strength Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Resistencia</Label>
              <Popover open={openFcValue} onOpenChange={setOpenFcValue}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedFcValue === 'all'
                      ? 'Todas las resistencias'
                      : (fcValues.find(f => f.value === selectedFcValue)?.label || `${selectedFcValue} kg/cm2`)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[200px]">
                  <Command>
                    <CommandInput placeholder="Buscar resistencia..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedFcValue('all'); setOpenFcValue(false); }}>Todas</CommandItem>
                        {fcValues.map((fc) => (
                          <CommandItem 
                            key={fc.value} 
                            onSelect={() => { setSelectedFcValue(fc.value); setOpenFcValue(false); }}
                          >
                            {fc.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Classification Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Clasificación</Label>
              <div className="flex gap-2">
                <Button
                  variant={selectedClasificacion === 'FC' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedClasificacion(selectedClasificacion === 'FC' ? 'all' : 'FC')}
                  className="flex-1"
                >
                  FC
                </Button>
                <Button
                  variant={selectedClasificacion === 'MR' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedClasificacion(selectedClasificacion === 'MR' ? 'all' : 'MR')}
                  className="flex-1"
                >
                  MR
                </Button>
              </div>
            </div>

            {/* Specimen Type Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Tipo Probeta</Label>
              <Select value={selectedSpecimenType} onValueChange={(value: any) => setSelectedSpecimenType(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {specimenTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Age Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Edad Garantía</Label>
              <Popover open={openAge} onOpenChange={setOpenAge}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedAge === 'all' ? 'Todas las edades' : (availableAges.find(a => a.value === selectedAge)?.label || selectedAge)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar edad..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron edades.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setSelectedAge('all');
                            setOpenAge(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${selectedAge === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                          Todas las edades
                        </CommandItem>
                        {availableAges.map((age) => (
                          <CommandItem
                            key={age.value}
                            value={age.value}
                            onSelect={() => {
                              setSelectedAge(age.value);
                              setOpenAge(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedAge === age.value ? 'opacity-100' : 'opacity-0'}`} />
                            {age.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Age Guarantee Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Edad Garantía</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="age-guarantee"
                  checked={soloEdadGarantia}
                  onCheckedChange={setSoloEdadGarantia}
                />
                <Label htmlFor="age-guarantee" className="text-sm">
                  {soloEdadGarantia ? 'Activado' : 'Desactivado'}
                </Label>
              </div>
            </div>
          </div>

          {/* Third Row - Outside Time Essays Toggle and Reset */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Outside Time Essays Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Incluir Ensayos Fuera de Tiempo</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="outside-time-essays"
                  checked={incluirEnsayosFueraTiempo}
                  onCheckedChange={setIncluirEnsayosFueraTiempo}
                />
                <Label htmlFor="outside-time-essays" className="text-sm">
                  {incluirEnsayosFueraTiempo ? 'Incluidos' : 'Excluidos'}
                </Label>
              </div>
            </div>

            {/* Reset Button */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">&nbsp;</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllFilters}
                className="w-full"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mb-6 flex flex-wrap gap-2">
          {selectedClient !== 'all' && (
            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Cliente: {clients.find(c => c.id === selectedClient)?.business_name || selectedClient}</span>
              <button
                className="hover:bg-blue-100 rounded-full p-1"
                onClick={() => setSelectedClient('all')}
              >
                ×
              </button>
            </div>
          )}

          {selectedConstructionSite !== 'all' && (
            <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Obra: {getFilteredConstructionSites().find(s => s.id === selectedConstructionSite)?.name || selectedConstructionSite}</span>
              <button
                className="hover:bg-green-100 rounded-full p-1"
                onClick={() => setSelectedConstructionSite('all')}
              >
                ×
              </button>
            </div>
          )}

          {selectedRecipe !== 'all' && (
            <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Receta: {selectedRecipe}</span>
              <button
                className="hover:bg-purple-100 rounded-full p-1"
                onClick={() => setSelectedRecipe('all')}
              >
                ×
              </button>
            </div>
          )}

          {selectedPlant !== 'all' && (
            <div className="bg-cyan-50 text-cyan-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Planta: {selectedPlant}</span>
              <button className="hover:bg-cyan-100 rounded-full p-1" onClick={() => setSelectedPlant('all')}>×</button>
            </div>
          )}

          {selectedClasificacion !== 'all' && (
            <div className="bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Clasificación: {selectedClasificacion}</span>
              <button className="hover:bg-rose-100 rounded-full p-1" onClick={() => setSelectedClasificacion('all')}>×</button>
            </div>
          )}

          {selectedSpecimenType !== 'all' && (
            <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Probeta: {selectedSpecimenType}</span>
              <button className="hover:bg-emerald-100 rounded-full p-1" onClick={() => setSelectedSpecimenType('all')}>×</button>
            </div>
          )}

          {selectedFcValue !== 'all' && (
            <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Resistencia: {fcValues.find(f => f.value === selectedFcValue)?.label || `${selectedFcValue} kg/cm2`}</span>
              <button className="hover:bg-amber-100 rounded-full p-1" onClick={() => setSelectedFcValue('all')}>×</button>
            </div>
          )}

          {selectedAge !== 'all' && (
            <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Edad: {availableAges.find(a => a.value === selectedAge)?.label || selectedAge}</span>
              <button className="hover:bg-indigo-100 rounded-full p-1" onClick={() => setSelectedAge('all')}>×</button>
            </div>
          )}

          {soloEdadGarantia && (
            <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Solo edad garantía</span>
              <button
                className="hover:bg-amber-100 rounded-full p-1"
                onClick={() => setSoloEdadGarantia(false)}
              >
                ×
              </button>
            </div>
          )}

          {incluirEnsayosFueraTiempo && (
            <div className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Incluye ensayos fuera de tiempo</span>
              <button
                className="hover:bg-orange-100 rounded-full p-1"
                onClick={() => setIncluirEnsayosFueraTiempo(false)}
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
