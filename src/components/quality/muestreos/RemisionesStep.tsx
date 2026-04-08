"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Truck, Factory } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { adjustDateForTimezone } from "./dateUtils";

const outlineBtn =
  "h-9 border-stone-300 bg-white px-3 shadow-none hover:bg-stone-50";
const primaryBtn =
  "h-9 bg-sky-700 px-3 text-sm text-white shadow-none hover:bg-sky-800";

type RemisionesStepProps = {
  isLoading: boolean;
  items: any[];
  selectedId?: string | null;
  onSelect: (remision: any) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  onResetFilters: () => void;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
};

export default function RemisionesStep({
  isLoading,
  items,
  selectedId,
  onSelect,
  searchTerm,
  setSearchTerm,
  onResetFilters,
  onBack,
  onContinue,
  canContinue,
}: RemisionesStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seleccionar Remisión</CardTitle>
        <CardDescription>Elige la remisión para la que deseas crear el muestreo</CardDescription>
        <div className="mt-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-500" />
              <Input
                type="text"
                placeholder="Buscar por remisión, cliente o receta"
                className="pl-9 border-stone-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" className={cn("flex-shrink-0", outlineBtn)} onClick={onResetFilters}>
              Limpiar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            <span className="ml-2 text-stone-600">Cargando remisiones...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center p-8 bg-stone-50 rounded-lg border border-stone-200">
            <Truck className="h-12 w-12 text-stone-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2 text-stone-900">No hay remisiones disponibles</h3>
            <p className="text-stone-500 max-w-md mx-auto">
              No se encontraron remisiones disponibles para esta orden o con los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((remision) => (
              <Card
                key={remision.id}
                className={cn(
                  "cursor-pointer transition-all border-stone-200 hover:border-sky-600",
                  selectedId === remision.id && "border-sky-600 ring-2 ring-sky-600 ring-opacity-50"
                )}
                onClick={() => onSelect(remision)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn("p-2 rounded-full", remision.is_production_record ? "bg-orange-50" : "bg-sky-50")}>
                      {remision.is_production_record
                        ? <Factory className="h-5 w-5 text-orange-500" />
                        : <Truck className="h-5 w-5 text-sky-700" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-stone-900">Remisión #{remision.remision_number}</h4>
                      <p className="text-sm text-stone-500">
                        {remision.fecha ? formatDate(adjustDateForTimezone(remision.fecha) || new Date(), "dd/MM/yyyy") : "Sin fecha"}
                      </p>
                    </div>
                    {remision.is_production_record && (
                      <span className="text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5 whitespace-nowrap flex-shrink-0">
                        Prod. Cruzada
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 mt-3 text-stone-800">
                    <p className="text-sm">
                      <span className="font-medium">Volumen:</span> {remision.volumen_fabricado} m³
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">f'c:</span> {remision.recipe?.strength_fc || "N/A"} kg/cm²
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Receta:</span> {remision.recipe?.recipe_code || "N/A"}
                    </p>
                    {remision.conductor && (
                      <p className="text-sm">
                        <span className="font-medium">Conductor:</span> {remision.conductor}
                      </p>
                    )}
                    {remision.unidad && (
                      <p className="text-sm">
                        <span className="font-medium">Unidad:</span> {remision.unidad}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <Button variant="outline" className={outlineBtn} onClick={onBack}>
          Atrás
        </Button>
        <Button className={primaryBtn} onClick={onContinue} disabled={!canContinue}>
          Continuar
        </Button>
      </CardFooter>
    </Card>
  );
}
