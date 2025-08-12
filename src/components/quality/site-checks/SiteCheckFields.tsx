"use client";

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { SiteCheckFormInput } from './siteCheckSchema';

type Plant = { id: string; name: string };

type Props = {
  form: UseFormReturn<SiteCheckFormInput>;
  mode: 'linked' | 'manual';
  plants: Plant[];
};

export default function SiteCheckFields({ form, mode, plants }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
      {/* Número de remisión */}
      <FormField
        control={form.control}
        name="remision_number_manual"
        render={({ field }) => (
          <FormItem className="md:col-span-4">
            <FormLabel>Número de remisión</FormLabel>
            <FormControl>
              <Input value={field.value ?? ''} onChange={field.onChange} placeholder="Ej. 123456" readOnly={mode === 'linked'} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Planta */}
      <FormField
        control={form.control}
        name="plant_id"
        render={({ field }) => (
          <FormItem className="md:col-span-4">
            <FormLabel>Planta</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la planta" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {plants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Fecha de muestreo */}
      <FormField
        control={form.control}
        name="fecha_muestreo"
        render={({ field }) => (
          <FormItem className="md:col-span-4">
            <FormLabel>Fecha de muestreo</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                  >
                    {field.value ? (
                      format(field.value, 'PPP', { locale: es })
                    ) : (
                      <span>Seleccionar fecha</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Horas */}
      <FormField
        control={form.control}
        name="hora_salida_planta"
        render={({ field }) => (
          <FormItem className="md:col-span-6">
            <FormLabel className="flex items-center justify-between">
              <span>Salida de planta (hora)</span>
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => {
                  const now = new Date();
                  const hh = String(now.getHours()).padStart(2, '0');
                  const mm = String(now.getMinutes()).padStart(2, '0');
                  field.onChange(`${hh}:${mm}`);
                }}
              >
                Ahora
              </button>
            </FormLabel>
            <FormControl>
              <Input type="time" value={field.value ?? ''} onChange={field.onChange} />
            </FormControl>
            <FormDescription>Formato 24 h, ej. 18:00</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="hora_llegada_obra"
        render={({ field }) => (
          <FormItem className="md:col-span-6">
            <FormLabel className="flex items-center justify-between">
              <span>Llegada a obra (hora)</span>
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => {
                  const now = new Date();
                  const hh = String(now.getHours()).padStart(2, '0');
                  const mm = String(now.getMinutes()).padStart(2, '0');
                  field.onChange(`${hh}:${mm}`);
                }}
              >
                Ahora
              </button>
            </FormLabel>
            <FormControl>
              <Input type="time" value={field.value ?? ''} onChange={field.onChange} />
            </FormControl>
            <FormDescription>Formato 24 h, ej. 18:00</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Tipo y valores */}
      <FormField
        control={form.control}
        name="test_type"
        render={({ field }) => (
          <FormItem className="md:col-span-4">
            <FormLabel>Tipo de prueba</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="SLUMP">Revenimiento (cm)</SelectItem>
                <SelectItem value="EXTENSIBILIDAD">Extensibilidad (cm)</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="valor_inicial_cm"
        render={({ field }) => (
          <FormItem className="md:col-span-4">
            <FormLabel>Medición inicial (cm)</FormLabel>
            <FormControl>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="fue_ajustado"
        render={({ field }) => (
          <FormItem className="md:col-span-4">
            <FormLabel>¿Se realizó ajuste?</FormLabel>
            <Select value={String(field.value)} onValueChange={(v) => field.onChange(v === 'true')}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Sí</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {form.watch('fue_ajustado') && (
        <>
          <FormField
            control={form.control}
            name="detalle_ajuste"
            render={({ field }) => (
              <FormItem className="md:col-span-8">
                <FormLabel>Detalle del ajuste</FormLabel>
                <FormControl>
              <Input value={field.value ?? ''} onChange={field.onChange} placeholder="Ej. Se agregó agua/plastificante" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="valor_final_cm"
            render={({ field }) => (
              <FormItem className="md:col-span-4">
                <FormLabel>Medición final (cm)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      {/* Temperaturas */}
      <FormField
        control={form.control}
        name="temperatura_ambiente"
        render={({ field }) => (
          <FormItem className="md:col-span-6">
            <FormLabel>Temperatura ambiente (°C)</FormLabel>
            <FormControl>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="temperatura_concreto"
        render={({ field }) => (
          <FormItem className="md:col-span-6">
            <FormLabel>Temperatura del concreto (°C)</FormLabel>
            <FormControl>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Observaciones */}
      <FormField
        control={form.control}
        name="observaciones"
        render={({ field }) => (
          <FormItem className="md:col-span-12">
            <FormLabel>Observaciones del colado</FormLabel>
            <FormControl>
              <Input value={field.value ?? ''} onChange={field.onChange} placeholder="Comentarios" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}


