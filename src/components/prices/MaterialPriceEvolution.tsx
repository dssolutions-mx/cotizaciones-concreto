'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { priceService } from '@/lib/supabase/prices';
import { parseMonthStart } from '@/lib/materialPricePeriod';
import { cn } from '@/lib/utils';
import { Check, Loader2, Pencil, Plus, X, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';

const MONTH_SHORT = new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' });
const MONTH_LONG = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });

function monthInputToPeriodStart(ym: string): string | null {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  return `${ym}-01`;
}

function periodToMonthInput(periodStart: string): string {
  return periodStart.slice(0, 7);
}

export type MaterialPriceEvolutionProps = {
  materialId: string | null;
  plantId: string | null;
  materialLabel: string;
  canEdit?: boolean;
  userId?: string | null;
  /** material_type for new/updated rows */
  defaultMaterialType?: string;
  /** Called after any save so the grid / sparklines refresh */
  onHistoryChanged?: () => void;
  /** Mes activo en la barra superior (sugerencia al agregar) */
  gridPeriodStart?: string | null;
};

type Row = {
  id?: string;
  period_start: string;
  price_per_unit: number;
  created_by: string | null;
  created_at: string | null;
};

export function MaterialPriceEvolution({
  materialId,
  plantId,
  materialLabel,
  canEdit = false,
  userId,
  defaultMaterialType = 'MATERIAL',
  onHistoryChanged,
  gridPeriodStart,
}: MaterialPriceEvolutionProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingPeriod, setSavingPeriod] = useState<string | null>(null);
  const [newMonthYm, setNewMonthYm] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [adding, setAdding] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!materialId || !plantId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await priceService.getMaterialPriceHistory(materialId, plantId);
      if (error) {
        console.error(error);
        setRows([]);
        return;
      }
      setRows((data as Row[]) || []);
    } finally {
      setLoading(false);
    }
  }, [materialId, plantId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setEditingPeriod(null);
    setEditDraft('');
    const hint = gridPeriodStart ? periodToMonthInput(gridPeriodStart) : '';
    setNewMonthYm(hint);
    setNewPrice('');
  }, [materialId, gridPeriodStart]);

  const periodSet = useMemo(() => new Set(rows.map((r) => r.period_start)), [rows]);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        month: MONTH_SHORT.format(parseMonthStart(r.period_start)),
        period: r.period_start,
        price: Number(r.price_per_unit) || 0,
      })),
    [rows]
  );

  const saveForPeriod = async (periodStart: string, price: number) => {
    if (!materialId || !plantId || !userId) return;
    setSavingPeriod(periodStart);
    try {
      const { error } = await priceService.saveMaterialPriceForPeriod({
        material_id: materialId,
        plant_id: plantId,
        period_start: periodStart,
        price_per_unit: price,
        material_type: defaultMaterialType,
        effective_date: periodStart,
        created_by: userId,
        updated_by: userId,
      });
      if (error) {
        toast.error('No se pudo guardar el precio');
        console.error(error);
        return;
      }
      toast.success(`Precio guardado (${MONTH_SHORT.format(parseMonthStart(periodStart))})`);
      setEditingPeriod(null);
      setEditDraft('');
      await loadHistory();
      onHistoryChanged?.();
    } finally {
      setSavingPeriod(null);
    }
  };

  const startEditRow = (r: Row) => {
    if (!canEdit) return;
    setEditingPeriod(r.period_start);
    setEditDraft(String(r.price_per_unit));
  };

  const commitEditRow = async () => {
    if (!editingPeriod) return;
    const n = Number(editDraft.replace(/,/g, '.'));
    if (Number.isNaN(n) || n < 0) {
      setEditingPeriod(null);
      return;
    }
    await saveForPeriod(editingPeriod, n);
  };

  const handleAddMonth = async () => {
    if (!canEdit || !userId) return;
    const period = monthInputToPeriodStart(newMonthYm);
    if (!period) {
      toast.error('Elige un mes válido');
      return;
    }
    if (periodSet.has(period)) {
      toast.message('Ese mes ya tiene precio — edítalo en la tabla de abajo');
      return;
    }
    const n = Number(newPrice.replace(/,/g, '.'));
    if (Number.isNaN(n) || n < 0) {
      toast.error('Indica un precio válido');
      return;
    }
    setAdding(true);
    try {
      await saveForPeriod(period, n);
      setNewPrice('');
    } finally {
      setAdding(false);
    }
  };

  if (!materialId || !plantId) {
    return (
      <Card className="border-white/40 bg-white/60 backdrop-blur-sm xl:sticky xl:top-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-emerald-700" />
            Detalle del material
          </CardTitle>
          <CardDescription>
            Pulsa un material en la tabla de la izquierda para ver la gráfica, el historial por mes y agregar o corregir
            precios de meses anteriores.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-white/40 bg-white/70 backdrop-blur-md shadow-lg shadow-emerald-900/5 xl:sticky xl:top-4 max-h-[calc(100vh-6rem)] flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-lg font-semibold tracking-tight leading-snug">{materialLabel}</CardTitle>
        <CardDescription>
          Historial por mes en esta planta. {canEdit ? 'Edita cualquier mes o agrega uno que falte.' : 'Solo lectura.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 overflow-y-auto min-h-0 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando historial…
          </div>
        ) : (
          <>
            {chartData.length > 0 ? (
              <div className="h-52 w-full shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-white/60" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={48} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid rgba(0,0,0,0.06)',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Precio']}
                    />
                    <Line type="monotone" dataKey="price" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2 text-center border border-dashed border-emerald-200/80 rounded-xl bg-emerald-50/40 px-3">
                Sin precios aún. {canEdit ? 'Usa el formulario de abajo para registrar el primer mes.' : ''}
              </p>
            )}

            {canEdit && userId && (
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                  <Plus className="h-4 w-4 shrink-0" />
                  Agregar precio en otro mes
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mp-new-month" className="text-xs text-muted-foreground">
                      Mes (cualquier fecha pasada o futura)
                    </Label>
                    <Input
                      id="mp-new-month"
                      type="month"
                      className="bg-white/90"
                      value={newMonthYm}
                      onChange={(e) => setNewMonthYm(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mp-new-price" className="text-xs text-muted-foreground">
                      Precio por unidad
                    </Label>
                    <Input
                      id="mp-new-price"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="bg-white/90 tabular-nums"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" onClick={() => void handleAddMonth()} disabled={adding}>
                    {adding ? 'Guardando…' : 'Guardar mes nuevo'}
                  </Button>
                  {gridPeriodStart && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-emerald-800"
                      onClick={() => setNewMonthYm(periodToMonthInput(gridPeriodStart))}
                    >
                      Usar mes de la barra ({MONTH_SHORT.format(parseMonthStart(gridPeriodStart))})
                    </Button>
                  )}
                </div>
                {newMonthYm && periodSet.has(monthInputToPeriodStart(newMonthYm) || '') && (
                  <p className="text-xs text-amber-800">Ese mes ya está en el historial — edítalo en la lista.</p>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium text-foreground">Todos los meses</span>
                <span className="text-xs text-muted-foreground">{rows.length} registro{rows.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="rounded-xl border border-white/50 overflow-hidden bg-white/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      {canEdit && <TableHead className="w-[100px] text-right">Acciones</TableHead>}
                      {!canEdit && <TableHead>Registrado</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...rows].reverse().map((r) => {
                      const isEditing = editingPeriod === r.period_start;
                      const isSaving = savingPeriod === r.period_start;
                      const isGridMonth = gridPeriodStart === r.period_start;
                      return (
                        <TableRow
                          key={r.id || `${r.period_start}-${r.price_per_unit}`}
                          className={cn(isGridMonth && 'bg-emerald-50/60')}
                        >
                          <TableCell className="font-medium">
                            <span className="capitalize">{MONTH_LONG.format(parseMonthStart(r.period_start))}</span>
                            {isGridMonth && (
                              <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">
                                · mes en barra
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditing ? (
                              <Input
                                className="w-28 ml-auto text-right tabular-nums h-8"
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void commitEditRow();
                                  if (e.key === 'Escape') {
                                    setEditingPeriod(null);
                                    setEditDraft('');
                                  }
                                }}
                                disabled={isSaving}
                                autoFocus
                              />
                            ) : (
                              <span className="tabular-nums">${Number(r.price_per_unit).toFixed(2)}</span>
                            )}
                          </TableCell>
                          {canEdit && (
                            <TableCell className="text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => void commitEditRow()}
                                    disabled={isSaving}
                                    aria-label="Guardar"
                                  >
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setEditingPeriod(null);
                                      setEditDraft('');
                                    }}
                                    disabled={isSaving}
                                    aria-label="Cancelar"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1"
                                  onClick={() => startEditRow(r)}
                                  disabled={!!savingPeriod || !userId}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </Button>
                              )}
                            </TableCell>
                          )}
                          {!canEdit && (
                            <TableCell className="text-muted-foreground text-xs">
                              {r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX') : '—'}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {rows.length === 0 && !loading && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">Sin filas en el historial.</div>
                )}
              </div>
              {canEdit && (
                <p className="text-xs text-muted-foreground mt-2">
                  El precio aplica a todo el mes indicado (desde el día1). Los reportes toman el precio del mes de cada
                  remisión.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
