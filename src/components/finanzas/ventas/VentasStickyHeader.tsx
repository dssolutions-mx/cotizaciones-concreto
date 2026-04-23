'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { VentasHelpPopover } from '@/components/finanzas/ventas/VentasHelpPopover';
import { cn } from '@/lib/utils';

interface VentasStickyHeaderProps {
  dateRangeText: string;
  scopeChipLabel: string;
  scopeSummary: string;
  includeVAT: boolean;
  onIncludeVATChange: (v: boolean) => void;
  rowCount: number;
  onExportExcel: () => void;
}

export function VentasStickyHeader({
  dateRangeText,
  scopeChipLabel,
  scopeSummary,
  includeVAT,
  onIncludeVATChange,
  rowCount,
  onExportExcel,
}: VentasStickyHeaderProps) {
  return (
    <div className="sticky top-0 z-30 -mx-2 border-b border-label-tertiary/10 bg-background-primary/80 px-2 py-4 backdrop-blur-md sm:-mx-4 sm:px-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-3">
            <h1 className="text-large-title font-bold text-label-primary">Reporte de Ventas</h1>
            <VentasHelpPopover />
          </div>
          <p className="mt-1 text-body text-label-secondary">{dateRangeText}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="max-w-full truncate border-systemBlue/25 bg-systemBlue/5 text-callout text-label-primary"
              title={scopeSummary}
            >
              {scopeChipLabel}
            </Badge>
            <span className="text-caption text-label-tertiary">{scopeSummary}</span>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="glass-thick flex items-center gap-3 rounded-2xl border border-label-tertiary/10 px-4 py-2">
            <Label htmlFor="ventas-iva-header" className="text-callout text-label-secondary">
              IVA
            </Label>
            <Switch
              id="ventas-iva-header"
              checked={includeVAT}
              onCheckedChange={(v) => onIncludeVATChange(Boolean(v))}
            />
            <span className="text-caption text-label-tertiary">{includeVAT ? 'Con IVA' : 'Sin IVA'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn('glass-thick border-label-tertiary/10')}
              disabled={rowCount === 0}
              onClick={onExportExcel}
            >
              <Download className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild className="text-callout">
              <Link href="/finanzas/clientes" className="flex items-center gap-1">
                Saldos clientes
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </Link>
            </Button>
          </div>

          <span className="text-caption text-label-tertiary lg:text-right">
            {format(new Date(), 'dd-MMM-yy HH:mm', { locale: es })}
          </span>
        </div>
      </div>
    </div>
  );
}
