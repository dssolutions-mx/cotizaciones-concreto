"use client";

import React from "react";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, User, Package, Droplets, Clock } from "lucide-react";
import { adjustDateForTimezone } from "./dateUtils";
import { formatDate } from "@/lib/utils";

type Props = {
  remision: any | null;
  onChange?: () => void;
};

export default function RemisionInfoCard({ remision, onChange }: Props) {
  if (!remision) {
    return (
      <CardContent className="flex justify-center items-center p-6">
        <p className="text-gray-500">No hay remisión seleccionada</p>
      </CardContent>
    );
  }

  return (
    <CardContent className="space-y-4">
      <div className="p-4 border rounded-lg bg-gray-50">
        <h3 className="font-semibold text-lg mb-3">Remisión #{remision.remision_number}</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium">Unidad</p>
              <p className="text-sm">{remision.unidad || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium">Conductor</p>
              <p className="text-sm">{remision.conductor || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium">Receta</p>
              <p className="text-sm">{remision.recipe?.recipe_code || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium">Volumen</p>
              <p className="text-sm">{remision.volumen_fabricado || 'N/A'} m³</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium">Hora de Carga</p>
              <p className="text-sm">{remision.hora_carga || 'N/A'}</p>
            </div>
          </div>

          <hr className="border-gray-200" />

          <div>
            <p className="text-sm font-medium">Detalles de la Mezcla</p>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <p className="text-sm"><span className="text-gray-500">f'c:</span> {remision.recipe?.strength_fc || 'N/A'} kg/cm²</p>
              <p className="text-sm"><span className="text-gray-500">Rev:</span> {remision.recipe?.slump || 'N/A'} cm</p>
              <p className="text-sm"><span className="text-gray-500">TMA:</span> {remision.recipe?.tma || 'N/A'} mm</p>
              <p className="text-sm"><span className="text-gray-500">Edad:</span> {remision.recipe?.age_hours ? `${remision.recipe.age_hours} horas` : `${remision.recipe?.age_days || 'N/A'} días`}</p>
            </div>
          </div>

          <hr className="border-gray-200" />

          <div>
            <p className="text-sm font-medium">Cliente/Obra</p>
            <p className="text-sm">{remision.client_name || 'N/A'}</p>
            <p className="text-sm text-gray-500">{remision.construction_name || 'N/A'}</p>
          </div>
        </div>
      </div>

      {onChange && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onChange} size="sm">
            Cambiar Remisión
          </Button>
        </div>
      )}
    </CardContent>
  );
}

