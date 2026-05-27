'use client';

import React, { useState } from 'react';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Plus } from 'lucide-react';
import FieldMeasurandBlock from '@/components/quality/muestreos/FieldMeasurandBlock';
import { MEASURAND_META, roundMeasurandAverage } from '@/lib/quality/muestreoFieldMeasurements';
import type { MuestreoFieldMeasurandCodigo, MuestreoMedicionCampoInput } from '@/types/muestreoFieldMeasurement';

type FormLike = {
  control: unknown;
  getValues: (name?: string) => Record<string, unknown>;
  setValue: (name: string, value: unknown, opts?: { shouldValidate?: boolean; shouldDirty?: boolean }) => void;
};

type Props = {
  codigo: MuestreoFieldMeasurandCodigo;
  form?: FormLike;
  scalarValue?: number | null;
  onScalarChange?: (value: number | undefined) => void;
  multiRows: MuestreoMedicionCampoInput[];
  onMultiRowsChange: (rows: MuestreoMedicionCampoInput[]) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  className?: string;
};

function decimalInputProps(allowNegative = false) {
  const re = allowNegative ? /^-?\d*\.?\d*$/ : /^-?\d*\.?\d*$/;
  return {
    test: (raw: string) =>
      raw === '' || raw === '.' || (allowNegative && (raw === '-' || raw === '-.')) || re.test(raw),
    parse: (raw: string) => {
      if (raw === '' || raw === '.' || raw === '-' || raw === '-.') return undefined;
      const n = parseFloat(raw);
      return Number.isNaN(n) ? undefined : n;
    },
  };
}

function MeasurandLabel({ codigo }: { codigo: MuestreoFieldMeasurandCodigo }) {
  const meta = MEASURAND_META[codigo];
  switch (codigo) {
    case 'REV':
      return <FormLabel>Revenimiento en sitio ({meta.unidad})</FormLabel>;
    case 'TEMP':
      return (
        <FormLabel className="flex items-center gap-1">
          Temperatura del concreto ({meta.unidad})
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Info className="h-4 w-4 text-stone-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Recomendado 10–35°C al muestreo. Válido 5–60°C.</TooltipContent>
          </Tooltip>
        </FormLabel>
      );
    case 'TEMP_AMB':
      return (
        <FormLabel className="flex items-center gap-1">
          Temperatura ambiente ({meta.unidad})
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Info className="h-4 w-4 text-stone-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Recomendado 10–35°C. Válido de -10 a 60°C.</TooltipContent>
          </Tooltip>
        </FormLabel>
      );
    case 'AIRE':
      return (
        <FormLabel className="flex items-center gap-1">
          Contenido de aire ({meta.unidad})
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Info className="h-4 w-4 text-stone-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Opcional. Rango válido 0–100%.</TooltipContent>
          </Tooltip>
        </FormLabel>
      );
    default:
      return <FormLabel>{meta.label}</FormLabel>;
  }
}

function ScalarInput({
  codigo,
  value,
  onChange,
  allowNegative,
}: {
  codigo: MuestreoFieldMeasurandCodigo;
  value: number | null | undefined;
  onChange: (v: number | undefined) => void;
  allowNegative?: boolean;
}) {
  const [raw, setRaw] = useState('');
  const { test, parse } = decimalInputProps(allowNegative);
  const display = raw !== '' ? raw : value != null ? String(value) : '';
  const optional = codigo === 'AIRE';

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={optional ? 'Opcional' : undefined}
      value={display}
      onChange={(e) => {
        const v = e.target.value;
        if (test(v)) setRaw(v);
      }}
      onBlur={() => {
        const finalValue = parse(raw !== '' ? raw : display);
        onChange(finalValue);
        setRaw(finalValue != null ? String(finalValue) : '');
      }}
    />
  );
}

export default function FieldMeasurandInput({
  codigo,
  form,
  scalarValue,
  onScalarChange,
  multiRows,
  onMultiRowsChange,
  expanded,
  onExpandedChange,
  className,
}: Props) {
  const meta = MEASURAND_META[codigo];
  const column = meta.muestreoColumn;
  const allowNegative = codigo === 'TEMP' || codigo === 'TEMP_AMB';

  const readScalar = (): number | undefined => {
    if (form) {
      const v = form.getValues(column);
      return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
    }
    if (scalarValue != null && !Number.isNaN(scalarValue)) return Number(scalarValue);
    return undefined;
  };

  const writeScalar = (v: number | undefined) => {
    if (form) {
      form.setValue(column, v, { shouldValidate: true, shouldDirty: true });
    }
    onScalarChange?.(v);
  };

  const startMulti = () => {
    const current = readScalar();
    onMultiRowsChange([
      {
        measurand_codigo: codigo,
        secuencia: 1,
        motivo: null,
        valor: current ?? 0,
        unidad: meta.unidad,
      },
      {
        measurand_codigo: codigo,
        secuencia: 2,
        motivo: null,
        valor: 0,
        unidad: meta.unidad,
      },
    ]);
    onExpandedChange(true);
  };

  const collapseToSingle = () => {
    const values = multiRows.map((r) => Number(r.valor)).filter((v) => Number.isFinite(v));
    const single =
      values.length > 0 ? roundMeasurandAverage(codigo, values) ?? values[0] : undefined;
    writeScalar(single);
    onMultiRowsChange([]);
    onExpandedChange(false);
  };

  if (expanded) {
    const values = multiRows.map((r) => Number(r.valor)).filter((v) => Number.isFinite(v));
    const promedio = roundMeasurandAverage(codigo, values);

    return (
      <div className={className}>
        <FieldMeasurandBlock
          codigo={codigo}
          rows={multiRows}
          onChange={onMultiRowsChange}
        />
        {promedio != null && multiRows.length > 1 ? (
          <p className="text-xs text-sky-800 font-medium mt-2">
            Promedio registrado: {promedio} {meta.unidad}
          </p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 mt-2 text-stone-600"
          onClick={collapseToSingle}
        >
          Usar un solo valor
        </Button>
      </div>
    );
  }

  const simpleControl = form ? (
    <FormField
      control={form.control as never}
      name={column}
      render={({ field }) => (
        <FormItem>
          <MeasurandLabel codigo={codigo} />
          <FormControl>
            <ScalarInput
              codigo={codigo}
              value={field.value as number | undefined}
              onChange={(v) => field.onChange(v)}
              allowNegative={allowNegative}
            />
          </FormControl>
          {codigo === 'TEMP' || codigo === 'TEMP_AMB' ? (
            <FormDescription>
              {codigo === 'TEMP'
                ? 'Rango recomendado 10–35°C (válido 5–60°C).'
                : 'Rango recomendado 10–35°C (válido -10 a 60°C).'}
            </FormDescription>
          ) : codigo === 'AIRE' ? (
            <FormDescription>Opcional. Rango válido 0–100%.</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  ) : (
    <FormItem>
      <MeasurandLabel codigo={codigo} />
      <FormControl>
        <ScalarInput
          codigo={codigo}
          value={scalarValue}
          onChange={writeScalar}
          allowNegative={allowNegative}
        />
      </FormControl>
    </FormItem>
  );

  return (
    <div className={className}>
      {simpleControl}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 mt-1 px-0 text-stone-600 hover:text-stone-900"
        onClick={startMulti}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Agregar otra lectura
      </Button>
    </div>
  );
}
