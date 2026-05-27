'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { supabase } from '@/lib/supabase/client';
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  LABORATORIO_PROTOCOL_TYPES,
  PROTOCOL_TYPE_LABELS,
  type LaboratorioLoteMaterialInput,
  type LaboratorioProtocolType,
} from '@/types/laboratorioLote';
import { concreteSpecsFromRecipe, computeMixKpis } from '@/lib/quality/laboratorioLoteUtils';
import ExperimentoWorkflowStepper from '@/components/quality/experimentos/ExperimentoWorkflowStepper';

type RecipeOption = {
  id: string;
  recipe_code: string;
  strength_fc: number | null;
  age_days: number | null;
  age_hours: number | null;
  slump: number | null;
};

type MaterialRow = LaboratorioLoteMaterialInput & { key: string };

export default function NuevoExperimentoPage() {
  const router = useRouter();
  const { currentPlant } = usePlantContext();
  const { session, profile } = useAuthBridge();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [materialCatalog, setMaterialCatalog] = useState<
    Array<{ id: string; material_name: string; unit_of_measure: string; category: string }>
  >([]);

  const [protocolType, setProtocolType] = useState<LaboratorioProtocolType>('formulacion');
  const [studyName, setStudyName] = useState('');
  const [hypothesisNotes, setHypothesisNotes] = useState('');
  const [studyDescription, setStudyDescription] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState('12:00');
  const [volumen, setVolumen] = useState('0.05');
  const [recipeId, setRecipeId] = useState<string>('');
  const [designacionEhe, setDesignacionEhe] = useState('');
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  const allowedRoles = ['QUALITY_TEAM', 'PLANT_MANAGER', 'LABORATORY', 'EXECUTIVE'];
  const hasAccess = profile && allowedRoles.includes(profile.role);

  useEffect(() => {
    if (!currentPlant?.id) return;
    setLoadingRecipes(true);
    supabase
      .from('recipes')
      .select('id, recipe_code, strength_fc, age_days, age_hours, slump')
      .eq('plant_id', currentPlant.id)
      .order('recipe_code')
      .then(({ data }) => {
        setRecipes((data as RecipeOption[]) ?? []);
        setLoadingRecipes(false);
      });

    supabase
      .from('materials')
      .select('id, material_name, unit_of_measure, category')
      .eq('plant_id', currentPlant.id)
      .eq('is_active', true)
      .order('material_name')
      .then(({ data }) => setMaterialCatalog(data ?? []));
  }, [currentPlant?.id]);

  const loadMaterialsFromRecipe = useCallback(async (rid: string, vol: number) => {
    setLoadingMaterials(true);
    try {
      const res = await fetch(
        `/api/quality/laboratorio-lotes?plant_id=${currentPlant?.id}&recipe_id=${rid}&volumen_m3=${vol}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const mats = (json.data?.materials ?? []) as LaboratorioLoteMaterialInput[];
      setMaterials(
        mats.map((m, i) => ({
          ...m,
          key: `row-${i}-${m.material_id}`,
        }))
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar materiales');
    } finally {
      setLoadingMaterials(false);
    }
  }, [currentPlant?.id]);

  const onRecipeChange = (rid: string) => {
    setRecipeId(rid);
    const vol = parseFloat(volumen) || 0;
    if (rid && vol > 0) {
      void loadMaterialsFromRecipe(rid, vol);
    } else if (!rid) {
      setMaterials([]);
    }
  };

  const onVolumenBlur = () => {
    const vol = parseFloat(volumen) || 0;
    if (recipeId && vol > 0) void loadMaterialsFromRecipe(recipeId, vol);
  };

  const addManualMaterial = () => {
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

  const removeMaterial = (key: string) => {
    setMaterials((prev) => prev.filter((m) => m.key !== key));
  };

  const handleSubmit = async () => {
    if (!currentPlant?.id || !session?.user) return;
    if (!studyName.trim()) {
      toast.error('El nombre del estudio es requerido');
      return;
    }
    if (materials.length === 0) {
      toast.error('Agrega al menos un material');
      return;
    }

    const selectedRecipe = recipes.find((r) => r.id === recipeId);
    const concrete_specs = selectedRecipe ? concreteSpecsFromRecipe(selectedRecipe) : undefined;

    setSubmitting(true);
    try {
      const res = await fetch('/api/quality/laboratorio-lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant_id: currentPlant.id,
          study_name: studyName.trim(),
          protocol_type: protocolType,
          hypothesis_notes: hypothesisNotes || null,
          study_description: studyDescription || null,
          fecha,
          hora_elaboracion: hora.length === 5 ? `${hora}:00` : hora,
          volumen_m3: parseFloat(volumen),
          recipe_id: recipeId || null,
          concrete_specs,
          designacion_ehe: designacionEhe || null,
          materials: materials.map(({ key: _k, ...m }) => m),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar');
      toast.success('Experimento registrado');
      router.push(`/quality/experimentos/${json.data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="py-16 text-center text-stone-600">
        No tienes permiso para registrar experimentos de laboratorio.
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <QualityBreadcrumb
        hubName="Experimentos"
        hubHref="/quality/experimentos"
        items={[{ label: 'Nuevo' }]}
      />

      <h1 className="text-xl font-semibold text-stone-900">Nuevo experimento</h1>

      <ExperimentoWorkflowStepper
        currentStep={step === 1 ? 'mezcla' : step === 2 ? 'mezcla' : 'mezcla'}
        compact
        className="mb-2"
      />

      <div className="flex gap-2 text-sm">
        <span className={step === 1 ? 'font-semibold text-violet-800' : 'text-stone-500'}>1. Protocolo</span>
        <span className="text-stone-300">/</span>
        <span className={step === 2 ? 'font-semibold text-violet-800' : 'text-stone-500'}>2. Materiales</span>
        <span className="text-stone-300">/</span>
        <span className={step === 3 ? 'font-semibold text-violet-800' : 'text-stone-500'}>3. Revisar</span>
      </div>

      {step === 1 && (
        <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Protocolo</Label>
              <Select value={protocolType} onValueChange={(v) => setProtocolType(v as LaboratorioProtocolType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LABORATORIO_PROTOCOL_TYPES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROTOCOL_TYPE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-violet-700 col-span-2 -mt-1">
                {PROTOCOL_TYPE_LABELS[protocolType]}
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre del estudio</Label>
              <Input value={studyName} onChange={(e) => setStudyName(e.target.value)} placeholder="Ej. Prueba aditivo X" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Hipótesis / criterio de aceptación</Label>
              <Textarea value={hypothesisNotes} onChange={(e) => setHypothesisNotes(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Fecha elaboración</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hora</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Volumen (m³)</Label>
              <Input type="number" step="0.01" min="0.001" value={volumen} onChange={(e) => setVolumen(e.target.value)} onBlur={onVolumenBlur} />
            </div>
            <div className="space-y-2">
              <Label>Receta de referencia (opcional)</Label>
              <Select value={recipeId || '__none__'} onValueChange={(v) => onRecipeChange(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingRecipes ? 'Cargando…' : 'Sin receta'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin receta</SelectItem>
                  {recipes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.recipe_code} (f&apos;c {r.strength_fc ?? '—'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Designación EHE (opcional)</Label>
              <Input value={designacionEhe} onChange={(e) => setDesignacionEhe(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descripción</Label>
              <Textarea value={studyDescription} onChange={(e) => setStudyDescription(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                if (!studyName.trim()) {
                  toast.error('Nombre del estudio requerido');
                  return;
                }
                setStep(2);
                if (recipeId && materials.length === 0) {
                  const vol = parseFloat(volumen) || 0;
                  if (vol > 0) void loadMaterialsFromRecipe(recipeId, vol);
                }
              }}
            >
              Siguiente
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
          {loadingMaterials ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <p className="text-sm text-stone-600">Materiales del lote (teórico por m³ y total batched)</p>
                <Button type="button" variant="outline" size="sm" onClick={addManualMaterial}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar material
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Teórico /m³</TableHead>
                    <TableHead>Real (lote)</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((m) => (
                    <TableRow key={m.key}>
                      <TableCell>
                        <Select
                          value={m.material_id}
                          onValueChange={(v) => updateMaterial(m.key, { material_id: v })}
                        >
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
                      <TableCell className="text-sm text-stone-500">{m.unit}</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeMaterial(m.key)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(() => {
                const vol = parseFloat(volumen) || 0;
                const kpis = computeMixKpis(
                  materials.map((m) => ({
                    cantidad_real: m.cantidad_real,
                    cantidad_teorica: m.cantidad_teorica,
                    category: materialCatalog.find((c) => c.id === m.material_id)?.category,
                  })),
                  vol
                );
                return (
                  <div className="flex gap-4 text-sm text-stone-600 pt-2">
                    <span>
                      Cemento:{' '}
                      {kpis.cementKgM3 != null ? `${kpis.cementKgM3.toFixed(1)} kg/m³` : '—'}
                    </span>
                    <span>
                      Agua: {kpis.waterLm3 != null ? `${kpis.waterLm3.toFixed(1)} L/m³` : '—'}
                    </span>
                  </div>
                );
              })()}
            </>
          )}
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Atrás
            </Button>
            <Button
              type="button"
              disabled={materials.length === 0}
              onClick={() => {
                if (materials.length === 0) {
                  toast.error('Agrega al menos un material');
                  return;
                }
                setStep(3);
              }}
            >
              Revisar
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-900">Resumen</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">Estudio</dt>
              <dd className="font-medium">{studyName}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Protocolo</dt>
              <dd>{PROTOCOL_TYPE_LABELS[protocolType]}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Fecha / volumen</dt>
              <dd>
                {fecha} · {volumen} m³
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Materiales</dt>
              <dd>{materials.length} líneas</dd>
            </div>
          </dl>
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Atrás
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Guardar experimento
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
