'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import type { MuestreoWithRelations } from '@/types/quality';

type Props = {
  muestreo: MuestreoWithRelations;
  onSaved: () => void;
};

export default function MuestreoInformeFieldsCard({ muestreo, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [muestreadoPor, setMuestreadoPor] = useState(muestreo.muestreado_por ?? 'LABORATORIO');
  const [declararIncertidumbreCampo, setDeclararIncertidumbreCampo] = useState(
    muestreo.declarar_incertidumbre_campo ?? false
  );
  const [fechaRecepcion, setFechaRecepcion] = useState(
    muestreo.fecha_recepcion_lab ?? format(new Date(muestreo.created_at ?? Date.now()), 'yyyy-MM-dd')
  );
  const [hrObra, setHrObra] = useState(muestreo.humedad_relativa_obra?.toString() ?? '');
  const [clima, setClima] = useState(muestreo.condiciones_climaticas ?? '');
  const [ubicacion, setUbicacion] = useState(muestreo.ubicacion_detalle ?? '');

  useEffect(() => {
    setMuestreadoPor(muestreo.muestreado_por ?? 'LABORATORIO');
    setDeclararIncertidumbreCampo(muestreo.declarar_incertidumbre_campo ?? false);
    setFechaRecepcion(
      muestreo.fecha_recepcion_lab ?? format(new Date(muestreo.created_at ?? Date.now()), 'yyyy-MM-dd')
    );
    setHrObra(muestreo.humedad_relativa_obra?.toString() ?? '');
    setClima(muestreo.condiciones_climaticas ?? '');
    setUbicacion(muestreo.ubicacion_detalle ?? '');
  }, [muestreo]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('muestreos')
        .update({
          muestreado_por: muestreadoPor,
          declarar_incertidumbre_campo: declararIncertidumbreCampo,
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

        <div className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50/60 px-3 py-2.5">
          <div className="space-y-1">
            <Label htmlFor="declarar-u-campo" className="font-medium">
              Declarar incertidumbre en ensayos de campo
            </Label>
            <p className="text-xs text-stone-500 leading-relaxed">
              Active solo si revenimiento, temperatura, contenido de aire y masa unitaria fueron
              tomados por personal del laboratorio cubierto por los estudios EMA publicados.
            </p>
          </div>
          <Switch
            id="declarar-u-campo"
            checked={declararIncertidumbreCampo}
            onCheckedChange={setDeclararIncertidumbreCampo}
          />
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
