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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ChevronLeft, RefreshCw, Mail, Users } from 'lucide-react';
import type { DailyComplianceReport, ComplianceRuleId } from '@/lib/compliance/run';
import { ComplianceRoutingReferenceCard } from '@/components/compliance/ComplianceRoutingReferenceCard';
import { ComplianceEmailSettingsCard } from '@/components/compliance/ComplianceEmailSettingsCard';
import { ComplianceFindingRow } from '@/components/compliance/ComplianceFindingRow';
import { ComplianceEmailComposer } from '@/components/compliance/ComplianceEmailComposer';
import { ComplianceIncidentsTab } from '@/components/compliance/ComplianceIncidentsTab';
import RoleGuard from '@/components/auth/RoleGuard';
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

function DailyComplianceContent() {
  const [date, setDate] = useState(defaultYmd);
  const [plantFilter, setPlantFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DailyComplianceReport | null>(null);

  // Recipients preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPlant, setPreviewPlant] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    to: string[];
    cc: string[];
    dosificadoresEnSistema: string[];
  } | null>(null);

  // Email composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPlant, setComposerPlant] = useState<string>('');
  const [composerCategory, setComposerCategory] = useState<ComplianceRuleId>('missingChecklist');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/compliance/daily/report?date=${date}`);
      if (res.status === 404) {
        setReport(null);
        setError('No hay corrida guardada para esta fecha.');
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

  useEffect(() => { void load(); }, [load]);

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

  const openComposer = (plantCode: string, category: ComplianceRuleId) => {
    setComposerPlant(plantCode);
    setComposerCategory(category);
    setComposerOpen(true);
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

  const plants = report?.plants ?? [];
  const plantCodes = ['all', ...plants.map((p) => p.plantCode)];
  const visiblePlants =
    plantFilter === 'all' ? plants : plants.filter((p) => p.plantCode === plantFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
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
        Revisa hallazgos entre cotizador y mantenimiento, personaliza y envía correos de seguimiento, y rastrea incidentes hasta su resolución.
      </p>

      <ComplianceRoutingReferenceCard />
      <ComplianceEmailSettingsCard />

      {/* Date & filter controls */}
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

      {/* Error / empty state */}
      {error ? (
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex-1">{error}</span>
          {error.includes('No hay corrida') && (
            <Button size="sm" onClick={() => void runNow()} disabled={running}>
              {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Calcular ahora
            </Button>
          )}
        </div>
      ) : null}

      {/* Main content tabs */}
      <Tabs defaultValue="hallazgos">
        <TabsList className="mb-4">
          <TabsTrigger value="hallazgos">Hallazgos</TabsTrigger>
          <TabsTrigger value="incidentes">Incidentes enviados</TabsTrigger>
        </TabsList>

        <TabsContent value="hallazgos" className="space-y-4">
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
                      {/* Recipient preview + email action buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void openRecipientPreview(plant.plantCode)}
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span className="ml-1.5">Quién recibe</span>
                        </Button>
                      </div>
                      <p className="text-xs text-stone-500">
                        Cada botón abre el compositor para <strong>un correo</strong> con todos los ítems de esa categoría. El número entre paréntesis es la cantidad de hallazgos.
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
                              title={disabled ? 'Sin hallazgos' : `${list.length} hallazgo(s) — clic para redactar correo`}
                              onClick={() => openComposer(plant.plantCode, er.rule)}
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

                      {/* Findings detail */}
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
            : !loading && !error && (
                <div className="rounded-lg border border-dashed border-stone-200 py-12 text-center text-sm text-stone-400">
                  Selecciona una fecha y ejecuta el cálculo para ver hallazgos.
                </div>
              )}
        </TabsContent>

        <TabsContent value="incidentes">
          <ComplianceIncidentsTab
            dateFrom={date}
            plantCode={plantFilter}
          />
        </TabsContent>
      </Tabs>

      {/* Recipients preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Destinatarios — {previewPlant ?? ''}</DialogTitle>
            <DialogDescription>
              Resultado con la política vigente, overrides guardados y dosificadores activos.
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
                    <li key={e} className="font-mono text-xs">{e}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-stone-800">Copia (CC)</div>
                <ul className="mt-1 list-inside list-disc text-stone-700">
                  {(previewData.cc?.length ? previewData.cc : ['(ninguno)']).map((e) => (
                    <li key={e} className="font-mono text-xs">{e}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-stone-800">Dosificadores en sistema</div>
                <p className="mt-1 font-mono text-xs text-stone-600">
                  {(previewData.dosificadoresEnSistema ?? []).join(', ') || '—'}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Email composer modal */}
      {composerOpen && (
        <ComplianceEmailComposer
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          onSent={(disputeId, to, cc) => {
            const toStr = to.join(', ') || '—';
            const ccStr = cc.join(', ') || '—';
            toast.success('Correo enviado', {
              description: `Para: ${toStr}\nCC: ${ccStr}${disputeId ? `\nIncidente: ${disputeId.slice(0, 8)}…` : ''}`,
              duration: 10000,
            });
          }}
          plantCode={composerPlant}
          category={composerCategory}
          date={date}
        />
      )}
    </div>
  );
}

export default function DailyCompliancePage() {
  return (
    <RoleGuard allowedRoles={['EXECUTIVE']}>
      <DailyComplianceContent />
    </RoleGuard>
  );
}
