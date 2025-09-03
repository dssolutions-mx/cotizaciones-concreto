'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addSampleToMuestreo } from '@/services/qualityMuestraService';
import { useToast } from '@/components/ui/use-toast';
import { createSafeDate } from '@/lib/utils';

type PlannedSample = {
  id: string;
  tipo_muestra: 'CILINDRO' | 'VIGA' | 'CUBO';
  fecha_programada_ensayo: Date;
  diameter_cm?: number;
  cube_side_cm?: number;
  age_days?: number;
  age_hours?: number;
};

interface AddSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  muestreoId: string;
  muestreoDate: string | Date;
  onSampleAdded: () => void;
}

// Helper functions similar to the ones used in new muestreo page
const computeAgeDays = (base: Date, target: Date): number => {
  const msPerDay = 24 * 3600 * 1000;
  const baseMid = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
  const targetMid = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 12, 0, 0);
  return Math.round((targetMid.getTime() - baseMid.getTime()) / msPerDay);
};

const addDaysSafe = (base: Date, days: number): Date => {
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result;
};

export default function AddSampleModal({
  isOpen,
  onClose,
  muestreoId,
  muestreoDate,
  onSampleAdded,
}: AddSampleModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sample, setSample] = useState<PlannedSample>({
    id: uuidv4(),
    tipo_muestra: 'CILINDRO',
    fecha_programada_ensayo: (() => {
      const base = typeof muestreoDate === 'string' ? createSafeDate(muestreoDate) || new Date() : muestreoDate;
      return addDaysSafe(base, 28);
    })(),
    diameter_cm: 15,
    age_days: 28,
  });
  
  const { toast } = useToast();

  const baseDate = typeof muestreoDate === 'string' ? createSafeDate(muestreoDate) || new Date() : muestreoDate;
  const useHours = typeof sample.age_hours === 'number' && isFinite(sample.age_hours);
  const ensayoDisplay = `${format(sample.fecha_programada_ensayo, 'dd/MM/yyyy', { locale: es })} ${String(sample.fecha_programada_ensayo.getHours()).padStart(2,'0')}:${String(sample.fecha_programada_ensayo.getMinutes()).padStart(2,'0')}`;

  const onSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      await addSampleToMuestreo(muestreoId, {
        tipo_muestra: sample.tipo_muestra,
        fecha_programada_ensayo: sample.fecha_programada_ensayo,
        diameter_cm: sample.diameter_cm,
        cube_side_cm: sample.cube_side_cm,
        age_days: sample.age_days,
        age_hours: sample.age_hours,
      });

      toast({
        title: "Muestra agregada",
        description: "La muestra se ha agregado correctamente al muestreo",
        variant: "default",
      });

      // Reset form
      setSample({
        id: uuidv4(),
        tipo_muestra: 'CILINDRO',
        fecha_programada_ensayo: addDaysSafe(baseDate, 28),
        diameter_cm: 15,
        age_days: 28,
      });
      
      onSampleAdded();
      onClose();
    } catch (error) {
      console.error('Error adding sample:', error);
      toast({
        title: "Error",
        description: "No se pudo agregar la muestra. Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSample({
      id: uuidv4(),
      tipo_muestra: 'CILINDRO',
      fecha_programada_ensayo: addDaysSafe(baseDate, 28),
      diameter_cm: 15,
      age_days: 28,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Nueva Muestra</DialogTitle>
          <DialogDescription>
            Configura los parámetros de la nueva muestra para el muestreo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Tipo de muestra */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de Muestra</Label>
            <Select value={sample.tipo_muestra} onValueChange={(val) => {
              const v = val as 'CILINDRO' | 'VIGA' | 'CUBO';
              setSample(prev => ({ ...prev, tipo_muestra: v }));
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona el tipo de muestra" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CILINDRO">Cilindro</SelectItem>
                <SelectItem value="VIGA">Viga</SelectItem>
                <SelectItem value="CUBO">Cubo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dimensiones */}
          {sample.tipo_muestra === 'CILINDRO' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Diámetro del Cilindro</Label>
              <Select value={String(sample.diameter_cm || 15)} onValueChange={(val) => {
                const num = parseInt(val, 10);
                setSample(prev => ({ ...prev, diameter_cm: num }));
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona el diámetro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 cm</SelectItem>
                  <SelectItem value="15">15 cm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {sample.tipo_muestra === 'CUBO' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Lado del Cubo</Label>
              <Select value={String(sample.cube_side_cm || 15)} onValueChange={(val) => {
                const num = parseInt(val, 10);
                setSample(prev => ({ ...prev, cube_side_cm: num }));
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona el tamaño" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 cm</SelectItem>
                  <SelectItem value="10">10 cm</SelectItem>
                  <SelectItem value="15">15 cm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Configuración de edad */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Configuración de Edad de Ensayo</Label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Unidad de Edad</Label>
                <Select
                  value={useHours ? 'hours' : 'days'}
                  onValueChange={(val) => {
                    if (val === 'hours') {
                      const diffMs = sample.fecha_programada_ensayo.getTime() - baseDate.getTime();
                      const hours = Math.max(1, Math.round(diffMs / 3600000));
                      setSample(prev => ({
                        ...prev,
                        age_hours: hours,
                        age_days: undefined,
                        fecha_programada_ensayo: (() => { const d = new Date(baseDate); d.setHours(d.getHours() + hours); return d; })(),
                      }));
                    } else {
                      const days = computeAgeDays(baseDate, sample.fecha_programada_ensayo);
                      setSample(prev => ({
                        ...prev,
                        age_days: days,
                        age_hours: undefined,
                        fecha_programada_ensayo: addDaysSafe(baseDate, days),
                      }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona la unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Días</SelectItem>
                    <SelectItem value="hours">Horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {useHours ? (
                <div className="space-y-2">
                  <Label className="text-sm">Edad (horas)</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Ej: 24, 48, 72..."
                    value={String(sample.age_hours ?? '')}
                    onChange={(e) => {
                      const val = parseInt(e.target.value || '0', 10);
                      const ageHours = isNaN(val) ? 0 : val;
                      setSample(prev => ({
                        ...prev,
                        age_hours: ageHours,
                        age_days: undefined,
                        fecha_programada_ensayo: (() => { const d = new Date(baseDate); d.setHours(d.getHours() + ageHours); return d; })(),
                      }));
                    }}
                  />
                  <div className="text-xs text-gray-500">Horas desde el muestreo</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm">Edad (días)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Ej: 7, 14, 28..."
                    value={String(sample.age_days ?? computeAgeDays(baseDate, sample.fecha_programada_ensayo))}
                    onChange={(e) => {
                      const val = parseInt(e.target.value || '0', 10);
                      const ageDays = isNaN(val) ? 0 : val;
                      setSample(prev => ({
                        ...prev,
                        age_days: ageDays,
                        age_hours: undefined,
                        fecha_programada_ensayo: addDaysSafe(baseDate, ageDays),
                      }));
                    }}
                  />
                  <div className="text-xs text-gray-500">Días desde el muestreo</div>
                </div>
              )}
            </div>
          </div>

          {/* Fecha y hora programada */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Programación del Ensayo</Label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Fecha de Ensayo</Label>
                <Input
                  type="date"
                  value={`${sample.fecha_programada_ensayo.getFullYear()}-${String(sample.fecha_programada_ensayo.getMonth() + 1).padStart(2, '0')}-${String(sample.fecha_programada_ensayo.getDate()).padStart(2, '0')}`}
                  onChange={(e) => {
                    const val = e.target.value;
                    const [y, m, d] = val.split('-').map((n) => parseInt(n, 10));
                    const newDate = new Date(y, (m || 1) - 1, d || 1, sample.fecha_programada_ensayo.getHours(), sample.fecha_programada_ensayo.getMinutes(), 0);
                    setSample(prev => ({
                      ...prev,
                      fecha_programada_ensayo: newDate,
                      age_days: computeAgeDays(baseDate, newDate),
                      age_hours: undefined,
                    }));
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Hora de Ensayo</Label>
                <Input
                  type="time"
                  value={`${String(sample.fecha_programada_ensayo.getHours()).padStart(2,'0')}:${String(sample.fecha_programada_ensayo.getMinutes()).padStart(2,'0')}`}
                  onChange={(e) => {
                    const timeVal = e.target.value;
                    const [h, m] = timeVal.split(':').map((n) => parseInt(n, 10) || 0);
                    const newDate = new Date(sample.fecha_programada_ensayo);
                    newDate.setHours(h, m, 0, 0);
                    setSample(prev => ({
                      ...prev,
                      fecha_programada_ensayo: newDate,
                    }));
                  }}
                />
              </div>
            </div>
            
            {/* Resumen de programación */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm font-medium text-blue-800 mb-1">Resumen de Programación</div>
              <div className="text-sm text-blue-700">
                <strong>Ensayo programado:</strong> {ensayoDisplay}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {useHours 
                  ? `${sample.age_hours} horas después del muestreo`
                  : `${sample.age_days ?? computeAgeDays(baseDate, sample.fecha_programada_ensayo)} días después del muestreo`
                }
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agregar Muestra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
