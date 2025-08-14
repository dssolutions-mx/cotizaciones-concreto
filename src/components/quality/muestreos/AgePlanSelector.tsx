'use client';

import React from 'react';
import { FormControl, FormLabel } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Props = {
  agePlanUnit: 'days' | 'hours';
  onAgePlanUnitChange: (unit: 'days' | 'hours') => void;
  edadGarantia: number;
  onEdadGarantiaChange: (value: number) => void;
};

export default function AgePlanSelector({ agePlanUnit, onAgePlanUnitChange, edadGarantia, onEdadGarantiaChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 items-start w-full">
      <div className="w-full">
        <FormLabel className="h-12 flex items-end leading-tight">Unidad</FormLabel>
        <FormControl>
          <Select value={agePlanUnit} onValueChange={(v) => onAgePlanUnitChange(v as 'days' | 'hours')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="days">Días</SelectItem>
              <SelectItem value="hours">Horas</SelectItem>
            </SelectContent>
          </Select>
        </FormControl>
      </div>
      <div className="w-full">
        <FormLabel className="h-12 flex items-end leading-tight">{agePlanUnit === 'hours' ? 'Edad (horas)' : 'Edad garantía (días)'}</FormLabel>
        <FormControl>
          <Select value={String(edadGarantia)} onValueChange={(v) => onEdadGarantiaChange(parseInt(v, 10))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={agePlanUnit === 'hours' ? 'Selecciona horas' : 'Selecciona días'} />
            </SelectTrigger>
            <SelectContent>
              {agePlanUnit === 'hours' ? (
                <>
                  <SelectItem value="12">12 horas</SelectItem>
                  <SelectItem value="14">14 horas</SelectItem>
                  <SelectItem value="16">16 horas</SelectItem>
                  <SelectItem value="18">18 horas</SelectItem>
                  <SelectItem value="20">20 horas</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="1">1 día</SelectItem>
                  <SelectItem value="3">3 días</SelectItem>
                  <SelectItem value="7">7 días</SelectItem>
                  <SelectItem value="14">14 días</SelectItem>
                  <SelectItem value="28">28 días</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </FormControl>
      </div>
    </div>
  );
}


