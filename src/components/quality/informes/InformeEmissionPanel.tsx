'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Award, CheckCircle2, Download, Eye, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { InformeFirmaDialog } from '@/components/quality/informes/InformeFirmaDialog';
import {
  evaluateInformeChecklist,
  checklistHasGaps,
  requiredUFromMuestreoRow,
} from '@/lib/quality/informeChecklist';
import type { InformeChecklistItem, InformeSnapshot } from '@/types/informe-ensayo';
import type { EmitFirmaInput } from '@/types/informe-ensayo';
import type { MuestreoWithRelations } from '@/types/quality';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { supabase } from '@/lib/supabase';
import { isInformeLabExperiment } from '@/lib/quality/informeLabContext';
import { downloadInformePdf } from '@/lib/quality/downloadInformePdf';

type Props = {
  muestreo: MuestreoWithRelations;
  ensayoHasEquipment?: boolean;
};

export default function InformeEmissionPanel({ muestreo, ensayoHasEquipment }: Props) {
  const { toast } = useToast();
  const { profile, user } = useAuthBridge();
  const [checklist, setChecklist] = useState<InformeChecklistItem[]>([]);
  const [snapshot, setSnapshot] = useState<InformeSnapshot | null>(null);
  const [informeRecord, setInformeRecord] = useState<{ id: string; numero: string; estado: string; issued_at?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [emitSheetOpen, setEmitSheetOpen] = useState(false);
  const [firmaOpen, setFirmaOpen] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [opinion, setOpinion] = useState('');
  const [profileMeta, setProfileMeta] = useState<{
    first_name?: string | null;
    last_name?: string | null;
    cedula_profesional?: string | null;
  }>();

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from('user_profiles')
      .select('first_name, last_name, cedula_profesional')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfileMeta(data);
      });
  }, [user?.id]);

  const refreshPreview = useCallback(async (): Promise<InformeSnapshot | null> => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const previewRes = await fetch('/api/quality/informes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', muestreo_id: muestreo.id }),
      });
      const previewJson = await previewRes.json();
      if (!previewRes.ok) {
        throw new Error(
          typeof previewJson.error === 'string' ? previewJson.error : 'No se pudo generar la vista previa',
        );
      }
      const next = (previewJson.data ?? null) as InformeSnapshot | null;
      if (next) setSnapshot(next);
      return next;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al generar vista previa';
      setPreviewError(msg);
      return null;
    } finally {
      setPreviewLoading(false);
    }
  }, [muestreo.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [informeRes, configRes] = await Promise.all([
        fetch(`/api/quality/informes?muestreo_id=${muestreo.id}`),
        fetch(`/api/quality/laboratorio-config?plant_id=${muestreo.plant_id ?? ''}`),
      ]);

      const informeJson = await informeRes.json();
      const configJson = await configRes.json();

      if (informeJson.data) {
        setInformeRecord(informeJson.data);
      }

      // Borrador snapshots are rebuilt from live DB so new ensayos appear; emitted informes stay frozen.
      if (informeJson.data?.estado === 'emitido' && informeJson.data.snapshot_json) {
        setSnapshot(informeJson.data.snapshot_json as InformeSnapshot);
      } else {
        await refreshPreview();
      }

      const required = requiredUFromMuestreoRow({
        revenimiento_sitio: muestreo.revenimiento_sitio,
        temperatura_concreto: muestreo.temperatura_concreto,
        contenido_aire: muestreo.contenido_aire,
        masa_unitaria: muestreo.masa_unitaria,
        muestras_json: muestreo.muestras?.map((m) => ({ tipo_muestra: m.tipo_muestra })),
        declarar_incertidumbre_campo: muestreo.declarar_incertidumbre_campo,
      });

      const publishedRes = await fetch('/api/ema/uncertainty/published');
      const publishedJson = await publishedRes.json();
      const publishedRows = Array.isArray(publishedJson) ? publishedJson : publishedJson.data ?? [];
      const publishedCodes = new Set(
        publishedRows.map((r: { measurand?: { codigo: string } }) => r.measurand?.codigo).filter(Boolean)
      );
      const uncertaintyMissing = required.filter((r) => !publishedCodes.has(r.codigo)).map((r) => r.codigo);

      const isLabExperiment =
        muestreo.sampling_type === 'LAB_EXPERIMENT' || !!muestreo.laboratorio_lote_id;

      const items = evaluateInformeChecklist({
        isLabExperiment,
        muestreo: {
          id: muestreo.id,
          fecha_recepcion_lab: (muestreo as { fecha_recepcion_lab?: string }).fecha_recepcion_lab,
          muestreado_por: (muestreo as { muestreado_por?: string }).muestreado_por,
          laboratorio_lote_id: muestreo.laboratorio_lote_id,
          muestras: muestreo.muestras,
        },
        order_elemento: (muestreo.remision as { order?: { elemento?: string } } | undefined)?.order?.elemento ?? null,
        labConfig: configJson.data,
        ensayoHasEquipment,
        uncertaintyMissing,
      });
      setChecklist(items);
    } catch {
      toast({ title: 'Error al cargar informe', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [muestreo, ensayoHasEquipment, toast, refreshPreview]);

  useEffect(() => {
    load();
  }, [load]);

  const hasGaps = checklistHasGaps(checklist);
  const emitted = informeRecord?.estado === 'emitido';
  const isLabMuestreo =
    muestreo.sampling_type === 'LAB_EXPERIMENT' || !!muestreo.laboratorio_lote_id;
  const isLabInforme = snapshot ? isInformeLabExperiment(snapshot) : isLabMuestreo;

  const handleEmit = async (firmas: EmitFirmaInput[]) => {
    setEmitting(true);
    try {
      const res = await fetch('/api/quality/informes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'emit',
          muestreo_id: muestreo.id,
          opinion_tecnica: opinion || undefined,
          firmas,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo emitir');
      toast({ title: `Informe ${json.data.informe.numero} emitido` });
      await load();
      setEmitSheetOpen(false);
      setFirmaOpen(false);
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : 'Error al emitir',
        variant: 'destructive',
      });
    } finally {
      setEmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setPdfDownloading(true);
    try {
      const snap = emitted ? snapshot : (await refreshPreview()) ?? snapshot;
      if (!snap) {
        toast({
          title: 'No hay datos para el PDF',
          description: previewError ?? 'Genere la vista previa e intente de nuevo.',
          variant: 'destructive',
        });
        return;
      }
      await downloadInformePdf(snap, {
        borrador: !emitted,
        numeroMuestreo: muestreo.numero_muestreo,
        muestreoId: muestreo.id,
      });
    } catch (e) {
      toast({
        title: 'Error al generar el PDF',
        description: e instanceof Error ? e.message : 'Revise la consola para más detalle.',
        variant: 'destructive',
      });
    } finally {
      setPdfDownloading(false);
    }
  };

  const confirmProceedWithGaps = (actionLabel: string): boolean => {
    if (!checklistHasGaps(checklist)) return true;
    const lines = checklist
      .filter((i) => !i.ok)
      .map((i) => `• ${i.label}`)
      .join('\n');
    return window.confirm(
      `El informe tiene información pendiente:\n\n${lines}\n\n¿Desea ${actionLabel} de todos modos con los datos disponibles?`
    );
  };

  const imprimirHref = `/quality/muestreos/${muestreo.id}/imprimir`;

  const signerProfile = profileMeta ?? {
    first_name: profile?.first_name,
    last_name: profile?.last_name,
    cedula_profesional: null,
  };

  return (
    <>
      <Card className="border-stone-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-[#1B365D]" />
                Informe de resultados (ISO 7.8)
              </CardTitle>
              <CardDescription>
                DC-LC-7.8-01 · Incertidumbre desde módulo EMA
                {isLabInforme ? ' · Formato experimento interno (I+D)' : ''}
                {' · '}
                {snapshot && !emitted
                  ? `Vista previa con ${snapshot.resultados_compresion.length} ensayo(s) de compresión registrados. `
                  : ''}
                El borrador se actualiza con los ensayos ya capturados en el sistema.
              </CardDescription>
            </div>
            {emitted ? (
              <Badge className="bg-emerald-600">{informeRecord?.numero}</Badge>
            ) : hasGaps ? (
              <Badge variant="outline" className="border-amber-300 text-amber-800">
                Con pendientes
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-300 text-emerald-800">
                Listo para emitir
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Evaluando checklist…
            </div>
          ) : (
            <>
              <ul className="text-xs space-y-1">
                {checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    {item.ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border border-stone-300 shrink-0" />
                    )}
                    {item.href && !item.ok ? (
                      <Link href={item.href} className="text-[#1B365D] underline underline-offset-2">
                        {item.label}
                      </Link>
                    ) : (
                      <span className={item.ok ? 'text-stone-600' : 'text-stone-800'}>{item.label}</span>
                    )}
                  </li>
                ))}
              </ul>

              {emitted && informeRecord?.issued_at && (
                <p className="text-xs text-stone-500">
                  Emitido{' '}
                  {format(new Date(informeRecord.issued_at), "d MMM yyyy HH:mm", { locale: es })}
                </p>
              )}

              {previewError ? (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5">
                  Vista previa: {previewError}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={imprimirHref}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ver PDF
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pdfDownloading || previewLoading || (!emitted && !snapshot)}
                  onClick={() => void handleDownloadPdf()}
                >
                  {pdfDownloading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}
                  {emitted ? 'Descargar PDF' : 'Descargar PDF (borrador)'}
                </Button>
                {!snapshot ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-stone-600"
                    disabled={previewLoading}
                    onClick={() => void refreshPreview()}
                  >
                    Generar borrador
                  </Button>
                ) : null}
                {!emitted && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!snapshot || emitting}
                    onClick={() => {
                      if (!confirmProceedWithGaps('emitir el informe')) return;
                      setEmitSheetOpen(true);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Emitir informe
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={emitSheetOpen} onOpenChange={setEmitSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Emitir informe</SheetTitle>
            <SheetDescription>
              Revise el PDF en la vista de impresión antes de firmar. El informe emitido queda congelado.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <Button type="button" variant="outline" size="sm" className="w-full" asChild>
              <Link href={imprimirHref}>
                <Eye className="h-4 w-4 mr-1" />
                Abrir vista previa PDF
              </Link>
            </Button>
            <div className="space-y-2">
              <Label htmlFor="opinion">Opinión e interpretaciones (opcional)</Label>
              <Textarea
                id="opinion"
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                rows={3}
                placeholder="Solo si aplica §5.9 / interpretación técnica"
              />
              <Button
                type="button"
                onClick={() => {
                  if (!confirmProceedWithGaps('continuar a la emisión')) return;
                  setFirmaOpen(true);
                }}
                disabled={!snapshot || emitting}
                className="w-full"
              >
                Continuar a firmas…
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <InformeFirmaDialog
        open={firmaOpen}
        onOpenChange={setFirmaOpen}
        loading={emitting}
        profile={signerProfile}
        userId={user?.id}
        onConfirm={(firmas) => void handleEmit(firmas)}
      />
    </>
  );
}
