'use client';

import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface QuoteProductSummary {
  pricingPath?: 'LIST_PRICE' | 'COST_DERIVED';
  finalPrice: number;
  effectiveFloor?: number | null;
  floorPrice?: number | null;
  requiresApproval?: boolean;
}

interface QuoteApprovalSummaryProps {
  products: QuoteProductSummary[];
}

export function QuoteApprovalSummary({ products }: QuoteApprovalSummaryProps) {
  if (products.length === 0) return null;

  // pricingPath is authoritative; fall back floorPrice for legacy drafts
  const listPriced = products.filter((p) => p.pricingPath === 'LIST_PRICE');
  const costDerivedCount = products.filter((p) => p.pricingPath !== 'LIST_PRICE').length;

  // "Bajo piso" = solo partidas CON lista cuyo precio está bajo el piso efectivo (no las sin lista)
  const belowFloor = products.filter(
    (p) => p.pricingPath === 'LIST_PRICE' && p.requiresApproval
  );

  const avgUpliftPct =
    listPriced.length > 0
      ? listPriced.reduce((sum, p) => {
          const floor = p.effectiveFloor ?? p.floorPrice ?? 0;
          if (floor <= 0) return sum;
          return sum + ((p.finalPrice - floor) / floor) * 100;
        }, 0) / listPriced.length
      : 0;

  const isAutoApproved = belowFloor.length === 0 && costDerivedCount === 0;

  return (
    <div
      className={
        isAutoApproved
          ? 'mb-4 rounded-lg border border-systemGreen/30 bg-systemGreen/10 p-4'
          : 'mb-4 rounded-lg border border-systemOrange/30 bg-systemOrange/10 p-4'
      }
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {isAutoApproved ? (
            <CheckCircle2 className="h-5 w-5 text-systemGreen" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-systemOrange" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {isAutoApproved
              ? 'Autoaprobada — todas las partidas con precio de lista y sobre piso'
              : 'Requiere aprobación — hay partidas bajo piso o sin precio de lista'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Uplift promedio vs lista:{' '}
            <span className="font-semibold">{avgUpliftPct.toFixed(1)}%</span>
            {' · '}
            Bajo piso: <span className="font-semibold">{belowFloor.length}</span>
            {' · '}
            Sin precio de lista: <span className="font-semibold">{costDerivedCount}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
