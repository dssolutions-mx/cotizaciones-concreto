'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import type { UnlocatedOrderRow } from '@/lib/finanzas/locationReportCore';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { finanzasHubCardClass } from '@/components/finanzas/finanzasHubUi';

interface LocationUnlocatedTableProps {
  data: UnlocatedOrderRow[];
  loading?: boolean;
}

export default function LocationUnlocatedTable({
  data,
  loading = false,
}: LocationUnlocatedTableProps) {
  if (!loading && data.length === 0) return null;

  return (
    <Card className={finanzasHubCardClass}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-stone-900">
          Órdenes sin coordenadas de entrega
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Planta</TableHead>
              <TableHead>Estado datos</TableHead>
              <TableHead className="text-right">Volumen</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-stone-500 py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.orderId}>
                  <TableCell>
                    <Link
                      href={`/orders/${row.orderId}`}
                      className="text-sky-700 hover:underline font-medium"
                    >
                      {row.orderNumber || row.orderId.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate">{row.clientName || '—'}</TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {row.constructionSite || '—'}
                  </TableCell>
                  <TableCell>{row.plantName || '—'}</TableCell>
                  <TableCell className="text-xs">{row.locationDataStatus}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.volume, 1)} m³
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.amount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
