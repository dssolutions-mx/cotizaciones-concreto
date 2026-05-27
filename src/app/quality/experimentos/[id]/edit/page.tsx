'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { computeMixKpis } from '@/lib/quality/laboratorioLoteUtils';
import type { LaboratorioLoteMaterialInput, LaboratorioLoteWithRelations } from '@/types/laboratorioLote';
import { usePlantContext } from '@/contexts/PlantContext';
import { supabase } from '@/lib/supabase/client';

type MaterialRow = LaboratorioLoteMaterialInput & { key: string };

export default function EditarExperimentoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { currentPlant } = usePlantContext();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [volumen, setVolumen] = useState('0.05');
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [materialCatalog, setMaterialCatalog] = useState<
    Array<{ id: string; material_name: string; unit_of_measure: string; category: string }>
  >([]);
  const [loteNumber, setLoteNumber] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quality/laboratorio-lotes/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const lote = json.data as LaboratorioLoteWithRelations;
      if (lote.status !== 'borrador') {
        toast.error('Solo se puede editar un lote en borrador');
        router.push(`/quality/experimentos/${id}`);
        return;
      }
      setLoteNumber(lote.lote_number);
      setVolumen(String(lote.volumen_m3));
      setMaterials(
        (lote.materials ?? []).map((m, i) => ({
          key: m.id ?? `row-${i}`,
          material_id: m.material_id,
          material_type: m.material_type,
          cantidad_teorica: m.cantidad_teorica,
          cantidad_real: m.cantidad_real,
          unit: m.unit,
        }))
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!currentPlant?.id) return;
    supabase
      .from('materials')
      .select('id, material_name, unit_of_measure, category')
      .eq('plant_id', currentPlant.id)
      .eq('is_active', true)
      .order('material_name')
      .then(({ data }) => setMaterialCatalog(data ?? []));
  }, [currentPlant?.id]);

  const vol = parseFloat(volumen) || 0;
  const kpis = computeMixKpis(
    materials.map((m) => ({
      cantidad_real: m.cantidad_real,
      cantidad_teorica: m.cantidad_teorica,
      category: materialCatalog.find((c) => c.id === m.material_id)?.category,
    })),
    vol
  );

  const addMaterial = () => {
    const first = materialCatalog[0];
    if (!first) return;
    setMaterials((prev) => [
      ...prev,
      {
        key: `manual-${Date.now()}`,
        material_id: first.id,
        material_type: first.material_name,
        cantidad_teorica: 0,
        cantidad_real: 0,
        unit: first.unit_of_measure,
      },
    ]);
  };

  const updateMaterial = (key: string, patch: Partial<MaterialRow>) => {
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.key !== key) return m;
        const next = { ...m, ...patch };
        if (patch.material_id) {
          const cat = materialCatalog.find((c) => c.id === patch.material_id);
          if (cat) {
            next.material_type = cat.material_name;
            next.unit = cat.unit_of_measure;
          }
        }
        return next;
      })
    );
  };

  const save = async () => {
    if (materials.length === 0) {
      toast.error('Agrega al menos un material');
      return;
    }
    if (vol <= 0) {
      toast.error('Volumen inválido');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quality/laboratorio-lotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volumen_m3: vol,
          materials: materials.map(({ key: _k, ...m }) => m),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Mezcla actualizada');
      router.push(`/quality/experimentos/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <QualityBreadcrumb
        hubName="Experimentos"
        hubHref="/quality/experimentos"
        items={[
          { label: loteNumber, href: `/quality/experimentos/${id}` },
          { label: 'Editar mezcla' },
        ]}
      />

      <h1 className="text-xl font-semibold text-stone-900">Editar mezcla del lote</h1>

      <div className="grid gap-4 sm:grid-cols-3 text-sm">
        <div className="space-y-2">
          <Label>Volumen (m³)</Label>
          <Input type="number" step="0.01" min="0.001" value={volumen} onChange={(e) => setVolumen(e.target.value)} />
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-stone-500 text-xs">Cemento /m³</p>
          <p className="font-semibold">{kpis.cementKgM3 != null ? `${kpis.cementKgM3.toFixed(1)} kg` : '—'}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-stone-500 text-xs">Agua /m³</p>
          <p className="font-semibold">{kpis.waterLm3 != null ? `${kpis.waterLm3.toFixed(1)} L` : '—'}</p>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-4 space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-stone-600">Materiales</p>
          <Button type="button" variant="outline" size="sm" onClick={addMaterial}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Teórico /m³</TableHead>
              <TableHead>Real (lote)</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((m) => (
              <TableRow key={m.key}>
                <TableCell>
                  <Select value={m.material_id} onValueChange={(v) => updateMaterial(m.key, { material_id: v })}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {materialCatalog.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.material_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="h-8 w-24"
                    value={m.cantidad_teorica ?? ''}
                    onChange={(e) =>
                      updateMaterial(m.key, { cantidad_teorica: parseFloat(e.target.value) || 0 })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="h-8 w-28"
                    value={m.cantidad_real ?? ''}
                    onChange={(e) =>
                      updateMaterial(m.key, { cantidad_real: parseFloat(e.target.value) || 0 })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setMaterials((p) => p.filter((x) => x.key !== m.key))}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between">
        <Link href={`/quality/experimentos/${id}`}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
        </Link>
        <Button onClick={save} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Guardar mezcla
        </Button>
      </div>
    </div>
  );
}
