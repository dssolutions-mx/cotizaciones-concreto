'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from '@/lib/utils';

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Total Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Cash Amount */}
        <Card className="bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-green-800">Efectivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">
              {includeVAT ? formatCurrency(summaryMetrics.cashAmountWithVAT) : formatCurrency(summaryMetrics.cashAmount)}
            </div>
            {includeVAT && (
              <p className="text-xs text-muted-foreground mt-1">Con IVA</p>
            )}
          </CardContent>
        </Card>

        {/* Invoice Amount */}
        <Card className="bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-blue-800">Fiscal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">
              {includeVAT ? formatCurrency(summaryMetrics.invoiceAmountWithVAT) : formatCurrency(summaryMetrics.invoiceAmount)}
            </div>
            {includeVAT && (
              <p className="text-xs text-muted-foreground mt-1">Con IVA</p>
            )}
          </CardContent>
        </Card>

        {/* Total Amount */}
        <Card className="bg-gray-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-800">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-700">
              {includeVAT ? formatCurrency(summaryMetrics.totalAmountWithVAT) : formatCurrency(summaryMetrics.totalAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {includeVAT ? 'Con IVA' : 'Sin IVA'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Product Type Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Concrete */}
        <Card className="overflow-hidden border-0 shadow-md">
          <CardHeader className="p-3 pb-1 bg-gradient-to-r from-blue-50 to-blue-100 border-b">
            <CardTitle className="text-sm font-semibold text-blue-700">CONCRETO PREMEZCLADO</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-2xl font-bold text-slate-800">
                  {summaryMetrics.concreteVolume.toFixed(1)}
                </div>
                <p className="text-xs text-slate-500 font-medium">Volumen (m³)</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">
                  ${includeVAT ? summaryMetrics.weightedConcretePriceWithVAT.toFixed(2) : summaryMetrics.weightedConcretePrice.toFixed(2)}
                </div>
                <p className="text-xs text-slate-500 font-medium text-right">
                  PRECIO PONDERADO {includeVAT ? '(Con IVA)' : '(Sin IVA)'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-1 max-h-16 overflow-y-auto">
              {Object.entries(concreteByRecipe)
                .sort(([, a], [, b]) => b.volume - a.volume)
                .map(([recipe, data], index) => (
                  <Badge key={`ventas-recipe-${index}-${recipe}`} variant="outline" className="bg-blue-50 text-xs">
                    {recipe}: {data.volume.toFixed(1)} m³
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Pumping */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SERVICIO DE BOMBEO</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold mb-2">
              {summaryMetrics.pumpVolume.toFixed(1)}
            </div>
            <p className="text-sm text-muted-foreground">Volumen (m³)</p>
          </CardContent>
          <CardFooter className="pt-0 border-t">
            <div className="w-full">
              <span className="text-sm text-muted-foreground">SubTotal</span>
              <div className="text-lg font-semibold">
                ${formatNumberWithUnits(includeVAT ? summaryMetrics.pumpAmount * (1 + VAT_RATE) : summaryMetrics.pumpAmount)}
              </div>
              {includeVAT && (
                <p className="text-xs text-muted-foreground mt-1">Con IVA</p>
              )}
            </div>
          </CardFooter>
        </Card>

        {/* Empty Truck */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">VACIO DE OLLA</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold mb-2">
              {summaryMetrics.emptyTruckVolume.toFixed(1)}
            </div>
            <p className="text-sm text-muted-foreground">Volumen (m³)</p>
          </CardContent>
          <CardFooter className="pt-0 border-t">
            <div className="w-full">
              <span className="text-sm text-muted-foreground">SubTotal</span>
              <div className="text-lg font-semibold">
                ${formatNumberWithUnits(includeVAT ? summaryMetrics.emptyTruckAmount * (1 + VAT_RATE) : summaryMetrics.emptyTruckAmount)}
              </div>
              {includeVAT && (
                <p className="text-xs text-muted-foreground mt-1">Con IVA</p>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </>
  );
};
