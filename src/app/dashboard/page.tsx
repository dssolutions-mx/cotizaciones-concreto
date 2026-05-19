'use client';

import React, { ReactNode, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FileText,
  TrendingUp,
  Users,
  Beaker,
  ExternalLink,
  DollarSign,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import { ApprovalTasksSection } from '@/components/dashboard/ApprovalTasksSection';
import { PersonalizedDashboardHeader } from '@/components/dashboard/PersonalizedDashboardHeader';
import { RoleQuickActions } from '@/components/dashboard/RoleQuickActions';
import { PlantComparisonTable } from '@/components/dashboard/PlantComparisonTable';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import useSWR from 'swr';
import {
  getRoleDashboardConfig,
  METRIC_DEFINITIONS,
  type DashboardMetricKey,
} from '@/lib/dashboard/dashboard-config';
import { resolveDashboardScope } from '@/lib/dashboard/resolve-dashboard-scope';
import type { UserRole } from '@/store/auth/types';

interface PendingQuote {
  id: string | number;
  client: string;
  date: string;
  amount: string;
  status: string;
  constructionSite: string;
  recipeSummary?: string;
}

interface DashboardData {
  metrics: {
    monthlyQuotes: number;
    monthlySales: number;
    activeClients: number;
    quoteGrowth: number;
    salesGrowth: number;
    clientGrowth: number;
    totalOutstandingBalance: number;
    monthlyRevenue: number;
    pendingCreditOrders: number;
    pendingQuotes: number;
    todayOrders: number;
  };
  newNotificationsCount: number;
  lastUpdated: string;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch data');
  return response.json();
};

interface MetricsCardProps {
  title: string;
  value: number | string;
  growth?: number;
  icon: ReactNode;
  isLoading: boolean;
  suffix?: string;
}

const MetricsCard = ({
  title,
  value,
  growth,
  icon,
  isLoading,
  suffix = '',
}: MetricsCardProps) => {
  if (isLoading) {
    return (
      <div className="glass-base rounded-2xl p-6">
        <motion.div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
          <motion.div className="h-8 bg-gray-200 rounded w-1/3 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </motion.div>
      </div>
    );
  }

  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;
    if (suffix === '$') return `$${val.toLocaleString('es-MX')}`;
    return val.toLocaleString('es-MX');
  };

  return (
    <motion.div
      className="glass-base rounded-2xl p-6 @container"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-500 text-sm @lg:text-base">{title}</p>
          <h3 className="text-2xl font-bold text-gray-800 mt-1 @lg:text-3xl">
            {formatValue(value)}
            {suffix !== '$' ? suffix : ''}
          </h3>
          {growth !== undefined && (
            <p
              className={`${growth >= 0 ? 'text-green-500' : 'text-red-500'} text-sm font-medium mt-2`}
            >
              {growth >= 0 ? '↑' : '↓'} {Math.abs(growth)}%
              <span className="text-gray-400 ml-1">vs mes anterior</span>
            </p>
          )}
        </div>
        <div className="rounded-xl bg-primary/10 p-2">{icon}</div>
      </div>
    </motion.div>
  );
};

const METRIC_ICONS: Record<DashboardMetricKey, ReactNode> = {
  monthlyQuotes: <FileText className="h-6 w-6 text-primary" />,
  monthlySales: <TrendingUp className="h-6 w-6 text-primary" />,
  activeClients: <Users className="h-6 w-6 text-primary" />,
  pendingCreditOrders: <AlertTriangle className="h-6 w-6 text-primary" />,
  todayOrders: <Calendar className="h-6 w-6 text-primary" />,
  totalOutstandingBalance: <DollarSign className="h-6 w-6 text-primary" />,
  pendingQuotes: <FileText className="h-6 w-6 text-primary" />,
};

function useDashboardData(plantId?: string | null) {
  const url = plantId ? `/api/dashboard?plant_id=${plantId}` : '/api/dashboard';
  const { data, error, isLoading } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 1000 * 60 * 5,
  });
  return { dashboardData: data as DashboardData | undefined, isLoading, isError: error };
}

function useQuotesData(plantId?: string | null) {
  const url = plantId ? `/api/dashboard/quotes?plant_id=${plantId}` : '/api/dashboard/quotes';
  const { data, error, isLoading } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 1000 * 60 * 10,
  });
  return {
    pendingQuotes: data?.pendingQuotes || [],
    isLoading,
    isError: error,
  };
}

function useSalesData(plantId?: string | null) {
  const url = plantId ? `/api/dashboard/sales?plant_id=${plantId}` : '/api/dashboard/sales';
  const { data, error, isLoading } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 1000 * 60 * 10,
  });
  return { salesData: data?.salesData || [], isLoading, isError: error };
}

function useByPlantTotals(enabled: boolean) {
  const { data, isLoading } = useSWR(
    enabled ? '/api/dashboard/by-plant' : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 1000 * 60 * 5 }
  );
  return { totals: data?.totals as Record<string, number> | null, isLoading };
}

function SalesChart({
  isLoading,
  plantId,
}: {
  isLoading: boolean;
  plantId?: string | null;
}) {
  const { salesData, isError } = useSalesData(plantId);

  if (isLoading) {
    return <div className="animate-pulse w-full h-64 bg-gray-200 rounded" />;
  }
  if (isError) {
    return <div className="text-red-500">Error al cargar datos de ventas</div>;
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={salesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} activeDot={{ r: 8 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PendingQuotesList({
  isLoading,
  plantId,
}: {
  isLoading: boolean;
  plantId?: string | null;
}) {
  const { pendingQuotes, isError } = useQuotesData(plantId);
  const displayQuotes = (pendingQuotes || []).slice(0, 5);

  if (isLoading) {
    return (
      <motion.div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
        ))}
      </motion.div>
    );
  }
  if (isError) {
    return <motion.div className="text-red-500">Error al cargar cotizaciones</motion.div>;
  }
  if (displayQuotes.length === 0) {
    return <p className="text-footnote text-muted-foreground py-4">No hay cotizaciones pendientes</p>;
  }

  return (
    <div className="space-y-2">
      {displayQuotes.map((quote: PendingQuote) => (
        <Link
          key={quote.id}
          href={`/quotes?tab=pending&id=${quote.id}`}
          className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-callout text-gray-900 truncate">{quote.client}</p>
            <p className="text-footnote text-muted-foreground">
              {quote.recipeSummary && <span className="text-gray-700">{quote.recipeSummary}</span>}
              {quote.recipeSummary && ' · '}
              {quote.amount} · {quote.date}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge variant="warning">{quote.status}</Badge>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function DashboardContent() {
  const { profile } = useAuthBridge();
  const {
    currentPlant,
    availablePlants,
    businessUnits,
    userAccess,
    isGlobalAdmin,
    switchPlant,
  } = usePlantContext();

  if (profile?.role === 'QUALITY_TEAM') {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso restringido</h2>
          </div>
          <p className="text-lg mb-4 text-yellow-700">
            No tienes permiso para acceder al dashboard principal.
          </p>
          <Link
            href="/quality"
            className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
          >
            <Beaker className="h-4 w-4 mr-2" />
            Ir al módulo de calidad
          </Link>
        </div>
      </div>
    );
  }

  const scope = resolveDashboardScope(
    profile,
    userAccess,
    availablePlants,
    businessUnits,
    currentPlant,
    isGlobalAdmin
  );

  const role = (profile?.role ?? 'EXECUTIVE') as UserRole;
  const config = getRoleDashboardConfig(role, scope.accessLevel, scope.plants.length);

  const useMultiPlantTotals =
    config.showPlantComparison &&
    scope.plants.length > 1 &&
    scope.accessLevel === 'BUSINESS_UNIT';

  const plantIdForApi = useMultiPlantTotals ? null : currentPlant?.id ?? null;

  const { dashboardData, isLoading: isLoadingDashboard, isError } = useDashboardData(plantIdForApi);
  const { totals: byPlantTotals, isLoading: isLoadingByPlant } = useByPlantTotals(useMultiPlantTotals);
  const { isLoading: isLoadingQuotes } = useQuotesData(plantIdForApi);
  const { isLoading: isLoadingSales } = useSalesData(plantIdForApi);

  const metricsSource = useMemo(() => {
    const base = dashboardData?.metrics;
    if (!useMultiPlantTotals || !byPlantTotals) return base;
    return {
      ...base,
      monthlySales: byPlantTotals.monthlySales ?? 0,
      todayOrders: byPlantTotals.todayOrders ?? 0,
      pendingQuotes: byPlantTotals.pendingQuotes ?? 0,
      pendingCreditOrders: byPlantTotals.pendingCreditOrders ?? 0,
      monthlyQuotes: byPlantTotals.monthlyQuotes ?? 0,
      quoteGrowth: 0,
      salesGrowth: 0,
      clientGrowth: 0,
    };
  }, [dashboardData?.metrics, useMultiPlantTotals, byPlantTotals]);

  const metricsLoading = isLoadingDashboard || (useMultiPlantTotals && isLoadingByPlant);

  const metricCards = config.metrics.map((key) => {
    const def = METRIC_DEFINITIONS[key];
    const m = metricsSource;
    let value: number | string = 0;
    let growth: number | undefined;

    switch (key) {
      case 'monthlyQuotes':
        value = m?.monthlyQuotes ?? 0;
        growth = useMultiPlantTotals ? undefined : m?.quoteGrowth;
        break;
      case 'monthlySales':
        value = m?.monthlySales ?? 0;
        growth = useMultiPlantTotals ? undefined : m?.salesGrowth;
        break;
      case 'activeClients':
        value = m?.activeClients ?? 0;
        growth = useMultiPlantTotals ? undefined : m?.clientGrowth;
        break;
      case 'pendingCreditOrders':
        value = m?.pendingCreditOrders ?? 0;
        break;
      case 'todayOrders':
        value = m?.todayOrders ?? 0;
        break;
      case 'totalOutstandingBalance':
        value = m?.totalOutstandingBalance ?? 0;
        break;
      case 'pendingQuotes':
        value = m?.pendingQuotes ?? 0;
        break;
    }

    return {
      key,
      title: def.title,
      value,
      growth: def.hasGrowth ? growth : undefined,
      icon: METRIC_ICONS[key],
      suffix: def.suffix === '$' ? '$' : def.suffix,
    };
  });

  const showCreditInTable =
    role === 'EXECUTIVE' ||
    role === 'PLANT_MANAGER' ||
    role === 'CREDIT_VALIDATOR' ||
    role === 'ADMIN_OPERATIONS';

  if (isError && !dashboardData && !byPlantTotals) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">Error al cargar el dashboard</p>
          <button
            type="button"
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
            onClick={() => window.location.reload()}
          >
            Intentar nuevamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PersonalizedDashboardHeader
        firstName={profile?.first_name}
        config={config}
        scope={scope}
        lastUpdated={dashboardData?.lastUpdated}
      />

      <RoleQuickActions actions={config.quickActions} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {metricCards.map((metric) => (
          <MetricsCard
            key={metric.key}
            title={metric.title}
            value={metric.value}
            growth={metric.growth}
            icon={metric.icon}
            isLoading={metricsLoading}
            suffix={metric.suffix}
          />
        ))}
      </div>

      {config.showPlantComparison && scope.plants.length > 1 && (
        <PlantComparisonTable
          showCreditColumn={showCreditInTable}
          selectedPlantId={currentPlant?.id}
          onSelectPlant={
            scope.accessLevel === 'BUSINESS_UNIT' || isGlobalAdmin
              ? (id) => switchPlant(id)
              : undefined
          }
        />
      )}

      {config.showApprovals && <ApprovalTasksSection />}

      {config.showSalesChart && (
        <div className="grid grid-cols-1 gap-6 mb-6">
          <motion.div
            className="glass-base rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-title-3 text-gray-800 mb-4">
              Ventas mensuales de concreto (m³)
              {currentPlant ? ` — ${currentPlant.name}` : ''}
            </h2>
            <SalesChart isLoading={isLoadingSales} plantId={plantIdForApi ?? currentPlant?.id} />
          </motion.div>
        </div>
      )}

      {config.showQuotesList && (
        <div className="grid grid-cols-1 gap-6">
          <motion.div className="glass-base rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-title-3 text-gray-800">Cotizaciones pendientes</h2>
              <Link
                href="/quotes"
                className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center"
              >
                Ver todas <ExternalLink className="h-4 w-4 ml-1" />
              </Link>
            </div>
            <PendingQuotesList
              isLoading={isLoadingQuotes}
              plantId={plantIdForApi ?? currentPlant?.id}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <motion.div className="p-8 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500" />
        </motion.div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
