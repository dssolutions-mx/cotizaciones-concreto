'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Package, Warehouse } from 'lucide-react';
import { PersonalizedDashboardHeader } from '@/components/dashboard/PersonalizedDashboardHeader';
import { PlantComparisonTable } from '@/components/dashboard/PlantComparisonTable';
import type { TodayOrderRow } from '@/app/api/dashboard/orders/today/route';
import type { RoleDashboardConfig } from '@/lib/dashboard/dashboard-config';
import { METRIC_DEFINITIONS } from '@/lib/dashboard/dashboard-config';
import type { DashboardScope } from '@/lib/dashboard/resolve-dashboard-scope';
import type { UserRole } from '@/store/auth/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('fetch failed'))));

interface OperationsHubDashboardProps {
  config: RoleDashboardConfig;
  scope: DashboardScope;
  role: UserRole;
  firstName?: string | null;
  plantId?: string | null;
  onSelectPlant?: (plantId: string) => void;
  selectedPlantId?: string | null;
  metrics: {
    todayOrders: number;
    monthlySales: number;
    pendingCreditOrders?: number;
  };
  metricsLoading: boolean;
  lastUpdated?: string;
}

function formatOrderStatus(status: string): string {
  const map: Record<string, string> = {
    created: 'Creado',
    pending: 'Pendiente',
    validated: 'Validado',
    scheduled: 'Programado',
    completed: 'Completado',
  };
  return map[status] ?? status;
}

export function OperationsHubDashboard({
  config,
  scope,
  role,
  firstName,
  plantId,
  isGlobalAdmin,
  onSelectPlant,
  selectedPlantId,
  metrics,
  metricsLoading,
  lastUpdated,
}: OperationsHubDashboardProps) {
  const todayUrl = plantId
    ? `/api/dashboard/orders/today?plant_id=${plantId}`
    : '/api/dashboard/orders/today';

  const { data: todayData, isLoading: todayLoading } = useSWR<{
    orders: TodayOrderRow[];
    count: number;
    date: string;
  }>(todayUrl, fetcher, { revalidateOnFocus: false, dedupingInterval: 60_000 });

  const isDosificador = role === 'DOSIFICADOR';
  const primaryHref = '/production-control';
  const primaryLabel = isDosificador ? 'Ir a control de producción' : 'Abrir control de producción';
  const primaryDescription = isDosificador
    ? 'Materiales, dosificación e inventario de planta'
    : 'Inventario, alertas de material y operación de planta';

  const showCreditInTable =
    role === 'ADMIN_OPERATIONS' || role === 'PLANT_MANAGER' || role === 'EXECUTIVE';

  const metricTiles = [
    {
      key: 'todayOrders',
      value: metrics.todayOrders,
      ...METRIC_DEFINITIONS.todayOrders,
    },
    {
      key: 'monthlySales',
      value: metrics.monthlySales,
      ...METRIC_DEFINITIONS.monthlySales,
    },
  ];

  if (!isDosificador && metrics.pendingCreditOrders !== undefined) {
    metricTiles.push({
      key: 'pendingCreditOrders',
      value: metrics.pendingCreditOrders,
      ...METRIC_DEFINITIONS.pendingCreditOrders,
    });
  }

  const orders = todayData?.orders ?? [];

  return (
    <motion.div className="p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PersonalizedDashboardHeader
        firstName={firstName}
        config={config}
        scope={scope}
        lastUpdated={lastUpdated}
      />

      <section className="mb-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-white/60 to-white/40 p-6">
        <motion.div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-footnote font-medium text-primary uppercase tracking-wide">
              {isDosificador ? 'Tu espacio de trabajo' : 'Operaciones de planta'}
            </p>
            <h2 className="text-title-2 text-gray-900 mt-1">Control de producción</h2>
            <p className="text-callout text-muted-foreground mt-1 max-w-xl">{primaryDescription}</p>
          </div>
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Warehouse className="h-5 w-5" />
            {primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {metricTiles.map((tile) => (
          <div key={tile.key} className="glass-base rounded-2xl p-5">
            {metricsLoading ? (
              <div className="h-16 animate-pulse bg-gray-200 rounded" />
            ) : (
              <>
                <p className="text-footnote text-muted-foreground">{tile.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {typeof tile.value === 'number'
                    ? tile.value.toLocaleString('es-MX')
                    : tile.value}
                  {tile.suffix !== '$' ? tile.suffix : ''}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-sm font-medium hover:bg-white/80"
        >
          <Package className="h-4 w-4 text-primary" />
          Todos los pedidos
        </Link>
        <Link
          href="/orders?tab=calendar"
          className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-sm font-medium hover:bg-white/80"
        >
          <Calendar className="h-4 w-4 text-primary" />
          Calendario
        </Link>
        {!isDosificador && (
          <Link
            href="/finanzas"
            className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-sm font-medium hover:bg-white/80"
          >
            Finanzas
          </Link>
        )}
      </div>

      {config.showPlantComparison && scope.plants.length > 1 && (
        <PlantComparisonTable
          showCreditColumn={showCreditInTable}
          selectedPlantId={selectedPlantId}
          onSelectPlant={onSelectPlant}
        />
      )}

      <section className="glass-base rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-title-3 text-gray-800">Pedidos de hoy</h2>
            <p className="text-footnote text-muted-foreground">
              {todayData?.date
                ? `Entregas programadas · ${orders.length} pedido${orders.length === 1 ? '' : 's'}`
                : 'Cargando programación…'}
            </p>
          </div>
          <Link href="/orders" className="text-sm font-medium text-primary hover:underline">
            Ver en pedidos
          </Link>
        </div>

        {todayLoading ? (
          <motion.div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
            ))}
          </motion.div>
        ) : orders.length === 0 ? (
          <p className="text-callout text-muted-foreground py-6 text-center">
            No hay pedidos programados para hoy en tu planta.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead className="text-right">m³</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.slice(0, 12).map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="tabular-nums whitespace-nowrap">
                    {order.deliveryTime?.slice(0, 5) ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/orders?id=${order.id}`}
                      className="font-medium text-gray-900 hover:text-primary"
                    >
                      {order.clientName}
                    </Link>
                    {order.orderNumber && (
                      <span className="text-footnote text-muted-foreground block">
                        #{order.orderNumber}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {order.constructionSite ?? '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{order.volumeM3}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{formatOrderStatus(order.orderStatus)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </motion.div>
  );
}
