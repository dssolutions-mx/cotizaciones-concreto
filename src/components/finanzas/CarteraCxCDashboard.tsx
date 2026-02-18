'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { DollarSign, Users } from 'lucide-react';
import { ExportBalancesExcelButton } from '@/components/finanzas/ExportBalancesExcelButton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

type ClientBalance = {
  client_id: string;
  business_name: string;
  current_balance: number;
  last_payment_date: string | null;
  credit_status: string;
};

type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getAgingBucket(days: number | null): AgingBucket {
  if (days === null) return '90+'; // No payment = longest aging
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

const BUCKET_ORDER: AgingBucket[] = ['0-30', '31-60', '61-90', '90+'];
const BUCKET_LABELS: Record<AgingBucket, string> = {
  '0-30': '0-30 días',
  '31-60': '31-60 días',
  '61-90': '61-90 días',
  '90+': '+90 días',
};
const BUCKET_COLORS: Record<AgingBucket, string> = {
  '0-30': 'bg-green-50 text-green-800 border-green-200',
  '31-60': 'bg-yellow-50 text-yellow-800 border-yellow-200',
  '61-90': 'bg-orange-50 text-orange-800 border-orange-200',
  '90+': 'bg-red-50 text-red-800 border-red-200',
};
const BUCKET_CHART_COLORS: Record<AgingBucket, string> = {
  '0-30': '#22c55e',
  '31-60': '#eab308',
  '61-90': '#f97316',
  '90+': '#ef4444',
};

export default function CarteraCxCDashboard({ clientBalances }: { clientBalances: ClientBalance[] }) {
  const [search, setSearch] = React.useState('');
  const [filterBucket, setFilterBucket] = React.useState<AgingBucket | 'all'>('all');

  const clientsWithBalance = useMemo(
    () => clientBalances.filter((c) => (c.current_balance || 0) > 0),
    [clientBalances]
  );

  const agingData = useMemo(() => {
    const buckets: Record<AgingBucket, { amount: number; clients: ClientBalance[] }> = {
      '0-30': { amount: 0, clients: [] },
      '31-60': { amount: 0, clients: [] },
      '61-90': { amount: 0, clients: [] },
      '90+': { amount: 0, clients: [] },
    };

    clientsWithBalance.forEach((c) => {
      const days = daysSince(c.last_payment_date);
      const bucket = getAgingBucket(days);
      buckets[bucket].amount += c.current_balance || 0;
      buckets[bucket].clients.push({ ...c });
    });

    return buckets;
  }, [clientsWithBalance]);

  const portfolioKpis = useMemo(() => {
    const totalCartera = clientsWithBalance.reduce((sum, c) => sum + (c.current_balance || 0), 0);
    const totalClientsWithBalance = clientsWithBalance.length;
    const avgAging =
      clientsWithBalance.length > 0
        ? clientsWithBalance.reduce((sum, c) => {
            const d = daysSince(c.last_payment_date);
            return sum + (d ?? 999);
          }, 0) / clientsWithBalance.length
        : 0;

    return { totalCartera, totalClientsWithBalance, avgAging };
  }, [clientsWithBalance]);

  const chartData = useMemo(() => {
    const total = portfolioKpis.totalCartera || 1;
    return BUCKET_ORDER.map((b) => ({
      name: BUCKET_LABELS[b],
      value: agingData[b].amount,
      percent: total > 0 ? (agingData[b].amount / total) * 100 : 0,
      fill: BUCKET_CHART_COLORS[b],
    }));
  }, [agingData, portfolioKpis.totalCartera]);

  const filteredClients = useMemo(() => {
    let list = clientsWithBalance;
    if (filterBucket !== 'all') {
      list = agingData[filterBucket].clients;
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.business_name || '').toLowerCase().includes(term) ||
          (c.client_code || '').toLowerCase().includes(term)
      );
    }
    return list;
  }, [clientsWithBalance, filterBucket, search, agingData]);

  const maxBalance = useMemo(
    () =>
      filteredClients.length > 0
        ? Math.max(...filteredClients.map((c) => c.current_balance || 0))
        : 1,
    [filteredClients]
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Cartera CxC</h1>
          <p className="text-muted-foreground text-sm">
            Cuentas por cobrar con aging por días desde último pago
          </p>
        </div>
        <ExportBalancesExcelButton />
      </div>

      {/* Aging distribution bar chart */}
      <div className="glass-base rounded-2xl p-6">
        <h2 className="text-title-3 text-gray-800 mb-4">Distribución por Aging</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 80, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={70}
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Monto']}
                contentStyle={{ borderRadius: 8 }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} stackId="a">
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Portfolio KPIs - 2 cards only */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-base rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-footnote text-muted-foreground">Total Cartera</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(portfolioKpis.totalCartera)}</p>
              <p className="text-footnote text-muted-foreground mt-1">Saldo total por cobrar</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>
        <div className="glass-base rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-footnote text-muted-foreground">Clientes con Saldo</p>
              <p className="text-2xl font-bold mt-1">{portfolioKpis.totalClientsWithBalance}</p>
              <p className="text-footnote text-muted-foreground mt-1">Con balance pendiente</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Aging buckets summary */}
      <Card>
        <CardHeader>
          <CardTitle>Aging por Días</CardTitle>
          <CardDescription>
            Distribución de la cartera según días desde el último pago
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-0 border rounded-xl overflow-hidden mb-4">
            <button
              onClick={() => setFilterBucket('all')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-r last:border-0 ${
                filterBucket === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted'
              }`}
            >
              Todos
            </button>
            {BUCKET_ORDER.map((b) => (
              <button
                key={b}
                onClick={() => setFilterBucket(b)}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-r last:border-0 ${
                  filterBucket === b ? BUCKET_COLORS[b] + ' ring-2 ring-inset ring-offset-1' : 'bg-muted/30 hover:bg-muted/50'
                }`}
              >
                {BUCKET_LABELS[b]}
              </button>
            ))}
          </div>

          <Input
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm mb-4"
          />

          <div className="rounded-md border overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Cliente</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Saldo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Último Pago</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Aging</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No hay clientes que coincidan con el filtro
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((c) => {
                    const days = daysSince(c.last_payment_date);
                    const bucket = getAgingBucket(days);
                    return (
                      <tr key={c.client_id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Link
                            href={`/clients/${c.client_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {c.business_name}
                          </Link>
                          {c.client_code && (
                            <span className="ml-2 text-xs text-muted-foreground">{c.client_code}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative flex items-center min-w-[120px]">
                            <div
                              className="absolute inset-y-0 left-0 rounded bg-red-100/80"
                              style={{
                                width: `${Math.min(100, ((c.current_balance || 0) / maxBalance) * 100)}%`,
                              }}
                            />
                            <span className="relative ml-2 font-medium text-red-600">
                              {formatCurrency(c.current_balance)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {c.last_payment_date ? formatDate(c.last_payment_date) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs font-medium border ${BUCKET_COLORS[bucket]}`}
                          >
                            {days !== null ? `${days} días` : 'Sin pago'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/clients/${c.client_id}`}
                            className="text-sm text-primary hover:underline"
                          >
                            Ver detalle
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
