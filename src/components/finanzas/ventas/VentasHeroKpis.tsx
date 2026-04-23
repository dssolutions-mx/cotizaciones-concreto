'use client';

import { Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SummaryMetrics } from '@/utils/salesDataProcessor';

interface VentasHeroKpisProps {
  currentSummaryMetrics: SummaryMetrics;
  includeVAT: boolean;
  filteredWeightedGuaranteeAge: number;
  gaStreaming: boolean;
  gaPercent: number;
}

export function VentasHeroKpis({
  currentSummaryMetrics,
  includeVAT,
  filteredWeightedGuaranteeAge,
  gaStreaming,
  gaPercent,
}: VentasHeroKpisProps) {
  const total =
    includeVAT ? currentSummaryMetrics.totalAmountWithVAT : currentSummaryMetrics.totalAmount;
  const cash =
    includeVAT ? currentSummaryMetrics.cashAmountWithVAT : currentSummaryMetrics.cashAmount;
  const fiscal =
    includeVAT ? currentSummaryMetrics.invoiceAmountWithVAT : currentSummaryMetrics.invoiceAmount;
  const volTotal =
    (currentSummaryMetrics.totalVolume ?? 0) + (currentSummaryMetrics.emptyTruckVolume ?? 0);
  const concrete = currentSummaryMetrics.concreteVolume ?? 0;
  const pump = currentSummaryMetrics.pumpVolume ?? 0;
  const vacio = currentSummaryMetrics.emptyTruckVolume ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-thick rounded-3xl border border-systemBlue/20 bg-gradient-to-br from-systemBlue/10 to-systemBlue/5 p-6"
      >
        <p className="text-title-1 font-bold tabular-nums text-label-primary">{formatCurrency(total)}</p>
        <p className="text-callout font-medium text-label-secondary">
          Ventas totales {includeVAT ? '(Con IVA)' : '(Sin IVA)'}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-label-tertiary/10 pt-4 text-caption">
          <span className="flex items-center gap-1.5 text-label-secondary">
            <span className="h-2 w-2 rounded-full bg-systemGreen" />
            Efectivo {formatCurrency(cash)}
          </span>
          <span className="flex items-center gap-1.5 text-label-secondary">
            <span className="h-2 w-2 rounded-full bg-systemBlue" />
            Fiscal {formatCurrency(fiscal)}
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="glass-thick rounded-3xl border border-systemGreen/20 bg-gradient-to-br from-systemGreen/10 to-systemGreen/5 p-6"
      >
        <p className="text-title-1 font-bold tabular-nums text-label-primary">{volTotal.toFixed(1)}</p>
        <p className="text-callout font-medium text-label-secondary">Volumen total (m³)</p>
        <p className="mt-3 text-caption text-label-tertiary">
          Concreto <span className="font-semibold text-label-secondary">{concrete.toFixed(1)}</span>
          {' · '}
          Bombeo <span className="font-semibold text-label-secondary">{pump.toFixed(1)}</span>
          {' · '}
          Vacío <span className="font-semibold text-label-secondary">{vacio.toFixed(1)}</span>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="glass-thick relative rounded-3xl border border-systemPurple/20 bg-gradient-to-br from-systemPurple/10 to-systemPurple/5 p-6"
      >
        <p className="text-title-1 font-bold tabular-nums text-label-primary">
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
        <p className="text-callout font-medium text-label-secondary">Resistencia ponderada</p>
        <p className="mt-2 text-caption text-label-tertiary">kg/cm² por volumen</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="glass-thick rounded-3xl border border-systemOrange/20 bg-gradient-to-br from-systemOrange/10 to-systemOrange/5 p-6"
      >
        <p className="text-title-1 font-bold tabular-nums text-label-primary">
          {(filteredWeightedGuaranteeAge || 0).toFixed(1)}
        </p>
        <p className="text-callout font-medium text-label-secondary">Edad de garantía (días)</p>
        {gaStreaming && (
          <p className="mt-2 text-caption text-label-tertiary">Cargando edad… {gaPercent}%</p>
        )}
      </motion.div>
    </div>
  );
}
