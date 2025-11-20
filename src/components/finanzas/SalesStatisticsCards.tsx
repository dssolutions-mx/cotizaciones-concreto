'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, DollarSign, TrendingUp, Package, Truck, Droplet } from "lucide-react";
import { formatCurrency } from '@/lib/utils';
import { motion } from 'framer-motion';

interface SummaryMetrics {
  concreteVolume: number;
  pumpVolume: number;
  emptyTruckVolume: number;
  totalVolume: number;
  concreteAmount: number;
  pumpAmount: number;
  emptyTruckAmount: number;
  totalAmount: number;
  cashAmount: number;
  invoiceAmount: number;
  weightedConcretePrice: number;
  weightedPumpPrice: number;
  weightedEmptyTruckPrice: number;
  weightedResistance: number;
  resistanceTooltip: string;
  totalAmountWithVAT: number;
  cashAmountWithVAT: number;
  invoiceAmountWithVAT: number;
  weightedConcretePriceWithVAT: number;
  weightedPumpPriceWithVAT: number;
  weightedEmptyTruckPriceWithVAT: number;
}

interface ConcreteByRecipe {
  [key: string]: {
    volume: number;
    count: number;
  };
}

interface SalesStatisticsCardsProps {
  loading: boolean;
  summaryMetrics: SummaryMetrics;
  concreteByRecipe: ConcreteByRecipe;
  includeVAT: boolean;
  VAT_RATE: number;
  formatNumberWithUnits: (value: number) => string;
}

export const SalesStatisticsCards: React.FC<SalesStatisticsCardsProps> = ({
  loading,
  summaryMetrics,
  concreteByRecipe,
  includeVAT,
  VAT_RATE,
  formatNumberWithUnits,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-thick rounded-3xl h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Total Summary Cards - Apple HIG Style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Cash Amount */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
          whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
          className="glass-thick rounded-3xl p-6 border border-systemGreen/20 bg-gradient-to-br from-systemGreen/10 to-systemGreen/5 hover:shadow-lg transition-shadow duration-200 relative overflow-hidden"
        >
          {/* Subtle gradient overlay */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl" />

          <div className="relative">
            {/* Header with icon */}
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-2xl glass-thin text-systemGreen">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            {/* Value */}
            <div className="mb-2">
              <h3 className="text-title-1 font-bold text-label-primary mb-1">
                {includeVAT ? formatCurrency(summaryMetrics.cashAmountWithVAT) : formatCurrency(summaryMetrics.cashAmount)}
              </h3>
              <p className="text-callout font-medium text-label-secondary">
                Efectivo
              </p>
            </div>

            {/* Subtitle */}
            {includeVAT && (
              <p className="text-footnote text-label-tertiary">
                Con IVA
              </p>
            )}
          </div>
        </motion.div>

        {/* Invoice Amount */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
          whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
          className="glass-thick rounded-3xl p-6 border border-systemBlue/20 bg-gradient-to-br from-systemBlue/10 to-systemBlue/5 hover:shadow-lg transition-shadow duration-200 relative overflow-hidden"
        >
          {/* Subtle gradient overlay */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl" />

          <div className="relative">
            {/* Header with icon */}
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-2xl glass-thin text-systemBlue">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* Value */}
            <div className="mb-2">
              <h3 className="text-title-1 font-bold text-label-primary mb-1">
                {includeVAT ? formatCurrency(summaryMetrics.invoiceAmountWithVAT) : formatCurrency(summaryMetrics.invoiceAmount)}
              </h3>
              <p className="text-callout font-medium text-label-secondary">
                Fiscal
              </p>
            </div>

            {/* Subtitle */}
            {includeVAT && (
              <p className="text-footnote text-label-tertiary">
                Con IVA
              </p>
            )}
          </div>
        </motion.div>

        {/* Total Amount */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
          whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
          className="glass-thick rounded-3xl p-6 border border-label-tertiary/20 bg-gradient-to-br from-label-tertiary/5 to-transparent hover:shadow-lg transition-shadow duration-200 relative overflow-hidden"
        >
          {/* Subtle gradient overlay */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl" />

          <div className="relative">
            {/* Header with icon */}
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-2xl glass-thin text-label-primary">
                <Package className="w-6 h-6" />
              </div>
            </div>

            {/* Value */}
            <div className="mb-2">
              <h3 className="text-title-1 font-bold text-label-primary mb-1">
                {includeVAT ? formatCurrency(summaryMetrics.totalAmountWithVAT) : formatCurrency(summaryMetrics.totalAmount)}
              </h3>
              <p className="text-callout font-medium text-label-secondary">
                Total
              </p>
            </div>

            {/* Subtitle */}
            <p className="text-footnote text-label-tertiary">
              {includeVAT ? 'Con IVA' : 'Sin IVA'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Product Type Breakdown - Apple HIG Style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Concrete */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
          whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
          className="glass-thick rounded-3xl overflow-hidden border border-systemBlue/20 bg-gradient-to-br from-systemBlue/10 to-systemBlue/5 hover:shadow-lg transition-shadow duration-200"
        >
          <div className="p-6">
            {/* Header with icon */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl glass-thin text-systemBlue">
                <Droplet className="w-6 h-6" />
              </div>
              <h3 className="text-callout font-semibold text-label-primary uppercase tracking-wide">
                Concreto Premezclado
              </h3>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-footnote text-label-tertiary mb-1">Volumen</p>
                <p className="text-title-2 font-bold text-label-primary">
                  {summaryMetrics.concreteVolume.toFixed(1)} m³
                </p>
              </div>
              <div>
                <p className="text-footnote text-label-tertiary mb-1">
                  Precio Ponderado {includeVAT ? '(IVA)' : ''}
                </p>
                <p className="text-title-3 font-semibold text-label-primary">
                  ${includeVAT ? summaryMetrics.weightedConcretePriceWithVAT.toFixed(2) : summaryMetrics.weightedConcretePrice.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Recipe badges */}
            <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
              {Object.entries(concreteByRecipe)
                .sort(([, a], [, b]) => b.volume - a.volume)
                .map(([recipe, data], index) => (
                  <span
                    key={`ventas-recipe-${index}-${recipe}`}
                    className="px-2 py-1 glass-thin rounded-xl text-caption font-medium text-label-secondary border border-systemBlue/20"
                  >
                    {recipe}: {data.volume.toFixed(1)} m³
                  </span>
                ))}
            </div>
          </div>
        </motion.div>

        {/* Pumping */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
          whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
          className="glass-thick rounded-3xl overflow-hidden border border-systemPurple/20 bg-gradient-to-br from-systemPurple/10 to-systemPurple/5 hover:shadow-lg transition-shadow duration-200"
        >
          <div className="p-6">
            {/* Header with icon */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl glass-thin text-systemPurple">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-callout font-semibold text-label-primary uppercase tracking-wide">
                Servicio de Bombeo
              </h3>
            </div>

            {/* Metrics */}
            <div className="mb-4">
              <p className="text-footnote text-label-tertiary mb-1">Volumen</p>
              <p className="text-title-1 font-bold text-label-primary mb-4">
                {summaryMetrics.pumpVolume.toFixed(1)} m³
              </p>

              <div className="pt-4 border-t border-label-tertiary/10">
                <p className="text-footnote text-label-tertiary mb-1">SubTotal</p>
                <p className="text-title-3 font-semibold text-label-primary">
                  ${formatNumberWithUnits(includeVAT ? summaryMetrics.pumpAmount * (1 + VAT_RATE) : summaryMetrics.pumpAmount)}
                </p>
                {includeVAT && (
                  <p className="text-caption text-label-tertiary mt-1">Con IVA</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Empty Truck */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
          whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
          className="glass-thick rounded-3xl overflow-hidden border border-systemOrange/20 bg-gradient-to-br from-systemOrange/10 to-systemOrange/5 hover:shadow-lg transition-shadow duration-200"
        >
          <div className="p-6">
            {/* Header with icon */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl glass-thin text-systemOrange">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-callout font-semibold text-label-primary uppercase tracking-wide">
                Vacío de Olla
              </h3>
            </div>

            {/* Metrics */}
            <div className="mb-4">
              <p className="text-footnote text-label-tertiary mb-1">Volumen</p>
              <p className="text-title-1 font-bold text-label-primary mb-4">
                {summaryMetrics.emptyTruckVolume.toFixed(1)} m³
              </p>

              <div className="pt-4 border-t border-label-tertiary/10">
                <p className="text-footnote text-label-tertiary mb-1">SubTotal</p>
                <p className="text-title-3 font-semibold text-label-primary">
                  ${formatNumberWithUnits(includeVAT ? summaryMetrics.emptyTruckAmount * (1 + VAT_RATE) : summaryMetrics.emptyTruckAmount)}
                </p>
                {includeVAT && (
                  <p className="text-caption text-label-tertiary mt-1">Con IVA</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};
