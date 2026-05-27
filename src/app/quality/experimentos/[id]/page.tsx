'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb';
import ExperimentoWorkflowStepper from '@/components/quality/experimentos/ExperimentoWorkflowStepper';
import ExperimentoNextActionCard from '@/components/quality/experimentos/ExperimentoNextActionCard';
import ExperimentoMixTable from '@/components/quality/experimentos/ExperimentoMixTable';
import ExperimentoMuestreosPanel from '@/components/quality/experimentos/ExperimentoMuestreosPanel';
import ExperimentoResultadosPanel from '@/components/quality/experimentos/ExperimentoResultadosPanel';
import ExperimentoConformidadBadge from '@/components/quality/experimentos/ExperimentoConformidadBadge';
import {
  resolveTargetFc,
  summarizeLoteConformidad,
} from '@/lib/quality/laboratorioConformidad';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { workflowStepFromStatus } from '@/lib/quality/experimentoWorkflow';
import { computeMixKpis } from '@/lib/quality/laboratorioLoteUtils';
import type { LaboratorioLoteStatus, LaboratorioLoteWithRelations } from '@/types/laboratorioLote';
import { PROTOCOL_TYPE_LABELS } from '@/types/laboratorioLote';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  muestreado: 'Muestreado',
  cerrado: 'Cerrado',
  evaluado: 'Evaluado',
};

export default function ExperimentoDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [lote, setLote] = useState<LaboratorioLoteWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [materialCategories, setMaterialCategories] = useState<Record<string, string>>({});
  const [conclusionOpen, setConclusionOpen] = useState(false);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quality/laboratorio-lotes/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setLote(json.data);
      setOutcomeNotes(json.data.outcome_notes ?? '');

      const matIds = (json.data.materials ?? []).map((m: { material_id: string }) => m.material_id);
      if (matIds.length > 0) {
        const { data: mats } = await supabase
          .from('materials')
          .select('id, category')
          .in('id', matIds);
        const map: Record<string, string> = {};
        for (const m of mats ?? []) map[m.id] = m.category;
        setMaterialCategories(map);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchStatus = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/quality/laboratorio-lotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Actualizado');
      setConclusionOpen(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!lote) {
    return <p className="text-stone-600 py-10">Lote no encontrado.</p>;
  }

  const kpis = computeMixKpis(
    (lote.materials ?? []).map((m) => ({
      ...m,
      category: materialCategories[m.material_id],
    })),
    Number(lote.volumen_m3)
  );

  const muestreos = lote.muestreos ?? [];
  const hasMuestreo = muestreos.length > 0;
  const step = workflowStepFromStatus(lote.status as LaboratorioLoteStatus);
  const conformidad = summarizeLoteConformidad(resolveTargetFc(lote), muestreos);
  const confDetail =
    conformidad.bestFc != null && conformidad.targetFc != null
      ? `${conformidad.bestFc.toFixed(1)} / ${conformidad.targetFc} kg/cm²`
      : conformidad.bestPct != null
        ? `${conformidad.bestPct.toFixed(0)}% cumplimiento`
        : undefined;

  return (
    <div className="space-y-5">
      <QualityBreadcrumb
        hubName="Experimentos"
        hubHref="/quality/experimentos"
        items={[{ label: lote.lote_number }]}
      />

      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">{lote.study_name}</h1>
          <p className="text-sm text-stone-500 mt-1">
            {lote.lote_number} · {PROTOCOL_TYPE_LABELS[lote.protocol_type]} ·{' '}
            {formatDate(lote.fecha, 'dd/MM/yyyy')}
          </p>
          <div className="flex flex-wrap gap-2 mt-2 items-center">
            <Badge variant="outline">{STATUS_LABELS[lote.status] ?? lote.status}</Badge>
            {lote.recipe?.recipe_code && (
              <Badge variant="secondary">Ref: {lote.recipe.recipe_code}</Badge>
            )}
            <ExperimentoConformidadBadge status={conformidad.status} showDetail={confDetail} />
          </div>
        </div>
        <ExperimentoWorkflowStepper currentStep={step} status={lote.status} />
      </div>

      <ExperimentoNextActionCard
        loteId={lote.id}
        status={lote.status}
        hasMuestreo={hasMuestreo}
        onCloseProtocol={() => void patchStatus({ status: 'cerrado' })}
        onOpenConclusion={() => setConclusionOpen(true)}
      />

      {(lote.hypothesis_notes || lote.study_description) && (
        <section className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700 space-y-2">
          {lote.hypothesis_notes && (
            <div>
              <p className="font-medium text-stone-900">Hipótesis</p>
              <p>{lote.hypothesis_notes}</p>
            </div>
          )}
          {lote.study_description && (
            <div>
              <p className="font-medium text-stone-900">Descripción</p>
              <p>{lote.study_description}</p>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-3 text-sm">
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-stone-500">Volumen</p>
          <p className="font-semibold">{lote.volumen_m3} m³</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-stone-500">Cemento (real/m³)</p>
          <p className="font-semibold">
            {kpis.cementKgM3 != null ? `${kpis.cementKgM3.toFixed(1)} kg/m³` : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-stone-500">Agua (real/m³)</p>
          <p className="font-semibold">
            {kpis.waterLm3 != null ? `${kpis.waterLm3.toFixed(1)} L/m³` : '—'}
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100">
          <h2 className="text-sm font-semibold text-stone-900">Mezcla del lote</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Comparación baseline receta (snapshot) vs teórico vs real batido
          </p>
        </div>
        <ExperimentoMixTable
          materials={lote.materials ?? []}
          volumenM3={Number(lote.volumen_m3)}
          recipeSnapshot={lote.recipe_snapshot}
        />
      </section>

      <ExperimentoMuestreosPanel loteId={lote.id} status={lote.status} muestreos={muestreos} />

      <ExperimentoResultadosPanel
        lote={lote}
        referenceStrengthFc={lote.recipe?.strength_fc}
        muestreos={muestreos}
      />

      <Dialog open={conclusionOpen} onOpenChange={setConclusionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conclusión del protocolo</DialogTitle>
            <DialogDescription>
              Resume el resultado del experimento y si cumple la hipótesis.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={outcomeNotes}
            onChange={(e) => setOutcomeNotes(e.target.value)}
            rows={4}
            placeholder="Ej. FC a 28d superó objetivo; se recomienda validación en planta."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConclusionOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={saving || !outcomeNotes.trim()}
              onClick={() =>
                void patchStatus({ status: 'evaluado', outcome_notes: outcomeNotes.trim() })
              }
            >
              {saving ? 'Guardando…' : 'Marcar como evaluado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
