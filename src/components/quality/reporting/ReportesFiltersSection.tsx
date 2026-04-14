'use client';

import React from 'react';
import type { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, Loader2 } from 'lucide-react';

type ReportesFiltersSectionProps = {
  dateRange: DateRange | undefined;
  onDateRangeChange: (r: DateRange | undefined) => void;
  selectedPlanta: string;
  onPlantaChange: (v: string) => void;
  selectedClasificacion: string;
  onClasificacionChange: (v: string) => void;
  selectedClient: string;
  onClientChange: (v: string) => void;
  selectedConstructionSite: string;
  onConstructionSiteChange: (v: string) => void;
  selectedRecipe: string;
  onRecipeChange: (v: string) => void;
  clients: any[];
  clientsLoading: boolean;
  constructionSites: any[];
  sitesLoading: boolean;
  recipes: any[];
  recipesLoading: boolean;
  loading: boolean;
  onApply: () => void;
};

export function ReportesFiltersSection({
  dateRange,
  onDateRangeChange,
  selectedPlanta,
  onPlantaChange,
  selectedClasificacion,
  onClasificacionChange,
  selectedClient,
  onClientChange,
  selectedConstructionSite,
  onConstructionSiteChange,
  selectedRecipe,
  onRecipeChange,
  clients,
  clientsLoading,
  constructionSites,
  sitesLoading,
  recipes,
  recipesLoading,
  loading,
  onApply,
}: ReportesFiltersSectionProps) {
  return (
    <Card className="mb-6 border-stone-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="h-5 w-5 text-stone-600" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium mb-2 text-stone-700">Período</p>
            <DatePickerWithRange value={dateRange} onChange={onDateRangeChange} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2 text-stone-700">Planta</p>
            <Select value={selectedPlanta} onValueChange={onPlantaChange}>
              <SelectTrigger className="w-full border-stone-200 bg-white">
                <SelectValue placeholder="Todas las plantas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las plantas</SelectItem>
                <SelectItem value="1">Planta 1</SelectItem>
                <SelectItem value="2">Planta 2</SelectItem>
                <SelectItem value="3">Planta 3</SelectItem>
                <SelectItem value="4">Planta 4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 text-stone-700">Clasificación</p>
            <Select value={selectedClasificacion} onValueChange={onClasificacionChange}>
              <SelectTrigger className="w-full border-stone-200 bg-white">
                <SelectValue placeholder="Todas las clasificaciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="FC">FC</SelectItem>
                <SelectItem value="MR">MR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 text-stone-700">Cliente</p>
            <Select value={selectedClient} onValueChange={onClientChange} disabled={clientsLoading || clients.length === 0}>
              <SelectTrigger className="w-full border-stone-200 bg-white">
                <SelectValue
                  placeholder={
                    clientsLoading
                      ? 'Cargando clientes...'
                      : clients.length === 0
                        ? 'No hay clientes'
                        : 'Todos los clientes'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients?.map((client: any) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.business_name || client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 text-stone-700">Obra</p>
            <Select
              value={selectedConstructionSite}
              onValueChange={onConstructionSiteChange}
              disabled={sitesLoading || constructionSites.length === 0 || selectedClient === 'all'}
            >
              <SelectTrigger className="w-full border-stone-200 bg-white">
                <SelectValue
                  placeholder={
                    selectedClient === 'all'
                      ? 'Seleccione un cliente primero'
                      : sitesLoading
                        ? 'Cargando obras...'
                        : constructionSites.length === 0
                          ? 'No hay obras'
                          : 'Todas las obras'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las obras</SelectItem>
                {constructionSites?.map((site: any) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 text-stone-700">Receta</p>
            <Select value={selectedRecipe} onValueChange={onRecipeChange} disabled={recipesLoading || recipes.length === 0}>
              <SelectTrigger className="w-full border-stone-200 bg-white">
                <SelectValue
                  placeholder={
                    recipesLoading
                      ? 'Cargando recetas...'
                      : recipes.length === 0
                        ? 'No hay recetas'
                        : 'Todas las recetas'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las recetas</SelectItem>
                {recipes?.map((recipe: any) => (
                  <SelectItem key={recipe.id} value={recipe.recipe_code}>
                    {recipe.recipe_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={onApply} disabled={loading} variant="default" className="gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando...
              </>
            ) : (
              <>
                <Filter className="h-4 w-4" />
                Aplicar filtros
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
