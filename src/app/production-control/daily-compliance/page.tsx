'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ChevronLeft, RefreshCw, Mail, Users } from 'lucide-react';
import type { DailyComplianceReport, ComplianceRuleId } from '@/lib/compliance/run';
import { ComplianceRoutingReferenceCard } from '@/components/compliance/ComplianceRoutingReferenceCard';
import { ComplianceEmailSettingsCard } from '@/components/compliance/ComplianceEmailSettingsCard';
import { ComplianceFindingRow } from '@/components/compliance/ComplianceFindingRow';
import { useAuthSelectors } from '@/hooks/use-auth-zustand';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function defaultYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const EMAIL_RULES: { rule: ComplianceRuleId; label: string }[] = [
  { rule: 'missingProduction', label: 'Sin remisiones CONCRETO' },
  { rule: 'missingMaterialEntries', label: 'Sin entradas de material' },
  { rule: 'missingEvidence', label: 'Evidencia faltante' },
  { rule: 'missingPumping', label: 'Bombeo faltante' },
  { rule: 'missingChecklist', label: 'Checklist faltante' },
  { rule: 'operatorMismatch', label: 'Conductor ≠ operador' },
  { rule: 'unknownUnit', label: 'Unidad no registrada' },
];

const PANEL_ONLY_RULES: ComplianceRuleId[] = ['noDieselActivity', 'dieselWithoutProduction'];

/** Orden de secciones en hallazgos */
const FINDING_ORDER: ComplianceRuleId[] = [
  'missingProduction',
  'missingMaterialEntries',
  'missingEvidence',
  'missingPumping',
  'missingChecklist',
  'operatorMismatch',
  'unknownUnit',
  'noDieselActivity',
  'dieselWithoutProduction',
];

const RULE_SECTION_TITLE: Partial<Record<ComplianceRuleId, string>> = {
  missingProduction: 'Sin dosificación (día operativo)',
  missingMaterialEntries: 'Sin entradas de material',
  missingEvidence: 'Evidencia de concreto',
  missingPumping: 'Bombeo',
  missingChecklist: 'Checklist mantenimiento',
  operatorMismatch: 'Conductor vs operador asignado',
  unknownUnit: 'Unidad / activo',
  noDieselActivity: 'Diesel vs producción (info)',
  dieselWithoutProduction: 'Diesel vs producción (info)',
};

export default function DailyCompliancePage() {
  const { profile } = useAuthSelectors();
  const [date, setDate] = useState(defaultYmd);
  const [plantFilter, setPlantFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DailyComplianceReport | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPlant, setPreviewPlant] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    to: string[];
    cc: string[];
    dosificadoresEnSistema: string[];
  } | null>(null);

  const allowed =
    profile?.role === 'EXECUTIVE' ||
    profile?.role === 'ADMIN_OPERATIONS' ||
    profile?.role === 'PLANT_MANAGER' ||
    profile?.role === 'QUALITY_TEAM';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/compliance/daily/report?date=${date}`);
      if (res.status === 404) {
        setReport(null);
        setError('No hay corrida guardada para esta fecha. Ejecuta "Calcular ahora".');
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Error');
        setReport(null);
        return;
      }
      const run = json.run as { report: DailyComplianceReport } | undefined;
      if (run?.report) setReport(run.report);
      else setReport(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const runNow = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/compliance/daily/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, notify: false }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Error al calcular');
        return;
      }
      if (json.report) setReport(json.report as DailyComplianceReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setRunning(false);
    }
  };

  const sendDispute = async (plantCode: string, category: ComplianceRuleId) => {
    try {
      const res = await fetch('/api/compliance/daily/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: date, plantCode, category }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'No se pudo enviar');
        return;
      }
      const to = (json.to as string[] | undefined)?.join(', ') || '—';
      const cc = (json.cc as string[] | undefined)?.join(', ') || '—';
      toast.success('Correo enviado', {
        description: `Para: ${to}\nCC: ${cc}`,
        duration: 8000,
      });
    } catch {
      toast.error('Error de red');
    }
  };

  const openRecipientPreview = async (plantCode: string) => {
    setPreviewPlant(plantCode);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await fetch(
        `/api/compliance/daily/recipients-preview?plantCode=${encodeURIComponent(plantCode)}`,
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'No se pudo cargar la vista previa');
        setPreviewOpen(false);
        return;
      }
      setPreviewData({
        to: json.to as string[],
        cc: json.cc as string[],
        dosificadoresEnSistema: json.dosificadoresEnSistema as string[],
      });
    } catch {
      toast.error('Error de red');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (!allowed) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-stone-600">No tienes permiso para ver esta sección.</p>
        <Link href="/production-control" className="mt-4 inline-block text-sm text-blue-600 underline">
          Volver
        </Link>
      </div>
    );
  }

  const plants = report?.plants ?? [];
  const plantCodes = ['all', ...plants.map((p) => p.plantCode)];

  const visiblePlants =
    plantFilter === 'all'
      ? plants
      : plants.filter((p) => p.plantCode === plantFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/production-control" className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Producción
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Compliance diario
        </h1>
      </div>

      <p className="max-w-3xl text-sm text-stone-600">
        Calcula hallazgos entre cotizador y mantenimiento, revisa por planta y envía correos de
        seguimiento. Abajo ves la nómina real de correos y reglas por región; más abajo ajustas solo
        extras por planta y el digest.
      </p>

      <ComplianceRoutingReferenceCard />

      <ComplianceEmailSettingsCard />

      <Card className="border-stone-200">
        <CardHeader>
          <CardTitle>Fecha y filtros</CardTitle>
          <CardDescription>
            Zona horaria: America/Mexico_City. Comparativa cotizador ↔ mantenimiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="d">Fecha</Label>
            <Input
              id="d"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Planta</Label>
            <Select value={plantFilter} onValueChange={setPlantFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                {plantCodes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === 'all' ? 'Todas' : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Recargar</span>
          </Button>
          <Button type="button" onClick={() => void runNow()} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span className="ml-2">Calcular ahora</span>
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {report
        ? visiblePlants.map((plant) => {
            const byRule = report.byPlantCategory[plant.plantId] ?? {};
            const findings = report.findings.filter((f) => f.plantId === plant.plantId);
            return (
              <Card key={plant.plantId} className="border-stone-200">
                <CardHeader>
                  <CardTitle>
                    {plant.plantCode} — {plant.plantName}
                  </CardTitle>
                  <CardDescription>
                    Producción CONCRETO: {plant.concretoRemisionCount} remisiones,{' '}
                    {plant.producedConcreteM3.toFixed(1)} m³ · Día operativo:{' '}
                    {plant.operatingDay ? 'sí' : 'no'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void openRecipientPreview(plant.plantCode)}
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span className="ml-1.5">Quién recibe (vista previa)</span>
                    </Button>
                  </div>
                  <p className="text-xs text-stone-500">
                    Cada botón envía <strong>un correo</strong> con todos los ítems de esa categoría. El número
                    entre paréntesis es cantidad de hallazgos, no de correos.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EMAIL_RULES.map((er) => {
                      const list = byRule[er.rule] ?? [];
                      const disabled = list.length === 0;
                      return (
                        <Button
                          key={er.rule}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={disabled}
                          title={`${list.length} hallazgo(s) en un solo correo`}
                          onClick={() => void sendDispute(plant.plantCode, er.rule)}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          <span className="ml-1.5">
                            {er.label}
                            {disabled ? '' : ` (${list.length})`}
                          </span>
                        </Button>
                      );
                    })}
                  </div>

                  <div className="space-y-6 text-sm">
                    {findings.length === 0 ? (
                      <p className="text-stone-500">Sin hallazgos para esta planta.</p>
                    ) : (
                      FINDING_ORDER.map((rule) => {
                        const list = findings.filter((f) => f.rule === rule);
                        if (!list.length) return null;
                        const panelOnly = PANEL_ONLY_RULES.includes(rule);
                        return (
                          <div key={rule}>
                            <div className="mb-2 flex flex-wrap items-baseline gap-2 border-b border-stone-100 pb-1">
                              <h4 className="text-sm font-semibold text-stone-800">
                                {RULE_SECTION_TITLE[rule] ?? rule}
                              </h4>
                              {panelOnly ? (
                                <span className="text-xs text-stone-500">(solo panel, sin correo)</span>
                              ) : null}
                            </div>
                            <div className="space-y-2">
                              {list.map((f) => (
                                <ComplianceFindingRow key={f.findingKey} f={f} />
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        : null}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Destinatarios — {previewPlant ?? ''}
            </DialogTitle>
            <DialogDescription>
              Resultado con la política vigente, overrides guardados y dosificadores activos en
              cotizador.
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
            </div>
          ) : previewData ? (
            <div className="space-y-4 text-sm">
              <div>
                <div className="font-medium text-stone-800">Para</div>
                <ul className="mt-1 list-inside list-disc text-stone-700">
                  {(previewData.to?.length ? previewData.to : ['(ninguno)']).map((e) => (
                    <li key={e} className="font-mono text-xs">
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-stone-800">Copia (CC)</div>
                <ul className="mt-1 list-inside list-disc text-stone-700">
                  {(previewData.cc?.length ? previewData.cc : ['(ninguno)']).map((e) => (
                    <li key={e} className="font-mono text-xs">
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-stone-800">Dosificadores en sistema (cotizador)</div>
                <p className="mt-1 font-mono text-xs text-stone-600">
                  {(previewData.dosificadoresEnSistema ?? []).join(', ') || '—'}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
