'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { SalesDataTable } from '@/components/finanzas/SalesDataTable';
import type { ComponentProps } from 'react';

type SalesDataTableProps = ComponentProps<typeof SalesDataTable>;

interface VentasRemisionesSectionProps extends SalesDataTableProps {
  rowCount: number;
}

export function VentasRemisionesSection({ rowCount, onExportToExcel, ...tableProps }: VentasRemisionesSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass-thick rounded-3xl border border-label-tertiary/10 p-4">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-auto justify-start px-2 text-title-3 font-semibold text-label-primary hover:bg-label-tertiary/5"
            >
              {open ? <ChevronUp className="mr-2 h-5 w-5" /> : <ChevronDown className="mr-2 h-5 w-5" />}
              Detalle de remisiones
              <span className="ml-2 text-callout font-normal text-label-tertiary">({rowCount})</span>
            </Button>
          </CollapsibleTrigger>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-label-tertiary/10"
              disabled={rowCount === 0}
              onClick={() => onExportToExcel()}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </div>

        <CollapsibleContent className="mt-4">
          <SalesDataTable {...tableProps} onExportToExcel={onExportToExcel} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
