'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Props = {
  form: any;
  onDateChange: (date?: Date) => void;
  onTimeChange: (hhmm: string) => void;
  highlightFromRemision?: boolean;
};

export default function LinkedMuestreoHeader({ form, onDateChange, onTimeChange, highlightFromRemision }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="fecha_muestreo"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>
              Fecha de Muestreo
            </FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full pl-3 text-left font-normal',
                      !field.value && 'text-muted-foreground',
                      highlightFromRemision && 'border-blue-300 bg-blue-50'
                    )}
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
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={(date) => onDateChange(date || undefined)}
                />
              </PopoverContent>
            </Popover>
            <FormDescription>
              Cambiar esta fecha recalcula la edad de cada muestra.
            </FormDescription>
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
          onChange={(e) => onTimeChange(e.target.value)}
        />
        <FormDescription>Define la hora exacta del muestreo para planear ensayos.</FormDescription>
      </FormItem>
    </div>
  );
}


