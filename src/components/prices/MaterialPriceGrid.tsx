'use client';

import { Fragment, useMemo, useState, useCallback, KeyboardEvent } from 'react';
import type { Material } from '@/types/recipes';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { PriceChangeIndicator } from '@/components/prices/PriceChangeIndicator';
import { MaterialPriceSparkline } from '@/components/prices/MaterialPriceSparkline';
import { LineChart as LineChartIcon } from 'lucide-react';

export type PriceRow = {
  material_id: string;
  price_per_unit: number;
  material_type?: string;
};

export type MaterialPriceGridProps = {
  materials: Material[];
  periodPrices: Map<string, PriceRow>;
  previousPrices: Map<string, number>;
  /** material_id → ordered price history (ascending by month) for sparkline */
  historySeries: Map<string, number[]>;
  canEdit: boolean;
  savingId: string | null;
  selectedMaterialId: string | null;
  onSelectMaterial: (materialId: string | null) => void;
  onSavePrice: (materialId: string, price: number, materialType: string) => Promise<void>;
  search: string;
  onSearchChange: (q: string) => void;
};

export function MaterialPriceGrid({
  materials,
  periodPrices,
  previousPrices,
  historySeries,
  canEdit,
  savingId,
  selectedMaterialId,
  onSelectMaterial,
  onSavePrice,
  search,
  onSearchChange,
}: MaterialPriceGridProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter(
      (m) =>
        m.material_name.toLowerCase().includes(q) ||
        m.material_code.toLowerCase().includes(q) ||
        (m.category || '').toLowerCase().includes(q)
    );
  }, [materials, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Material[]>();
    for (const m of filtered) {
      const cat = m.category || 'Sin categoría';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(m);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.material_name.localeCompare(b.material_name, 'es'));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [filtered]);

  const startEdit = useCallback(
    (m: Material) => {
      if (!canEdit) return;
      const row = periodPrices.get(m.id);
      setEditingId(m.id);
      setDraft(row ? String(row.price_per_unit) : '');
    },
    [canEdit, periodPrices]
  );

  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
  };

  const commitEdit = async (materialId: string, materialType: string) => {
    const n = Number(draft.replace(/,/g, '.'));
    if (Number.isNaN(n) || n < 0) {
      cancelEdit();
      return;
    }
    await onSavePrice(materialId, n, materialType);
    cancelEdit();
  };

  const onKeyDown = (e: KeyboardEvent, materialId: string, materialType: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitEdit(materialId, materialType);
    }
    if (e.key === 'Escape') cancelEdit();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <Input
          placeholder="Buscar por nombre, código o categoría…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-md"
        />
        <p className="text-sm text-muted-foreground">
          {filtered.length} materiales · {grouped.length} categorías
        </p>
      </div>

      <div className="rounded-xl border border-white/50 bg-white/60 backdrop-blur-md overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-white/80 hover:bg-white/80">
              <TableHead className="w-10" aria-label="Detalle" />
              <TableHead>Material</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Precio (mes)</TableHead>
              <TableHead className="text-right">Mes ant.</TableHead>
              <TableHead className="text-right">Cambio</TableHead>
              <TableHead className="text-center w-[88px]">Tendencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map(([category, list]) => (
              <Fragment key={category}>
                <TableRow className="bg-emerald-50/80 hover:bg-emerald-50/80">
                  <TableCell colSpan={8} className="font-semibold text-emerald-900 py-2">
                    {category}
                  </TableCell>
                </TableRow>
                {list.map((m) => {
                  const row = periodPrices.get(m.id);
                  const current = row?.price_per_unit ?? null;
                  const prev = previousPrices.get(m.id) ?? null;
                  const isSelected = selectedMaterialId === m.id;
                  const isEditing = editingId === m.id;
                  const series = historySeries.get(m.id) || [];
                  const materialType = row?.material_type || 'MATERIAL';

                  return (
                    <TableRow
                      key={m.id}
                      className={cn(
                        'cursor-pointer transition-colors border-l-4 border-transparent',
                        isSelected && 'bg-emerald-50/70 border-l-emerald-600 shadow-[inset_0_0_0_1px_rgba(5,150,105,0.15)]'
                      )}
                      onClick={() => onSelectMaterial(m.id)}
                    >
                      <TableCell className="w-10">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-700"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onSelectMaterial(m.id);
                          }}
                          aria-label="Abrir panel de historial y otros meses"
                        >
                          <LineChartIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium max-w-[220px] truncate" title={m.material_name}>
                        {m.material_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{m.material_code}</TableCell>
                      <TableCell className="text-sm">{m.unit_of_measure}</TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            autoFocus
                            className="w-28 ml-auto text-right tabular-nums"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => onKeyDown(e, m.id, materialType)}
                            onBlur={() => {
                              if (editingId === m.id) void commitEdit(m.id, materialType);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            disabled={!canEdit}
                          />
                        ) : (
                          <button
                            type="button"
                            className={cn(
                              'tabular-nums rounded-lg px-2 py-1 -mr-2 transition-colors',
                              canEdit && 'hover:bg-white/80',
                              !canEdit && 'cursor-default'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(m);
                            }}
                          >
                            {current != null ? `$${current.toFixed(2)}` : '—'}
                          </button>
                        )}
                        {savingId === m.id && (
                          <span className="ml-2 text-xs text-muted-foreground">Guardando…</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {prev != null ? `$${prev.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <PriceChangeIndicator previous={prev} current={current} />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <MaterialPriceSparkline values={series} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">No hay materiales que coincidan.</div>
        )}
      </div>
    </div>
  );
}
