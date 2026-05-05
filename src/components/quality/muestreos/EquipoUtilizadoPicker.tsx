'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import Link from 'next/link';
import {
  Package,
  Wrench,
  X,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle,
  ChevronDown,
  Loader2,
  Info,
  ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import type { PlannedSample } from '@/components/quality/muestreos/dateUtils';

export interface SelectedInstrumento {
  instrumento_id: string;
  paquete_id?: string;
  nombre: string;
  codigo: string;
  estado_al_momento: 'vigente' | 'proximo_vencer' | 'vencido';
  fecha_vencimiento_al_momento: string;
}

export interface EquipoUtilizadoPickerHandle {
  getSelected: () => SelectedInstrumento[];
}

/** Campos de medición del formulario de muestreo — para sugerir categorías de equipo */
export type MuestreoMeasurementsHint = {
  revenimiento_sitio?: number | null;
  temperatura_ambiente?: number | null;
  temperatura_concreto?: number | null;
  contenido_aire?: number | null;
  peso_recipiente_vacio?: number | null;
  peso_recipiente_lleno?: number | null;
};

type CategorySuggestion = {
  key: string;
  label: string;
  categoria: string;
};

function deriveSuggestedCategories(
  plannedSamples: PlannedSample[] | undefined,
  m: MuestreoMeasurementsHint | undefined,
): CategorySuggestion[] {
  const out: CategorySuggestion[] = [];
  const push = (key: string, label: string, categoria: string) => {
    if (out.some((x) => x.key === key)) return;
    out.push({ key, label, categoria });
  };

  const samples = plannedSamples ?? [];
  if (samples.some((s) => s.tipo_muestra === 'CILINDRO')) {
    push('molde_cil', 'Molde cilíndrico', 'Molde cilíndrico');
  }
  if (samples.some((s) => s.tipo_muestra === 'VIGA')) {
    push('molde_viga', 'Molde para viga', 'Molde para viga');
  }
  if (samples.some((s) => s.tipo_muestra === 'CUBO')) {
    push('molde_cubo', 'Molde cúbico', 'Molde cúbico');
  }

  if (m?.revenimiento_sitio != null && Number.isFinite(Number(m.revenimiento_sitio))) {
    push('rev', 'Equipo de revenimiento', 'Equipo de revenimiento');
  }
  if (
    (m?.temperatura_ambiente != null && Number.isFinite(Number(m.temperatura_ambiente))) ||
    (m?.temperatura_concreto != null && Number.isFinite(Number(m.temperatura_concreto)))
  ) {
    push('term', 'Termómetro', 'Termómetro');
  }
  if (m?.contenido_aire != null && Number.isFinite(Number(m.contenido_aire))) {
    push('aire', 'Equipo contenido de aire', 'Equipo contenido de aire');
  }
  if (
    (m?.peso_recipiente_vacio != null && Number.isFinite(Number(m.peso_recipiente_vacio))) ||
    (m?.peso_recipiente_lleno != null && Number.isFinite(Number(m.peso_recipiente_lleno)))
  ) {
    push('rec_pv', 'Recipiente PV', 'Recipiente PV');
    push('balanza', 'Balanza', 'Balanza');
  }

  push('varilla', 'Varilla p/compactar', 'Varilla p/compactar');
  push('charola', 'Charola de acero', 'Charola de acero');
  push('cucharon', 'Cucharón', 'Cucharón');

  return out;
}

interface Props {
  plantId?: string;
  onChange?: (instruments: SelectedInstrumento[]) => void;
  plannedSamples?: PlannedSample[];
  measurements?: MuestreoMeasurementsHint;
}

const ESTADO_BADGE: Record<string, string> = {
  vigente: 'bg-emerald-100 text-emerald-800',
  proximo_vencer: 'bg-amber-100 text-amber-900',
  vencido: 'bg-red-100 text-red-800',
};

const ESTADO_ICON: Record<string, React.ReactNode> = {
  vigente: <CheckCircle className="h-3 w-3" />,
  proximo_vencer: <Clock className="h-3 w-3" />,
  vencido: <AlertTriangle className="h-3 w-3" />,
};

const ROLES_CAN_REGISTER_INSTRUMENT = [
  'QUALITY_TEAM',
  'LABORATORY',
  'PLANT_MANAGER',
  'EXECUTIVE',
  'ADMIN',
  'ADMIN_OPERATIONS',
];

export const EquipoUtilizadoPicker = forwardRef<EquipoUtilizadoPickerHandle, Props>(
  ({ plantId, onChange, plannedSamples, measurements }, ref) => {
    const { profile } = useAuthBridge();
    const [selected, setSelected] = useState<SelectedInstrumento[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [paquetes, setPaquetes] = useState<any[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [loadingPaquete, setLoadingPaquete] = useState(false);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [hasAnyInstruments, setHasAnyInstruments] = useState<boolean | null>(null);
    const [open, setOpen] = useState(true);
    const [noSearchMatch, setNoSearchMatch] = useState(false);

    const [expandedSuggestionKey, setExpandedSuggestionKey] = useState<string | null>(null);
    const [instrumentsByCat, setInstrumentsByCat] = useState<Record<string, any[]>>({});
    const [loadingSuggestionCat, setLoadingSuggestionCat] = useState<string | null>(null);
    const suggestionFetchStartedRef = useRef<Set<string>>(new Set());

    const suggestedCategories = useMemo(
      () => deriveSuggestedCategories(plannedSamples, measurements),
      [plannedSamples, measurements],
    );

    const canLinkToAlta =
      profile?.role && ROLES_CAN_REGISTER_INSTRUMENT.includes(profile.role);

    useImperativeHandle(ref, () => ({
      getSelected: () => selected,
    }));

    useEffect(() => {
      setInstrumentsByCat({});
      setExpandedSuggestionKey(null);
      suggestionFetchStartedRef.current.clear();
    }, [plantId]);

    useEffect(() => {
      const fetchPaquetes = async () => {
        try {
          const params = new URLSearchParams();
          if (plantId) params.set('plant_id', plantId);
          const res = await fetch(`/api/ema/paquetes?${params}`);
          const j = await res.json();
          setPaquetes(j.data ?? []);
        } catch {
          setPaquetes([]);
        }
      };
      fetchPaquetes();
    }, [plantId]);

    useEffect(() => {
      let cancelled = false;
      const checkCatalog = async () => {
        setCatalogLoading(true);
        try {
          const params = new URLSearchParams({ limit: '1', page: '1' });
          if (plantId) params.set('plant_id', plantId);
          const res = await fetch(`/api/ema/instrumentos?${params}`);
          const j = await res.json();
          const list = j.data ?? [];
          if (!cancelled) {
            const any = Array.isArray(list) && list.length > 0;
            setHasAnyInstruments(any);
          }
        } catch {
          if (!cancelled) {
            setHasAnyInstruments(false);
          }
        } finally {
          if (!cancelled) setCatalogLoading(false);
        }
      };
      if (plantId) checkCatalog();
      else {
        setCatalogLoading(false);
        setHasAnyInstruments(null);
      }
      return () => {
        cancelled = true;
      };
    }, [plantId]);

    useEffect(() => {
      if (catalogLoading) return;
      if (!plantId) {
        setOpen(true);
        return;
      }
      if (hasAnyInstruments === null) return;
      setOpen(hasAnyInstruments || paquetes.length > 0);
    }, [catalogLoading, hasAnyInstruments, paquetes.length, plantId]);

    useEffect(() => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        setNoSearchMatch(false);
        return;
      }
      const timer = setTimeout(async () => {
        setLoadingSearch(true);
        try {
          const params = new URLSearchParams({ search: searchQuery });
          if (plantId) params.set('plant_id', plantId);
          const res = await fetch(`/api/ema/instrumentos?${params}`);
          const j = await res.json();
          const filtered = (j.data ?? []).filter((i: any) => i.estado !== 'inactivo');
          setSearchResults(filtered);
          setNoSearchMatch(filtered.length === 0);
        } catch {
          setSearchResults([]);
          setNoSearchMatch(false);
        } finally {
          setLoadingSearch(false);
        }
      }, 350);
      return () => clearTimeout(timer);
    }, [searchQuery, plantId]);

    const ensureCategoryInstruments = useCallback(
      async (categoria: string) => {
        if (!plantId || !categoria) return;
        if (suggestionFetchStartedRef.current.has(categoria)) return;
        suggestionFetchStartedRef.current.add(categoria);
        setLoadingSuggestionCat(categoria);
        try {
          const params = new URLSearchParams({ categoria, limit: '200' });
          params.set('plant_id', plantId);
          const res = await fetch(`/api/ema/instrumentos?${params}`);
          const j = await res.json();
          const list = (j.data ?? []).filter((i: any) => i.estado !== 'inactivo');
          setInstrumentsByCat((prev) => ({ ...prev, [categoria]: list }));
        } catch {
          suggestionFetchStartedRef.current.delete(categoria);
          setInstrumentsByCat((prev) => ({ ...prev, [categoria]: [] }));
        } finally {
          setLoadingSuggestionCat(null);
        }
      },
      [plantId],
    );

    const addInstrumento = useCallback((inst: any, paqueteId?: string) => {
      if (selected.some((s) => s.instrumento_id === inst.id)) return;

      let estadoSnap: SelectedInstrumento['estado_al_momento'] = 'vigente';
      if (inst.estado === 'vencido') estadoSnap = 'vencido';
      else if (inst.estado === 'proximo_vencer') estadoSnap = 'proximo_vencer';

      const newItem: SelectedInstrumento = {
        instrumento_id: inst.id,
        paquete_id: paqueteId,
        nombre: inst.nombre,
        codigo: inst.codigo,
        estado_al_momento: estadoSnap,
        fecha_vencimiento_al_momento: inst.fecha_proximo_evento ?? new Date().toISOString().split('T')[0],
      };
      const next = [...selected, newItem];
      setSelected(next);
      onChange?.(next);
      setSearchQuery('');
      setSearchResults([]);
      setNoSearchMatch(false);
    }, [selected, onChange]);

    const removeInstrumento = useCallback(
      (instrumentoId: string) => {
        const next = selected.filter((s) => s.instrumento_id !== instrumentoId);
        setSelected(next);
        onChange?.(next);
      },
      [selected, onChange],
    );

    const loadPaquete = useCallback(
      async (paqueteId: string) => {
        if (!paqueteId || paqueteId === 'none') return;
        setLoadingPaquete(true);
        try {
          const res = await fetch(`/api/ema/paquetes/${paqueteId}`);
          const j = await res.json();
          const paquete = j.data;
          if (!paquete?.instrumentos) return;

          setSelected((prev) => {
            const existing = new Set(prev.map((s) => s.instrumento_id));
            const added: SelectedInstrumento[] = [];
            for (const pi of paquete.instrumentos) {
              const inst = pi.instrumento;
              if (!inst || existing.has(inst.id)) continue;
              let estadoSnap: SelectedInstrumento['estado_al_momento'] = 'vigente';
              if (inst.estado === 'vencido') estadoSnap = 'vencido';
              else if (inst.estado === 'proximo_vencer') estadoSnap = 'proximo_vencer';
              const item: SelectedInstrumento = {
                instrumento_id: inst.id,
                paquete_id: paqueteId,
                nombre: inst.nombre,
                codigo: inst.codigo,
                estado_al_momento: estadoSnap,
                fecha_vencimiento_al_momento:
                  inst.fecha_proximo_evento ?? new Date().toISOString().split('T')[0],
              };
              added.push(item);
              existing.add(inst.id);
            }
            if (added.length === 0) return prev;
            const next = [...prev, ...added];
            onChange?.(next);
            return next;
          });
        } catch {
          /* silent */
        } finally {
          setLoadingPaquete(false);
        }
      },
      [onChange],
    );

    const toggleSuggestion = useCallback(
      async (row: CategorySuggestion) => {
        const next = expandedSuggestionKey === row.key ? null : row.key;
        setExpandedSuggestionKey(next);
        if (next) await ensureCategoryInstruments(row.categoria);
      },
      [expandedSuggestionKey, ensureCategoryInstruments],
    );

    const hasVencidos = selected.some((s) => s.estado_al_momento === 'vencido');
    const catalogEmpty = hasAnyInstruments === false && paquetes.length === 0 && !catalogLoading;

    return (
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="rounded-lg border border-stone-200 bg-stone-50/80"
      >
        <div className="flex items-center gap-2 p-3 pb-0">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="flex w-full items-center justify-between px-0 py-1 h-auto text-left hover:bg-transparent"
            >
              <span className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-stone-600" />
                <span className="text-sm font-semibold text-stone-900">Equipo utilizado</span>
                <span className="text-xs text-stone-500">EMA — trazabilidad</span>
              </span>
              <ChevronDown
                className={cn('h-4 w-4 text-stone-500 transition-transform', open && 'rotate-180')}
              />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="space-y-3 px-3 pb-4 pt-1">
          {catalogLoading && (
            <div className="flex items-center gap-2 text-xs text-stone-500 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
              Comprobando catálogo de instrumentos…
            </div>
          )}

          {catalogEmpty && !catalogLoading && (
            <div className="rounded-md border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs text-sky-950">
              <div className="flex gap-2">
                <Info className="h-4 w-4 shrink-0 text-sky-700 mt-0.5" />
                <div>
                  <p className="font-medium">No hay instrumentos registrados para esta planta.</p>
                  <p className="mt-1 text-sky-900/90">
                    Registra equipos en el módulo de instrumentos para poder asociarlos al muestreo.
                  </p>
                  {canLinkToAlta ? (
                    <Link
                      href="/quality/instrumentos/nuevo"
                      className="mt-2 inline-block text-sky-800 underline font-medium hover:text-sky-950"
                    >
                      Registrar instrumento
                    </Link>
                  ) : (
                    <p className="mt-2 text-stone-600">Contacta al equipo de calidad para registrar instrumentos.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {hasVencidos && (
            <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              Hay instrumentos vencidos. Si el bloqueo está activo en configuración EMA, el guardado será rechazado.
              Quita los instrumentos vencidos o actualiza su calibración.
            </div>
          )}

          {paquetes.length > 0 && (
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-stone-400 flex-shrink-0" />
              <Select onValueChange={loadPaquete} disabled={loadingPaquete}>
                <SelectTrigger className="h-8 text-xs bg-white border-stone-300">
                  <SelectValue placeholder={loadingPaquete ? 'Cargando paquete…' : 'Cargar desde paquete…'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Seleccionar paquete —</SelectItem>
                  {paquetes.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingPaquete && <Loader2 className="h-4 w-4 animate-spin text-sky-600" />}
            </div>
          )}

          {plantId && !catalogEmpty && suggestedCategories.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-stone-800">Sugeridos para este muestreo</p>
              <p className="text-[11px] text-stone-500 -mt-1">
                Según el plan de muestras y las mediciones capturadas. Expande una categoría y elige el instrumento.
              </p>
              <div className="flex flex-col gap-1.5">
                {suggestedCategories.map((row) => {
                  const list = instrumentsByCat[row.categoria] ?? [];
                  const ids = new Set(list.map((i: any) => i.id));
                  const pickedCount = selected.filter((s) => ids.has(s.instrumento_id)).length;
                  const vigenteCount = list.filter((i: any) => i.estado === 'vigente').length;
                  const expanded = expandedSuggestionKey === row.key;
                  const loading = loadingSuggestionCat === row.categoria;

                  return (
                    <div
                      key={row.key}
                      className={cn(
                        'rounded-md border bg-white text-xs overflow-hidden',
                        pickedCount > 0 ? 'border-emerald-300 ring-1 ring-emerald-100/80' : 'border-stone-200',
                      )}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-stone-50/80"
                        onClick={() => void toggleSuggestion(row)}
                      >
                        <ChevronRight
                          className={cn(
                            'h-3.5 w-3.5 text-stone-400 shrink-0 transition-transform',
                            expanded && 'rotate-90',
                          )}
                        />
                        <span className="font-medium text-stone-800 flex-1">{row.label}</span>
                        {loading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600 shrink-0" />
                        ) : list.length > 0 ? (
                          <span className="text-[10px] text-stone-500 shrink-0">
                            {pickedCount > 0 ? (
                              <span className="text-emerald-700 font-medium">{pickedCount} elegido(s)</span>
                            ) : (
                              <span>
                                {vigenteCount} vigente(s) · {list.length} total
                              </span>
                            )}
                          </span>
                        ) : expanded ? (
                          <span className="text-[10px] text-stone-400">Sin datos</span>
                        ) : null}
                      </button>
                      {expanded && (
                        <div className="border-t border-stone-100 max-h-40 overflow-y-auto">
                          {loading ? (
                            <div className="flex items-center gap-2 px-3 py-2 text-xs text-stone-500">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
                              Cargando instrumentos…
                            </div>
                          ) : list.length === 0 ? (
                            <p className="px-3 py-2 text-stone-500">
                              No hay instrumentos en esta categoría para la planta.
                            </p>
                          ) : (
                            list.map((inst: any) => {
                              const isSel = selected.some((s) => s.instrumento_id === inst.id);
                              const disabled = inst.estado === 'vencido';
                              return (
                                <div
                                  key={inst.id}
                                  className={cn(
                                    'px-3 py-1.5 flex items-center justify-between gap-2 border-b border-stone-50 last:border-0',
                                    disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer hover:bg-stone-50',
                                    isSel && 'bg-emerald-50/50',
                                  )}
                                  onClick={() => !disabled && addInstrumento(inst)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                                      e.preventDefault();
                                      addInstrumento(inst);
                                    }
                                  }}
                                >
                                  <span>
                                    <span className="font-mono text-stone-500 mr-1.5">{inst.codigo}</span>
                                    {inst.nombre}
                                  </span>
                                  <span className="flex items-center gap-1 shrink-0">
                                    {isSel && (
                                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" aria-label="Agregado" />
                                    )}
                                    <span
                                      className={cn(
                                        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium',
                                        ESTADO_BADGE[inst.estado] ?? 'bg-stone-100 text-stone-600',
                                      )}
                                    >
                                      {ESTADO_ICON[inst.estado]} {inst.estado}
                                    </span>
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-xs font-medium text-stone-700">Buscar otro instrumento</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
              <Input
                placeholder="Código o nombre (mín. 2 caracteres)…"
                className="pl-8 h-8 text-sm bg-white border-stone-300"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={catalogEmpty}
              />
              {loadingSearch && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((inst: any) => (
                    <div
                      key={inst.id}
                      className="px-3 py-2 cursor-pointer hover:bg-stone-50 text-xs flex items-center justify-between"
                      onClick={() => addInstrumento(inst)}
                    >
                      <span>
                        <span className="font-mono text-stone-500 mr-2">{inst.codigo}</span>
                        {inst.nombre}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[inst.estado] ?? 'bg-stone-100 text-stone-600'}`}
                      >
                        {ESTADO_ICON[inst.estado]} {inst.estado}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {noSearchMatch && searchQuery.length >= 2 && !loadingSearch && (
                <p className="text-xs text-stone-500 mt-1.5 px-0.5">
                  No se encontraron instrumentos. Verifica el código o registra el equipo en el catálogo.
                </p>
              )}
            </div>
          </div>

          {selected.length === 0 ? (
            <p className="text-xs text-stone-500 text-center py-2 border border-dashed border-stone-200 rounded-md bg-white/60">
              Ningún instrumento seleccionado (opcional)
            </p>
          ) : (
            <div className="space-y-1">
              {selected.map((s) => (
                <div
                  key={s.instrumento_id}
                  className={cn(
                    'flex items-center gap-2 bg-white border rounded px-3 py-1.5 text-xs',
                    s.estado_al_momento === 'vencido'
                      ? 'border-red-300 ring-1 ring-red-100'
                      : 'border-stone-200',
                  )}
                >
                  <Wrench className="h-3 w-3 text-stone-400 flex-shrink-0" />
                  <span className="font-mono text-stone-500">{s.codigo}</span>
                  <span className="flex-1 text-stone-800">{s.nombre}</span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium ${ESTADO_BADGE[s.estado_al_momento]}`}
                  >
                    {ESTADO_ICON[s.estado_al_momento]} {s.estado_al_momento}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => removeInstrumento(s.instrumento_id)}
                        className={cn(
                          'rounded p-0.5 ml-1',
                          s.estado_al_momento === 'vencido'
                            ? 'text-red-600 border border-red-200 hover:bg-red-50'
                            : 'text-stone-300 hover:text-red-600',
                        )}
                        aria-label="Quitar instrumento"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-xs">
                      {s.estado_al_momento === 'vencido'
                        ? 'Instrumento vencido: quítalo para poder guardar si el bloqueo EMA está activo.'
                        : 'Quitar de la lista'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  },
);

EquipoUtilizadoPicker.displayName = 'EquipoUtilizadoPicker';
