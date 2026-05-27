"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import FieldMeasurandInput from "@/components/quality/muestreos/FieldMeasurandInput";
import FieldMeasurandBlock from "@/components/quality/muestreos/FieldMeasurandBlock";
import {
  buildMedicionesPayload,
  computeScalarPatchFromMediciones,
  MEASURAND_META,
  roundMeasurandAverage,
} from "@/lib/quality/muestreoFieldMeasurements";
import { formatDecimalDisplay as formatDecimal } from "@/lib/quality/decimalFieldInput";
import type { MuestreoFieldMeasurandCodigo, MuestreoMedicionCampoInput } from "@/types/muestreoFieldMeasurement";

type Props = {
  form: {
    control: unknown;
    watch: (name: string) => unknown;
    getValues: (name?: string) => Record<string, unknown>;
    setValue: (name: string, value: unknown, opts?: { shouldValidate?: boolean; shouldDirty?: boolean }) => void;
  };
};

export type MeasurementsFieldsHandle = {
  buildMedicionesPayload: () => MuestreoMedicionCampoInput[];
};

const SIMPLE_MEASURANDS: MuestreoFieldMeasurandCodigo[] = ["REV", "TEMP", "AIRE", "TEMP_AMB"];

const MeasurementsFields = forwardRef<MeasurementsFieldsHandle, Props>(function MeasurementsFields(
  { form },
  ref,
) {
  const [pesoVacioInput, setPesoVacioInput] = useState<string>("");
  const [pesoLlenoInput, setPesoLlenoInput] = useState<string>("");
  const [factorInput, setFactorInput] = useState<string>("");

  const [mediciones, setMediciones] = useState<MuestreoMedicionCampoInput[]>([]);
  const [expandedCodigos, setExpandedCodigos] = useState<Set<MuestreoFieldMeasurandCodigo>>(new Set());
  const [muExpanded, setMuExpanded] = useState(false);

  const setRowsForCodigo = (codigo: MuestreoFieldMeasurandCodigo, rows: MuestreoMedicionCampoInput[]) => {
    setMediciones((prev) => [...prev.filter((r) => r.measurand_codigo !== codigo), ...rows]);
  };

  const getRows = (codigo: MuestreoFieldMeasurandCodigo) =>
    mediciones.filter((r) => r.measurand_codigo === codigo);

  const setExpanded = (codigo: MuestreoFieldMeasurandCodigo, on: boolean) => {
    setExpandedCodigos((prev) => {
      const next = new Set(prev);
      if (on) next.add(codigo);
      else next.delete(codigo);
      return next;
    });
  };

  const multiMediciones = useMemo(
    () => mediciones.filter((m) => expandedCodigos.has(m.measurand_codigo) || (m.measurand_codigo === "MU" && muExpanded)),
    [mediciones, expandedCodigos, muExpanded],
  );

  useImperativeHandle(
    ref,
    () => ({
      buildMedicionesPayload: () =>
        buildMedicionesPayload(form.getValues() as Record<string, unknown>, {
          mediciones,
          expandedCodigos,
          muExpanded,
        }),
    }),
    [form, mediciones, expandedCodigos, muExpanded],
  );

  useEffect(() => {
    form.setValue("mediciones_campo", multiMediciones, { shouldDirty: true });
    const patch = computeScalarPatchFromMediciones(multiMediciones);
    for (const codigo of expandedCodigos) {
      const col = MEASURAND_META[codigo].muestreoColumn;
      const next = patch[col];
      if (next !== undefined) {
        form.setValue(col, next, { shouldValidate: true, shouldDirty: true });
      }
    }
    if (muExpanded) {
      const next = patch.masa_unitaria;
      if (next !== undefined) {
        form.setValue("masa_unitaria", next, { shouldValidate: true, shouldDirty: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiMediciones, expandedCodigos, muExpanded]);

  const pesoVacio = form.watch("peso_recipiente_vacio");
  const pesoLleno = form.watch("peso_recipiente_lleno");
  const factorRecipiente = form.watch("factor_recipiente");
  const masaUnitaria = form.watch("masa_unitaria");

  const startMuMulti = () => {
    const mu = typeof masaUnitaria === "number" ? masaUnitaria : null;
    if (mu == null || !Number.isFinite(mu)) return;
    const motivoParts: string[] = [];
    if (typeof pesoVacio === "number" && typeof pesoLleno === "number") {
      motivoParts.push(`Recipiente ${pesoVacio}–${pesoLleno} kg`);
    }
    setRowsForCodigo("MU", [
      {
        measurand_codigo: "MU",
        secuencia: 1,
        motivo: motivoParts.join(" ") || null,
        valor: mu,
        unidad: MEASURAND_META.MU.unidad,
      },
      {
        measurand_codigo: "MU",
        secuencia: 2,
        motivo: null,
        valor: NaN,
        unidad: MEASURAND_META.MU.unidad,
      },
    ]);
    setMuExpanded(true);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
      {SIMPLE_MEASURANDS.map((codigo) => (
        <div key={codigo} className="md:col-span-6">
          <FieldMeasurandInput
            codigo={codigo}
            form={form}
            multiRows={getRows(codigo)}
            onMultiRowsChange={(rows) => setRowsForCodigo(codigo, rows)}
            expanded={expandedCodigos.has(codigo)}
            onExpandedChange={(on) => setExpanded(codigo, on)}
          />
        </div>
      ))}

      <div className="space-y-2 md:col-span-12">
        <FormItem>
          <FormLabel className="flex items-center gap-1">
            Masa unitaria (kg/m³)
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Info className="h-4 w-4 text-stone-400" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Ingresa los pesos y el factor del recipiente; calculamos la masa unitaria.</TooltipContent>
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
                <FormLabel className="text-xs">Resultado (kg/m³)</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    readOnly
                    className="bg-stone-50 max-w-xs font-mono"
                    value={
                      Number.isFinite(field.value as number)
                        ? formatDecimal(field.value as number, MEASURAND_META.MU.decimals)
                        : ""
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {!muExpanded ? (
            <button
              type="button"
              className="text-sm text-stone-600 hover:text-stone-900 mt-2 inline-flex items-center"
              onClick={startMuMulti}
            >
              + Agregar otra lectura de masa unitaria
            </button>
          ) : (
            <div className="mt-4">
              <FieldMeasurandBlock
                codigo="MU"
                rows={getRows("MU")}
                onChange={(rows) => setRowsForCodigo("MU", rows)}
              />
              <button
                type="button"
                className="text-sm text-stone-600 hover:text-stone-900 mt-2"
                onClick={() => {
                  const rows = getRows("MU");
                  const values = rows.map((r) => Number(r.valor)).filter((v) => Number.isFinite(v));
                  const single = roundMeasurandAverage("MU", values);
                  if (single != null) {
                    form.setValue("masa_unitaria", single, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }
                  setRowsForCodigo("MU", []);
                  setMuExpanded(false);
                }}
              >
                Usar un solo valor
              </button>
            </div>
          )}
        </FormItem>
      </div>
    </div>
  );
});

export default MeasurementsFields;
