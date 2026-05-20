'use client';

import React from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  form: { control: unknown };
};

export default function InformeAccreditedFields({ form }: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-stone-200 bg-stone-50/50">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-stone-800">
        Datos para informe acreditado (ISO 7.8)
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-4">
        <FormField
          control={form.control as never}
          name="muestreado_por"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Muestreado por</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value ?? 'LABORATORIO'}
                  className="flex gap-4"
                >
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="LABORATORIO" />
                    </FormControl>
                    <FormLabel className="font-normal">Laboratorio</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="CLIENTE" />
                    </FormControl>
                    <FormLabel className="font-normal">Cliente</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control as never}
            name="fecha_recepcion_lab"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha recepción en laboratorio</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control as never}
            name="humedad_relativa_obra"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Humedad relativa en obra (%)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.1"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control as never}
          name="condiciones_climaticas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Condiciones climáticas</FormLabel>
              <FormControl>
                <Input placeholder="ej. Soleado, nublado…" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control as never}
          name="ubicacion_detalle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Detalle de ubicación en obra</FormLabel>
              <FormControl>
                <Input placeholder="Opcional — complementa GPS / obra" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
