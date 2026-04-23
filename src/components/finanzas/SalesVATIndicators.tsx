'use client';

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from '@/lib/utils';

interface SalesVATIndicatorsProps {
  includeVAT: boolean;
  currentPlant: any;
  clientFilter: string[];
  clients: { id: string; name: string }[];
  filteredRemisionesWithVacioDeOlla: any[];
  summaryMetrics: {
    cashAmount: number;
    invoiceAmount: number;
    cashAmountWithVAT: number;
    invoiceAmountWithVAT: number;
    totalAmount: number;
    totalAmountWithVAT: number;
  };
}

export const SalesVATIndicators: React.FC<SalesVATIndicatorsProps> = ({
  includeVAT,
  currentPlant,
  clientFilter,
  clients,
  filteredRemisionesWithVacioDeOlla,
  summaryMetrics,
}) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between rounded-lg border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>
          {includeVAT
            ? 'Montos con IVA (16%) en órdenes fiscales'
            : 'Montos sin IVA (subtotales)'}
        </span>
        {includeVAT && (
          <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
            IVA activo
          </Badge>
        )}
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Efectivo: {formatCurrency(includeVAT ? summaryMetrics.cashAmountWithVAT : summaryMetrics.cashAmount)}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Fiscal: {formatCurrency(includeVAT ? summaryMetrics.invoiceAmountWithVAT : summaryMetrics.invoiceAmount)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>Planta: {currentPlant?.name || 'Todas'}</span>
        {clientFilter.length > 0 && (
          <span>
            Cliente{clientFilter.length > 1 ? 's' : ''}:{' '}
            {clientFilter.length === 1
              ? clients.find((c) => c.id === clientFilter[0])?.name || 'N/A'
              : `${clientFilter.length} seleccionados`}
          </span>
        )}
        <span>{filteredRemisionesWithVacioDeOlla.length} remisiones en vista</span>
      </div>
    </div>
  );
};
