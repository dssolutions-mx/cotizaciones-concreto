'use client';

import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormLabel } from '@/components/ui/form';
import { Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PlannedSample = {
  id: string;
  tipo_muestra: 'CILINDRO' | 'VIGA' | 'CUBO';
  fecha_programada_ensayo: Date;
  diameter_cm?: number;
  cube_side_cm?: number;
  age_days?: number;
  age_hours?: number;
};

type SamplePlanProps<FormValues> = {
  plannedSamples: PlannedSample[];
  setPlannedSamples: React.Dispatch<React.SetStateAction<PlannedSample[]>>;
  form: UseFormReturn<FormValues>;
  clasificacion: 'FC' | 'MR';
  edadGarantia: number;
  agePlanUnit?: 'days' | 'hours';
  computeAgeDays: (base: Date, target: Date) => number;
  addDaysSafe: (base: Date, days: number) => Date;
  formatAgeSummary?: (samples: PlannedSample[], baseDate?: Date | null) => string;
};

export default function SamplePlan<FormValues>(props: SamplePlanProps<FormValues>) {
  const { plannedSamples, setPlannedSamples, form, clasificacion, edadGarantia, agePlanUnit = 'days', computeAgeDays, addDaysSafe, formatAgeSummary } = props;

  const handleAddSuggested = () => {
    const base = form.getValues('fecha_muestreo') as unknown as Date;
    if (!base) return;

    if (agePlanUnit === 'hours') {
      const hoursSet = [12, 14, 16, 18, 20];
      const additions: PlannedSample[] = hoursSet.map((h) => {
        const d = new Date(base);
        d.setHours(d.getHours() + h);
        return {
          id: uuidv4(),
          tipo_muestra: clasificacion === 'MR' ? 'VIGA' : 'CILINDRO',
          fecha_programada_ensayo: d,
          diameter_cm: 15,
          age_hours: h,
        };
      });
      setPlannedSamples((prev) => [...prev, ...additions]);
      return;
    }

    const days = (() => {
      if (clasificacion === 'FC') {
        switch (edadGarantia) {
          case 1: return [1, 1, 3];
          case 3: return [1, 1, 3, 3];
          case 7: return [1, 3, 7, 7];
          case 14: return [3, 7, 14, 14];
          case 28: return [7, 14, 28, 28];
          default: return [7, 14, 28, 28];
        }
      } else {
        switch (edadGarantia) {
          case 1: return [1, 1, 3];
          case 3: return [1, 3, 3];
          case 7: return [3, 7, 7];
          case 14: return [7, 14, 14];
          case 28: return [7, 28, 28];
          default: return [7, 28, 28];
        }
      }
    })();

    const additions: PlannedSample[] = days.map((d) => {
      const date = addDaysSafe(base, d);
      return {
        id: uuidv4(),
        tipo_muestra: clasificacion === 'MR' ? 'VIGA' : 'CILINDRO',
        fecha_programada_ensayo: date,
        diameter_cm: 15,
        age_days: d,
      };
    });
    setPlannedSamples((prev) => [...prev, ...additions]);
  };

  const handleAddSingle = () => {
    const base = form.getValues('fecha_muestreo') as unknown as Date;
    const date = base ? new Date(base) : new Date();
    date.setDate(date.getDate() + 1);
    setPlannedSamples((prev) => [
      ...prev,
      { id: uuidv4(), tipo_muestra: 'CILINDRO', fecha_programada_ensayo: date, diameter_cm: 15, age_days: 1 },
    ]);
  };

  const baseDate = form.getValues('fecha_muestreo') as unknown as Date | undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-sm font-semibold">Plan de Muestras</h3>
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto">
          {agePlanUnit !== 'hours' && (
            <Button type="button" variant="outline" size="sm" onClick={handleAddSuggested}>
              <Plus className="h-4 w-4 mr-1" /> Agregar conjunto sugerido
            </Button>
          )}
          <Button type="button" size="sm" onClick={handleAddSingle}>
            <Plus className="h-4 w-4 mr-1" /> Agregar muestra
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500">La edad se calcula desde la fecha de muestreo. Ajusta la edad o la fecha y recalcularemos automáticamente.</p>
      {plannedSamples.length === 0 ? (
        <div className="text-sm text-gray-500">No hay muestras planificadas. Agrega un conjunto sugerido o una muestra.</div>
      ) : (
        <div className="space-y-2 border rounded-md p-3">
          {plannedSamples.map((s) => {
            const useHours = typeof s.age_hours === 'number' && isFinite(s.age_hours);
            const ensayoLocal = s.fecha_programada_ensayo;
            const ensayoDisplay = `${format(ensayoLocal, 'dd/MM/yyyy', { locale: es })} ${String(ensayoLocal.getHours()).padStart(2,'0')}:${String(ensayoLocal.getMinutes()).padStart(2,'0')}`;
            return (
              <div key={s.id} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2 items-center">
                <div className="md:col-span-3">
                  <FormLabel className="text-xs">Tipo</FormLabel>
                  <Select value={s.tipo_muestra} onValueChange={(val) => {
                    const v = val as 'CILINDRO' | 'VIGA' | 'CUBO';
                    setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? { ...p, tipo_muestra: v } : p)));
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de muestra" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CILINDRO">Cilindro</SelectItem>
                      <SelectItem value="VIGA">Viga</SelectItem>
                      <SelectItem value="CUBO">Cubo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {s.tipo_muestra === 'CILINDRO' && (
                  <div className="md:col-span-3">
                    <FormLabel className="text-xs">Diámetro (cm)</FormLabel>
                    <Select value={String(s.diameter_cm || 15)} onValueChange={(val) => {
                      const num = parseInt(val, 10);
                      setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? { ...p, diameter_cm: num } : p)));
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Diámetro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 cm</SelectItem>
                        <SelectItem value="15">15 cm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {s.tipo_muestra === 'CUBO' && (
                  <div className="md:col-span-3">
                    <FormLabel className="text-xs">Lado del cubo (cm)</FormLabel>
                    <Select value={String(s.cube_side_cm || 15)} onValueChange={(val) => {
                      const num = parseInt(val, 10);
                      setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? { ...p, cube_side_cm: num } : p)));
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tamaño" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 cm</SelectItem>
                        <SelectItem value="10">10 cm</SelectItem>
                        <SelectItem value="15">15 cm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Unidad por muestra */}
                <div className="md:col-span-2">
                  <FormLabel className="text-xs">Unidad</FormLabel>
                  <Select
                    value={useHours ? 'hours' : 'days'}
                    onValueChange={(val) => {
                      const base = form.getValues('fecha_muestreo') as unknown as Date;
                      if (!base) return;
                      if (val === 'hours') {
                        const diffMs = (s.fecha_programada_ensayo as Date).getTime() - base.getTime();
                        const hours = Math.max(1, Math.round(diffMs / 3600000));
                        setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? {
                          ...p,
                          age_hours: hours,
                          age_days: undefined,
                          fecha_programada_ensayo: (() => { const d = new Date(base); d.setHours(d.getHours() + hours); return d; })(),
                        } : p)));
                      } else {
                        const days = computeAgeDays(base, s.fecha_programada_ensayo);
                        setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? {
                          ...p,
                          age_days: days,
                          age_hours: undefined,
                          fecha_programada_ensayo: addDaysSafe(base, days),
                        } : p)));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Días</SelectItem>
                      <SelectItem value="hours">Horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {useHours ? (
                  <div className="md:col-span-2">
                    <FormLabel className="text-xs">Edad (horas)</FormLabel>
                    <Input
                      type="number"
                      min={1}
                      value={String(s.age_hours ?? '')}
                      onChange={(e) => {
                        const base = form.getValues('fecha_muestreo') as unknown as Date;
                        const val = parseInt(e.target.value || '0', 10);
                        const ageHours = isNaN(val) ? 0 : val;
                        setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? {
                          ...p,
                          age_hours: ageHours,
                          age_days: undefined,
                          fecha_programada_ensayo: (() => { const d = new Date(base); d.setHours(d.getHours() + ageHours); return d; })(),
                        } : p)));
                      }}
                    />
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <FormLabel className="text-xs">Edad (días)</FormLabel>
                    <Input
                      type="number"
                      min={0}
                      value={(function() {
                        const base = form.getValues('fecha_muestreo') as unknown as Date;
                        const age = typeof s.age_days === 'number' && isFinite(s.age_days)
                          ? s.age_days
                          : (base ? computeAgeDays(base, s.fecha_programada_ensayo) : 0);
                        return String(age);
                      })()}
                      onChange={(e) => {
                        const base = form.getValues('fecha_muestreo') as unknown as Date;
                        const val = parseInt(e.target.value || '0', 10);
                        const ageDays = isNaN(val) ? 0 : val;
                        setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? {
                          ...p,
                          age_days: ageDays,
                          age_hours: undefined,
                          fecha_programada_ensayo: base ? addDaysSafe(base, ageDays) : p.fecha_programada_ensayo,
                        } : p)));
                      }}
                    />
                  </div>
                )}

                <div className={cn('', (s.tipo_muestra === 'CILINDRO' || s.tipo_muestra === 'CUBO') ? 'md:col-span-2' : 'md:col-span-4')}>
                  <FormLabel className="text-xs">Fecha programada de ensayo</FormLabel>
                  <Input
                    type="date"
                    value={`${s.fecha_programada_ensayo.getFullYear()}-${String(s.fecha_programada_ensayo.getMonth() + 1).padStart(2, '0')}-${String(s.fecha_programada_ensayo.getDate()).padStart(2, '0')}`}
                    onChange={(e) => {
                      const val = e.target.value;
                      const [y, m, d] = val.split('-').map((n) => parseInt(n, 10));
                      const newDate = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
                      const base = form.getValues('fecha_muestreo') as unknown as Date;
                      setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? {
                        ...p,
                        fecha_programada_ensayo: newDate,
                        age_days: base ? computeAgeDays(base, newDate) : p.age_days,
                      } : p)));
                    }}
                  />
                </div>

                <div className="md:col-span-2">
                  <FormLabel className="text-xs">Hora de Ensayo (local)</FormLabel>
                  <Input
                    type="time"
                    value={(function() {
                      const ts = s.fecha_programada_ensayo as Date;
                      return `${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`;
                    })()}
                    onChange={(e) => {
                      const timeVal = e.target.value;
                      const [h, m] = timeVal.split(':').map((n) => parseInt(n, 10) || 0);
                      const newDate = new Date(s.fecha_programada_ensayo);
                      newDate.setHours(h, m, 0, 0);
                      setPlannedSamples((prev) => prev.map((p) => (p.id === s.id ? {
                        ...p,
                        fecha_programada_ensayo: newDate,
                      } : p)));
                    }}
                  />
                  <div className="text-[11px] text-gray-500 mt-1">Ensayo programado: {ensayoDisplay}</div>
                </div>

                <div className="md:col-span-1 flex justify-end">
                  <Button type="button" variant="outline" size="icon" onClick={() => setPlannedSamples((prev) => prev.filter((p) => p.id !== s.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="text-xs text-gray-500">
            Se crearán {plannedSamples.length} muestras{formatAgeSummary && baseDate ? ` · Distribución de edades: ${formatAgeSummary(plannedSamples, baseDate)}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}


