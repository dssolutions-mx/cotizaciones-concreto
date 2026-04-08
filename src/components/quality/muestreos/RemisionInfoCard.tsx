"use client";

import React from "react";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, User, Package, Droplets, Clock, Building2, Factory } from "lucide-react";
const outlineBtn =
  "h-9 border-stone-300 bg-white px-3 text-sm shadow-none hover:bg-stone-50";

type Props = {
  remision: any | null;
  onChange?: () => void;
};

export default function RemisionInfoCard({ remision, onChange }: Props) {
  if (!remision) {
    return (
      <CardContent className="flex justify-center items-center p-6">
        <p className="text-stone-500">No hay remisión seleccionada</p>
      </CardContent>
    );
  }

  return (
    <CardContent className="space-y-4">
      <div className="p-4 border border-stone-200 rounded-lg bg-stone-50">
        <h3 className="font-semibold text-lg mb-3 text-stone-900">Remisión #{remision.remision_number}</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-stone-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-stone-900">Unidad</p>
              <p className="text-sm text-stone-700">{remision.unidad || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-stone-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-stone-900">Planta</p>
              <p className="text-sm text-stone-700">{remision.planta || remision.plants?.code || remision.plants?.name || 'N/A'}</p>
            </div>
          </div>

          {/* Cross-plant production banner */}
          {(remision.is_production_record || remision.cross_plant_billing_remision_id) && (
            <div className="flex items-start gap-2 rounded-md bg-orange-50 border border-orange-200 px-3 py-2">
              <Factory className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-orange-800">Producción Cruzada</p>
                <p className="text-xs text-orange-600">
                  {remision.is_production_record
                    ? 'Este concreto fue producido aquí para otra planta.'
                    : 'Este concreto fue producido en otra planta.'}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-stone-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-stone-900">Conductor</p>
              <p className="text-sm text-stone-700">{remision.conductor || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-stone-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-stone-900">Receta</p>
              <p className="text-sm text-stone-700">{remision.recipe?.recipe_code || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-stone-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-stone-900">Volumen</p>
              <p className="text-sm text-stone-700">{remision.volumen_fabricado || 'N/A'} m³</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-stone-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-stone-900">Hora de Carga</p>
              <p className="text-sm text-stone-700">{remision.hora_carga || 'N/A'}</p>
            </div>
          </div>

          <hr className="border-stone-200" />

          <div>
            <p className="text-sm font-medium text-stone-900">Detalles de la Mezcla</p>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <p className="text-sm text-stone-800"><span className="text-stone-500">f'c:</span> {remision.recipe?.strength_fc || 'N/A'} kg/cm²</p>
              <p className="text-sm text-stone-800"><span className="text-stone-500">Rev:</span> {remision.recipe?.slump || 'N/A'} cm</p>
              <p className="text-sm text-stone-800"><span className="text-stone-500">TMA:</span> {remision.recipe?.tma || 'N/A'} mm</p>
              <p className="text-sm text-stone-800"><span className="text-stone-500">Edad:</span> {remision.recipe?.age_hours ? `${remision.recipe.age_hours} horas` : `${remision.recipe?.age_days || 'N/A'} días`}</p>
            </div>
          </div>

          <hr className="border-stone-200" />

          <div>
            <p className="text-sm font-medium text-stone-900">Cliente/Obra</p>
            <p className="text-sm text-stone-800">{remision.client_name || 'N/A'}</p>
            <p className="text-sm text-stone-500">{remision.construction_name || 'N/A'}</p>
          </div>
        </div>
      </div>

      {onChange && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onChange} size="sm" className={outlineBtn}>
            Cambiar Remisión
          </Button>
        </div>
      )}
    </CardContent>
  );
}
