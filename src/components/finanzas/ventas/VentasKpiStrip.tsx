'use client';

import { Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SummaryMetrics } from '@/utils/salesDataProcessor';

interface VentasKpiStripProps {
  currentSummaryMetrics: SummaryMetrics;
  includeVAT: boolean;
  filteredWeightedGuaranteeAge: number;
  gaStreaming: boolean;
  gaPercent: number;
}

export function VentasKpiStrip({
  currentSummaryMetrics,
  includeVAT,
  filteredWeightedGuaranteeAge,
  gaStreaming,
  gaPercent,
}: VentasKpiStripProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <div className="glass-thick rounded-3xl border border-systemBlue/20 bg-gradient-to-br from-systemBlue/10 to-systemBlue/5 p-6 text-center">
        <p className="text-title-1 mb-2 font-bold tabular-nums text-label-primary">
          {includeVAT
            ? formatCurrency(currentSummaryMetrics.totalAmountWithVAT)
            : formatCurrency(currentSummaryMetrics.totalAmount)}
        </p>
        <p className="text-callout font-medium text-label-secondary">
          Total de ventas {includeVAT ? '(Con IVA)' : '(Subtotal)'}
        </p>
      </div>

      <div className="glass-thick rounded-3xl border border-systemGreen/20 bg-gradient-to-br from-systemGreen/10 to-systemGreen/5 p-6 text-center">
        <p className="text-title-1 mb-2 font-bold tabular-nums text-label-primary">
          {(currentSummaryMetrics.totalVolume + currentSummaryMetrics.emptyTruckVolume).toFixed(1)}
        </p>
        <p className="text-callout font-medium text-label-secondary">Volumen Total (m³)</p>
        <p className="mt-2 text-caption text-label-tertiary">Concreto + Bombeo + Vacío de Olla</p>
      </div>

      <div className="glass-thick rounded-3xl border border-systemOrange/20 bg-gradient-to-br from-systemOrange/10 to-systemOrange/5 p-6 text-center">
        <p className="text-title-1 mb-2 font-bold tabular-nums text-label-primary">
          {(filteredWeightedGuaranteeAge || 0).toFixed(1)}
        </p>
        <p className="text-callout font-medium text-label-secondary">Edad de Garantía (días)</p>
        {gaStreaming && (
          <p className="mt-2 text-caption text-label-tertiary">Cargando {gaPercent}%</p>
        )}
      </div>

      <div className="glass-thick relative rounded-3xl border border-systemPurple/20 bg-gradient-to-br from-systemPurple/10 to-systemPurple/5 p-6 text-center">
        <p className="text-title-1 mb-2 font-bold tabular-nums text-label-primary">
          {currentSummaryMetrics.weightedResistance.toFixed(1)}
          {currentSummaryMetrics.resistanceTooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="absolute right-4 top-4 h-4 w-4 cursor-help text-label-tertiary" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-caption">{currentSummaryMetrics.resistanceTooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </p>
        <p className="text-callout font-medium text-label-secondary">Resistencia Ponderada</p>
        <p className="mt-2 text-caption text-label-tertiary">kg/cm² promedio por volumen</p>
      </div>
    </div>
  );
}
