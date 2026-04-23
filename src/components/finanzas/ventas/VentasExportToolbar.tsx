'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { SummaryMetrics } from '@/utils/salesDataProcessor';

interface VentasExportToolbarProps {
  includeVAT: boolean;
  currentSummaryMetrics: SummaryMetrics;
  selectedPlantName: string | null;
  clientFilter: string[];
  clients: { id: string; name: string }[];
  rowCount: number;
  onExportExcel: () => void;
}

export function VentasExportToolbar({
  includeVAT,
  currentSummaryMetrics,
  selectedPlantName,
  clientFilter,
  clients,
  rowCount,
  onExportExcel,
}: VentasExportToolbarProps) {
  return (
    <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-callout text-label-secondary">
            {includeVAT
              ? 'Mostrando montos con IVA (16%) aplicado a órdenes fiscales'
              : 'Mostrando montos sin IVA (solo subtotales)'}
          </span>
          {includeVAT && (
            <Badge variant="default" className="bg-green-100 text-xs text-green-800">
              IVA ACTIVO
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <span className="flex items-center">
            <span className="mr-1 h-2 w-2 rounded-full bg-green-500" />
            Efectivo:{' '}
            {formatCurrency(
              includeVAT ? currentSummaryMetrics.cashAmountWithVAT : currentSummaryMetrics.cashAmount
            )}
          </span>
          <span className="flex items-center">
            <span className="mr-1 h-2 w-2 rounded-full bg-blue-500" />
            Fiscal:{' '}
            {formatCurrency(
              includeVAT
                ? currentSummaryMetrics.invoiceAmountWithVAT
                : currentSummaryMetrics.invoiceAmount
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption font-medium text-label-secondary">
            Planta: {selectedPlantName || 'Todas'}
          </span>
          {clientFilter.length > 0 && (
            <span className="text-xs">
              Cliente{clientFilter.length > 1 ? 's' : ''}:{' '}
              {clientFilter.length === 1
                ? clients.find((c) => c.id === clientFilter[0])?.name || 'N/A'
                : `${clientFilter.length} seleccionados`}
            </span>
          )}
          <span className="text-caption text-label-tertiary">{rowCount} elementos</span>
        </div>
      </div>
      <Button
        onClick={onExportExcel}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        disabled={rowCount === 0}
      >
        <Download className="h-4 w-4" />
        Exportar Excel
      </Button>
    </div>
  );
}
