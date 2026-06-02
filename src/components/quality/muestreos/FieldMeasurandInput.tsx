'use client';

import React from 'react';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import DecimalFieldInput from '@/components/quality/muestreos/DecimalFieldInput';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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

function MeasurandLabelContent({ codigo }: { codigo: MuestreoFieldMeasurandCodigo }) {
  const meta = MEASURAND_META[codigo];
  switch (codigo) {
    case 'REV':
      return <>Revenimiento en sitio ({meta.unidad})</>;
    case 'TEMP':
      return (
        <>
          Temperatura del concreto ({meta.unidad})
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Info className="h-4 w-4 text-stone-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Recomendado 10–35°C al muestreo. Válido 5–60°C.</TooltipContent>
          </Tooltip>
        </>
      );
    case 'TEMP_AMB':
      return (
        <>
          Temperatura ambiente ({meta.unidad})
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Info className="h-4 w-4 text-stone-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Recomendado 10–35°C. Válido de -10 a 60°C.</TooltipContent>
          </Tooltip>
        </>
      );
    case 'AIRE':
      return (
        <>
          Contenido de aire ({meta.unidad})
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Info className="h-4 w-4 text-stone-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Opcional. Rango válido 0–100%.</TooltipContent>
          </Tooltip>
        </>
      );
    default:
      return <>{meta.label}</>;
  }
}

const measurandLabelClass = (codigo: MuestreoFieldMeasurandCodigo) =>
  cn(codigo === 'TEMP' || codigo === 'TEMP_AMB' || codigo === 'AIRE' ? 'flex items-center gap-1' : undefined);

function MeasurandFormLabel({ codigo }: { codigo: MuestreoFieldMeasurandCodigo }) {
  return (
    <FormLabel className={measurandLabelClass(codigo)}>
      <MeasurandLabelContent codigo={codigo} />
    </FormLabel>
  );
}

function MeasurandStandaloneLabel({ codigo }: { codigo: MuestreoFieldMeasurandCodigo }) {
  return (
    <Label className={cn('text-sm font-medium leading-none', measurandLabelClass(codigo))}>
      <MeasurandLabelContent codigo={codigo} />
    </Label>
  );
}

function MeasurandFieldHint({ codigo }: { codigo: MuestreoFieldMeasurandCodigo }) {
  if (codigo === 'TEMP') {
    return <p className="text-sm text-muted-foreground">Rango recomendado 10–35°C (válido 5–60°C).</p>;
  }
  if (codigo === 'TEMP_AMB') {
    return <p className="text-sm text-muted-foreground">Rango recomendado 10–35°C (válido -10 a 60°C).</p>;
  }
  if (codigo === 'AIRE') {
    return <p className="text-sm text-muted-foreground">Opcional. Rango válido 0–100%.</p>;
  }
  return null;
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
        valor: NaN,
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
          <MeasurandFormLabel codigo={codigo} />
          <FormControl>
            <DecimalFieldInput
              value={field.value as number | undefined}
              decimals={meta.decimals}
              allowNegative={allowNegative}
              placeholder={codigo === 'AIRE' ? 'Opcional' : undefined}
              onChange={(v) => field.onChange(v)}
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
    <div className="space-y-2">
      <MeasurandStandaloneLabel codigo={codigo} />
      <DecimalFieldInput
        value={scalarValue}
        decimals={meta.decimals}
        allowNegative={allowNegative}
        placeholder={codigo === 'AIRE' ? 'Opcional' : undefined}
        onChange={writeScalar}
      />
      <MeasurandFieldHint codigo={codigo} />
    </div>
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
