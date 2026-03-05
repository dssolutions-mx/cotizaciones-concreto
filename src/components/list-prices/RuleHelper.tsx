'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PricingFamily } from '@/lib/services/listPriceWorkspaceService';

interface Props {
  family: PricingFamily;
  anchorCost: number | undefined;
  ruleAnchorPrice: string;
  ruleDeltaRev: string;
  ruleUpliftBombeado: string;
  ruleDeltaTmaSmaller: string;
  ruleDeltaTmaLarger: string;
  onAnchorChange: (v: string) => void;
  onDeltaRevChange: (v: string) => void;
  onUpliftChange: (v: string) => void;
  onDeltaTmaSmallerChange: (v: string) => void;
  onDeltaTmaLargerChange: (v: string) => void;
  onApply: () => void;
}

const MARGIN_PRESETS = [10, 15, 20, 25, 30];

export function RuleHelper({
  family,
  anchorCost,
  ruleAnchorPrice,
  ruleDeltaRev,
  ruleUpliftBombeado,
  ruleDeltaTmaSmaller,
  ruleDeltaTmaLarger,
  onAnchorChange,
  onDeltaRevChange,
  onUpliftChange,
  onDeltaTmaSmallerChange,
  onDeltaTmaLargerChange,
  onApply,
}: Props) {
  const hasBombeado = family.placements.some((p) => !p.toUpperCase().startsWith('D'));
  const anchorMaster = family.masters.find((m) => m.id === family.anchorMasterId);
  const anchorTma = anchorMaster?.max_aggregate_size ?? 20;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-800">
          Regla de llenado rápido
        </CardTitle>
        <CardDescription className="text-sm text-slate-500">
          Pre-rellena todos los maestros de la familia. Puedes ajustar individualmente después.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className={`grid grid-cols-1 gap-4 ${hasBombeado ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>

          {/* Anchor price */}
          <div>
            <label className="block text-caption font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
              Precio ancla — Directa · Rev.&nbsp;{family.slumpValues[0]} cm
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-footnote select-none">$</span>
              <Input
                type="number"
                className="pl-7 rounded-xl border-gray-200 focus:ring-systemBlue/40 focus:border-systemBlue/40"
                value={ruleAnchorPrice}
                onChange={(e) => onAnchorChange(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {anchorCost != null && (
              <div className="flex flex-wrap items-center gap-1 mt-2">
                <span className="text-caption text-gray-400">Margen rápido:</span>
                {MARGIN_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => onAnchorChange((anchorCost * (1 + pct / 100)).toFixed(2))}
                    className="text-xs px-2 py-0.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delta revenimiento */}
          <div>
            <label className="block text-caption font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
              Delta por revenimiento <span className="text-gray-400 normal-case font-normal">(cada 4 cm)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-footnote select-none">$</span>
              <Input
                type="number"
                className="pl-7 rounded-xl border-gray-200 focus:ring-systemBlue/40 focus:border-systemBlue/40"
                value={ruleDeltaRev}
                onChange={(e) => onDeltaRevChange(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <p className="text-caption text-gray-400 mt-1">10→14→18→22 cm. Cada paso suma este monto.</p>
          </div>

          {/* Uplift bombeado */}
          {hasBombeado && (
            <div>
              <label className="block text-caption font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                Uplift colocación bombeada
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-footnote select-none">$</span>
                <Input
                  type="number"
                  className="pl-7 rounded-xl border-gray-200 focus:ring-systemBlue/40 focus:border-systemBlue/40"
                  value={ruleUpliftBombeado}
                  onChange={(e) => onUpliftChange(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <p className="text-caption text-gray-400 mt-1">
                Se suma a Directa mismo Rev. para obtener Bombeado.
              </p>
            </div>
          )}
        </div>

        {/* TMA deltas — anchor TMA as reference; finer (&lt; ancla) or coarser (&gt; ancla) can cost more */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-caption font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
              Delta TMA {'<'}{' '}{anchorTma} mm
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-footnote select-none">$</span>
              <Input
                type="number"
                className="pl-7 rounded-xl border-gray-200 focus:ring-systemBlue/40 focus:border-systemBlue/40"
                value={ruleDeltaTmaSmaller}
                onChange={(e) => onDeltaTmaSmallerChange(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <p className="text-caption text-gray-400 mt-1">
              Agregado más fino que {anchorTma} mm suele costar más.
            </p>
          </div>
          <div>
            <label className="block text-caption font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
              Delta TMA {'>'}{' '}{anchorTma} mm
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-footnote select-none">$</span>
              <Input
                type="number"
                className="pl-7 rounded-xl border-gray-200 focus:ring-systemBlue/40 focus:border-systemBlue/40"
                value={ruleDeltaTmaLarger}
                onChange={(e) => onDeltaTmaLargerChange(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <p className="text-caption text-gray-400 mt-1">
              Agregado más grueso que {anchorTma} mm puede costar más según planta.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onApply}>
            Calcular y pre-rellenar {family.masters.length} maestros
          </Button>
          {ruleAnchorPrice && (
            <p className="text-sm text-slate-500">
              Los precios quedarán como borrador hasta que guardes.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
