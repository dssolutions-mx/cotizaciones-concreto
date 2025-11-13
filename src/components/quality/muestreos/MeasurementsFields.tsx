"use client";

import React, { useState } from "react";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

type Props = {
  form: any;
};

export default function MeasurementsFields({ form }: Props) {
  // Local state to track raw input strings while typing
  const [revenimientoInput, setRevenimientoInput] = useState<string>("");
  const [pesoVacioInput, setPesoVacioInput] = useState<string>("");
  const [pesoLlenoInput, setPesoLlenoInput] = useState<string>("");
  const [factorInput, setFactorInput] = useState<string>("");
  const [tempAmbienteInput, setTempAmbienteInput] = useState<string>("");
  const [tempConcretoInput, setTempConcretoInput] = useState<string>("");
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
      <FormField
        control={form.control}
        name="revenimiento_sitio"
        render={({ field }) => {
          const displayValue = revenimientoInput !== "" ? revenimientoInput : (field.value != null ? String(field.value) : "");
          return (
            <FormItem className="md:col-span-6">
              <FormLabel>
                Revenimiento en Sitio (cm)
              </FormLabel>
              <FormControl>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={displayValue}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    // Allow empty string, single dot, or valid decimal numbers
                    if (rawValue === '' || rawValue === '.' || /^-?\d*\.?\d*$/.test(rawValue)) {
                      setRevenimientoInput(rawValue);
                    }
                  }}
                  onBlur={(e) => {
                    const rawValue = e.target.value;
                    const numValue = rawValue === '' || rawValue === '.' 
                      ? undefined 
                      : parseFloat(rawValue);
                    const finalValue = isNaN(numValue as number) ? undefined : numValue;
                    field.onChange(finalValue);
                    setRevenimientoInput(finalValue != null ? String(finalValue) : "");
                    field.onBlur();
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
            <FormField
              control={form.control}
              name="peso_recipiente_vacio"
              render={({ field }) => {
                const displayValue = pesoVacioInput !== "" ? pesoVacioInput : (field.value != null ? String(field.value) : "");
                return (
                  <FormItem>
                    <FormLabel className="text-xs leading-tight">Recipiente vacío (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="ej. 12.5"
                        value={displayValue}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          // Allow empty string, single dot, or valid decimal numbers
                          if (rawValue === '' || rawValue === '.' || /^-?\d*\.?\d*$/.test(rawValue)) {
                            setPesoVacioInput(rawValue);
                          }
                        }}
                        onBlur={(e) => {
                          const rawValue = e.target.value;
                          const numValue = rawValue === '' || rawValue === '.' 
                            ? undefined 
                            : parseFloat(rawValue);
                          const finalValue = isNaN(numValue as number) ? undefined : numValue;
                          field.onChange(finalValue);
                          setPesoVacioInput(finalValue != null ? String(finalValue) : "");
                          field.onBlur();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              control={form.control}
              name="peso_recipiente_lleno"
              render={({ field }) => {
                const displayValue = pesoLlenoInput !== "" ? pesoLlenoInput : (field.value != null ? String(field.value) : "");
                return (
                  <FormItem>
                    <FormLabel className="text-xs leading-tight">Recipiente lleno (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="ej. 17.8"
                        value={displayValue}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          // Allow empty string, single dot, or valid decimal numbers
                          if (rawValue === '' || rawValue === '.' || /^-?\d*\.?\d*$/.test(rawValue)) {
                            setPesoLlenoInput(rawValue);
                          }
                        }}
                        onBlur={(e) => {
                          const rawValue = e.target.value;
                          const numValue = rawValue === '' || rawValue === '.' 
                            ? undefined 
                            : parseFloat(rawValue);
                          const finalValue = isNaN(numValue as number) ? undefined : numValue;
                          field.onChange(finalValue);
                          setPesoLlenoInput(finalValue != null ? String(finalValue) : "");
                          field.onBlur();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              control={form.control}
              name="factor_recipiente"
              render={({ field }) => {
                const displayValue = factorInput !== "" ? factorInput : (field.value != null ? String(field.value) : "");
                return (
                  <FormItem>
                    <FormLabel className="text-xs leading-tight">Factor recipiente</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="ej. 1007"
                        value={displayValue}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          // Allow empty string, single dot, or valid decimal numbers
                          if (rawValue === '' || rawValue === '.' || /^-?\d*\.?\d*$/.test(rawValue)) {
                            setFactorInput(rawValue);
                          }
                        }}
                        onBlur={(e) => {
                          const rawValue = e.target.value;
                          const numValue = rawValue === '' || rawValue === '.' 
                            ? undefined 
                            : parseFloat(rawValue);
                          const finalValue = isNaN(numValue as number) ? undefined : numValue;
                          field.onChange(finalValue);
                          setFactorInput(finalValue != null ? String(finalValue) : "");
                          field.onBlur();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
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
                <FormMessage />
              </FormItem>
            )}
          />
        </FormItem>
      </div>

      <FormField
        control={form.control}
        name="temperatura_ambiente"
        render={({ field }) => {
          const displayValue = tempAmbienteInput !== "" ? tempAmbienteInput : (field.value != null ? String(field.value) : "");
          return (
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
                <Input
                  type="text"
                  inputMode="decimal"
                  value={displayValue}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    // Allow empty string, single dot, or valid decimal numbers (including negative)
                    if (rawValue === '' || rawValue === '.' || rawValue === '-' || /^-?\d*\.?\d*$/.test(rawValue)) {
                      setTempAmbienteInput(rawValue);
                    }
                  }}
                  onBlur={(e) => {
                    const rawValue = e.target.value;
                    const numValue = rawValue === '' || rawValue === '.' || rawValue === '-'
                      ? undefined 
                      : parseFloat(rawValue);
                    const finalValue = isNaN(numValue as number) ? undefined : numValue;
                    field.onChange(finalValue);
                    setTempAmbienteInput(finalValue != null ? String(finalValue) : "");
                    field.onBlur();
                  }}
                />
              </FormControl>
              <FormDescription>Rango recomendado 10–35°C (válido -10 a 60°C).</FormDescription>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      <FormField
        control={form.control}
        name="temperatura_concreto"
        render={({ field }) => {
          const displayValue = tempConcretoInput !== "" ? tempConcretoInput : (field.value != null ? String(field.value) : "");
          return (
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
                <Input
                  type="text"
                  inputMode="decimal"
                  value={displayValue}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    // Allow empty string, single dot, or valid decimal numbers (including negative)
                    if (rawValue === '' || rawValue === '.' || rawValue === '-' || /^-?\d*\.?\d*$/.test(rawValue)) {
                      setTempConcretoInput(rawValue);
                    }
                  }}
                  onBlur={(e) => {
                    const rawValue = e.target.value;
                    const numValue = rawValue === '' || rawValue === '.' || rawValue === '-'
                      ? undefined 
                      : parseFloat(rawValue);
                    const finalValue = isNaN(numValue as number) ? undefined : numValue;
                    field.onChange(finalValue);
                    setTempConcretoInput(finalValue != null ? String(finalValue) : "");
                    field.onBlur();
                  }}
                />
              </FormControl>
              <FormDescription>Rango recomendado 10–35°C (válido 5–60°C).</FormDescription>
              <FormMessage />
            </FormItem>
          );
        }}
      />
    </div>
  );
}


