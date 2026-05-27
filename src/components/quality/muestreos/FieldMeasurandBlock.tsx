'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DecimalFieldInput from '@/components/quality/muestreos/DecimalFieldInput';
import type { MuestreoFieldMeasurandCodigo, MuestreoMedicionCampoInput } from '@/types/muestreoFieldMeasurement';
import { MEASURAND_META, roundMeasurandAverage } from '@/lib/quality/muestreoFieldMeasurements';

type Props = {
  codigo: MuestreoFieldMeasurandCodigo;
  rows: MuestreoMedicionCampoInput[];
  onChange: (rows: MuestreoMedicionCampoInput[]) => void;
  className?: string;
  compact?: boolean;
};

export default function FieldMeasurandBlock({ codigo, rows, onChange, className, compact }: Props) {
  const meta = MEASURAND_META[codigo];
  const values = rows.map((r) => Number(r.valor)).filter((v) => Number.isFinite(v));
  const promedio = roundMeasurandAverage(codigo, values);

  const addRow = () => {
    onChange([
      ...rows,
      {
        measurand_codigo: codigo,
        secuencia: rows.length + 1,
        motivo: null,
        valor: NaN,
        unidad: meta.unidad,
      },
    ]);
  };

  const removeRow = (index: number) => {
    const next = rows
      .filter((_, i) => i !== index)
      .map((r, i) => ({ ...r, secuencia: i + 1 }));
    onChange(next);
  };

  const updateRow = (index: number, patch: Partial<MuestreoMedicionCampoInput>) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  return (
    <div className={className}>
      {!compact ? (
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-medium text-stone-600">{meta.label}</p>
          {promedio != null && rows.length > 1 ? (
            <p className="text-xs font-semibold text-sky-800">
              Promedio: {promedio} {meta.unidad}
            </p>
          ) : null}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="rounded-md border border-stone-200 overflow-hidden mb-2 bg-stone-50/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-left text-xs text-stone-500">
                <th className="px-2 py-1.5 font-medium">Motivo / lectura</th>
                <th className="px-2 py-1.5 font-medium w-28">
                  Valor ({meta.unidad})
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${codigo}-${index}-${row.secuencia}`} className="border-t border-stone-100 bg-white">
                  <td className="px-2 py-1">
                    <Input
                      value={row.motivo ?? ''}
                      placeholder="ej. Réplica 2"
                      className="h-8 text-sm"
                      onChange={(e) => updateRow(index, { motivo: e.target.value || null })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <DecimalFieldInput
                      value={Number.isFinite(Number(row.valor)) ? Number(row.valor) : undefined}
                      decimals={meta.decimals}
                      inputClassName="h-8 text-sm font-mono"
                      onChange={(v) => {
                        if (v === undefined) {
                          updateRow(index, { valor: NaN });
                        } else {
                          updateRow(index, { valor: v });
                        }
                      }}
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-stone-400 hover:text-red-600"
                      onClick={() => removeRow(index)}
                      aria-label="Eliminar lectura"
                      disabled={rows.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Button type="button" variant="outline" size="sm" className="h-8" onClick={addRow}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Agregar lectura
      </Button>
    </div>
  );
}
