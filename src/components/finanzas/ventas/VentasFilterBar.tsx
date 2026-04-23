'use client';

import { useMemo, type ComponentProps } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SalesFilters } from '@/components/finanzas/SalesFilters';
import { cn } from '@/lib/utils';

type SalesFiltersProps = ComponentProps<typeof SalesFilters>;

interface VentasFilterBarProps extends SalesFiltersProps {
  className?: string;
}

export function VentasFilterBar({ className, ...filtersProps }: VentasFilterBarProps) {
  const activeCount = useMemo(() => {
    let n = 0;
    if (filtersProps.selectedPlantIds?.length) n++;
    if (filtersProps.clientFilter?.length) n++;
    if (filtersProps.resistanceFilter && filtersProps.resistanceFilter !== 'all') n++;
    if (filtersProps.efectivoFiscalFilter && filtersProps.efectivoFiscalFilter !== 'all') n++;
    if (filtersProps.tipoFilter?.length) n++;
    if (filtersProps.codigoProductoFilter?.length) n++;
    if (filtersProps.searchTerm?.trim()) n++;
    return n;
  }, [
    filtersProps.selectedPlantIds,
    filtersProps.clientFilter,
    filtersProps.resistanceFilter,
    filtersProps.efectivoFiscalFilter,
    filtersProps.tipoFilter,
    filtersProps.codigoProductoFilter,
    filtersProps.searchTerm,
  ]);

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="glass-thick border-label-tertiary/10"
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filtros
            <Badge variant="secondary" className="ml-2 rounded-full px-2 py-0 text-caption">
              {activeCount}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="max-h-[min(85vh,720px)] w-[min(96vw,1100px)] overflow-y-auto border-label-tertiary/10 p-0"
        >
          <div className="p-4">
            <SalesFilters {...filtersProps} />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
