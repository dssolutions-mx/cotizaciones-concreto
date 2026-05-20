'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import type { MuestreoWithRelations } from '@/types/quality';

type InformeMuestreoFields = {
  muestreado_por?: string | null;
  fecha_recepcion_lab?: string | null;
  humedad_relativa_obra?: number | null;
  condiciones_climaticas?: string | null;
  ubicacion_detalle?: string | null;
};

type Props = {
  muestreo: MuestreoWithRelations;
  onSaved: () => void;
};

export default function MuestreoInformeFieldsCard({ muestreo, onSaved }: Props) {
  const { toast } = useToast();
  const ext = muestreo as MuestreoWithRelations & InformeMuestreoFields;
  const [saving, setSaving] = useState(false);
  const [muestreadoPor, setMuestreadoPor] = useState(ext.muestreado_por ?? 'LABORATORIO');
  const [fechaRecepcion, setFechaRecepcion] = useState(
    ext.fecha_recepcion_lab ?? format(new Date(muestreo.created_at ?? Date.now()), 'yyyy-MM-dd')
  );
  const [hrObra, setHrObra] = useState(ext.humedad_relativa_obra?.toString() ?? '');
  const [clima, setClima] = useState(ext.condiciones_climaticas ?? '');
  const [ubicacion, setUbicacion] = useState(ext.ubicacion_detalle ?? '');

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('muestreos')
        .update({
          muestreado_por: muestreadoPor,
          fecha_recepcion_lab: fechaRecepcion || null,
          humedad_relativa_obra: hrObra === '' ? null : Number(hrObra),
          condiciones_climaticas: clima || null,
          ubicacion_detalle: ubicacion || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', muestreo.id);
      if (error) throw error;
      toast({ title: 'Datos de informe actualizados' });
      onSaved();
    } catch {
      toast({ title: 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-stone-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Datos para informe acreditado (§2)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-2">
          <Label>Muestreado por</Label>
          <RadioGroup value={muestreadoPor} onValueChange={setMuestreadoPor} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="LABORATORIO" id="mp-lab" />
              <Label htmlFor="mp-lab" className="font-normal">
                Laboratorio
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="CLIENTE" id="mp-cli" />
              <Label htmlFor="mp-cli" className="font-normal">
                Cliente
              </Label>
            </div>
          </RadioGroup>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fecha-rec">Fecha recepción lab</Label>
            <Input id="fecha-rec" type="date" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hr-obra">HR en obra (%)</Label>
            <Input id="hr-obra" type="number" step="0.1" value={hrObra} onChange={(e) => setHrObra(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clima">Condiciones climáticas</Label>
          <Input id="clima" value={clima} onChange={(e) => setClima(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ubic">Detalle ubicación</Label>
          <Input id="ubic" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}
