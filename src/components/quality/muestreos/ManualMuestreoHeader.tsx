'use client';

import React from 'react';
import { FormField, FormItem, FormLabel, FormMessage, FormControl, FormDescription } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AgePlanSelector from '@/components/quality/muestreos/AgePlanSelector';
import { cn } from '@/lib/utils';

type Props = {
  form: any;
  agePlanUnit: 'days' | 'hours';
  setAgePlanUnit: (u: 'days'|'hours') => void;
  edadGarantia: number;
  setEdadGarantia: (n: number) => void;
  clasificacion: 'FC' | 'MR';
  setClasificacion: (c: 'FC'|'MR') => void;
  onHoraChange: (hhmm: string) => void;
};

export default function ManualMuestreoHeader({ form, agePlanUnit, setAgePlanUnit, edadGarantia, setEdadGarantia, clasificacion, setClasificacion, onHoraChange }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="fecha_muestreo"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Fecha de Muestreo</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                    {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Seleccionar fecha</span>}
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

      <FormItem>
        <FormLabel>Hora de Muestreo</FormLabel>
        <Input
          type="time"
          value={(function(){
            const ts = (form.getValues('fecha_muestreo') as Date) || new Date();
            const hh = String(ts.getHours()).padStart(2, '0');
            const mm = String(ts.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
          })()}
          onChange={(e) => onHoraChange(e.target.value)}
        />
        <FormDescription>Define la hora exacta del muestreo.</FormDescription>
      </FormItem>

      <div className="md:col-span-2">
        <FormItem>
          <FormLabel>Remisión (manual)</FormLabel>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input placeholder="Número de remisión" />
            <AgePlanSelector
              agePlanUnit={agePlanUnit}
              onAgePlanUnitChange={setAgePlanUnit}
              edadGarantia={edadGarantia}
              onEdadGarantiaChange={setEdadGarantia}
            />
            <Select value={clasificacion} onValueChange={(v) => setClasificacion(v as 'FC' | 'MR')}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Clasificación" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="FC">FC (Compresión)</SelectItem>
                <SelectItem value="MR">MR (Flexión)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormItem>
      </div>
    </div>
  );
}



