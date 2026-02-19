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
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { parseArkikCodeToSpecs } from '@/lib/utils/arkikCodeParser';
import {
  deriveMaterialsFromArkikRow,
  createRecipeFromArkikData,
} from '@/lib/services/arkikRecipeCreationService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { StagingRemision } from '@/types/arkik';

interface CreateRecipeFromArkikModalProps {
  isOpen: boolean;
  arkikCode: string;
  sourceRows: StagingRemision[];
  plantId: string;
  onSuccess: () => void;
  onCancel: () => void;
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

  const [deriveResult, setDeriveResult] = useState<{
    materials: { material_id: string; quantity: number; unit: string; material_name?: string }[];
    unmapped: string[];
  } | null>(null);
  const [deriveError, setDeriveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sourceRow || !plantId) {
      setDeriveResult(null);
      setDeriveError(null);
      return;
    }
    deriveMaterialsFromArkikRow(sourceRow, plantId)
      .then((r) => setDeriveResult({ materials: r.materials, unmapped: r.unmapped }))
      .catch((e) => setDeriveError(e.message));
  }, [isOpen, sourceRow, plantId]);

  const canCreate =
    parsed &&
    deriveResult &&
    deriveResult.materials.length > 0 &&
    !deriveError &&
    !isSubmitting;

  const handleConfirm = async () => {
    if (!parsed || !deriveResult || deriveResult.materials.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await createRecipeFromArkikData({
        arkikCode,
        plantId,
        specification: parsed.specification,
        materials: deriveResult.materials,
        masterCode: parsed.masterCode,
        variantSuffix: parsed.variantSuffix,
      });
      toast.success('Receta creada exitosamente');
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear receta desde Arkik: {arkikCode}</DialogTitle>
          <DialogDescription>
            Revisa los datos derivados antes de confirmar. La receta se creará con maestro y
            materiales por m³.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!parsed && (
            <p className="text-sm text-amber-600">
              No se pudo interpretar el código. Crea manualmente en /recipes.
            </p>
          )}

          {parsed && (
            <div className="rounded border p-3 space-y-1" aria-readonly>
              <p className="text-xs font-medium text-muted-foreground">Especificaciones</p>
              <p className="text-sm">
                FC {parsed.specification.strength_fc} · slump {parsed.specification.slump} ·
                TMA {parsed.specification.max_aggregate_size}mm · {parsed.specification.placement_type}
                {parsed.specification.age_hours
                  ? ` · ${parsed.specification.age_hours}h`
                  : ` · ${parsed.specification.age_days}d`}
              </p>
              <p className="text-xs text-muted-foreground">
                Maestro: {parsed.masterCode} · Variante: {parsed.variantSuffix || '-'}
              </p>
            </div>
          )}

          {deriveError && (
            <p className="text-sm text-red-600">{deriveError}</p>
          )}

          {deriveResult && deriveResult.materials.length > 0 && (
            <div className="rounded border p-3 space-y-1" aria-readonly>
              <p className="text-xs font-medium text-muted-foreground">Materiales (por m³)</p>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {deriveResult.materials.map((m) => (
                  <div key={m.material_id} className="text-sm flex justify-between gap-2">
                    <span>{m.material_name || m.material_id.slice(0, 8) + '…'}</span>
                    <span>{m.quantity} {m.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deriveResult && deriveResult.unmapped.length > 0 && (
            <p className="text-sm text-amber-600">
              Códigos sin mapear: {deriveResult.unmapped.join(', ')}
            </p>
          )}

          {deriveResult && deriveResult.materials.length === 0 && !deriveError && (
            <p className="text-sm text-amber-600">
              No hay materiales mapeados. Configura arkik_material_mapping para esta planta.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canCreate}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando…
              </>
            ) : (
              'Crear receta'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
