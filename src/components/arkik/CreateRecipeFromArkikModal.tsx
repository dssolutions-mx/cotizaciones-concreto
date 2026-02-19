'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { parseArkikCodeToSpecs } from '@/lib/utils/arkikCodeParser';
import {
  deriveMaterialsFromArkikRow,
  createRecipeFromArkikData,
} from '@/lib/services/arkikRecipeCreationService';
import { toast } from 'sonner';
import { Loader2, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { StagingRemision } from '@/types/arkik';
import type { RecipeSpecification } from '@/types/recipes';

interface CreateRecipeFromArkikModalProps {
  isOpen: boolean;
  arkikCode: string;
  sourceRows: StagingRemision[];
  plantId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function normPlacement(p: string): string {
  if (p === 'B' || p === 'D') return p === 'B' ? 'BOMBEADO' : 'DIRECTO';
  return p || 'BOMBEADO';
}

function masterToEditable(master: {
  strength_fc: number;
  age_days: number | null;
  age_hours: number | null;
  max_aggregate_size: number;
  slump: number;
  placement_type: string;
}): ReturnType<typeof specToEditable> {
  const isHours = master.age_hours != null && master.age_hours > 0;
  return {
    strength_fc: master.strength_fc,
    ageValue: isHours ? master.age_hours! : (master.age_days ?? 28),
    ageUnit: (isHours ? 'H' : 'D') as 'H' | 'D',
    max_aggregate_size: master.max_aggregate_size,
    slump: master.slump,
    placement_type: normPlacement(master.placement_type),
    application_type: 'standard',
    recipe_type: undefined,
  };
}

function specToEditable(spec: RecipeSpecification) {
  const isHours = spec.age_hours != null && spec.age_hours > 0;
  return {
    strength_fc: spec.strength_fc,
    ageValue: isHours ? spec.age_hours! : (spec.age_days ?? 28),
    ageUnit: (isHours ? 'H' : 'D') as 'H' | 'D',
    max_aggregate_size: spec.max_aggregate_size,
    slump: spec.slump,
    placement_type: spec.placement_type,
    application_type: spec.application_type,
    recipe_type: spec.recipe_type,
  };
}

function editableToSpec(e: ReturnType<typeof specToEditable>): RecipeSpecification {
  const ageVal = Math.round(e.ageValue);
  return {
    strength_fc: e.strength_fc,
    age_days: e.ageUnit === 'D' ? ageVal : 0,
    age_hours: e.ageUnit === 'H' ? ageVal : undefined,
    max_aggregate_size: e.max_aggregate_size,
    slump: e.slump,
    placement_type: e.placement_type,
    application_type: e.application_type || 'standard',
    recipe_type: e.recipe_type,
  };
}

export function CreateRecipeFromArkikModal({
  isOpen,
  arkikCode,
  sourceRows,
  plantId,
  onSuccess,
  onCancel,
}: CreateRecipeFromArkikModalProps) {
  const { profile } = useAuthBridge();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceRow = useMemo(
    () => sourceRows.find((r) => (r.product_description || r.recipe_code) === arkikCode),
    [sourceRows, arkikCode]
  );

  const parsed = useMemo(() => parseArkikCodeToSpecs(arkikCode), [arkikCode]);

  const [editableSpec, setEditableSpec] = useState<ReturnType<typeof specToEditable> | null>(null);

  const [deriveResult, setDeriveResult] = useState<{
    materials: { material_id: string; quantity: number; unit: string; material_name?: string; material_code: string }[];
    unmapped: string[];
  } | null>(null);
  const [deriveError, setDeriveError] = useState<string | null>(null);

  type MasterOption = {
    id: string;
    master_code: string;
    strength_fc: number;
    age_days: number | null;
    age_hours: number | null;
    max_aggregate_size: number;
    slump: number;
    placement_type: string;
  };
  const [existingMasters, setExistingMasters] = useState<MasterOption[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sourceRow || !plantId) {
      setDeriveResult(null);
      setDeriveError(null);
      setExistingMasters([]);
      setSelectedMasterId(null);
      return;
    }
    deriveMaterialsFromArkikRow(sourceRow, plantId)
      .then((r) => setDeriveResult({ materials: r.materials, unmapped: r.unmapped }))
      .catch((e) => setDeriveError(e.message));
  }, [isOpen, sourceRow, plantId]);

  useEffect(() => {
    if (!isOpen || !parsed || !plantId) {
      setEditableSpec(parsed ? specToEditable(parsed.specification) : null);
      setExistingMasters([]);
      setSelectedMasterId(null);
      return;
    }
    const fetchMasters = async () => {
      const codes = [parsed!.masterCode];
      const alt = parsed!.masterCode.startsWith('PAV-') ? `P-${parsed!.masterCode.slice(4)}` : parsed!.masterCode.startsWith('P-') ? `PAV-${parsed!.masterCode.slice(2)}` : null;
      if (alt && !codes.includes(alt)) codes.push(alt);

      const { data } = await supabase
        .from('master_recipes')
        .select('id, master_code, strength_fc, age_days, age_hours, max_aggregate_size, slump, placement_type')
        .eq('plant_id', plantId)
        .in('master_code', codes);

      const masters = (data || []) as MasterOption[];
      setExistingMasters(masters);
      if (masters.length === 1) {
        setSelectedMasterId(masters[0].id);
        setEditableSpec(masterToEditable(masters[0]));
      } else if (masters.length > 1) {
        setSelectedMasterId(masters[0].id);
        setEditableSpec(masterToEditable(masters[0]));
      } else {
        setSelectedMasterId(null);
        setEditableSpec(specToEditable(parsed!.specification));
      }
    };
    fetchMasters();
  }, [isOpen, plantId, parsed]);

  const selectedMaster = existingMasters.find((m) => m.id === selectedMasterId);

  useEffect(() => {
    if (selectedMasterId === '__new__' && parsed) {
      setEditableSpec(specToEditable(parsed.specification));
    } else if (selectedMaster) {
      setEditableSpec(masterToEditable(selectedMaster));
    }
  }, [selectedMasterId, selectedMaster, parsed]);

  const canCreate =
    parsed &&
    editableSpec &&
    deriveResult &&
    deriveResult.materials.length > 0 &&
    !deriveError &&
    !isSubmitting;

  const handleConfirm = async () => {
    if (!parsed || !editableSpec || !deriveResult || deriveResult.materials.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const specification = editableToSpec(editableSpec);
      const result = await createRecipeFromArkikData({
        arkikCode,
        plantId,
        specification,
        materials: deriveResult.materials,
        masterCode: parsed.masterCode,
        variantSuffix: parsed.variantSuffix,
        masterId: selectedMasterId && selectedMasterId !== '__new__' ? selectedMasterId : undefined,
      });
      toast.success(result.updated ? 'Receta actualizada exitosamente' : 'Receta creada exitosamente');
      onSuccess();
      onCancel();
    } catch (e: any) {
      setError(e.message || 'Error al crear receta');
      toast.error(e.message || 'Error al crear receta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreateRecipe = ['EXECUTIVE', 'PLANT_MANAGER', 'QUALITY_TEAM'].includes(profile?.role || '');

  if (!canCreateRecipe) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden gap-0 p-0">
        <div className="shrink-0 px-6 pt-6 pb-4 pr-12 border-b bg-muted/30">
          <DialogTitle className="text-lg font-semibold">Crear receta: {arkikCode}</DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            Revisa y corrige los datos derivados del código Arkik antes de crear.
          </DialogDescription>
          {sourceRow && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>
                Origen: remisión {sourceRow.remision_number} · {sourceRow.volumen_fabricado} m³
                {sourceRow.cliente_name && ` · ${sourceRow.cliente_name}`}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
          {!parsed && (
            <p className="text-sm text-amber-600">
              No se pudo interpretar el código. Crea manualmente en /recipes.
            </p>
          )}

          {parsed && editableSpec && (
            <>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Especificaciones técnicas
                  {selectedMaster && (
                    <span className="ml-2 normal-case font-normal text-blue-600">(Heredadas del maestro)</span>
                  )}
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="spec-fc" className="text-sm">f&apos;c (kg/cm²)</Label>
                    <Input
                      id="spec-fc"
                      type="number"
                      min={1}
                      value={editableSpec.strength_fc}
                      onChange={(e) =>
                        setEditableSpec((s) => s && { ...s, strength_fc: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full"
                      disabled={!!selectedMaster}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="spec-slump" className="text-sm">Slump (cm)</Label>
                    <Input
                      id="spec-slump"
                      type="number"
                      min={0}
                      value={editableSpec.slump}
                      onChange={(e) =>
                        setEditableSpec((s) => s && { ...s, slump: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full"
                      disabled={!!selectedMaster}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="spec-tma" className="text-sm">TMA (mm)</Label>
                    <Input
                      id="spec-tma"
                      type="number"
                      min={1}
                      value={editableSpec.max_aggregate_size}
                      onChange={(e) =>
                        setEditableSpec((s) => s && { ...s, max_aggregate_size: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full"
                      disabled={!!selectedMaster}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="spec-placement" className="text-sm">Colocación</Label>
                    <Select
                      value={editableSpec.placement_type}
                      onValueChange={(v) =>
                        setEditableSpec((s) => s && { ...s, placement_type: v })
                      }
                    >
                        <SelectTrigger id="spec-placement" className="w-full" disabled={!!selectedMaster}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BOMBEADO">Bombeado</SelectItem>
                        <SelectItem value="DIRECTO">Directo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-sm">Edad de garantía</Label>
                    <div className="flex gap-3 items-stretch">
                      <Input
                        id="spec-age-value"
                        type="number"
                        min={0}
                        step="0.5"
                        placeholder="Valor"
                        value={editableSpec.ageValue}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setEditableSpec((s) => s && { ...s, ageValue: !Number.isNaN(v) ? v : 0 });
                        }}
                        className="w-24"
                        disabled={!!selectedMaster}
                      />
                      <Select
                        value={editableSpec.ageUnit}
                        onValueChange={(v: 'H' | 'D') =>
                          setEditableSpec((s) => s && { ...s, ageUnit: v })
                        }
                      >
                        <SelectTrigger className="w-[130px]" disabled={!!selectedMaster}>
                          <SelectValue placeholder="Selecciona unidad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="D">Días</SelectItem>
                          <SelectItem value="H">Horas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span><strong className="text-foreground">Variante:</strong> {parsed.variantSuffix || '-'}</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Maestro</Label>
                    {existingMasters.length > 1 ? (
                      <Select value={selectedMasterId ?? ''} onValueChange={(v) => setSelectedMasterId(v || null)}>
                        <SelectTrigger className="w-full max-w-sm">
                          <SelectValue placeholder="Elige el maestro" />
                        </SelectTrigger>
                        <SelectContent>
                          {existingMasters.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.master_code} · f&apos;c {m.strength_fc} · Rev {m.slump} · TMA {m.max_aggregate_size}mm
                            </SelectItem>
                          ))}
                          <SelectItem value="__new__">
                            Crear nuevo maestro ({parsed.masterCode})
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : existingMasters.length === 1 ? (
                      <p className="text-sm">
                        <span className="font-mono">{selectedMaster?.master_code}</span>
                        <span className="ml-2 text-green-600">(ya existe)</span>
                      </p>
                    ) : (
                      <p className="text-sm">
                        <span className="font-mono">{parsed.masterCode}</span>
                        <span className="ml-2">(se creará nuevo)</span>
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Materiales por m³
                  {sourceRow?.volumen_fabricado && (
                    <span className="normal-case font-normal ml-1">(teórico ÷ {sourceRow.volumen_fabricado} m³)</span>
                  )}
                </h3>
                {!deriveResult ? (
                  <p className="text-sm text-muted-foreground py-3">Cargando materiales…</p>
                ) : deriveResult.materials.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left py-2.5 px-3 font-medium">Material</th>
                          <th className="text-right py-2.5 px-3 font-medium w-28">Cantidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deriveResult.materials.map((m) => (
                          <tr key={m.material_id} className="border-b last:border-0">
                            <td className="py-2 px-3">{m.material_name || m.material_id.slice(0, 8) + '…'}</td>
                            <td className="py-2 px-3 text-right font-mono">{m.quantity} {m.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-amber-600 py-2">
                    No hay materiales. Deben existir en la planta con material_code = código Arkik.
                  </p>
                )}
              </section>
            </>
          )}

          {deriveError && <p className="text-sm text-red-600">{deriveError}</p>}
          {deriveResult && deriveResult.unmapped.length > 0 && (
            <p className="text-sm text-amber-600">Códigos sin mapear: {deriveResult.unmapped.join(', ')}</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="shrink-0 px-6 py-4 border-t bg-muted/20 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canCreate}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando…
              </>
            ) : (
              'Crear receta'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
