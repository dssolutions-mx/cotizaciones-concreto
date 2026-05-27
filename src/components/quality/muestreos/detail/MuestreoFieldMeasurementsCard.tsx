'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Save, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import FieldMeasurandBlock from '@/components/quality/muestreos/FieldMeasurandBlock';
import {
  FIELD_MEASURAND_ORDER,
  MEASURAND_META,
  scalarsToMedicionInputs,
} from '@/lib/quality/muestreoFieldMeasurements';
import type { MuestreoMedicionCampoGrouped, MuestreoMedicionCampoInput } from '@/types/muestreoFieldMeasurement';
import type { MuestreoWithRelations } from '@/types/quality';

type Props = {
  muestreoId: string;
  muestreo: MuestreoWithRelations;
  canEdit?: boolean;
  onSaved: () => void;
};

function rowsForCodigo(
  grouped: MuestreoMedicionCampoGrouped[],
  codigo: (typeof FIELD_MEASURAND_ORDER)[number],
): MuestreoMedicionCampoInput[] {
  const g = grouped.find((x) => x.measurand_codigo === codigo);
  if (!g) return [];
  return g.rows.map((r) => ({
    measurand_codigo: r.measurand_codigo,
    secuencia: r.secuencia,
    motivo: r.motivo,
    valor: Number(r.valor),
    unidad: r.unidad,
  }));
}

export default function MuestreoFieldMeasurementsCard({
  muestreoId,
  muestreo,
  canEdit = false,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [grouped, setGrouped] = useState<MuestreoMedicionCampoGrouped[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<MuestreoMedicionCampoInput[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quality/muestreos/${muestreoId}/mediciones-campo?grouped=1`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar mediciones');
      const data = (json.data ?? []) as MuestreoMedicionCampoGrouped[];
      setGrouped(data);
      if (!editing) {
        const flat = FIELD_MEASURAND_ORDER.flatMap((c) => rowsForCodigo(data, c));
        setDraft(
          flat.length > 0
            ? flat
            : scalarsToMedicionInputs({
                revenimiento_sitio: muestreo.revenimiento_sitio,
                temperatura_concreto: muestreo.temperatura_concreto,
                masa_unitaria: muestreo.masa_unitaria,
                contenido_aire: muestreo.contenido_aire,
                temperatura_ambiente: muestreo.temperatura_ambiente,
              }),
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar las mediciones';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [muestreoId, muestreo, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const setRowsForCodigo = (codigo: (typeof FIELD_MEASURAND_ORDER)[number], rows: MuestreoMedicionCampoInput[]) => {
    setDraft((prev) => [...prev.filter((r) => r.measurand_codigo !== codigo), ...rows]);
  };

  const getRows = (codigo: (typeof FIELD_MEASURAND_ORDER)[number]) =>
    draft.filter((r) => r.measurand_codigo === codigo);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/quality/muestreos/${muestreoId}/mediciones-campo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediciones: draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar');
      toast({ title: 'Mediciones guardadas', description: 'Promedios actualizados en el muestreo.' });
      setEditing(false);
      await load();
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudieron guardar las mediciones';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    const flat = FIELD_MEASURAND_ORDER.flatMap((c) => rowsForCodigo(grouped, c));
    setDraft(
      flat.length > 0
        ? flat
        : scalarsToMedicionInputs({
            revenimiento_sitio: muestreo.revenimiento_sitio,
            temperatura_concreto: muestreo.temperatura_concreto,
            masa_unitaria: muestreo.masa_unitaria,
            contenido_aire: muestreo.contenido_aire,
            temperatura_ambiente: muestreo.temperatura_ambiente,
          }),
    );
    setEditing(false);
  };

  const hasAny =
    grouped.length > 0 ||
    muestreo.revenimiento_sitio != null ||
    muestreo.temperatura_concreto != null ||
    muestreo.masa_unitaria != null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Mediciones de campo</CardTitle>
            <CardDescription>
              Lecturas individuales; el promedio se usa en listados y conformidad. El informe lista cada lectura sin fila de promedio.
            </CardDescription>
          </div>
          {canEdit && !editing ? (
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Editar
            </Button>
          ) : null}
          {editing ? (
            <div className="flex gap-1">
              <Button type="button" size="sm" className="h-8" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Guardar
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={cancelEdit} disabled={saving}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : !hasAny && !editing ? (
          <p className="text-sm text-stone-500">Sin mediciones de campo registradas.</p>
        ) : editing ? (
          <div className="space-y-6">
            {FIELD_MEASURAND_ORDER.map((codigo) => (
              <FieldMeasurandBlock
                key={codigo}
                codigo={codigo}
                rows={getRows(codigo)}
                onChange={(rows) => setRowsForCodigo(codigo, rows)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {(grouped.length > 0
              ? grouped
              : FIELD_MEASURAND_ORDER.map((codigo) => {
                  const meta = MEASURAND_META[codigo];
                  const v = muestreo[meta.muestreoColumn];
                  if (v == null) return null;
                  return {
                    measurand_codigo: codigo,
                    label: meta.label,
                    unidad: meta.unidad,
                    promedio: Number(v),
                    rows: [
                      {
                        id: codigo,
                        muestreo_id: muestreoId,
                        measurand_codigo: codigo,
                        secuencia: 1,
                        motivo: null,
                        valor: Number(v),
                        unidad: meta.unidad,
                        notas: null,
                        created_by: null,
                        created_at: '',
                      },
                    ],
                  };
                }).filter(Boolean) as MuestreoMedicionCampoGrouped[]
            ).map((g) => (
              <div key={g.measurand_codigo}>
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-sm font-medium text-stone-800">{g.label}</p>
                  {g.promedio != null ? (
                    <p className="text-xs font-semibold text-sky-800">
                      Promedio: {g.promedio} {g.unidad}
                    </p>
                  ) : null}
                </div>
                <table className="w-full text-xs border border-stone-200 rounded-md overflow-hidden">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 text-left">
                      <th className="px-2 py-1">Motivo</th>
                      <th className="px-2 py-1">Valor</th>
                      <th className="px-2 py-1">Unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.id} className="border-t border-stone-100">
                        <td className="px-2 py-1">{r.motivo ?? `Lectura ${r.secuencia}`}</td>
                        <td className="px-2 py-1 font-mono">{r.valor}</td>
                        <td className="px-2 py-1">{r.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
