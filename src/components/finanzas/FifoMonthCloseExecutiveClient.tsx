'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, CheckCircle2, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/types/supabase';
import { usePlantContext } from '@/contexts/PlantContext';
import { cn } from '@/lib/utils';

type GapRow = Database['public']['Functions']['fn_fifo_operational_gaps']['Returns'][number];

type ApiPayload = {
  from: string;
  to: string;
  rows: GapRow[];
  summary: {
    total_lines: number;
    gap_lines: number;
    allocated_lines: number;
    distinct_plant_material_gaps: number;
    gap_by_reason: Record<string, number>;
  };
};

function monthBounds(ym: string): { from: string; to: string } | null {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return null;
  const from = `${y}-${String(mo).padStart(2, '0')}-01`;
  const last = new Date(y, mo, 0);
  const to = `${y}-${String(mo).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  return { from, to };
}

function formatDayLabel(isoDate: string) {
  try {
    return format(parseISO(isoDate), 'EEEE d MMM yyyy', { locale: es });
  } catch {
    return isoDate;
  }
}

function reasonBadgeClass(code: string): string {
  switch (code) {
    case 'FIRST_RECEIPT_AFTER_POUR_DATE':
      return 'bg-amber-100 text-amber-950 border-amber-300';
    case 'NO_RECEIPTS_IN_SYSTEM':
      return 'bg-red-100 text-red-950 border-red-300';
    case 'INSUFFICIENT_STOCK_SNAPSHOT':
      return 'bg-orange-100 text-orange-950 border-orange-300';
    case 'UNKNOWN_ELSE':
      return 'bg-violet-100 text-violet-950 border-violet-300';
    default:
      return 'bg-stone-100 text-stone-800 border-stone-300';
  }
}

type ReplaySummary = {
  ok: number;
  fail: number;
  total: number;
  dateFrom: string;
  dateTo: string;
};

export default function FifoMonthCloseExecutiveClient() {
  const { availablePlants } = usePlantContext();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  /** '' = todas las plantas */
  const [plantId, setPlantId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  /** `month` = replay de rango mensual; `YYYY-MM-DD` = día concreto */
  const [replayTarget, setReplayTarget] = useState<string | null>(null);
  const [monthConfirmOpen, setMonthConfirmOpen] = useState(false);
  const [lastReplay, setLastReplay] = useState<ReplaySummary | null>(null);

  const bounds = useMemo(() => monthBounds(month), [month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month });
      if (plantId) params.set('plant_id', plantId);
      const res = await fetch(`/api/procurement/fifo-gaps?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setPayload(null);
        setError(typeof json.error === 'string' ? json.error : 'No se pudo cargar');
        return;
      }
      setPayload(json.data as ApiPayload);
    } catch {
      setPayload(null);
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }, [month, plantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const gaps = useMemo(() => (payload?.rows ?? []).filter((r) => !r.is_allocated), [payload]);

  const dayLadder = useMemo(() => {
    const byDate = new Map<
      string,
      { fecha: string; lines: GapRow[]; plantCodes: Set<string> }
    >();
    for (const r of gaps) {
      const fecha = String(r.remision_fecha);
      if (!byDate.has(fecha)) {
        byDate.set(fecha, { fecha, lines: [], plantCodes: new Set() });
      }
      const g = byDate.get(fecha)!;
      g.lines.push(r);
      if (r.plant_code) g.plantCodes.add(r.plant_code);
    }
    const arr = Array.from(byDate.values());
    arr.sort((a, b) => {
      if (b.lines.length !== a.lines.length) return b.lines.length - a.lines.length;
      return b.fecha.localeCompare(a.fecha);
    });
    return arr;
  }, [gaps]);

  const runReplay = useCallback(
    async (body: Record<string, unknown>, target: 'month' | string) => {
      if (plantId) body.plant_id = plantId;
      setReplayTarget(target);
      setLastReplay(null);
      try {
        const res = await fetch('/api/finanzas/fifo-closure/replay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as ReplaySummary & {
          success?: boolean;
          error?: string;
          failuresSample?: Array<{ remision_id: string; message: string }>;
        };
        if (!res.ok || !json.success) {
          toast.error(typeof json.error === 'string' ? json.error : 'Error en re-ejecución FIFO');
          return;
        }
        setLastReplay({
          ok: json.ok,
          fail: json.fail,
          total: json.total,
          dateFrom: json.dateFrom,
          dateTo: json.dateTo,
        });
        toast.success(
          `FIFO: ${json.ok} ok · ${json.fail} con incidencias · ${json.total} remisiones procesadas`
        );
        if (json.fail > 0 && json.failuresSample?.length) {
          console.warn('[fifo-closure] failures sample', json.failuresSample);
        }
        await load();
      } catch {
        toast.error('Error de red');
      } finally {
        setReplayTarget(null);
      }
    },
    [plantId, load]
  );

  const replayBusy = replayTarget !== null;
  const summary = payload?.summary;

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Cierre costo FIFO (mensual)</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Consolida la visibilidad de huecos de costeo, permite re-ejecutar la asignación FIFO por día o por todo el
          mes, y documenta el criterio de cierre para firma ejecutiva.
        </p>
      </div>

      <Card className="border-stone-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">A. Alcance</CardTitle>
          <CardDescription>Mes calendario y planta (opcional). Cargue el estado desde el mismo origen que Compras.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fifo-close-month" className="text-xs font-semibold uppercase tracking-wide text-stone-600">
              Mes
            </Label>
            <Input
              id="fifo-close-month"
              type="month"
              className="w-[160px] h-9 border-stone-300 bg-white"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 min-w-[200px]">
            <Label htmlFor="fifo-close-plant" className="text-xs font-semibold uppercase tracking-wide text-stone-600">
              Planta
            </Label>
            <Select value={plantId || '__all__'} onValueChange={(v) => setPlantId(v === '__all__' ? '' : v)}>
              <SelectTrigger id="fifo-close-plant" className="h-9 border-stone-300 bg-white">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las plantas</SelectItem>
                {availablePlants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 border-stone-300"
            onClick={() => void load()}
            disabled={loading || replayBusy}
          >
            <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} />
            Cargar estado
          </Button>
        </CardContent>
      </Card>

      <Card className="border-stone-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">B. Indicadores y puerta de cierre</CardTitle>
          <CardDescription>
            Criterio operativo: cero líneas con hueco en el alcance seleccionado antes de dar por cerrado el mes (salvo
            excepciones documentadas fuera de sistema).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !payload && (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full max-w-md" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>
          )}
          {summary && (
            <>
              <div
                className={cn(
                  'rounded-lg border px-4 py-3 flex items-start gap-3',
                  summary.gap_lines === 0
                    ? 'border-emerald-200 bg-emerald-50/90 text-emerald-950'
                    : 'border-amber-200 bg-amber-50/80 text-amber-950'
                )}
              >
                {summary.gap_lines === 0 ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
                )}
                <div>
                  <p className="font-medium">
                    {summary.gap_lines === 0
                      ? 'Sin huecos en el alcance — listo para cierre contable FIFO'
                      : `Hay ${summary.gap_lines} línea(s) sin costeo completo`}
                  </p>
                  <p className="text-sm opacity-90 mt-0.5">
                    Plantas × materiales distintos con hueco: {summary.distinct_plant_material_gaps}. Líneas con costo:{' '}
                    {summary.allocated_lines} / {summary.total_lines}.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.gap_by_reason)
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, n]) => (
                    <Badge key={code} variant="outline" className={cn('font-mono text-xs', reasonBadgeClass(code))}>
                      {code}: {n}
                    </Badge>
                  ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-stone-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">C. Escalera por día (solo días con huecos)</CardTitle>
          <CardDescription>
            Ordenados por severidad (más líneas con hueco primero). Re-ejecuta FIFO para todas las remisiones CONCRETO
            del día en el rango de la planta seleccionada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dayLadder.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {payload ? 'No hay días con huecos en este alcance.' : 'Cargue el estado para ver la escalera.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Líneas con hueco</TableHead>
                  <TableHead>Plantas</TableHead>
                  <TableHead className="w-[200px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayLadder.map((d) => (
                  <TableRow key={d.fecha}>
                    <TableCell>
                      <div className="font-medium">{formatDayLabel(d.fecha)}</div>
                      <div className="text-xs text-muted-foreground font-mono">{d.fecha}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{d.lines.length}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[...d.plantCodes].sort((a, b) => a.localeCompare(b, 'es')).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={replayBusy}
                        onClick={() => void runReplay({ mode: 'day', date: d.fecha }, d.fecha)}
                      >
                        {replayTarget === d.fecha ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Procesando…
                          </>
                        ) : (
                          'Re-ejecutar FIFO este día'
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-stone-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">D. Re-ejecución de todo el mes</CardTitle>
          <CardDescription>
            Recorre en secuencia todas las remisiones CONCRETO del mes ({bounds?.from ?? '…'} — {bounds?.to ?? '…'}) y
            vuelve a correr la asignación FIFO. Use después de corregir entradas o datos maestros.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button
            type="button"
            variant="default"
            disabled={replayBusy || !bounds}
            onClick={() => setMonthConfirmOpen(true)}
          >
            {replayTarget === 'month' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Re-ejecutando mes…
              </>
            ) : (
              'Re-ejecutar FIFO todo el mes (rango)'
            )}
          </Button>
          {lastReplay && (
            <p className="text-sm text-muted-foreground">
              Última corrida: {lastReplay.dateFrom} — {lastReplay.dateTo}: {lastReplay.ok} ok, {lastReplay.fail}{' '}
              incidencias, {lastReplay.total} remisiones.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={monthConfirmOpen} onOpenChange={setMonthConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar re-ejecución FIFO del mes</AlertDialogTitle>
            <AlertDialogDescription>
              Se procesarán todas las remisiones tipo CONCRETO desde {bounds?.from} hasta {bounds?.to}
              {plantId ? ' para la planta seleccionada' : ' en todas las plantas'}. La operación puede tardar varios
              minutos. ¿Desea continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setMonthConfirmOpen(false);
                if (!bounds) return;
                void runReplay({ mode: 'range', from: bounds.from, to: bounds.to }, 'month');
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Collapsible className="group rounded-xl border border-stone-200 bg-stone-50/50">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-stone-100/80 rounded-xl transition-colors">
          <div>
            <span className="font-semibold text-stone-900">E. Esquema de cierre mensual</span>
            <p className="text-xs text-stone-600 mt-0.5">Pasos ordenados — misma lógica que operaciones</p>
          </div>
          <ChevronDown className="h-5 w-5 text-stone-500 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4 pt-0">
          <ol className="list-decimal list-inside space-y-2 text-sm text-stone-800 leading-relaxed border-t border-stone-200/80 pt-3">
            <li>
              <strong className="font-semibold">Atender causas raíz de datos</strong> según{' '}
              <code className="text-xs bg-white px-1 py-0.5 rounded border">reason_code</code>: recepciones faltantes (
              <code className="text-xs">NO_RECEIPTS_IN_SYSTEM</code>), stock insuficiente al verter (
              <code className="text-xs">INSUFFICIENT_STOCK_SNAPSHOT</code>), o primera entrada posterior a la colada (
              <code className="text-xs">FIRST_RECEIPT_AFTER_POUR_DATE</code>) — en ese caso revisar{' '}
              <code className="text-xs">entry_date</code> en entradas de material.
            </li>
            <li>
              <strong className="font-semibold">Corregir en Compras / plantas</strong> (PO, recepciones, consumos)
              hasta que el negocio valide los datos.
            </li>
            <li>
              <strong className="font-semibold">Re-ejecutar FIFO</strong> por día grave (bloque C) o mes completo
              (bloque D) tras las correcciones.
            </li>
            <li>
              <strong className="font-semibold">Cargar estado</strong> de nuevo y verificar que la puerta de cierre
              (bloque B) muestre cero huecos.
            </li>
            <li>
              <strong className="font-semibold">Firma ejecutiva</strong> solo cuando no queden líneas con hueco o
              exista lista explícita de excepciones aprobadas fuera de esta herramienta.
            </li>
          </ol>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
