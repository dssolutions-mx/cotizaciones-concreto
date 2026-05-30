'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Save, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import FieldMeasurandInput from '@/components/quality/muestreos/FieldMeasurandInput';
import {
  buildMedicionesPayload,
  FIELD_MEASURAND_ORDER,
  MEASURAND_META,
  type MeasurandMeta,
} from '@/lib/quality/muestreoFieldMeasurements';
import type {
  MuestreoFieldMeasurandCodigo,
  MuestreoMedicionCampoGrouped,
  MuestreoMedicionCampoInput,
} from '@/types/muestreoFieldMeasurement';
import type { MuestreoWithRelations } from '@/types/quality';
import type { UncertaintyPublished } from '@/types/ema-uncertainty';
import {
  uncertaintyDisplayByFieldCodigo,
  type PublishedUncertaintyRow,
} from '@/lib/quality/fieldUncertaintyDisplay';

type Props = {
  muestreoId: string;
  muestreo: MuestreoWithRelations;
  canEdit?: boolean;
  onSaved: () => void;
  initialGrouped?: MuestreoMedicionCampoGrouped[];
  initialPublishedUncertainty?: UncertaintyPublished[];
};

function rowsForCodigo(
  grouped: MuestreoMedicionCampoGrouped[],
  codigo: MuestreoFieldMeasurandCodigo,
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

function expandedFromGrouped(grouped: MuestreoMedicionCampoGrouped[]): Set<MuestreoFieldMeasurandCodigo> {
  return new Set(
    grouped.filter((g) => g.rows.length > 1).map((g) => g.measurand_codigo),
  );
}

export default function MuestreoFieldMeasurementsCard({
  muestreoId,
  muestreo,
  canEdit = false,
  onSaved,
  initialGrouped,
  initialPublishedUncertainty,
}: Props) {
  const { toast } = useToast();
  const [grouped, setGrouped] = useState<MuestreoMedicionCampoGrouped[]>(initialGrouped ?? []);
  const [loading, setLoading] = useState(initialGrouped === undefined);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mediciones, setMediciones] = useState<MuestreoMedicionCampoInput[]>([]);
  const [expandedCodigos, setExpandedCodigos] = useState<Set<MuestreoFieldMeasurandCodigo>>(new Set());
  const [muExpanded, setMuExpanded] = useState(false);
  const [scalars, setScalars] = useState<Partial<Record<MeasurandMeta['muestreoColumn'], number | null>>>({});
  const [uncertaintyByField, setUncertaintyByField] = useState<
    Map<MuestreoFieldMeasurandCodigo, string>
  >(new Map());

  const declararU = muestreo.declarar_incertidumbre_campo === true;

  useEffect(() => {
    if (!declararU) {
      setUncertaintyByField(new Map());
      return;
    }
    if (initialPublishedUncertainty !== undefined) {
      setUncertaintyByField(
        uncertaintyDisplayByFieldCodigo(initialPublishedUncertainty as PublishedUncertaintyRow[])
      );
      return;
    }
    let cancelled = false;
    void fetch('/api/ema/uncertainty/published')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const rows = (json.data ?? json ?? []) as PublishedUncertaintyRow[];
        setUncertaintyByField(uncertaintyDisplayByFieldCodigo(rows));
      })
      .catch(() => {
        if (!cancelled) setUncertaintyByField(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [declararU, muestreo.id, initialPublishedUncertainty]);

  const uFor = (codigo: MuestreoFieldMeasurandCodigo) =>
    declararU ? uncertaintyByField.get(codigo) : undefined;

  const initScalarsFromMuestreo = useCallback(() => {
    const s: Partial<Record<MeasurandMeta['muestreoColumn'], number | null>> = {};
    for (const codigo of FIELD_MEASURAND_ORDER) {
      const col = MEASURAND_META[codigo].muestreoColumn;
      const v = muestreo[col];
      s[col] = typeof v === 'number' ? v : null;
    }
    setScalars(s);
  }, [muestreo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quality/muestreos/${muestreoId}/mediciones-campo?grouped=1`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar mediciones');
      const data = (json.data ?? []) as MuestreoMedicionCampoGrouped[];
      setGrouped(data);
      if (!editing) {
        initScalarsFromMuestreo();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar las mediciones';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [muestreoId, editing, toast, initScalarsFromMuestreo]);

  useEffect(() => {
    if (initialGrouped !== undefined) {
      setGrouped(initialGrouped);
      setLoading(false);
      if (!editing) {
        initScalarsFromMuestreo();
      }
      return;
    }
    void load();
  }, [initialGrouped, load, editing, initScalarsFromMuestreo]);

  const startEdit = () => {
    const expanded = expandedFromGrouped(grouped);
    setExpandedCodigos(expanded);
    setMuExpanded(expanded.has('MU'));
    const multiOnly = FIELD_MEASURAND_ORDER.flatMap((c) =>
      expanded.has(c) ? rowsForCodigo(grouped, c) : [],
    );
    setMediciones(multiOnly);
    initScalarsFromMuestreo();
    for (const g of grouped) {
      if (g.rows.length === 1) {
        const col = MEASURAND_META[g.measurand_codigo].muestreoColumn;
        setScalars((prev) => ({ ...prev, [col]: g.promedio ?? Number(g.rows[0]?.valor) }));
      }
    }
    setEditing(true);
  };

  const setRowsForCodigo = (codigo: MuestreoFieldMeasurandCodigo, rows: MuestreoMedicionCampoInput[]) => {
    setMediciones((prev) => [...prev.filter((r) => r.measurand_codigo !== codigo), ...rows]);
  };

  const getRows = (codigo: MuestreoFieldMeasurandCodigo) =>
    mediciones.filter((r) => r.measurand_codigo === codigo);

  const setExpanded = (codigo: MuestreoFieldMeasurandCodigo, on: boolean) => {
    setExpandedCodigos((prev) => {
      const next = new Set(prev);
      if (on) next.add(codigo);
      else next.delete(codigo);
      return next;
    });
  };

  const setScalarForCodigo = (codigo: MuestreoFieldMeasurandCodigo, value: number | undefined) => {
    const col = MEASURAND_META[codigo].muestreoColumn;
    setScalars((prev) => ({ ...prev, [col]: value ?? null }));
  };

  const getScalarForCodigo = (codigo: MuestreoFieldMeasurandCodigo): number | null => {
    const col = MEASURAND_META[codigo].muestreoColumn;
    return scalars[col] ?? null;
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = buildMedicionesPayload(
        {
          revenimiento_sitio: scalars.revenimiento_sitio,
          temperatura_concreto: scalars.temperatura_concreto,
          masa_unitaria: scalars.masa_unitaria,
          contenido_aire: scalars.contenido_aire,
          temperatura_ambiente: scalars.temperatura_ambiente,
        },
        { mediciones, expandedCodigos, muExpanded },
      );

      const res = await fetch(`/api/quality/muestreos/${muestreoId}/mediciones-campo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediciones: payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar');
      toast({
        title: 'Mediciones guardadas',
        description: `${payload.length} lectura(s) registradas; promedios actualizados en el muestreo.`,
      });
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
    setEditing(false);
    setExpandedCodigos(new Set());
    setMuExpanded(false);
    setMediciones([]);
    initScalarsFromMuestreo();
    void load();
  };

  const hasAny =
    grouped.length > 0 ||
    muestreo.revenimiento_sitio != null ||
    muestreo.temperatura_concreto != null ||
    muestreo.masa_unitaria != null;

  const displayGroups =
    grouped.length > 0
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
        }).filter(Boolean) as MuestreoMedicionCampoGrouped[];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Mediciones de campo</CardTitle>
            <CardDescription>
              Un valor por prueba; usa «Agregar otra lectura» solo si necesitas réplicas.
              {declararU ? ' Incertidumbre EMA se muestra cuando está publicada.' : ''}
            </CardDescription>
          </div>
          {canEdit && !editing ? (
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={startEdit}>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FIELD_MEASURAND_ORDER.filter((c) => c !== 'MU').map((codigo) => (
              <FieldMeasurandInput
                key={codigo}
                codigo={codigo}
                scalarValue={getScalarForCodigo(codigo)}
                onScalarChange={(v) => setScalarForCodigo(codigo, v)}
                multiRows={getRows(codigo)}
                onMultiRowsChange={(rows) => setRowsForCodigo(codigo, rows)}
                expanded={expandedCodigos.has(codigo)}
                onExpandedChange={(on) => setExpanded(codigo, on)}
              />
            ))}
            <div className="md:col-span-2">
              <FieldMeasurandInput
                codigo="MU"
                scalarValue={getScalarForCodigo('MU')}
                onScalarChange={(v) => setScalarForCodigo('MU', v)}
                multiRows={getRows('MU')}
                onMultiRowsChange={(rows) => setRowsForCodigo('MU', rows)}
                expanded={expandedCodigos.has('MU') || muExpanded}
                onExpandedChange={(on) => {
                  setExpanded('MU', on);
                  setMuExpanded(on);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {displayGroups.map((g) =>
              g.rows.length > 1 ? (
                <div key={g.measurand_codigo}>
                  <div className="flex items-baseline justify-between mb-1">
                    <p className="text-sm font-medium text-stone-800">{g.label}</p>
                    <div className="text-right">
                      {g.promedio != null ? (
                        <p className="text-xs font-semibold text-sky-800">
                          Promedio: {g.promedio} {g.unidad}
                        </p>
                      ) : null}
                      {uFor(g.measurand_codigo) ? (
                        <p className="text-[10px] text-stone-500">U: {uFor(g.measurand_codigo)}</p>
                      ) : null}
                    </div>
                  </div>
                  <table className="w-full text-xs border border-stone-200 rounded-md overflow-hidden">
                    <thead>
                      <tr className="bg-stone-50 text-stone-500 text-left">
                        <th className="px-2 py-1">Motivo</th>
                        <th className="px-2 py-1">Valor</th>
                        <th className="px-2 py-1">Unidad</th>
                        {declararU ? <th className="px-2 py-1">U</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r) => (
                        <tr key={r.id} className="border-t border-stone-100">
                          <td className="px-2 py-1">{r.motivo ?? `Lectura ${r.secuencia}`}</td>
                          <td className="px-2 py-1 font-mono">{r.valor}</td>
                          <td className="px-2 py-1">{r.unidad}</td>
                          {declararU ? (
                            <td className="px-2 py-1 text-[10px] text-stone-500">
                              {uFor(g.measurand_codigo) ?? '—'}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p key={g.measurand_codigo} className="text-sm text-stone-800">
                  <span className="font-medium">{g.label}:</span>{' '}
                  <span className="font-mono">{g.rows[0]?.valor ?? g.promedio}</span> {g.unidad}
                  {uFor(g.measurand_codigo) ? (
                    <span className="block text-[10px] text-stone-500 mt-0.5">
                      U: {uFor(g.measurand_codigo)}
                    </span>
                  ) : null}
                </p>
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
