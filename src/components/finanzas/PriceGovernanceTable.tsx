'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import {
  ChevronRight,
  RefreshCw,
  Calendar,
  Trash2,
  Power,
  PowerOff,
  Package,
  MapPin,
  Building2,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

type ActivePrice = {
  id: string;
  code: string;
  base_price: number;
  effective_date: string;
  created_at: string;
  updated_at: string;
  last_used: string | null;
  fc_mr_value: number | null;
  placement_type: string | null;
  max_aggregate_size: number | null;
  slump: number | null;
  age_days: number | null;
};

type PriceGovernanceSite = {
  id: string;
  client_id: string;
  client_name: string;
  client_code: string;
  site_name: string;
  location: string | null;
  plant_id: string | null;
  plant_name: string | null;
  is_active: boolean;
  valid_until: string | null;
  prices: ActivePrice[];
};

type Metrics = {
  sites_with_validity: number;
  sites_without_validity: number;
  prices_over_90_days: number;
};

/** Formato alineado con ScheduleOrderForm: f'c, Rev cm, Directa/Bombeado, TMA mm, edad días */
function formatProductSpecs(p: ActivePrice): string {
  const parts: string[] = [];
  if (p.fc_mr_value) parts.push(`f'c ${p.fc_mr_value} kg/cm²`);
  if (p.slump != null) parts.push(`Rev ${p.slump} cm`);
  if (p.placement_type) {
    const pl = String(p.placement_type).toUpperCase();
    if (pl === 'D' || pl.includes('DIRECT')) parts.push('Directa');
    else if (pl === 'B' || pl.includes('BOMB')) parts.push('Bombeado');
    else parts.push(pl);
  }
  if (p.max_aggregate_size) parts.push(`TMA ${p.max_aggregate_size} mm`);
  if (p.age_days) parts.push(`${p.age_days} días`);
  return parts.length > 0 ? parts.join(' · ') : p.code || '—';
}

/** Usa effective_date (cuándo entró en vigor el precio), no created_at (registro en BD) */
function isOver90Days(effectiveDate: string | null): boolean {
  if (!effectiveDate) return false;
  const d = new Date(effectiveDate);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  return d < cutoff;
}

function SiteRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-5 px-5 border-b border-slate-100 animate-pulse">
      <div className="h-4 w-6 bg-slate-200 rounded" />
      <div className="flex-1 space-y-2">
        <div className="h-5 w-48 bg-slate-200 rounded" />
        <div className="h-4 w-32 bg-slate-100 rounded" />
      </div>
      <div className="h-6 w-16 bg-slate-200 rounded" />
    </div>
  );
}

export function PriceGovernanceTable() {
  const [sites, setSites] = useState<PriceGovernanceSite[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('');
  const [plantFilter, setPlantFilter] = useState<string>('');
  const [clients, setClients] = useState<{ id: string; business_name: string }[]>([]);
  const [plants, setPlants] = useState<{ id: string; name: string }[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [datePopover, setDatePopover] = useState<string | null>(null);
  const [deactivatePriceTarget, setDeactivatePriceTarget] = useState<{
    priceId: string;
    specs: string;
    siteName: string;
  } | null>(null);
  const [deactivateSiteTarget, setDeactivateSiteTarget] = useState<PriceGovernanceSite | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (clientFilter) params.set('client_id', clientFilter);
      if (plantFilter) params.set('plant_id', plantFilter);
      const res = await fetch(`/api/price-governance?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setSites(json.sites || []);
      setMetrics(json.metrics || null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar');
      setSites([]);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [clientFilter, plantFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase/client');
        const [c, p] = await Promise.all([
          supabase.from('clients').select('id, business_name').eq('approval_status', 'APPROVED').order('business_name'),
          supabase.from('plants').select('id, name').eq('is_active', true).order('name'),
        ]);
        setClients(c.data || []);
        setPlants(p.data || []);
      } catch {
        setClients([]);
        setPlants([]);
      }
    })();
  }, []);

  async function updateSite(site: PriceGovernanceSite, updates: { valid_until?: string | null; is_active?: boolean }) {
    try {
      setActing(site.id);
      const res = await fetch(`/api/price-governance/sites/${site.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      toast.success(updates.is_active === false ? 'Obra desactivada' : 'Obra actualizada');
      setDatePopover(null);
      setDeactivateSiteTarget(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setActing(null);
    }
  }

  async function deactivatePrice(priceId: string) {
    try {
      setActing(priceId);
      const res = await fetch(`/api/price-governance/prices/${priceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      toast.success('Precio desactivado');
      setDeactivatePriceTarget(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar');
    } finally {
      setActing(null);
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n);

  const isSiteExpired = (s: PriceGovernanceSite) =>
    s.valid_until && new Date(s.valid_until) < new Date();

  const sitesWithPrices = sites.filter((s) => s.prices.length > 0);

  return (
    <div className="space-y-6">
      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Calendar className="h-4 w-4" />
              Obras con vigencia definida
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{metrics.sites_with_validity}</div>
            <p className="mt-0.5 text-xs text-slate-500">valid_until asignado</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <CalendarClock className="h-4 w-4" />
              Obras sin vigencia
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{metrics.sites_without_validity}</div>
            <p className="mt-0.5 text-xs text-slate-500">sin fecha de término</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-amber-700 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Precios &gt;90 días
            </div>
            <div className="mt-1 text-2xl font-semibold text-amber-800">{metrics.prices_over_90_days}</div>
            <p className="mt-0.5 text-xs text-amber-600">vigentes desde hace más de 90 días</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Precios vigentes por obra
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Precios activos en uso. Aquí puedes agregar vigencia a la obra (valid_until) o desactivar precios/obras.
            Vigente desde = cuando la cotización se aprobó. Última entrega = última entrega real.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={clientFilter || '__all__'} onValueChange={(v) => setClientFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[200px] h-9 bg-white border-slate-200">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={plantFilter || '__all__'} onValueChange={(v) => setPlantFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[180px] h-9 bg-white border-slate-200">
              <SelectValue placeholder="Planta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las plantas</SelectItem>
              {plants.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
        style={{ boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}
      >
        {loading ? (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <SiteRowSkeleton key={i} />
            ))}
          </div>
        ) : sitesWithPrices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full mb-4"
              style={{ backgroundColor: 'rgba(148, 163, 184, 0.15)' }}
            >
              <Package className="h-7 w-7 text-slate-500" />
            </div>
            <h3 className="text-base font-medium text-slate-900">Sin precios activos</h3>
            <p className="mt-2 text-center text-sm text-slate-500 max-w-sm">
              {sites.length === 0
                ? 'No hay obras aprobadas que coincidan con los filtros.'
                : 'Ninguna obra tiene precios activos. Los precios se crean al aprobar cotizaciones.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sitesWithPrices.map((site) => {
              const expanded = expandedIds.has(site.id);
              const expired = isSiteExpired(site);

              return (
                <Collapsible
                  key={site.id}
                  open={expanded}
                  onOpenChange={() => toggleExpanded(site.id)}
                >
                  <div
                    className={`transition-colors ${
                      expanded ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'
                    }`}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center gap-4 py-4 px-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                      >
                        <ChevronRight
                          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                            expanded ? 'rotate-90' : ''
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-900">{site.site_name}</span>
                            <Badge
                              variant="outline"
                              className={
                                site.is_active && !expired
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-600'
                              }
                            >
                              {site.is_active && !expired ? 'Activa' : expired ? 'Vencida' : 'Inactiva'}
                            </Badge>
                            {site.valid_until ? (
                              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                                Vigencia hasta {format(new Date(site.valid_until), 'd MMM yyyy', { locale: es })}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                Sin vigencia
                              </Badge>
                            )}
                            {site.prices.length > 0 && (
                              <span className="text-sm text-slate-500">
                                {site.prices.length} precio{site.prices.length !== 1 ? 's' : ''} vigente
                                {site.prices.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5" />
                              {site.client_name || '—'}
                              {site.client_code && (
                                <span className="font-mono">({site.client_code})</span>
                              )}
                            </span>
                            {site.location && (
                              <span className="flex items-center gap-1 truncate max-w-[200px]">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                {site.location}
                              </span>
                            )}
                            {site.plant_name && (
                              <span className="text-slate-400">{site.plant_name}</span>
                            )}
                          </div>
                        </div>
                        <div
                          className="flex items-center gap-2 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Popover.Root
                            open={datePopover === site.id}
                            onOpenChange={(o) => setDatePopover(o ? site.id : null)}
                          >
                            <Popover.Trigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                disabled={acting === site.id}
                                title={site.valid_until ? 'Cambiar vigencia' : 'Agregar vigencia'}
                              >
                                <Calendar className="h-4 w-4" />
                              </Button>
                            </Popover.Trigger>
                            <Popover.Portal>
                              <Popover.Content
                                className="z-50 rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
                                align="end"
                                sideOffset={8}
                              >
                                <p className="text-xs font-medium text-slate-500 mb-3">
                                  {site.valid_until ? 'Vigencia de la obra' : 'Agregar vigencia (valid_until)'}
                                </p>
                                <DayPicker
                                  mode="single"
                                  selected={site.valid_until ? new Date(site.valid_until) : undefined}
                                  onSelect={(d) => {
                                    if (d) updateSite(site, { valid_until: format(d, 'yyyy-MM-dd') });
                                  }}
                                  locale={es}
                                />
                                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => updateSite(site, { valid_until: null })}
                                  >
                                    Quitar vigencia
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setDatePopover(null)}>
                                    Cerrar
                                  </Button>
                                </div>
                              </Popover.Content>
                            </Popover.Portal>
                          </Popover.Root>
                          {site.is_active ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              disabled={acting === site.id}
                              title="Desactivar obra"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeactivateSiteTarget(site);
                              }}
                            >
                              <PowerOff className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              disabled={acting === site.id}
                              title="Reactivar obra"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateSite(site, { is_active: true });
                              }}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t border-slate-100 bg-white">
                        <div className="px-5 pt-3 pb-4">
                          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3 px-1">
                            Precios activos (en uso)
                          </div>
                          <div className="rounded-xl border border-slate-100 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100">
                                  <th className="text-left py-3 px-4 font-medium text-slate-600">Especificaciones</th>
                                  <th className="text-right py-3 px-4 font-medium text-slate-600">Precio base</th>
                                  <th className="text-left py-3 px-4 font-medium text-slate-600">Vigente desde</th>
                                  <th className="text-left py-3 px-4 font-medium text-slate-600">Última entrega</th>
                                  <th className="w-12" />
                                </tr>
                              </thead>
                              <tbody>
                                {site.prices.map((price) => {
                                  const specs = formatProductSpecs(price);
                                  const over90 = isOver90Days(price.effective_date);
                                  return (
                                    <tr
                                      key={price.id}
                                      className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors ${
                                        over90 ? 'bg-amber-50/30' : ''
                                      }`}
                                    >
                                      <td className="py-3 px-4">
                                        <div>
                                          <div className="font-medium text-slate-900">{specs}</div>
                                          {price.code && price.code !== specs && (
                                            <div className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[280px]">
                                              {price.code}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 text-right font-medium text-slate-900">
                                        {formatCurrency(price.base_price)}
                                      </td>
                                      <td className="py-3 px-4 text-slate-600">
                                        {price.effective_date ? (
                                          <>
                                            {format(new Date(price.effective_date), 'd MMM yyyy', { locale: es })}
                                            <div className="text-xs text-slate-400">
                                              {formatDistanceToNow(new Date(price.effective_date), {
                                                addSuffix: true,
                                                locale: es,
                                              })}
                                            </div>
                                          </>
                                        ) : (
                                          '—'
                                        )}
                                      </td>
                                      <td className="py-3 px-4 text-slate-600">
                                        {price.last_used ? (
                                          format(new Date(price.last_used), 'd MMM yyyy', { locale: es })
                                        ) : (
                                          <span className="text-slate-400">Sin entregas</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-4">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                          disabled={acting === price.id}
                                          title="Desactivar precio"
                                          onClick={() =>
                                            setDeactivatePriceTarget({
                                              priceId: price.id,
                                              specs: formatProductSpecs(price),
                                              siteName: site.site_name,
                                            })
                                          }
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>

      {/* Deactivate price confirmation */}
      <AlertDialog
        open={!!deactivatePriceTarget}
        onOpenChange={(o) => !o && setDeactivatePriceTarget(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar precio</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivatePriceTarget && (
                <>
                  Se desactivará el precio <strong>{deactivatePriceTarget.specs}</strong> en{' '}
                  <strong>{deactivatePriceTarget.siteName}</strong>. Ya no estará disponible para nuevas cotizaciones
                  u órdenes. ¿Continuar?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                deactivatePriceTarget && deactivatePrice(deactivatePriceTarget.priceId)
              }
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate site confirmation */}
      <AlertDialog
        open={!!deactivateSiteTarget}
        onOpenChange={(o) => !o && setDeactivateSiteTarget(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar obra completa</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateSiteTarget && (
                <>
                  Se desactivará la obra <strong>{deactivateSiteTarget.site_name}</strong> y todos sus precios
                  ({deactivateSiteTarget.prices.length}). No estará disponible para nuevas cotizaciones u órdenes.
                  ¿Continuar?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                deactivateSiteTarget && updateSite(deactivateSiteTarget, { is_active: false })
              }
            >
              Desactivar obra
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
