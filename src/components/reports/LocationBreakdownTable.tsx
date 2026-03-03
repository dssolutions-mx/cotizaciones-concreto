'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LocationBreakdownRow } from '@/services/locationReportService';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

type SortKey = 'locality' | 'sublocality' | 'administrativeArea1' | 'orderCount' | 'volume' | 'amount' | 'avgPricePerM3';
type SortDir = 'asc' | 'desc';

interface LocationBreakdownTableProps {
  data: LocationBreakdownRow[];
  loading?: boolean;
  className?: string;
}

function getPriceColor(avgPrice: number, baseline: number): string {
  if (baseline <= 0) return 'text-label-primary';
  const ratio = avgPrice / baseline;
  if (ratio >= 1.1) return 'text-systemGreen font-medium';
  if (ratio <= 0.9) return 'text-amber-600 font-medium';
  return 'text-label-primary';
}

export default function LocationBreakdownTable({
  data,
  loading = false,
  className,
}: LocationBreakdownTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const baselinePrice = useMemo(() => {
    if (data.length === 0) return 0;
    const totalAmount = data.reduce((s, r) => s + r.amount, 0);
    const totalVolume = data.reduce((s, r) => s + r.volume, 0);
    return totalVolume > 0 ? totalAmount / totalVolume : 0;
  }, [data]);

  const sortedData = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'locality':
          cmp = (a.locality || '').localeCompare(b.locality || '');
          break;
        case 'sublocality':
          cmp = (a.sublocality || '').localeCompare(b.sublocality || '');
          break;
        case 'administrativeArea1':
          cmp = (a.administrativeArea1 || '').localeCompare(b.administrativeArea1 || '');
          break;
        case 'orderCount':
          cmp = a.orderCount - b.orderCount;
          break;
        case 'volume':
          cmp = a.volume - b.volume;
          break;
        case 'amount':
          cmp = a.amount - b.amount;
          break;
        case 'avgPricePerM3':
          cmp = (a.avgPricePerM3 ?? 0) - (b.avgPricePerM3 ?? 0);
          break;
        default:
          cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [data, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortHeader = ({
    label,
    columnKey,
    align = 'left',
  }: {
    label: string;
    columnKey: SortKey;
    align?: 'left' | 'right';
  }) => (
    <TableHead className={cn('font-medium', align === 'right' && 'text-right')}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 -ml-2 font-medium',
          align === 'right' && 'float-right'
        )}
        onClick={() => handleSort(columnKey)}
      >
        {label}
        {sortKey === columnKey ? (
          sortDir === 'asc' ? (
            <ArrowUp className="ml-1 h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="ml-1 h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />
        )}
      </Button>
    </TableHead>
  );

  return (
    <Card className={cn('glass-thick rounded-3xl border border-label-tertiary/10', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          Desglose por ubicación
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Volumen, monto y precio promedio por ciudad/colonia
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground text-sm">
              Cargando...
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No hay datos para mostrar
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <SortHeader label="Ciudad" columnKey="locality" />
                  <SortHeader label="Colonia" columnKey="sublocality" />
                  <SortHeader label="Estado" columnKey="administrativeArea1" />
                  <SortHeader label="Órdenes" columnKey="orderCount" align="right" />
                  <SortHeader label="Volumen (m³)" columnKey="volume" align="right" />
                  <SortHeader label="Monto" columnKey="amount" align="right" />
                  <SortHeader label="Precio prom. $/m³" columnKey="avgPricePerM3" align="right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((row, idx) => (
                  <TableRow key={`${row.locality}-${row.sublocality}-${idx}`}>
                    <TableCell className="font-medium">{row.locality}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.sublocality || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.administrativeArea1 || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.orderCount.toLocaleString('es-MX')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.volume, 1)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums',
                        getPriceColor(row.avgPricePerM3 ?? 0, baselinePrice)
                      )}
                    >
                      {row.volume > 0
                        ? formatCurrency(row.avgPricePerM3 ?? row.amount / row.volume)
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
