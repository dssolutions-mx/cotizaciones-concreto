import React, { useMemo } from 'react';
import { QualityFilterBar, ActiveFilters, type ActiveFilterChip } from '@/components/quality/reporting';
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

  const activeChips: ActiveFilterChip[] = useMemo(() => {
    const chips: ActiveFilterChip[] = [];
    if (selectedClient !== 'all') {
      chips.push({
        id: 'client',
        label: `Cliente: ${clients.find(c => c.id === selectedClient)?.business_name || selectedClient}`,
        onRemove: () => setSelectedClient('all'),
      });
    }
    if (selectedConstructionSite !== 'all') {
      chips.push({
        id: 'site',
        label: `Obra: ${getFilteredConstructionSites().find(s => s.id === selectedConstructionSite)?.name || selectedConstructionSite}`,
        onRemove: () => setSelectedConstructionSite('all'),
      });
    }
    if (selectedRecipe !== 'all') {
      chips.push({
        id: 'recipe',
        label: `Receta: ${selectedRecipe}`,
        onRemove: () => setSelectedRecipe('all'),
      });
    }
    if (selectedPlant !== 'all') {
      chips.push({
        id: 'plant',
        label: `Planta: ${selectedPlant}`,
        onRemove: () => setSelectedPlant('all'),
      });
    }
    if (selectedClasificacion !== 'all') {
      chips.push({
        id: 'class',
        label: `Clasificación: ${selectedClasificacion}`,
        onRemove: () => setSelectedClasificacion('all'),
      });
    }
    if (selectedSpecimenType !== 'all') {
      chips.push({
        id: 'specimen',
        label: `Probeta: ${selectedSpecimenType}`,
        onRemove: () => setSelectedSpecimenType('all'),
      });
    }
    if (selectedFcValue !== 'all') {
      chips.push({
        id: 'fc',
        label: `Resistencia: ${fcValues.find(f => f.value === selectedFcValue)?.label || `${selectedFcValue} kg/cm²`}`,
        onRemove: () => setSelectedFcValue('all'),
      });
    }
    if (selectedAge !== 'all') {
      chips.push({
        id: 'age',
        label: `Edad: ${availableAges.find(a => a.value === selectedAge)?.label || selectedAge}`,
        onRemove: () => setSelectedAge('all'),
      });
    }
    if (soloEdadGarantia) {
      chips.push({
        id: 'solo-garantia',
        label: 'Solo edad garantía',
        onRemove: () => setSoloEdadGarantia(false),
        tone: 'muted',
      });
    }
    if (incluirEnsayosFueraTiempo) {
      chips.push({
        id: 'fuera-tiempo',
        label: 'Incluye ensayos fuera de tiempo',
        onRemove: () => setIncluirEnsayosFueraTiempo(false),
        tone: 'muted',
      });
    }
    return chips;
  }, [
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
    clients,
    fcValues,
    availableAges,
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
  ]);

  const primaryFilters = (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Client Filter */}
            <div className="space-y-2">
              <Label className="text-footnote font-medium text-slate-700">Cliente</Label>
              <Popover open={openClient} onOpenChange={setOpenClient}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full border-stone-200 bg-white">
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
              <Label className="text-footnote font-medium text-slate-700">Obra</Label>
              <Popover open={openSite} onOpenChange={setOpenSite}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full border-stone-200 bg-white">
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
              <Label className="text-footnote font-medium text-slate-700">Receta</Label>
              <Popover open={openRecipe} onOpenChange={setOpenRecipe}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full border-stone-200 bg-white">
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
              <Label className="text-footnote font-medium text-slate-700">Planta</Label>
              <Popover open={openPlant} onOpenChange={setOpenPlant}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full border-stone-200 bg-white">
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
  );

  const secondaryFilters = (
 <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Strength Filter */}
            <div className="space-y-2">
              <Label className="text-footnote font-medium text-slate-700">Resistencia</Label>
              <Popover open={openFcValue} onOpenChange={setOpenFcValue}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full border-stone-200 bg-white">
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
              <Label className="text-footnote font-medium text-slate-700">Clasificación</Label>
              <div className="flex gap-2">
                <Button
                  variant={selectedClasificacion === 'FC' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedClasificacion(selectedClasificacion === 'FC' ? 'all' : 'FC')}
                  className="flex-1 border-stone-200 bg-white"
                >
                  FC
                </Button>
                <Button
                  variant={selectedClasificacion === 'MR' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedClasificacion(selectedClasificacion === 'MR' ? 'all' : 'MR')}
                  className="flex-1 border-stone-200 bg-white"
                >
                  MR
                </Button>
              </div>
            </div>

            {/* Specimen Type Filter */}
            <div className="space-y-2">
              <Label className="text-footnote font-medium text-slate-700">Tipo Probeta</Label>
              <Select value={selectedSpecimenType} onValueChange={(value: any) => setSelectedSpecimenType(value)}>
                <SelectTrigger className="w-full border-stone-200 bg-white">
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
              <Label className="text-footnote font-medium text-slate-700">Edad Garantía</Label>
              <Popover open={openAge} onOpenChange={setOpenAge}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full border-stone-200 bg-white">
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
              <Label className="text-footnote font-medium text-slate-700">Edad Garantía</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="age-guarantee"
                  checked={soloEdadGarantia}
                  onCheckedChange={setSoloEdadGarantia}
                />
                <Label htmlFor="age-guarantee" className="text-footnote text-slate-600">
                  {soloEdadGarantia ? 'Activado' : 'Desactivado'}
                </Label>
              </div>
            </div>
          </div>

          {/* Third Row - Outside Time Essays Toggle and Reset */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Outside Time Essays Toggle */}
            <div className="space-y-2">
              <Label className="text-footnote font-medium text-slate-700">Incluir Ensayos Fuera de Tiempo</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="outside-time-essays"
                  checked={incluirEnsayosFueraTiempo}
                  onCheckedChange={setIncluirEnsayosFueraTiempo}
                />
                <Label htmlFor="outside-time-essays" className="text-footnote text-slate-600">
                  {incluirEnsayosFueraTiempo ? 'Incluidos' : 'Excluidos'}
                </Label>
              </div>
            </div>

            {/* Reset Button */}
            <div className="space-y-2">
              <Label className="text-footnote font-medium text-slate-700">&nbsp;</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllFilters}
                className="w-full border-stone-200 bg-white"
                disabled={!hasActiveFilters}
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
          </>
  );

  return (
    <div className="mb-6">
      <QualityFilterBar
        title="Filtros de análisis"
        primary={primaryFilters}
        secondary={secondaryFilters}
        activeChips={hasActiveFilters ? <ActiveFilters chips={activeChips} /> : undefined}
      />
    </div>
  );
}
