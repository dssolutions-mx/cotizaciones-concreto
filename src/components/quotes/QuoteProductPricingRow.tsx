'use client';

import { Info, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface QuoteRecipeLike {
  recipe_code: string;
  placement_type: string;
}

interface QuoteProductLike {
  recipe: QuoteRecipeLike;
  basePrice: number;
  volume: number;
  profitMargin: number;
  finalPrice: number;
  pricingPath?: 'LIST_PRICE' | 'COST_DERIVED';
  requiresApproval?: boolean;
  master_code?: string;
  floorPrice?: number | null;
  baseListPrice?: number | null;
  zoneRangeCode?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  zoneSurcharge?: number;
  effectiveFloor?: number | null;
  pricingEditorMode?: 'OVER_LIST' | 'DIRECT_FINAL';
  listDelta?: number;
}

interface QuoteProductPricingRowProps {
  product: QuoteProductLike;
  index: number;
  isMasterPricingEnabled: boolean;
  includesVAT: boolean;
  cashOverpricePct: number;
  onUpdateProductDetails: (index: number, updates: any) => void;
  onShowBreakdown: (index: number) => void;
  onRemove: (index: number) => void;
}

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
    {children}
  </span>
);

export function QuoteProductPricingRow({
  product,
  index,
  isMasterPricingEnabled,
  includesVAT,
  cashOverpricePct,
  onUpdateProductDetails,
  onShowBreakdown,
  onRemove,
}: QuoteProductPricingRowProps) {
  // pricingPath is authoritative; fall back to floorPrice for legacy drafts missing effectiveFloor
  const isListPriced = product.pricingPath === 'LIST_PRICE';
  const resolvedFloor = product.effectiveFloor ?? product.floorPrice ?? null;
  const isApproved = !product.requiresApproval;
  const deltaVsFloor = resolvedFloor != null ? product.finalPrice - resolvedFloor : null;

  // Derive raw list price (before cash uplift) for visualization
  const rawListPrice =
    product.baseListPrice != null && !includesVAT && cashOverpricePct > 0
      ? product.baseListPrice / (1 + cashOverpricePct / 100)
      : product.baseListPrice ?? null;
  const upliftAmount = rawListPrice != null && product.baseListPrice != null ? product.baseListPrice - rawListPrice : null;

  const displayCode =
    isMasterPricingEnabled && product.master_code
      ? product.master_code
      : product.recipe.recipe_code;

  // Layout unificado 12 cols: ident | ref/costo | precio | m³ | estado | del

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
        isListPriced && !isApproved ? 'border-systemOrange/40' : 'border-slate-200'
      }`}
    >
      <div className="grid grid-cols-2 md:grid-cols-6 xl:grid-cols-12 items-center gap-x-4 gap-y-3 px-4 py-3">

        {/* ── IDENTITY ─────────────────────────────── */}
        <div className="col-span-2 md:col-span-1 xl:col-span-3 min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-slate-900">
            {displayCode}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            {product.recipe.placement_type === 'D' ? 'Directa' : 'Bombeado'}
            {isListPriced && product.zoneRangeCode && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                Zona {product.zoneRangeCode}
              </span>
            )}
            {!isListPriced && (
              <span className="text-[10px] italic text-slate-400">Sin precio de lista</span>
            )}
          </p>
        </div>

        {/* ── REFERENCIAS (lista) / COSTO BASE (cost) ── */}
        {isListPriced ? (
          <div className="col-span-2 md:col-span-1 xl:col-span-3 space-y-1 border-l border-slate-100 pl-3 min-w-0">
            {rawListPrice != null && upliftAmount != null && !includesVAT && cashOverpricePct > 0 ? (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] text-slate-500">Lista catálogo</span>
                  <span className="text-sm font-medium tabular-nums text-slate-600">${fmt(rawListPrice)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] text-systemGreen">+{cashOverpricePct}% contado</span>
                  <span className="text-sm font-medium tabular-nums text-systemGreen">+${fmt(upliftAmount)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2 pt-0.5 border-t border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-600">Lista base</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-700">${fmt(product.baseListPrice)}</span>
                </div>
              </>
            ) : (
              <div>
                <FieldLabel>Lista base</FieldLabel>
                <p className="text-sm font-semibold tabular-nums text-slate-600">${fmt(product.baseListPrice)}</p>
              </div>
            )}
            {resolvedFloor != null && (
              <div className="flex items-baseline justify-between gap-2 pt-0.5 border-t border-slate-100">
                <span className="text-[10px] font-semibold text-slate-700">Piso efectivo</span>
                <span className="text-sm font-bold tabular-nums text-slate-800">${fmt(resolvedFloor)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="col-span-2 md:col-span-1 xl:col-span-3 border-l border-slate-100 pl-3">
            <FieldLabel>Costo base</FieldLabel>
            <div className="flex items-center gap-1.5">
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                <Input
                  type="number"
                  value={product.basePrice}
                  onChange={(e) =>
                    onUpdateProductDetails(index, { basePrice: parseFloat(e.target.value) || 0 })
                  }
                  className="h-9 pl-5 text-sm tabular-nums"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => onShowBreakdown(index)}
                className="h-9 w-9 shrink-0 border-slate-200 text-slate-400 hover:text-systemBlue"
                title="Ver desglose del precio base"
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── PRECIO (venta o final) — misma posición en ambos tipos ── */}
        {isListPriced ? (
          <div className="col-span-2 md:col-span-1 xl:col-span-3">
            <FieldLabel>Precio de venta</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
              <Input
                type="number"
                value={product.finalPrice}
                onChange={(e) =>
                  onUpdateProductDetails(index, { finalPrice: parseFloat(e.target.value) || 0 })
                }
                className={`h-10 pl-6 text-base font-semibold tabular-nums ${
                  isApproved ? 'text-systemGreen border-systemGreen/30' : 'text-systemOrange border-systemOrange/30'
                }`}
              />
            </div>
            {resolvedFloor != null && deltaVsFloor != null && (
              <p className={`mt-1 text-[11px] font-medium ${isApproved ? 'text-systemGreen' : 'text-systemOrange'}`}>
                {deltaVsFloor >= 0 ? `$${fmt(deltaVsFloor)} sobre el piso` : `$${fmt(Math.abs(deltaVsFloor))} bajo el piso`}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="col-span-1 xl:col-span-2">
              <FieldLabel>Margen</FieldLabel>
              <div className="relative">
                <Input
                  type="number"
                  value={(product.profitMargin * 100).toFixed(2)}
                  onChange={(e) =>
                    onUpdateProductDetails(index, { profitMargin: (parseFloat(e.target.value) || 0) / 100 })
                  }
                  className="h-9 pr-6 text-sm tabular-nums"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
              </div>
            </div>
            <div className="col-span-1 xl:col-span-2">
              <FieldLabel>Precio final</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                <Input
                  type="number"
                  value={product.finalPrice}
                  onChange={(e) =>
                    onUpdateProductDetails(index, { finalPrice: parseFloat(e.target.value) || 0 })
                  }
                  className="h-9 pl-5 text-sm font-semibold tabular-nums"
                />
              </div>
              <p className="mt-1 text-[10px] font-medium text-systemOrange">Requiere aprobación</p>
            </div>
          </>
        )}

        {/* ── VOLUMEN m³ ───────────────────────────── */}
        <div className="col-span-1 xl:col-span-1">
          <FieldLabel>m³</FieldLabel>
          <Input
            type="number"
            value={product.volume}
            onChange={(e) =>
              onUpdateProductDetails(index, { volume: parseFloat(e.target.value) || 0 })
            }
            className="h-9 w-full text-center text-sm tabular-nums"
          />
        </div>

        {/* ── ESTADO (solo lista) ────────────────────── */}
        {isListPriced && (
          <div className="col-span-1 xl:col-span-1 flex flex-col items-center justify-center">
            {isApproved ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-systemGreen" />
                <span className="text-[9px] font-bold uppercase tracking-wide text-systemGreen">Auto</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-systemOrange" />
                <span className="text-[9px] font-bold uppercase tracking-wide text-systemOrange">Aprob.</span>
              </>
            )}
          </div>
        )}

        {/* ── DELETE ───────────────────────────────── */}
        <div className="col-span-1 xl:col-span-1 flex justify-center">
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-systemRed text-white transition-colors hover:bg-systemRed/90 focus:outline-none focus:ring-2 focus:ring-systemRed/50 focus:ring-offset-2"
            title="Eliminar producto"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── STATUS BAR: delta vs floor (list-priced only) ─────────────────── */}
      {isListPriced && resolvedFloor != null && deltaVsFloor != null && (
        <div
          className={`border-t px-4 py-1.5 text-[11px] font-medium ${
            isApproved
              ? 'border-systemGreen/20 bg-systemGreen/5 text-systemGreen'
              : 'border-systemOrange/20 bg-systemOrange/5 text-systemOrange'
          }`}
        >
          {isApproved
            ? `✓ $${fmt(deltaVsFloor)} sobre el piso efectivo ($${fmt(resolvedFloor)})`
            : `⚠ $${fmt(Math.abs(deltaVsFloor))} bajo el piso efectivo ($${fmt(resolvedFloor)}) — requiere aprobación gerencial`}
        </div>
      )}
    </div>
  );
}
