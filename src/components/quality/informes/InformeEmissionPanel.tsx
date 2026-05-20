'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Award, CheckCircle2, Download, Eye, FileText, Loader2, Lock } from 'lucide-react';
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
import { InformePreview } from '@/components/quality/informes/InformePreview';
import { InformeFirmaDialog } from '@/components/quality/informes/InformeFirmaDialog';
import { evaluateInformeChecklist, checklistReady, requiredUFromMuestreoRow } from '@/lib/quality/informeChecklist';
import type { InformeChecklistItem, InformeSnapshot } from '@/types/informe-ensayo';
import type { EmitFirmaInput } from '@/types/informe-ensayo';
import type { MuestreoWithRelations } from '@/types/quality';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { supabase } from '@/lib/supabase';

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [firmaOpen, setFirmaOpen] = useState(false);
  const [emitting, setEmitting] = useState(false);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [informeRes, configRes, previewRes] = await Promise.all([
        fetch(`/api/quality/informes?muestreo_id=${muestreo.id}`),
        fetch(`/api/quality/laboratorio-config?plant_id=${muestreo.plant_id ?? ''}`),
        fetch('/api/quality/informes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'preview', muestreo_id: muestreo.id }),
        }),
      ]);

      const informeJson = await informeRes.json();
      const configJson = await configRes.json();
      const previewJson = await previewRes.json();

      if (previewJson.data) setSnapshot(previewJson.data as InformeSnapshot);
      if (informeJson.data) {
        setInformeRecord(informeJson.data);
        if (informeJson.data.snapshot_json) setSnapshot(informeJson.data.snapshot_json);
      }

      const required = requiredUFromMuestreoRow({
        revenimiento_sitio: muestreo.revenimiento_sitio,
        temperatura_concreto: muestreo.temperatura_concreto,
        contenido_aire: muestreo.contenido_aire,
        masa_unitaria: muestreo.masa_unitaria,
        muestras_json: muestreo.muestras?.map((m) => ({ tipo_muestra: m.tipo_muestra })),
      });

      const publishedRes = await fetch('/api/ema/uncertainty/published');
      const publishedJson = await publishedRes.json();
      const publishedRows = Array.isArray(publishedJson) ? publishedJson : publishedJson.data ?? [];
      const publishedCodes = new Set(
        publishedRows.map((r: { measurand?: { codigo: string } }) => r.measurand?.codigo).filter(Boolean)
      );
      const uncertaintyMissing = required.filter((r) => !publishedCodes.has(r.codigo)).map((r) => r.codigo);

      const items = evaluateInformeChecklist({
        muestreo: {
          id: muestreo.id,
          fecha_recepcion_lab: (muestreo as { fecha_recepcion_lab?: string }).fecha_recepcion_lab,
          muestreado_por: (muestreo as { muestreado_por?: string }).muestreado_por,
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
  }, [muestreo, ensayoHasEquipment, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const ready = checklistReady(checklist);
  const emitted = informeRecord?.estado === 'emitido';

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
      setPreviewOpen(false);
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
    if (!snapshot) return;
    const { pdf } = await import('@react-pdf/renderer');
    const { InformeResultadosPDF } = await import('@/components/quality/informes/InformeResultadosPDF');
    const blob = await pdf(<InformeResultadosPDF snapshot={snapshot} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${snapshot.documento.numero ?? 'informe'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const gapLinks = checklist.filter((i) => !i.ok).map((i) => ({ label: i.label, href: i.href }));

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
              <CardDescription>DC-LC-7.8-01 · Incertidumbre desde módulo EMA</CardDescription>
            </div>
            {emitted ? (
              <Badge className="bg-emerald-600">{informeRecord?.numero}</Badge>
            ) : ready ? (
              <Badge variant="outline" className="border-amber-300 text-amber-800">
                Listo para emitir
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Lock className="h-3 w-3 mr-1" />
                Incompleto
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

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewOpen(true)}
                  disabled={!snapshot}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Vista previa
                </Button>
                {!emitted && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!ready || emitting}
                    onClick={() => setPreviewOpen(true)}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Emitir informe
                  </Button>
                )}
                {emitted && snapshot && (
                  <Button type="button" size="sm" variant="secondary" onClick={handleDownloadPdf}>
                    <Download className="h-4 w-4 mr-1" />
                    Descargar PDF
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Vista previa del informe</SheetTitle>
            <SheetDescription>Revise §1–§6 antes de emitir el folio definitivo.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {snapshot && <InformePreview snapshot={snapshot} gaps={gapLinks} />}
            {!emitted && (
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
                  onClick={() => setFirmaOpen(true)}
                  disabled={!ready || emitting}
                  className="w-full"
                >
                  Continuar a firmas…
                </Button>
              </div>
            )}
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
