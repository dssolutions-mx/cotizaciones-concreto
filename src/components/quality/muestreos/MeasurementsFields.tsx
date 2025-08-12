"use client";

import React from "react";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

type Props = {
  form: any;
};

export default function MeasurementsFields({ form }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
      <FormField
        control={form.control}
        name="revenimiento_sitio"
        render={({ field }) => (
          <FormItem className="md:col-span-6">
            <FormLabel className="flex items-center gap-1">
              Revenimiento en Sitio (cm)
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Info className="h-4 w-4 text-gray-400" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Típico: 8–15 cm según mezcla. Límite permitido 0–25 cm.</TooltipContent>
              </Tooltip>
            </FormLabel>
            <FormControl>
              <Input type="number" step="0.1" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
            </FormControl>
            <FormDescription>Recomendado 8–15 cm. Rango válido 0–25 cm.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-2 md:col-span-6">
        <FormItem>
          <FormLabel className="flex items-center gap-1">
            Masa Unitaria (kg/m³)
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Info className="h-4 w-4 text-gray-400" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Ingresa los pesos y el factor del recipiente; calculamos la masa unitaria automáticamente.</TooltipContent>
            </Tooltip>
          </FormLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
            <FormField
              control={form.control}
              name="peso_recipiente_vacio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs leading-tight min-h-[40px] flex items-end">Recipiente vacío (kg)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      placeholder="ej. 12.5"
                      value={Number.isFinite(field.value as any) ? String(field.value) : ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="peso_recipiente_lleno"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs leading-tight min-h-[40px] flex items-end">Recipiente lleno (kg)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      placeholder="ej. 17.8"
                      value={Number.isFinite(field.value as any) ? String(field.value) : ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="factor_recipiente"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs leading-tight min-h-[40px] flex items-end">Factor recipiente</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      placeholder="ej. 1007"
                      value={Number.isFinite(field.value as any) ? String(field.value) : ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="masa_unitaria"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Resultado (kg/m³)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" value={Number.isFinite(field.value as any) ? String(field.value) : ""} readOnly className="bg-gray-50" />
                </FormControl>
                <FormDescription>Esperado 2100–2500. Rango válido 1500–3000 kg/m³.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormItem>
      </div>

      <FormField
        control={form.control}
        name="temperatura_ambiente"
        render={({ field }) => (
          <FormItem className="md:col-span-6">
            <FormLabel className="flex items-center gap-1">
              Temperatura Ambiente (°C)
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Info className="h-4 w-4 text-gray-400" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Recomendado 10–35°C. Válido de -10 a 60°C.</TooltipContent>
              </Tooltip>
            </FormLabel>
            <FormControl>
              <Input type="number" step="0.1" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
            </FormControl>
            <FormDescription>Rango recomendado 10–35°C (válido -10 a 60°C).</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="temperatura_concreto"
        render={({ field }) => (
          <FormItem className="md:col-span-6">
            <FormLabel className="flex items-center gap-1">
              Temperatura del Concreto (°C)
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Info className="h-4 w-4 text-gray-400" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Recomendado 10–35°C al muestreo. Válido 5–60°C.</TooltipContent>
              </Tooltip>
            </FormLabel>
            <FormControl>
              <Input type="number" step="0.1" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
            </FormControl>
            <FormDescription>Rango recomendado 10–35°C (válido 5–60°C).</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}


