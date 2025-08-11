"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Truck } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { adjustDateForTimezone } from "./dateUtils";

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
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Buscar por remisión, cliente o receta"
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" className="flex-shrink-0" onClick={onResetFilters}>
              Limpiar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Cargando remisiones...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-lg">
            <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay remisiones disponibles</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              No se encontraron remisiones disponibles para esta orden o con los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((remision) => (
              <Card
                key={remision.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary",
                  selectedId === remision.id && "border-primary ring-2 ring-primary ring-opacity-50"
                )}
                onClick={() => onSelect(remision)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-primary-50 p-2 rounded-full">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Remisión #{remision.remision_number}</h4>
                      <p className="text-sm text-gray-500">
                        {remision.fecha ? formatDate(adjustDateForTimezone(remision.fecha) || new Date(), "dd/MM/yyyy") : "Sin fecha"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1 mt-3">
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
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button onClick={onContinue} disabled={!canContinue}>
          Continuar
        </Button>
      </CardFooter>
    </Card>
  );
}


