"use client";

import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import FieldMeasurandBlock from "@/components/quality/muestreos/FieldMeasurandBlock";
import {
  computeScalarPatchFromMediciones,
  MEASURAND_META,
  scalarsToMedicionInputs,
} from "@/lib/quality/muestreoFieldMeasurements";
import type { MuestreoFieldMeasurandCodigo, MuestreoMedicionCampoInput } from "@/types/muestreoFieldMeasurement";

type Props = {
  form: {
    control: unknown;
    watch: (name: string) => unknown;
    getValues: (name?: string) => Record<string, unknown>;
    setValue: (name: string, value: unknown, opts?: { shouldValidate?: boolean; shouldDirty?: boolean }) => void;
  };
};

const SIMPLE_MEASURANDS: MuestreoFieldMeasurandCodigo[] = ["REV", "TEMP", "AIRE", "TEMP_AMB"];

export default function MeasurementsFields({ form }: Props) {
  const [pesoVacioInput, setPesoVacioInput] = useState<string>("");
  const [pesoLlenoInput, setPesoLlenoInput] = useState<string>("");
  const [factorInput, setFactorInput] = useState<string>("");

  const [mediciones, setMediciones] = useState<MuestreoMedicionCampoInput[]>(() => {
    const v = form.getValues();
    return scalarsToMedicionInputs({
      revenimiento_sitio: v.revenimiento_sitio as number | null | undefined,
      temperatura_concreto: v.temperatura_concreto as number | null | undefined,
      masa_unitaria: v.masa_unitaria as number | null | undefined,
      contenido_aire: v.contenido_aire as number | null | undefined,
      temperatura_ambiente: v.temperatura_ambiente as number | null | undefined,
    });
  });

  useEffect(() => {
    form.setValue("mediciones_campo", mediciones, { shouldDirty: true });
    const patch = computeScalarPatchFromMediciones(mediciones);
    for (const codigo of Object.keys(MEASURAND_META) as MuestreoFieldMeasurandCodigo[]) {
      const col = MEASURAND_META[codigo].muestreoColumn;
      const next = patch[col] ?? undefined;
      const current = form.getValues(col);
      if (current !== next) {
        form.setValue(col, next, { shouldValidate: true, shouldDirty: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync scalars when mediciones change
  }, [mediciones]);

  const setRowsForCodigo = (codigo: MuestreoFieldMeasurandCodigo, rows: MuestreoMedicionCampoInput[]) => {
    setMediciones((prev) => [...prev.filter((r) => r.measurand_codigo !== codigo), ...rows]);
  };

  const getRows = (codigo: MuestreoFieldMeasurandCodigo) =>
    mediciones.filter((r) => r.measurand_codigo === codigo);

  const pesoVacio = form.watch("peso_recipiente_vacio");
  const pesoLleno = form.watch("peso_recipiente_lleno");
  const factorRecipiente = form.watch("factor_recipiente");
  const masaUnitaria = form.watch("masa_unitaria");

  const addMuReading = () => {
    const mu = typeof masaUnitaria === "number" ? masaUnitaria : null;
    if (mu == null || !Number.isFinite(mu)) return;
    const motivoParts: string[] = [];
    if (typeof pesoVacio === "number" && typeof pesoLleno === "number") {
      motivoParts.push(`Recipiente ${pesoVacio}–${pesoLleno} kg`);
    }
    const existing = getRows("MU");
    setRowsForCodigo("MU", [
      ...existing,
      {
        measurand_codigo: "MU",
        secuencia: existing.length + 1,
        motivo: motivoParts.join(" ") || null,
        valor: mu,
        unidad: MEASURAND_META.MU.unidad,
      },
    ]);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
      {SIMPLE_MEASURANDS.map((codigo) => (
        <div key={codigo} className="md:col-span-6">
          <FieldMeasurandBlock
            codigo={codigo}
            rows={getRows(codigo)}
            onChange={(rows) => setRowsForCodigo(codigo, rows)}
          />
        </div>
      ))}

      <div className="space-y-2 md:col-span-12">
        <FormItem>
          <FormLabel className="flex items-center gap-1">
            Masa Unitaria (kg/m³)
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Info className="h-4 w-4 text-stone-400" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Calcula con el recipiente y registra cada lectura en la tabla.
              </TooltipContent>
            </Tooltip>
          </FormLabel>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
            <FormField
              control={form.control as never}
              name="peso_recipiente_vacio"
              render={({ field }) => {
                const displayValue =
                  pesoVacioInput !== "" ? pesoVacioInput : field.value != null ? String(field.value) : "";
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
                          if (rawValue === "" || rawValue === "." || /^-?\d*\.?\d*$/.test(rawValue)) {
                            setPesoVacioInput(rawValue);
                          }
                        }}
                        onBlur={(e) => {
                          const rawValue = e.target.value;
                          const numValue =
                            rawValue === "" || rawValue === "." ? undefined : parseFloat(rawValue);
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
              control={form.control as never}
              name="peso_recipiente_lleno"
              render={({ field }) => {
                const displayValue =
                  pesoLlenoInput !== "" ? pesoLlenoInput : field.value != null ? String(field.value) : "";
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
                          if (rawValue === "" || rawValue === "." || /^-?\d*\.?\d*$/.test(rawValue)) {
                            setPesoLlenoInput(rawValue);
                          }
                        }}
                        onBlur={(e) => {
                          const rawValue = e.target.value;
                          const numValue =
                            rawValue === "" || rawValue === "." ? undefined : parseFloat(rawValue);
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
              control={form.control as never}
              name="factor_recipiente"
              render={({ field }) => {
                const displayValue =
                  factorInput !== "" ? factorInput : field.value != null ? String(field.value) : "";
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
                          if (rawValue === "" || rawValue === "." || /^-?\d*\.?\d*$/.test(rawValue)) {
                            setFactorInput(rawValue);
                          }
                        }}
                        onBlur={(e) => {
                          const rawValue = e.target.value;
                          const numValue =
                            rawValue === "" || rawValue === "." ? undefined : parseFloat(rawValue);
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
            control={form.control as never}
            name="masa_unitaria"
            render={({ field }) => (
              <FormItem className="mt-2">
                <FormLabel className="text-xs">Resultado calculado (kg/m³)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.1"
                    value={Number.isFinite(field.value as number) ? String(field.value) : ""}
                    readOnly
                    className="bg-stone-50 max-w-xs"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={addMuReading}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Agregar lectura de MU
            </Button>
          </div>
          <div className="mt-4">
            <FieldMeasurandBlock codigo="MU" rows={getRows("MU")} onChange={(rows) => setRowsForCodigo("MU", rows)} />
          </div>
        </FormItem>
      </div>
    </div>
  );
}

export function buildMedicionesPayloadFromForm(
  values: Record<string, unknown>,
): MuestreoMedicionCampoInput[] {
  const fromField = values.mediciones_campo as MuestreoMedicionCampoInput[] | undefined;
  if (Array.isArray(fromField) && fromField.length > 0) return fromField;
  return scalarsToMedicionInputs({
    revenimiento_sitio: values.revenimiento_sitio as number | null | undefined,
    temperatura_concreto: values.temperatura_concreto as number | null | undefined,
    masa_unitaria: values.masa_unitaria as number | null | undefined,
    contenido_aire: values.contenido_aire as number | null | undefined,
    temperatura_ambiente: values.temperatura_ambiente as number | null | undefined,
  });
}
