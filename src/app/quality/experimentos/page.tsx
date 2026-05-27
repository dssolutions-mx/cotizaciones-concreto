'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb';
import ExperimentoWorkflowStepper from '@/components/quality/experimentos/ExperimentoWorkflowStepper';
import ExperimentoConformidadBadge from '@/components/quality/experimentos/ExperimentoConformidadBadge';
import { qualityHubPrimaryButtonClass } from '@/components/quality/qualityHubUi';
import { masterRecipeService } from '@/lib/services/masterRecipeService';
import {
  resolveTargetFc,
  summarizeLoteConformidad,
} from '@/lib/quality/laboratorioConformidad';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Loader2, Plus, RefreshCw, FlaskConical, X } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { nextStepHint } from '@/lib/quality/experimentoWorkflow';
import type { LaboratorioLoteWithRelations, LaboratorioLoteStatus } from '@/types/laboratorioLote';
import {
  LABORATORIO_PROTOCOL_TYPES,
  LABORATORIO_LOTE_STATUSES,
  PROTOCOL_TYPE_LABELS,
} from '@/types/laboratorioLote';
import type { MasterRecipe } from '@/types/masterRecipes';

const STATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  muestreado: 'Muestreado',
  cerrado: 'Cerrado',
  evaluado: 'Evaluado',
};

export default function ExperimentosListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentPlant } = usePlantContext();
  const { session } = useAuthBridge();
  const [rows, setRows] = useState<LaboratorioLoteWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [masterFilter, setMasterFilter] = useState('all');
  const [recipeFilter, setRecipeFilter] = useState('all');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [masters, setMasters] = useState<MasterRecipe[]>([]);

  useEffect(() => {
    const rid = searchParams.get('recipe_id');
    const mid = searchParams.get('master_recipe_id');
    if (rid) setRecipeFilter(rid);
    if (mid) setMasterFilter(mid);
  }, [searchParams]);

  useEffect(() => {
    if (!currentPlant?.id) return;
    masterRecipeService
      .getMasterRecipes(currentPlant.id)
      .then(setMasters)
      .catch(() => setMasters([]));
  }, [currentPlant?.id]);

  const syncUrl = useCallback(
    (next: { recipe_id?: string; master_recipe_id?: string }) => {
      const params = new URLSearchParams();
      if (next.master_recipe_id && next.master_recipe_id !== 'all') {
        params.set('master_recipe_id', next.master_recipe_id);
      }
      if (next.recipe_id && next.recipe_id !== 'all') {
        params.set('recipe_id', next.recipe_id);
      }
      const q = params.toString();
      router.replace(q ? `/quality/experimentos?${q}` : '/quality/experimentos');
    },
    [router]
  );

  const load = useCallback(async () => {
    if (!currentPlant?.id || !session?.user) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ plant_id: currentPlant.id });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (protocolFilter !== 'all') params.set('protocol_type', protocolFilter);
      if (masterFilter !== 'all') params.set('master_recipe_id', masterFilter);
      if (recipeFilter !== 'all') params.set('recipe_id', recipeFilter);
      if (fechaDesde) params.set('fecha_desde', fechaDesde);
      if (fechaHasta) params.set('fecha_hasta', fechaHasta);

      const res = await fetch(`/api/quality/laboratorio-lotes?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar');
      setRows(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [
    currentPlant?.id,
    session?.user,
    statusFilter,
    protocolFilter,
    masterFilter,
    recipeFilter,
    fechaDesde,
    fechaHasta,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const activeMasterLabel = useMemo(
    () => masters.find((m) => m.id === masterFilter)?.master_code,
    [masters, masterFilter]
  );

  const activeRecipeLabel = useMemo(() => {
    if (recipeFilter === 'all') return null;
    const fromRow = rows.find((r) => r.recipe_id === recipeFilter);
    return fromRow?.recipe?.recipe_code ?? null;
  }, [recipeFilter, rows]);

  const hasDeepLink = masterFilter !== 'all' || recipeFilter !== 'all';

  const clearDeepFilters = () => {
    setMasterFilter('all');
    setRecipeFilter('all');
    router.replace('/quality/experimentos');
  };

  return (
    <div className="space-y-5">
      <QualityBreadcrumb
        hubName="Validaciones"
        hubHref="/quality/validaciones"
        items={[{ label: 'Experimentos' }]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-stone-900 flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-violet-700" />
            Experimentos de laboratorio
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Registrar mezcla interna, planificar muestras y dar seguimiento a ensayos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Link href="/quality/experimentos/new">
            <Button className={qualityHubPrimaryButtonClass}>
              <Plus className="h-4 w-4 mr-1" />
              Nuevo experimento
            </Button>
          </Link>
        </div>
      </div>

      {hasDeepLink && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <span>
            Filtro desde recetas:
            {activeMasterLabel && <> maestro {activeMasterLabel}</>}
            {activeRecipeLabel && <> variante {activeRecipeLabel}</>}
            {!activeMasterLabel && !activeRecipeLabel && <> variante / maestro seleccionado</>}
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={clearDeepFilters}>
            <X className="h-3.5 w-3.5 mr-1" />
            Quitar
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
        <p className="text-xs font-medium text-violet-900 mb-2">Procedimiento</p>
        <ExperimentoWorkflowStepper currentStep="mezcla" compact />
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-stone-500">Estado</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {LABORATORIO_LOTE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-stone-500">Protocolo</label>
          <Select value={protocolFilter} onValueChange={setProtocolFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {LABORATORIO_PROTOCOL_TYPES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PROTOCOL_TYPE_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-stone-500">Receta maestra</label>
          <Select
            value={masterFilter}
            onValueChange={(v) => {
              setMasterFilter(v);
              if (v !== 'all') setRecipeFilter('all');
              syncUrl({ master_recipe_id: v, recipe_id: 'all' });
            }}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {masters.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.master_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-stone-500">Desde</label>
          <Input
            type="date"
            className="h-9 w-[140px]"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-stone-500">Hasta</label>
          <Input
            type="date"
            className="h-9 w-[140px]"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 px-4">
            <FlaskConical className="h-10 w-10 text-violet-300 mx-auto mb-3" />
            <p className="text-sm text-stone-600 mb-1">No hay lotes con estos filtros.</p>
            <p className="text-xs text-stone-500 mb-4">
              Crea un lote para documentar la mezcla y luego planifica muestras desde su detalle.
            </p>
            <Link href="/quality/experimentos/new">
              <Button className={qualityHubPrimaryButtonClass}>Nuevo experimento</Button>
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs text-stone-500 px-4 py-2 border-b border-stone-100">
              {rows.length} lote{rows.length !== 1 ? 's' : ''}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Estudio</TableHead>
                  <TableHead>Receta ref.</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Conformidad</TableHead>
                  <TableHead>Siguiente paso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const hasMuestreo = (row.muestreos?.length ?? 0) > 0;
                  const hint = nextStepHint(row.status as LaboratorioLoteStatus, hasMuestreo);
                  const conf = summarizeLoteConformidad(
                    resolveTargetFc(row),
                    row.muestreos ?? []
                  );
                  const confDetail =
                    conf.bestFc != null && conf.targetFc != null
                      ? `max ${conf.bestFc.toFixed(0)} / ${conf.targetFc}`
                      : conf.bestPct != null
                        ? `max ${conf.bestPct.toFixed(0)}%`
                        : undefined;
                  return (
                    <TableRow key={row.id} className="hover:bg-stone-50">
                      <TableCell>
                        <Link
                          href={`/quality/experimentos/${row.id}`}
                          className="font-medium text-sky-700 hover:underline"
                        >
                          {row.lote_number}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate">{row.study_name}</TableCell>
                      <TableCell className="text-sm text-stone-600">
                        {row.recipe?.recipe_code ?? '—'}
                      </TableCell>
                      <TableCell>{formatDate(row.fecha, 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{STATUS_LABELS[row.status] ?? row.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <ExperimentoConformidadBadge status={conf.status} showDetail={confDetail} />
                      </TableCell>
                      <TableCell className="text-sm text-stone-600">{hint}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </div>
  );
}
