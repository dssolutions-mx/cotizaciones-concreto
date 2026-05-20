'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import QualityHubLayout from '@/components/quality/QualityHubLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import type { LaboratorioAcreditacionConfig } from '@/types/informe-ensayo';

export default function ConfiguracionInformePage() {
  const { currentPlant } = usePlantContext();
  const { toast } = useToast();
  const [config, setConfig] = useState<Partial<LaboratorioAcreditacionConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = currentPlant?.id ? `?plant_id=${currentPlant.id}` : '';
      const res = await fetch(`/api/quality/laboratorio-config${q}`);
      const json = await res.json();
      if (json.data) setConfig(json.data);
    } finally {
      setLoading(false);
    }
  }, [currentPlant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/quality/laboratorio-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, plant_id: currentPlant?.id ?? null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setConfig(json.data);
      toast({ title: 'Configuración guardada' });
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : 'Error al guardar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof LaboratorioAcreditacionConfig, label: string, multiline = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      {multiline ? (
        <Textarea
          id={key}
          value={(config[key] as string) ?? ''}
          onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
          rows={3}
        />
      ) : (
        <Input
          id={key}
          value={(config[key] as string) ?? ''}
          onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
        />
      )}
    </div>
  );

  return (
    <QualityHubLayout
      title="Configuración del informe"
      description="Identidad del laboratorio acreditado para DC-LC-7.8-01"
    >
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      ) : (
        <div className="max-w-xl space-y-4">
          {field('razon_social', 'Razón social')}
          {field('nombre_laboratorio', 'Nombre del laboratorio')}
          {field('direccion', 'Dirección')}
          {field('telefono', 'Teléfono')}
          {field('email', 'Correo')}
          {field('acreditacion_ema_numero', 'No. acreditación EMA')}
          {field('regla_decision_default', 'Regla de decisión por defecto')}
          {field('pie_pagina_texto', 'Texto pie de página', true)}
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar
          </Button>
        </div>
      )}
    </QualityHubLayout>
  );
}
