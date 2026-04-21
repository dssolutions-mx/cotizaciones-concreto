'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

// UI
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Icons
import {
  Download,
  FileText,
  FileSpreadsheet,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Check,
  Minus,
  AlertCircle,
  RefreshCw,
  Settings2,
  Building2,
  Paperclip,
  X as XIcon,
  Loader2,
} from 'lucide-react';

// Services & types
import { ReportDataService } from '@/services/reportDataService';
import type {
  ReportFilter,
  ReportRemisionData,
  ReportSummary,
  ReportColumn,
  HierarchicalReportData,
  SelectableClient,
  SelectableOrder,
  SelectableRemision,
} from '@/types/pdf-reports';
import {
  AVAILABLE_COLUMNS,
  DEFAULT_COLUMN_SETS,
  DEFAULT_TEMPLATES,
  columnsFromOrderedIds,
  REPORTES_CLIENTES_STORAGE_KEY,
  type ReportDefinitionPersistedV1,
  type ReportDefinitionPersistedV2,
  type ReportDefinitionPersisted,
} from '@/types/pdf-reports';
import { formatCurrency } from '@/lib/utils';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import { buildDeliveryReceiptExcel, downloadExcelBuffer, buildAdditionalProductPseudoRows, computeFIFOPumpingAllocation } from '@/lib/reports/deliveryReceiptExcel';
import {
  buildEvidenceBundle,
  countEvidenceFiles,
  MAX_BUNDLE_ORDERS,
  MAX_BUNDLE_FILES,
  type EvidenceCounts,
} from '@/lib/reports/evidenceBundle';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import type { DeliveryReceiptExcelConfig } from '@/lib/reports/deliveryReceiptExcel';
import type { DeliveryReceiptTemplateConfig } from '@/components/reports/templates/DeliveryReceiptPDF';

// No dynamic imports for PDF renderer at module level — use pdf() API on demand

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = REPORTES_CLIENTES_STORAGE_KEY;
const DEFAULT_DATE_RANGE: DateRange = {
  from: subDays(new Date(), 30),
  to: new Date(),
};
const COMPANY_STANDARD_COLS = DEFAULT_COLUMN_SETS.company_standard;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCurr(v?: number) {
  if (v == null) return '—';
  return `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtNum(v?: number, d = 2) {
  if (v == null) return '—';
  return v.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDate(d?: string) {
  if (!d) return '—';
  try { return format(new Date(d + 'T12:00:00'), 'dd/MM/yy'); } catch { return d; }
}
function pumpingPillInfo(tipo?: string | null): { label: string; cls: string } | null {
  if (!tipo) return null;
  const t = String(tipo).toUpperCase();
  if (t === 'BOMBEO') return { label: 'Bombeo', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  if (t === 'VACÍO DE OLLA' || t === 'VACIO DE OLLA') {
    return { label: 'Vacío', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  return null;
}
function PumpingPill({ tipo }: { tipo?: string | null }) {
  const info = pumpingPillInfo(tipo);
  if (!info) return null;
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${info.cls}`}
    >
      {info.label}
    </span>
  );
}
function AdditionalPill({ tipo }: { tipo?: string | null }) {
  if (String(tipo ?? '').toUpperCase() !== 'ADICIONAL') return null;
  return (
    <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-800 border-amber-300">
      Adic.
    </span>
  );
}

function isPumpingRowPage(item: ReportRemisionData): boolean {
  const t = String(item.tipo_remision ?? '').toUpperCase();
  return t === 'BOMBEO' || t === 'VACÍO DE OLLA' || t === 'VACIO DE OLLA';
}
function isAdditionalRowPage(item: ReportRemisionData): boolean {
  return String(item.tipo_remision ?? '').toUpperCase() === 'ADICIONAL';
}

function cellDisplay(
  item: ReportRemisionData,
  col: ReportColumn,
  fifoAllocationMap?: Map<string, number>,
  additionalsByOrderId?: Map<string, { total_per_m3: number; labels: string[] }>,
): string {
  switch (col.id) {
    case 'row_number': return '';
    case 'fecha': return fmtDate(item.fecha);
    case 'remision_number': return String(item.remision_number ?? '');
    case 'business_name': return item.client?.business_name ?? '—';
    case 'order_number': return String(item.order?.order_number ?? '');
    case 'construction_site': return item.order?.construction_site ?? '—';
    case 'elemento': return item.order?.elemento ?? '—';
    case 'unidad_cr': case 'unidad': return item.unidad ?? '—';
    case 'recipe_code': return item.master_code ?? item.recipe?.recipe_code ?? '—';
    case 'volumen_fabricado': return fmtNum(item.volumen_fabricado);
    case 'unit_price': {
      const base = item.unit_price;
      if (!isAdditionalRowPage(item) && !isPumpingRowPage(item)) {
        const info = additionalsByOrderId?.get(String(item.order_id ?? ''));
        if (info && info.total_per_m3 > 0)
          return fmtCurr((base ?? 0) + info.total_per_m3);
      }
      return fmtCurr(base);
    }
    case 'line_total': return fmtCurr(item.line_total);
    case 'vat_amount': return fmtCurr(item.vat_amount);
    case 'final_total': return fmtCurr(item.final_total);
    case 'conductor': return item.conductor ?? '—';
    case 'strength_fc': return item.recipe?.strength_fc ? `${item.recipe.strength_fc}` : '—';
    case 'requires_invoice': return item.order?.requires_invoice ? 'Sí' : 'No';
    case 'client_rfc': return item.client?.rfc ?? '—';
    case 'contact_name': return item.client?.contact_name ?? '—';
    case 'special_requirements': return item.order?.special_requirements ?? '—';
    case 'comentarios_internos': return item.order?.comentarios_internos ?? '—';
    case 'arkik_reassignment': return item.arkik_reassignment_note ?? '—';
    case 'order_status': return item.order?.order_status ?? '—';
    case 'tipo_remision': return item.tipo_remision ?? '—';
    case 'recipe_notes': return item.recipe?.notes ?? '—';
    case 'age_days': return item.recipe?.age_days != null ? `${item.recipe.age_days}` : '—';
    case 'placement_type': return item.recipe?.placement_type ?? '—';
    case 'max_aggregate_size': return item.recipe?.max_aggregate_size != null ? `${item.recipe.max_aggregate_size}` : '—';
    case 'slump': return item.recipe?.slump != null ? `${item.recipe.slump}` : '—';
    case 'serv_bombeo': {
      if (isPumpingRowPage(item)) return fmtCurr(item.line_total);
      if (isAdditionalRowPage(item)) return '—';
      // Concrete row: show FIFO-allocated pumping cost for this remision.
      const mapKey = `${String(item.order_id ?? '')}:${String(item.id ?? '')}`;
      const allocated = fifoAllocationMap?.get(mapKey);
      return allocated != null && allocated > 0 ? fmtCurr(allocated) : '—';
    }
    case 'adicional_m3': {
      if (isAdditionalRowPage(item) || isPumpingRowPage(item)) return '—';
      const info = additionalsByOrderId?.get(String(item.order_id ?? ''));
      if (!info || info.total_per_m3 === 0) return '—';
      return info.labels.length === 1 ? info.labels[0] : info.labels.join(' + ');
    }
    default: return '—';
  }
}

function persistPrefs(prefs: ReportDefinitionPersisted) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* quota */ }
}

/**
 * Load prefs and auto-migrate v1 → v2. For v1 rows pinned to the old
 * company-standard column set, replace with the new v2 default. Custom column
 * selections are preserved.
 */
function loadPrefs(): ReportDefinitionPersisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p?.v === 2) {
      // If a v2 still points to recipe_notes as 13th column (intermediate save),
      // swap it for comentarios_internos.
      const v2 = p as ReportDefinitionPersistedV2;
      const migrated = (v2.columnIdsOrdered ?? []).map((id: string) =>
        id === 'recipe_notes' ? 'comentarios_internos' : id
      );
      return { ...v2, columnIdsOrdered: migrated };
    }
    if (p?.v === 1) {
      const v1 = p as ReportDefinitionPersistedV1;
      // Detect the exact v1 default 11-column set → replace with v2 default.
      const OLD_DEFAULT_IDS = [
        'fecha','remision_number','business_name','order_number','construction_site',
        'elemento','unidad_cr','recipe_code','volumen_fabricado','unit_price','line_total'
      ];
      const isOldDefault =
        Array.isArray(v1.columnIdsOrdered) &&
        v1.columnIdsOrdered.length === OLD_DEFAULT_IDS.length &&
        v1.columnIdsOrdered.every((id, i) => id === OLD_DEFAULT_IDS[i]);
      return {
        v: 2,
        selectedTemplate: v1.selectedTemplate,
        columnIdsOrdered: isOldDefault ? [...DEFAULT_COLUMN_SETS.company_standard] : v1.columnIdsOrdered,
        reportTitle: v1.reportTitle,
        showSummary: v1.showSummary,
        showVAT: v1.showVAT,
        sortBy: v1.sortBy,
        plantIds: [],
      };
    }
  } catch { /* corrupt */ }
  return null;
}

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------
function KpiTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-stone-200 bg-white px-4 py-3 text-center shadow-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</span>
      <span className={`mt-1 font-mono text-base font-semibold tabular-nums ${accent ? 'text-emerald-700' : 'text-stone-900'}`}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hierarchical selection tree
// ---------------------------------------------------------------------------
interface TreeProps {
  data: HierarchicalReportData;
  selectedRemisionIds: Set<string>;
  onToggleRemision: (id: string) => void;
  onToggleOrder: (orderId: string, remisionIds: string[]) => void;
  onToggleClient: (clientId: string, remisionIds: string[]) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

function SelectionTree({
  data,
  selectedRemisionIds,
  onToggleRemision,
  onToggleOrder,
  onToggleClient,
  onSelectAll,
  onClearAll,
}: TreeProps) {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const allRemisionIds = useMemo(() => {
    const ids: string[] = [];
    data.clients.forEach((c) => c.orders.forEach((o) => o.remisiones.forEach((r) => ids.push(r.id))));
    return ids;
  }, [data]);

  const toggleClient = (clientId: string) =>
    setExpandedClients((s) => {
      const n = new Set(s);
      n.has(clientId) ? n.delete(clientId) : n.add(clientId);
      return n;
    });
  const toggleOrder = (orderId: string) =>
    setExpandedOrders((s) => {
      const n = new Set(s);
      n.has(orderId) ? n.delete(orderId) : n.add(orderId);
      return n;
    });

  const clientState = (client: SelectableClient): 'all' | 'some' | 'none' => {
    const ids = client.orders.flatMap((o) => o.remisiones.map((r) => r.id));
    const sel = ids.filter((id) => selectedRemisionIds.has(id)).length;
    if (sel === 0) return 'none';
    if (sel === ids.length) return 'all';
    return 'some';
  };
  const orderState = (order: SelectableOrder): 'all' | 'some' | 'none' => {
    const ids = order.remisiones.map((r) => r.id);
    const sel = ids.filter((id) => selectedRemisionIds.has(id)).length;
    if (sel === 0) return 'none';
    if (sel === ids.length) return 'all';
    return 'some';
  };

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Datos Disponibles
        </span>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-xs text-stone-600 underline underline-offset-2 hover:text-stone-900"
          >
            Seleccionar Todo
          </button>
          <span className="text-stone-300">·</span>
          <button
            onClick={onClearAll}
            className="text-xs text-stone-600 underline underline-offset-2 hover:text-stone-900"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="divide-y divide-stone-100">
        {data.clients.map((client) => {
          const cState = clientState(client);
          const cExpanded = expandedClients.has(client.id);
          const cRemIds = client.orders.flatMap((o) => o.remisiones.map((r) => r.id));
          return (
            <div key={client.id}>
              {/* Client row */}
              <div className="flex cursor-pointer items-center gap-2 px-4 py-3 hover:bg-stone-50">
                <button onClick={() => toggleClient(client.id)} className="shrink-0 text-stone-400">
                  {cExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div
                  onClick={() => onToggleClient(client.id, cRemIds)}
                  className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border border-stone-300"
                  style={{
                    backgroundColor: cState === 'all' ? '#1B365D' : cState === 'some' ? '#E2E8F0' : '',
                  }}
                >
                  {cState === 'all' && <Check className="h-3 w-3 text-white" />}
                  {cState === 'some' && <Minus className="h-3 w-3 text-stone-500" />}
                </div>
                <div className="min-w-0 flex-1" onClick={() => toggleClient(client.id)}>
                  <div className="text-sm font-medium text-stone-900">{client.business_name}</div>
                  <div className="text-xs text-stone-500">
                    {client.orders.length} órdenes ·{' '}
                    {client.orders.reduce((s, o) => s + o.total_remisiones, 0)} remisiones
                  </div>
                </div>
              </div>

              {/* Orders */}
              {cExpanded && (
                <div className="divide-y divide-stone-50 bg-stone-50/50">
                  {client.orders.map((order) => {
                    const oState = orderState(order);
                    const oExpanded = expandedOrders.has(order.id);
                    const oRemIds = order.remisiones.map((r) => r.id);
                    return (
                      <div key={order.id}>
                        <div className="flex cursor-pointer items-center gap-2 py-2 pl-10 pr-4 hover:bg-stone-100/70">
                          <button
                            onClick={() => toggleOrder(order.id)}
                            className="shrink-0 text-stone-400"
                          >
                            {oExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <div
                            onClick={() => onToggleOrder(order.id, oRemIds)}
                            className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border border-stone-300"
                            style={{
                              backgroundColor:
                                oState === 'all' ? '#1B365D' : oState === 'some' ? '#E2E8F0' : '',
                            }}
                          >
                            {oState === 'all' && <Check className="h-3 w-3 text-white" />}
                            {oState === 'some' && <Minus className="h-3 w-3 text-stone-500" />}
                          </div>
                          <div className="min-w-0 flex-1" onClick={() => toggleOrder(order.id)}>
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-medium text-stone-800">
                                {order.order_number}
                              </span>
                              <span className="text-xs text-stone-500">{order.construction_site}</span>
                              {order.elemento && (
                                <span className="text-xs text-stone-400">· {order.elemento}</span>
                              )}
                            </div>
                            {order.special_requirements && (
                              <p className="mt-0.5 truncate text-[11px] leading-tight text-stone-400">
                                {order.special_requirements}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-stone-500">{order.total_remisiones} rem.</div>
                            <div className="font-mono text-xs tabular-nums text-stone-700">
                              {fmtNum(order.total_volume)} m³
                            </div>
                          </div>
                        </div>

                        {/* Remisiones */}
                        {oExpanded && (
                          <div className="divide-y divide-stone-100 bg-white">
                            {order.remisiones.map((rem) => (
                              <div
                                key={rem.id}
                                onClick={() => onToggleRemision(rem.id)}
                                className="flex cursor-pointer items-center gap-2 py-1.5 pl-16 pr-4 hover:bg-stone-50"
                              >
                                <div
                                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-stone-300"
                                  style={{
                                    backgroundColor: selectedRemisionIds.has(rem.id) ? '#1B365D' : '',
                                  }}
                                >
                                  {selectedRemisionIds.has(rem.id) && (
                                    <Check className="h-2.5 w-2.5 text-white" />
                                  )}
                                </div>
                                <span className="text-xs text-stone-700">{fmtDate(rem.fecha)}</span>
                                <span className="text-xs font-medium text-stone-800">
                                  #{rem.remision_number}
                                </span>
                                <PumpingPill tipo={rem.tipo_remision} />
                                <span className="ml-1 text-xs text-stone-500">{rem.recipe_code}</span>
                                <span className="ml-auto font-mono text-xs tabular-nums text-stone-600">
                                  {fmtNum(rem.volumen_fabricado)} m³
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {data.clients.length === 0 && (
          <div className="flex flex-col items-center py-12 text-stone-400">
            <Filter className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">Sin datos para el período seleccionado</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column picker
// ---------------------------------------------------------------------------
function ColumnPicker({
  orderedCols,
  onReorder,
  onRemove,
  onAddCol,
  onApplyPreset,
}: {
  orderedCols: ReportColumn[];
  onReorder: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onAddCol: (col: ReportColumn) => void;
  onApplyPreset: (ids: string[]) => void;
}) {
  const selected = new Set(orderedCols.map((c) => c.id));
  const available = AVAILABLE_COLUMNS.filter((c) => !selected.has(c.id));

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Presets */}
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-stone-800">Plantillas Rápidas</p>
        <div className="space-y-2">
          {DEFAULT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onApplyPreset(t.selectedColumns)}
              className="w-full rounded-md border border-stone-200 px-3 py-2 text-left text-xs hover:border-stone-900 hover:bg-stone-50"
            >
              <div className="font-medium text-stone-800">{t.name}</div>
              <div className="mt-0.5 text-stone-500">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Available + Selected */}
      <div className="space-y-3">
        {/* Available */}
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-stone-800">Columnas Disponibles</p>
          <div className="space-y-1 overflow-y-auto" style={{ maxHeight: '180px' }}>
            {available.map((col) => (
              <button
                key={col.id}
                onClick={() => onAddCol(col)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-stone-700 hover:bg-stone-50"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
                {col.label}
                <span className="ml-auto text-stone-400">{col.width}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected (ordered) */}
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-stone-800">
            Columnas Seleccionadas ({orderedCols.length})
          </p>
          <div className="space-y-1 overflow-y-auto" style={{ maxHeight: '180px' }}>
            {orderedCols.map((col, i) => (
              <div
                key={col.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs text-stone-700 hover:bg-stone-50"
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    disabled={i === 0}
                    onClick={() => onReorder(i, i - 1)}
                    className="leading-none text-stone-400 disabled:opacity-20 hover:text-stone-700"
                  >
                    ▲
                  </button>
                  <button
                    disabled={i === orderedCols.length - 1}
                    onClick={() => onReorder(i, i + 1)}
                    className="leading-none text-stone-400 disabled:opacity-20 hover:text-stone-700"
                  >
                    ▼
                  </button>
                </div>
                <span className="flex-1">{col.label}</span>
                <button
                  onClick={() => onRemove(col.id)}
                  className="text-stone-400 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type Step = 'selection' | 'columns' | 'review';

export default function ReportesClientesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profile } = useAuthBridge();
  const { availablePlants, currentPlant, isGlobalAdmin } = usePlantContext();

  // ── Date & filter state ───────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [search, setSearch] = useState('');
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([]);
  const [plantPickerOpen, setPlantPickerOpen] = useState(false);

  // ── Hierarchical data ─────────────────────────────────────────────────────
  const [hierarchical, setHierarchical] = useState<HierarchicalReportData | null>(null);
  const [hierarchicalLoading, setHierarchicalLoading] = useState(false);
  const [hierarchicalError, setHierarchicalError] = useState<string | null>(null);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedRemisionIds, setSelectedRemisionIds] = useState<Set<string>>(new Set());

  // ── Columns ───────────────────────────────────────────────────────────────
  const [orderedCols, setOrderedCols] = useState<ReportColumn[]>(() =>
    columnsFromOrderedIds(COMPANY_STANDARD_COLS),
  );

  // ── Grouping / sort ───────────────────────────────────────────────────────
  const [groupBy, setGroupBy] = useState<'none' | 'order' | 'construction_site'>('none');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // ── Report data ───────────────────────────────────────────────────────────
  const [reportData, setReportData] = useState<ReportRemisionData[]>([]);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // ── Step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('selection');
  const [excelLoading, setExcelLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  /** Handoff desde evidencia remisiones (sessionStorage + ?from=evidencia). */
  const [evidenciaPrefetch, setEvidenciaPrefetch] = useState<null | { remisionIds: string[] }>(null);
  const [fromEvidenciaHandoff, setFromEvidenciaHandoff] = useState(false);
  const [evidenciaOrderCount, setEvidenciaOrderCount] = useState(0);

  // ── Evidence bundle ───────────────────────────────────────────────────────
  const [evidenceCounts, setEvidenceCounts] = useState<EvidenceCounts | null>(null);
  const [evidenceCountLoading, setEvidenceCountLoading] = useState(false);
  const [evidenceBundling, setEvidenceBundling] = useState(false);
  const [evidenceProgress, setEvidenceProgress] = useState<{ done: number; total: number; label?: string } | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const evidenceAbortRef = React.useRef<AbortController | null>(null);
  /** Prefetch report once after evidencia handoff (columns step). */
  const evidenciaReportPrefetchOnceRef = React.useRef(false);
  /** Remision id key last used for a successful fetchReport (skip duplicate fetch on Ver Reporte). */
  const lastReportFetchKeyRef = React.useRef<string>('');

  // ── Restore prefs ─────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = loadPrefs();
    if (saved?.columnIdsOrdered?.length) {
      setOrderedCols(columnsFromOrderedIds(saved.columnIdsOrdered));
    }
    try {
      const raw = sessionStorage.getItem('reportes_clientes.preselect');
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.source === 'evidencia') {
          // Plantas vienen del handoff; no pisar con prefs guardadas (otra planta activa en UI).
          return;
        }
      }
    } catch {
      /* ignore */
    }
    if (saved?.plantIds?.length) {
      setSelectedPlantIds(saved.plantIds);
    }
  }, []);

  // ── Default plant selection from context (only if user has NOT explicitly
  //    chosen in this session and has no saved prefs) ────────────────────────
  useEffect(() => {
    if (selectedPlantIds.length > 0) return;
    if (currentPlant?.id) {
      setSelectedPlantIds([currentPlant.id]);
    }
  }, [currentPlant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prune plant IDs the user no longer has access to (e.g. after role change)
  useEffect(() => {
    if (!availablePlants.length) return;
    const validIds = new Set(availablePlants.map((p) => p.id));
    setSelectedPlantIds((prev) => {
      const filtered = prev.filter((id) => validIds.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [availablePlants]);

  // ── Load hierarchical when date changes ───────────────────────────────────
  const loadHierarchical = useCallback(async () => {
    if (!dateRange.from || !dateRange.to) return;
    setHierarchicalLoading(true);
    setHierarchicalError(null);
    try {
      const data = await ReportDataService.fetchHierarchicalData({
        from: dateRange.from,
        to: dateRange.to,
        plantIds: selectedPlantIds.length ? selectedPlantIds : undefined,
      });
      setHierarchical(data);
      setSelectedRemisionIds(new Set()); // reset selection on date / plant change
    } catch (e: any) {
      setHierarchicalError(e.message ?? 'Error al cargar datos');
    } finally {
      setHierarchicalLoading(false);
    }
  }, [dateRange.from, dateRange.to, selectedPlantIds]);

  useEffect(() => { loadHierarchical(); }, [loadHierarchical]);

  useEffect(() => {
    if (searchParams.get('from') !== 'evidencia') return;
    try {
      const raw = sessionStorage.getItem('reportes_clientes.preselect');
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p.source !== 'evidencia') return;
      if (p.dateRange?.from && p.dateRange?.to) {
        setDateRange({ from: new Date(p.dateRange.from), to: new Date(p.dateRange.to) });
      }
      if (Array.isArray(p.plantIds) && p.plantIds.length) setSelectedPlantIds(p.plantIds);
      setEvidenciaPrefetch({ remisionIds: Array.isArray(p.remisionIds) ? p.remisionIds : [] });
      setEvidenciaOrderCount(Array.isArray(p.orderIds) ? p.orderIds.length : 0);
      setFromEvidenciaHandoff(true);
      sessionStorage.removeItem('reportes_clientes.preselect');
      router.replace('/finanzas/reportes-clientes', { scroll: false });
    } catch (e) {
      console.error('evidencia preselect', e);
    }
  }, [searchParams, router]);

  // Evidencia handoff: apply remision IDs after the first hierarchical load for the new
  // date/plant (loadHierarchical clears selection — we restore handoff IDs here).
  // Do NOT intersect with the tree: listado evidencia filtra por delivery_date; el árbol
  // del reporte filtra remisiones por fecha — mismas remisiones pueden no aparecer en el árbol.
  useEffect(() => {
    if (!evidenciaPrefetch) return;
    if (hierarchicalLoading) return;

    const ids = evidenciaPrefetch.remisionIds.filter(Boolean);
    if (ids.length) {
      setSelectedRemisionIds(new Set(ids));
    }
    setStep('columns');
    setEvidenciaPrefetch(null);
  }, [evidenciaPrefetch, hierarchicalLoading]);

  // New handoff → allow report prefetch again (ref was true from a prior run on this page).
  useEffect(() => {
    if (evidenciaPrefetch) evidenciaReportPrefetchOnceRef.current = false;
  }, [evidenciaPrefetch]);

  // ── Filtered hierarchical (search) ───────────────────────────────────────
  const emptySummary = {
    totalClients: 0, totalOrders: 0, totalRemisiones: 0,
    totalVolume: 0, totalAmount: 0,
    selectedClients: [] as string[], selectedOrders: [] as string[], selectedRemisiones: [] as string[],
  };
  const filteredHierarchical = useMemo<HierarchicalReportData>(() => {
    if (!hierarchical) return { clients: [], selectionSummary: emptySummary };
    if (!search.trim()) return hierarchical;
    const q = search.toLowerCase();
    const clients = hierarchical.clients
      .map((c) => {
        const orders = c.orders
          .map((o) => {
            const remisiones = o.remisiones.filter(
              (r) =>
                String(r.remision_number).includes(q) ||
                (r.recipe_code ?? '').toLowerCase().includes(q),
            );
            if (
              o.order_number.toLowerCase().includes(q) ||
              o.construction_site.toLowerCase().includes(q) ||
              remisiones.length > 0
            )
              return { ...o, remisiones };
            return null;
          })
          .filter(Boolean) as typeof c.orders;
        if (c.business_name.toLowerCase().includes(q) || orders.length > 0)
          return { ...c, orders };
        return null;
      })
      .filter(Boolean) as typeof hierarchical.clients;
    return { ...hierarchical, clients };
  }, [hierarchical, search]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allRemisionIds = useMemo(
    () =>
      hierarchical?.clients.flatMap((c) =>
        c.orders.flatMap((o) => o.remisiones.map((r) => r.id)),
      ) ?? [],
    [hierarchical],
  );

  const toggleRemision = useCallback((id: string) => {
    setSelectedRemisionIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const toggleOrder = useCallback((orderId: string, remisionIds: string[]) => {
    setSelectedRemisionIds((s) => {
      const allSel = remisionIds.every((id) => s.has(id));
      const n = new Set(s);
      if (allSel) remisionIds.forEach((id) => n.delete(id));
      else remisionIds.forEach((id) => n.add(id));
      return n;
    });
  }, []);

  const toggleClient = useCallback((clientId: string, remisionIds: string[]) => {
    setSelectedRemisionIds((s) => {
      const allSel = remisionIds.every((id) => s.has(id));
      const n = new Set(s);
      if (allSel) remisionIds.forEach((id) => n.delete(id));
      else remisionIds.forEach((id) => n.add(id));
      return n;
    });
  }, []);

  const selectAll = useCallback(() => setSelectedRemisionIds(new Set(allRemisionIds)), [allRemisionIds]);
  const clearAll = useCallback(() => setSelectedRemisionIds(new Set()), []);

  // ── Summary bar (live, from tree data) ───────────────────────────────────
  const liveSummary = useMemo(() => {
    if (!hierarchical) return null;
    let vol = 0, amount = 0, count = 0;
    hierarchical.clients.forEach((c) =>
      c.orders.forEach((o) =>
        o.remisiones.forEach((r) => {
          if (selectedRemisionIds.has(r.id)) {
            count++;
            vol += r.volumen_fabricado;
            amount += r.line_total ?? 0;
          }
        }),
      ),
    );
    return { count, vol, amount };
  }, [hierarchical, selectedRemisionIds]);

  // ── Column management ─────────────────────────────────────────────────────
  const reorderCol = useCallback((from: number, to: number) => {
    setOrderedCols((cols) => {
      const next = [...cols];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);
  const removeCol = useCallback((id: string) => {
    setOrderedCols((cols) => cols.filter((c) => c.id !== id));
  }, []);
  const addCol = useCallback((col: ReportColumn) => {
    setOrderedCols((cols) => (cols.some((c) => c.id === col.id) ? cols : [...cols, col]));
  }, []);
  const applyPreset = useCallback((ids: string[]) => {
    setOrderedCols(columnsFromOrderedIds(ids));
  }, []);

  // ── Fetch report data (on proceed to review) ──────────────────────────────
  const fetchReport = useCallback(async () => {
    if (!selectedRemisionIds.size) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const filter: ReportFilter = {
        dateRange,
        remisionIds: Array.from(selectedRemisionIds),
        plantIds: selectedPlantIds.length ? selectedPlantIds : undefined,
      };
      const { data, summary } = await ReportDataService.fetchReportData(filter);
      const tipoRankFetch = (t?: string) => {
        const u = String(t ?? '').toUpperCase();
        if (u === 'ADICIONAL') return 2;
        if (u !== 'CONCRETO' && u !== '') return 1; // BOMBEO / VACÍO DE OLLA
        return 0;
      };
      const sorted = [...data].sort((a, b) => {
        // Group by order so auxiliary rows stay with their concrete deliveries
        const ao = String(a.order?.order_number ?? a.order_id ?? '');
        const bo = String(b.order?.order_number ?? b.order_id ?? '');
        if (ao !== bo) return ao.localeCompare(bo);
        // Concrete → pumping → additional
        const tr = tipoRankFetch(a.tipo_remision) - tipoRankFetch(b.tipo_remision);
        if (tr !== 0) return tr;
        const av = new Date(a.fecha).getTime();
        const bv = new Date(b.fecha).getTime();
        return sortDirection === 'desc' ? bv - av : av - bv;
      });
      setReportData(sorted);
      setReportSummary(summary);
      lastReportFetchKeyRef.current = [...selectedRemisionIds].sort().join(',');

      // Auto-append smart columns whenever the data warrants it.
      const hasPumping = sorted.some((r) => {
        const t = String(r.tipo_remision ?? '').toUpperCase();
        return (t === 'BOMBEO' || t === 'VACÍO DE OLLA' || t === 'VACIO DE OLLA');
      });
      const hasAdditionals = sorted.some(
        (r) => (r.order?.additional_products?.length ?? 0) > 0,
      );

      // Auto-append smart columns when the data warrants it and the column
      // isn't already visible. No strict default-check — if pumping/additionals
      // exist they should always surface, regardless of how the user has
      // customised the column order.
      setOrderedCols((cols) => {
        let next = cols;
        if (hasPumping && !next.some((c) => c.id === 'serv_bombeo')) {
          const col = AVAILABLE_COLUMNS.find((c) => c.id === 'serv_bombeo');
          if (col) next = [...next, col];
        }
        if (hasAdditionals && !next.some((c) => c.id === 'adicional_m3')) {
          const col = AVAILABLE_COLUMNS.find((c) => c.id === 'adicional_m3');
          if (col) next = [...next, col];
        }
        return next;
      });
    } catch (e: any) {
      setReportError(e.message ?? 'Error al cargar reporte');
    } finally {
      setReportLoading(false);
    }
  }, [selectedRemisionIds, dateRange, sortDirection, selectedPlantIds]);

  const goToReview = useCallback(() => {
    const key = [...selectedRemisionIds].sort().join(',');
    setStep('review');
    if (lastReportFetchKeyRef.current === key && reportData.length > 0) {
      return;
    }
    void fetchReport();
  }, [fetchReport, selectedRemisionIds, reportData.length]);

  // Prefetch report rows on evidencia handoff (stay on columns; Ver Reporte skips duplicate fetch).
  useEffect(() => {
    if (!fromEvidenciaHandoff) return;
    if (step !== 'columns') return;
    if (selectedRemisionIds.size === 0) return;
    if (evidenciaReportPrefetchOnceRef.current) return;
    evidenciaReportPrefetchOnceRef.current = true;
    void fetchReport();
  }, [fromEvidenciaHandoff, step, selectedRemisionIds, fetchReport]);

  // ── Persist column prefs when they change ─────────────────────────────────
  useEffect(() => {
    const prefs: ReportDefinitionPersistedV2 = {
      v: 2,
      selectedTemplate: 'company-standard',
      columnIdsOrdered: orderedCols.map((c) => c.id),
      reportTitle: 'Reporte de Entregas',
      showSummary: true,
      showVAT: true,
      sortBy: { field: 'fecha', direction: sortDirection },
      plantIds: selectedPlantIds,
    };
    persistPrefs(prefs);
  }, [orderedCols, sortDirection, selectedPlantIds]);

  // ── PDF config ────────────────────────────────────────────────────────────
  const pdfConfig = useMemo((): DeliveryReceiptTemplateConfig => {
    const clientNames = Array.from(
      new Set(reportData.map((r) => r.client?.business_name).filter(Boolean) as string[]),
    );
    const plantName = reportData[0]?.plant_info?.plant_name;
    const vatRatePct = reportData[0]?.plant_info?.vat_percentage;
    const dateLabel =
      dateRange.from && dateRange.to
        ? `${format(dateRange.from, 'dd/MM/yyyy')} – ${format(dateRange.to, 'dd/MM/yyyy')}`
        : '—';
    return {
      columns: orderedCols,
      groupBy,
      showTotalsRow: true,
      showIVABreakdown: true,
      showGroupSubtotals: groupBy !== 'none',
      orientation: orderedCols.length > 8 ? 'landscape' : 'portrait',
      reportTitle: 'Reporte de Entregas de Concreto',
      pageSize: 'A4',
      generatedAt: new Date(),
      dateRangeLabel: dateLabel,
      plantName,
      clientNames,
      vatRatePct,
    };
  }, [reportData, orderedCols, groupBy, dateRange]);

  // ── Excel export ──────────────────────────────────────────────────────────
  const handlePdfExport = useCallback(async () => {
    if (!reportData.length || !reportSummary) return;
    setPdfLoading(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { DeliveryReceiptPDF } = await import('@/components/reports/templates/DeliveryReceiptPDF');
      const blob = await pdf(
        <DeliveryReceiptPDF data={reportData} summary={reportSummary} config={pdfConfig} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const clientSlug = pdfConfig.clientNames[0]?.replace(/\s+/g, '-').toLowerCase() ?? 'dc';
      a.href = url;
      a.download = `reporte-${clientSlug}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('PDF export error', e);
    } finally {
      setPdfLoading(false);
    }
  }, [reportData, reportSummary, pdfConfig]);

  const handleExcelExport = useCallback(async () => {
    if (!reportData.length || !reportSummary) return;
    setExcelLoading(true);
    try {
      const cfg: DeliveryReceiptExcelConfig = {
        columns: orderedCols,
        reportTitle: pdfConfig.reportTitle,
        dateRangeLabel: pdfConfig.dateRangeLabel,
        clientNames: pdfConfig.clientNames,
        plantName: pdfConfig.plantName,
        vatRatePct: pdfConfig.vatRatePct,
        generatedAt: new Date(),
        groupBy,
      };
      const buf = await buildDeliveryReceiptExcel(reportData, reportSummary, cfg);
      const clientSlug = pdfConfig.clientNames[0]?.replace(/\s+/g, '-').toUpperCase() ?? 'REPORTE';
      const dateSlug = format(new Date(), 'yyyy-MM-dd');
      downloadExcelBuffer(buf, `reporte-${clientSlug}-${dateSlug}`);
    } catch (e) {
      console.error('Excel export error', e);
    } finally {
      setExcelLoading(false);
    }
  }, [reportData, reportSummary, orderedCols, groupBy, pdfConfig]);

  // ── Evidence preflight (lightweight count) ────────────────────────────────
  useEffect(() => {
    if (step !== 'review' || reportData.length === 0) {
      setEvidenceCounts(null);
      return;
    }
    let cancelled = false;
    setEvidenceCountLoading(true);
    countEvidenceFiles(reportData)
      .then((c) => { if (!cancelled) setEvidenceCounts(c); })
      .catch((e) => { console.warn('evidence preflight', e); if (!cancelled) setEvidenceCounts(null); })
      .finally(() => { if (!cancelled) setEvidenceCountLoading(false); });
    return () => { cancelled = true; };
  }, [step, reportData]);

  const handleEvidenceDownload = useCallback(async () => {
    if (!reportData.length) return;
    const ctrl = new AbortController();
    evidenceAbortRef.current = ctrl;
    setEvidenceBundling(true);
    setEvidenceError(null);
    setEvidenceProgress({ done: 0, total: evidenceCounts?.orders ?? 1 });
    try {
      const clientName = reportData[0]?.client?.business_name ?? 'cliente';
      const stamp = format(new Date(), 'yyyyMMdd-HHmm');
      const bundleRoot = `evidencia-${clientName}-${stamp}`.replace(/\s+/g, '-');
      const { blob, orderCount, fileCount, capped } = await buildEvidenceBundle({
        remisiones: reportData,
        bundleRoot,
        signal: ctrl.signal,
        onProgress: (p) => setEvidenceProgress({ done: p.done, total: p.total, label: p.currentLabel }),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bundleRoot}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (capped) {
        setEvidenceError(`ZIP con ${fileCount} archivo(s) de ${orderCount} pedido(s). Se alcanzó el límite de ${MAX_BUNDLE_FILES} archivos; reduzca la selección para incluir el resto.`);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setEvidenceError('Descarga cancelada');
      } else {
        console.error('evidence bundle', e);
        setEvidenceError(e?.message ?? 'No se pudo generar el ZIP');
      }
    } finally {
      setEvidenceBundling(false);
      evidenceAbortRef.current = null;
    }
  }, [reportData, evidenceCounts]);

  const cancelEvidenceDownload = useCallback(() => {
    evidenceAbortRef.current?.abort();
  }, []);

  // ── FIFO pumping allocation map for preview cell rendering ───────────────
  // Maps `${order_id}:${remision_id}` → allocated pumping cost per concrete row.
  const fifoAllocationMap = useMemo(
    () => computeFIFOPumpingAllocation(reportData),
    [reportData],
  );

  // ── Additional-products map for preview "Adicional/m³" column ────────────
  const additionalsByOrderId = useMemo(() => {
    const fmtCurrLocal = (n: number) =>
      `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const m = new Map<string, { total_per_m3: number; labels: string[] }>();
    for (const r of reportData) {
      const key = String(r.order_id ?? '');
      if (!key || m.has(key)) continue;
      const addl = r.order?.additional_products ?? [];
      if (!addl.length) continue;
      const perM3 = addl.filter((a) => a.billing_type === 'PER_M3');
      const total_per_m3 = perM3.reduce((s, a) => s + a.unit_price, 0);
      // Label is amount-only — internal codes are noise to clients
      const labels = perM3.length > 0 ? [`+${fmtCurrLocal(total_per_m3)}/m³`] : [];
      m.set(key, { total_per_m3, labels });
    }
    return m;
  }, [reportData]);

  // ── Preview rows: original service data + additional-product pseudo-rows ──
  const previewRows = useMemo(() => {
    const pseudo = buildAdditionalProductPseudoRows(reportData);
    const all = [...reportData, ...pseudo];
    const tipoRankPreview = (t?: string) => {
      const u = String(t ?? '').toUpperCase();
      if (u === 'ADICIONAL') return 2;
      if (u !== 'CONCRETO' && u !== '') return 1;
      return 0;
    };
    return all.sort((a, b) => {
      const ao = String(a.order?.order_number ?? a.order_id ?? '');
      const bo = String(b.order?.order_number ?? b.order_id ?? '');
      if (ao !== bo) return ao.localeCompare(bo, 'es-MX');
      const tr = tipoRankPreview(a.tipo_remision) - tipoRankPreview(b.tipo_remision);
      if (tr !== 0) return tr;
      return (a.fecha ?? '').localeCompare(b.fecha ?? '');
    });
  }, [reportData]);

  // ── Render ────────────────────────────────────────────────────────────────
  const dateLabel =
    dateRange.from && dateRange.to
      ? `${format(dateRange.from, 'dd/MM/yyyy')} – ${format(dateRange.to, 'dd/MM/yyyy')}`
      : '—';

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Reportes de Entregas</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            Selecciona remisiones, configura columnas y exporta en PDF o Excel
          </p>
        </div>
        {liveSummary && liveSummary.count > 0 && (
          <Badge variant="secondary" className="text-xs font-mono tabular-nums">
            {liveSummary.count} rem. · {fmtNum(liveSummary.vol)} m³ · {fmtCurr(liveSummary.amount)}
          </Badge>
        )}
      </div>

      {fromEvidenciaHandoff && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-950">
          <span className="font-medium">
            Desde evidencia remisiones — {evidenciaOrderCount} pedido(s) precargado(s)
          </span>
          <Button variant="outline" size="sm" className="border-amber-400 bg-white" asChild>
            <Link href="/finanzas/evidencia-remisiones-concreto">Volver a evidencia</Link>
          </Button>
        </div>
      )}

      {/* Step nav */}
      <div className="flex items-center gap-0 rounded-lg border border-stone-200 bg-white p-1 text-sm">
        {(['selection', 'columns', 'review'] as Step[]).map((s, i) => {
          const labels: Record<Step, string> = {
            selection: '1. Selección',
            columns: '2. Columnas',
            review: '3. Revisar y Exportar',
          };
          const active = step === s;
          return (
            <button
              key={s}
              onClick={() => {
                if (s === 'review') { goToReview(); } else { setStep(s); }
              }}
              className={`flex-1 rounded-md px-4 py-2 text-center transition-colors ${
                active
                  ? 'bg-stone-900 text-white font-medium'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              {labels[s]}
            </button>
          );
        })}
      </div>

      {/* ── Step 1: Selection ─────────────────────────────────────────── */}
      {step === 'selection' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <Card className="border-stone-200">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Período
                  </span>
                  <DatePickerWithRange value={dateRange} onChange={(d) => d && setDateRange(d)} />
                </div>
                {availablePlants.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
                      Planta{availablePlants.length > 1 ? 's' : ''}
                    </span>
                    <Popover open={plantPickerOpen} onOpenChange={setPlantPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={availablePlants.length < 2}
                          className="h-9 gap-2 border-stone-200 bg-white text-sm font-normal text-stone-700 hover:bg-stone-50"
                        >
                          <Building2 className="h-3.5 w-3.5 text-stone-500" />
                          {selectedPlantIds.length === 0
                            ? 'Todas'
                            : selectedPlantIds.length === availablePlants.length
                              ? `Todas (${availablePlants.length})`
                              : selectedPlantIds.length === 1
                                ? (availablePlants.find((p) => p.id === selectedPlantIds[0])?.code
                                    ?? availablePlants.find((p) => p.id === selectedPlantIds[0])?.name
                                    ?? '1 planta')
                                : `${selectedPlantIds.length} plantas`}
                          <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2" align="start">
                        <div className="mb-1 flex items-center justify-between px-1 text-[11px] uppercase tracking-wide text-stone-500">
                          <span>Plantas</span>
                          {isGlobalAdmin && availablePlants.length > 1 && (
                            <button
                              className="rounded px-1.5 py-0.5 text-stone-600 hover:bg-stone-100"
                              onClick={() => {
                                setSelectedPlantIds(
                                  selectedPlantIds.length === availablePlants.length
                                    ? []
                                    : availablePlants.map((p) => p.id),
                                );
                              }}
                            >
                              {selectedPlantIds.length === availablePlants.length ? 'Limpiar' : 'Todas'}
                            </button>
                          )}
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {availablePlants.map((p) => {
                            const checked = selectedPlantIds.includes(p.id);
                            return (
                              <label
                                key={p.id}
                                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-stone-50"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => {
                                    setSelectedPlantIds((prev) => {
                                      if (v) return prev.includes(p.id) ? prev : [...prev, p.id];
                                      return prev.filter((id) => id !== p.id);
                                    });
                                  }}
                                />
                                <span className="flex-1 truncate text-stone-700">
                                  <span className="font-medium text-stone-900">{p.code}</span>
                                  <span className="ml-1.5 text-stone-500">{p.name}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Buscar
                  </span>
                  <Input
                    placeholder="Cliente, orden, remisión..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 border-stone-200 bg-white text-sm"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadHierarchical}
                  className="gap-2 border-stone-200 text-stone-700 hover:bg-stone-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Actualizar
                </Button>
                {selectedRemisionIds.size > 0 && (
                  <Button
                    size="sm"
                    onClick={() => setStep('columns')}
                    className="gap-2 bg-stone-900 text-white hover:bg-stone-800"
                  >
                    Continuar
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Live KPI bar when something is selected */}
          {liveSummary && liveSummary.count > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
              <KpiTile label="Remisiones" value={String(liveSummary.count)} />
              <KpiTile label="Volumen" value={`${fmtNum(liveSummary.vol)} m³`} />
              <KpiTile label="Subtotal" value={fmtCurr(liveSummary.amount)} accent />
            </div>
          )}

          {/* Tree */}
          {hierarchicalLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : hierarchicalError ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="flex items-center gap-3 p-4 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {hierarchicalError}
              </CardContent>
            </Card>
          ) : (
            <SelectionTree
              data={filteredHierarchical}
              selectedRemisionIds={selectedRemisionIds}
              onToggleRemision={toggleRemision}
              onToggleOrder={toggleOrder}
              onToggleClient={toggleClient}
              onSelectAll={selectAll}
              onClearAll={clearAll}
            />
          )}
        </div>
      )}

      {/* ── Step 2: Columns ───────────────────────────────────────────── */}
      {step === 'columns' && (
        <div className="space-y-4">
          <Card className="border-stone-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-stone-800">
                Configuración de Columnas
              </CardTitle>
              <CardDescription className="text-xs text-stone-500">
                Selecciona y ordena las columnas. Las flechas controlan el orden en PDF y Excel.
              </CardDescription>
              {reportLoading && (
                <p
                  className="mt-2 flex items-center gap-2 text-sm text-stone-700"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  Generando datos del reporte…
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Ordenar por
                  </span>
                  <Select value={sortDirection} onValueChange={(v) => setSortDirection(v as 'asc' | 'desc')}>
                    <SelectTrigger className="h-8 w-40 border-stone-200 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Fecha descendente</SelectItem>
                      <SelectItem value="asc">Fecha ascendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Agrupar por
                  </span>
                  <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
                    <SelectTrigger className="h-8 w-44 border-stone-200 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin agrupación</SelectItem>
                      <SelectItem value="order">Por orden / pedido</SelectItem>
                      <SelectItem value="construction_site">Por obra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ColumnPicker
                orderedCols={orderedCols}
                onReorder={reorderCol}
                onRemove={removeCol}
                onAddCol={addCol}
                onApplyPreset={applyPreset}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep('selection')} className="border-stone-200 text-stone-600">
              ← Selección
            </Button>
            <Button
              size="sm"
              disabled={selectedRemisionIds.size === 0}
              onClick={goToReview}
              className="bg-stone-900 text-white hover:bg-stone-800"
            >
              Ver Reporte →
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Export ───────────────────────────────────── */}
      {/* Evidence bundle progress dialog */}
      <Dialog
        open={evidenceBundling || !!evidenceError}
        onOpenChange={(open) => {
          if (!open && !evidenceBundling) setEvidenceError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Evidencia por pedido</DialogTitle>
            <DialogDescription>
              {evidenceBundling
                ? 'Descargando y uniendo los archivos de evidencia. No cierres esta ventana.'
                : 'Resultado de la descarga.'}
            </DialogDescription>
          </DialogHeader>
          {evidenceBundling && evidenceProgress && (
            <div className="space-y-3">
              <Progress
                value={
                  evidenceProgress.total > 0
                    ? Math.min(100, (evidenceProgress.done / evidenceProgress.total) * 100)
                    : 0
                }
              />
              <p className="text-xs text-stone-600">
                {evidenceProgress.label ?? 'Procesando…'} ({evidenceProgress.done}/{evidenceProgress.total})
              </p>
            </div>
          )}
          {!evidenceBundling && evidenceError && (
            <p className="text-sm text-stone-700">{evidenceError}</p>
          )}
          <DialogFooter>
            {evidenceBundling ? (
              <Button variant="outline" size="sm" onClick={cancelEvidenceDownload}>
                Cancelar
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEvidenceError(null)}>
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {step === 'review' && (
        <div className="space-y-4">
          {/* KPIs */}
          {reportSummary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <KpiTile label="Remisiones" value={String(reportSummary.totalRemisiones)} />
              <KpiTile
                label="Volumen"
                value={`${fmtNum(reportSummary.totalVolume)} m³`}
              />
              <KpiTile label="Subtotal" value={fmtCurr(reportSummary.totalAmount)} />
              <KpiTile label="IVA" value={fmtCurr(reportSummary.totalVAT)} />
              <KpiTile label="Total" value={fmtCurr(reportSummary.finalTotal)} accent />
            </div>
          )}

          {/* Preview table */}
          <Card className="border-stone-200">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold text-stone-800">
                  Vista Previa de Datos
                </CardTitle>
                <p className="mt-0.5 text-xs text-stone-500">
                  Estas son las mismas {orderedCols.length} columnas que aparecerán en el PDF y Excel exportados
                </p>
              </div>
              {reportData.length > 0 && (
                <span className="text-xs text-stone-500">{previewRows.length} registros</span>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {reportLoading ? (
                <div className="space-y-2 p-4">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : reportError ? (
                <div className="flex items-center gap-2 p-4 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {reportError}
                </div>
              ) : reportData.length === 0 ? (
                <div className="py-12 text-center text-sm text-stone-400">
                  Sin datos para las selecciones realizadas
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-stone-50 hover:bg-stone-50">
                        {orderedCols.map((col) => (
                          <TableHead
                            key={col.id}
                            className="text-xs font-semibold uppercase tracking-wide text-stone-600"
                          >
                            {col.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.slice(0, 60).map((row, i) => {
                        const isAddl = String(row.tipo_remision ?? '').toUpperCase() === 'ADICIONAL';
                        const isPump = String(row.tipo_remision ?? '').toUpperCase() === 'BOMBEO' || String(row.tipo_remision ?? '').toUpperCase() === 'VACÍO DE OLLA';
                        const rowCls = isAddl
                          ? 'bg-amber-50/70 hover:bg-amber-50'
                          : isPump
                          ? 'bg-blue-50/50 hover:bg-blue-50/70'
                          : 'hover:bg-stone-50/60';
                        return (
                        <TableRow key={row.id ?? i} className={rowCls}>
                          {orderedCols.map((col) => {
                            const isNum = col.type === 'currency' || col.type === 'number';
                            const isRemCol = col.id === 'remision_number';
                            return (
                              <TableCell
                                key={col.id}
                                className={`py-2 text-xs ${isNum ? 'text-right font-mono tabular-nums text-stone-700' : 'text-stone-600'} ${isAddl ? 'italic text-amber-800' : ''} ${isPump ? 'italic text-blue-800' : ''}`}
                              >
                                {isRemCol ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <span>{cellDisplay(row, col, fifoAllocationMap, additionalsByOrderId)}</span>
                                    <PumpingPill tipo={row.tipo_remision} />
                                    <AdditionalPill tipo={row.tipo_remision} />
                                  </span>
                                ) : (
                                  cellDisplay(row, col, fifoAllocationMap, additionalsByOrderId)
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {reportData.length > 50 && (
                    <p className="py-3 text-center text-xs text-stone-400">
                      Mostrando 50 de {reportData.length} registros. El PDF/Excel incluye todos.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export actions */}
          <Card className="border-stone-200">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-stone-800">Opciones de Exportación</p>
                <p className="text-xs text-stone-500">
                  {reportSummary?.totalRemisiones ?? 0} registros · {orderedCols.length} columnas · {dateLabel}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep('columns')}
                  className="border-stone-200 text-stone-600"
                >
                  <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                  Editar columnas
                </Button>
                {reportData.length > 0 && reportSummary && (
                  <>
                    <Button
                      size="sm"
                      disabled={pdfLoading}
                      onClick={handlePdfExport}
                      className="gap-2 bg-stone-900 text-white hover:bg-stone-800"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {pdfLoading ? 'Generando...' : 'Descargar PDF'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={excelLoading}
                      onClick={handleExcelExport}
                      className="gap-2 border-stone-200 text-stone-700 hover:bg-stone-50"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      {excelLoading ? 'Generando...' : 'Descargar Excel'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        evidenceBundling ||
                        evidenceCountLoading ||
                        !evidenceCounts ||
                        evidenceCounts.totalFiles === 0
                      }
                      onClick={handleEvidenceDownload}
                      className="gap-2 border-stone-200 text-stone-700 hover:bg-stone-50"
                      title={
                        evidenceCounts
                          ? `${evidenceCounts.concreteFiles} concreto · ${evidenceCounts.pumpingFiles} bombeo en ${evidenceCounts.orders} pedido(s)`
                          : 'Calculando evidencia…'
                      }
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {evidenceCountLoading
                        ? 'Evidencia…'
                        : evidenceCounts
                        ? `Evidencia (${evidenceCounts.totalFiles})`
                        : 'Evidencia'}
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
