'use client';

import useSWR from 'swr';
import { usePlantContext } from '@/contexts/PlantContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { PlantDashboardRow } from '@/app/api/dashboard/by-plant/route';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al cargar comparativo');
  return res.json();
};

interface PlantComparisonTableProps {
  /** Roles that should see credit column */
  showCreditColumn?: boolean;
  onSelectPlant?: (plantId: string) => void;
  selectedPlantId?: string | null;
}

export function PlantComparisonTable({
  showCreditColumn = true,
  onSelectPlant,
  selectedPlantId,
}: PlantComparisonTableProps) {
  const { userAccess, isGlobalAdmin } = usePlantContext();
  const canSwitch =
    isGlobalAdmin || userAccess?.accessLevel === 'BUSINESS_UNIT';

  const { data, isLoading, error } = useSWR<{
    plants: PlantDashboardRow[];
    totals: Omit<PlantDashboardRow, 'plantId' | 'plantCode' | 'plantName'> | null;
  }>('/api/dashboard/by-plant', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="glass-base rounded-2xl p-6 animate-pulse h-48" aria-busy="true" />
    );
  }

  if (error || !data?.plants?.length) {
    return null;
  }

  const { plants, totals } = data;
  if (plants.length <= 1 && !canSwitch) {
    return null;
  }

  return (
    <section className="glass-base rounded-2xl p-6 mb-8">
      <div className="mb-4">
        <h2 className="text-title-3 text-gray-800">Comparativo por planta</h2>
        <p className="text-footnote text-muted-foreground mt-1">
          {canSwitch && onSelectPlant
            ? 'Haz clic en una fila para enfocar esa planta en el resto del dashboard.'
            : 'Resumen del mes y operación de hoy por planta.'}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Planta</TableHead>
            <TableHead className="text-right">Venta mes (m³)</TableHead>
            <TableHead className="text-right">Pedidos hoy</TableHead>
            <TableHead className="text-right">Cotiz. pend.</TableHead>
            {showCreditColumn && (
              <TableHead className="text-right">Crédito pend.</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {plants.map((row) => (
            <TableRow
              key={row.plantId}
              className={cn(
                canSwitch && onSelectPlant && 'cursor-pointer',
                selectedPlantId === row.plantId && 'bg-primary/5'
              )}
              onClick={() => onSelectPlant?.(row.plantId)}
            >
              <TableCell>
                <span className="font-medium">{row.plantName}</span>
                <span className="text-footnote text-muted-foreground ml-2">{row.plantCode}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.monthlySales.toLocaleString('es-MX')}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.todayOrders}</TableCell>
              <TableCell className="text-right tabular-nums">{row.pendingQuotes}</TableCell>
              {showCreditColumn && (
                <TableCell className="text-right tabular-nums">{row.pendingCreditOrders}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
        {totals && plants.length > 1 && (
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {totals.monthlySales.toLocaleString('es-MX')}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {totals.todayOrders}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {totals.pendingQuotes}
              </TableCell>
              {showCreditColumn && (
                <TableCell className="text-right font-semibold tabular-nums">
                  {totals.pendingCreditOrders}
                </TableCell>
              )}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </section>
  );
}
