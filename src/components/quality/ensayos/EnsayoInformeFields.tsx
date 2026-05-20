'use client';

import React from 'react';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CAPPING_TYPES = [
  { value: 'placas_no_adheridas', label: 'Placas no adheridas' },
  { value: 'otro', label: 'Otro' },
] as const;

const CAPPING_NORMAS = [
  { value: 'NMX-C-469', label: 'NMX-C-469' },
  { value: 'NA', label: 'N/A' },
] as const;

type Props = {
  form: { control: unknown };
};

/** §5 lab conditions for ISO 7.8 informe — captured at ensayo registration. */
export default function EnsayoInformeFields({ form }: Props) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/60 p-4 space-y-4">
      <p className="text-sm font-medium text-stone-800">Condiciones de laboratorio (informe ISO 7.8)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          control={form.control as never}
          name="temp_laboratorio_c"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-stone-700">Temperatura lab (°C)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.1"
                  className="h-9 border-stone-300 bg-white"
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control as never}
          name="humedad_relativa_lab"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-stone-700">Humedad relativa lab (%)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.1"
                  className="h-9 border-stone-300 bg-white"
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control as never}
          name="capping_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-stone-700">Tipo de capado</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ''}>
                <FormControl>
                  <SelectTrigger className="h-9 border-stone-300 bg-white">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CAPPING_TYPES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control as never}
          name="capping_norma"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-stone-700">Norma de capado</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ''}>
                <FormControl>
                  <SelectTrigger className="h-9 border-stone-300 bg-white">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CAPPING_NORMAS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
