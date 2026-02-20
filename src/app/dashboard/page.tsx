'use client';

import React, { ReactNode, Suspense } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  FileText, 
  TrendingUp, 
  Users, 
  Beaker, 
  Clock, 
  ExternalLink,
  DollarSign,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';

// Componentes
import { ApprovalTasksSection } from '@/components/dashboard/ApprovalTasksSection';
import { Badge } from '@/components/ui/badge';
import { 
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

// Add SWR for data fetching with caching
import useSWR from 'swr';

// Interface definitions
interface PendingQuote {
  id: string | number;
  client: string;
  date: string;
  amount: string;
  status: string;
  constructionSite: string;
}

// Enhanced dashboard metrics interface
interface DashboardData {
  metrics: {
    // Core metrics (removed activeRecipes and quality metrics)
    monthlyQuotes: number;
    monthlySales: number;
    activeClients: number;
    
    // Growth metrics
    quoteGrowth: number;
    salesGrowth: number;
    clientGrowth: number;
    
    // Financial metrics
    totalOutstandingBalance: number;
    monthlyRevenue: number;
    pendingCreditOrders: number;
    
    // Operational metrics
    pendingQuotes: number;
    todayOrders: number;
  };
  newNotificationsCount: number;
  lastUpdated: string;
}

// Create a simple fetcher function for SWR
const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }
  return response.json();
};

// Define component prop types
interface MetricsCardProps {
  title: string;
  value: number | string;
  growth?: number;
  icon: ReactNode;
  isLoading: boolean;
  suffix?: string;
  colorScheme?: 'green' | 'blue' | 'yellow' | 'red' | 'purple';
}

// Define component prop types
interface ChartProps {
  isLoading: boolean;
}

// Separate dashboard into smaller components for better performance
const MetricsCard = ({ title, value, growth, icon, isLoading, suffix = '', colorScheme = 'green' }: MetricsCardProps) => {
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { 
        type: 'spring',
        stiffness: 200,
        damping: 20
      } 
    }
  };

  if (isLoading) {
    return (
      <motion.div 
        className="glass-base rounded-2xl p-6"
        variants={itemVariants}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </motion.div>
    );
  }

  // Format value for display
  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;
    if (suffix === '$') {
      return `$${val.toLocaleString('es-MX')}`;
    }
    return val.toLocaleString('es-MX');
  };

  return (
    <motion.div 
      className="glass-base rounded-2xl p-6 @container"
      variants={itemVariants}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-500 text-sm @lg:text-base">{title}</p>
          <h3 className="text-2xl font-bold text-gray-800 mt-1 @lg:text-3xl">
            {formatValue(value)}{suffix !== '$' ? suffix : ''}
          </h3>
          {growth !== undefined && (
            <p className={`${growth >= 0 ? 'text-green-500' : 'text-red-500'} text-sm font-medium mt-2 @lg:text-base`}>
              <span>
                {growth >= 0 ? '↑' : '↓'} {Math.abs(growth)}%
              </span> 
              <span className="text-gray-400 ml-1">vs mes anterior</span>
            </p>
          )}
        </div>
        <div className="rounded-xl bg-primary/10 p-2">
          {icon}
        </div>
      </div>
    </motion.div>
  );
};

// Create a separate async API route for dashboard data
// This will allow us to fetch everything in parallel and cache it
const useDashboardData = () => {
  const { currentPlant } = usePlantContext();
  
  const { data, error, isLoading } = useSWR(
    currentPlant?.id ? `/api/dashboard?plant_id=${currentPlant.id}` : '/api/dashboard', 
    fetcher, 
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 1000 * 60 * 5, // Cache for 5 minutes
    }
  );

  return {
    dashboardData: data as DashboardData | undefined,
    isLoading,
    isError: error
  };
};

// Create individual data hooks for each section to allow lazy loading
const useQuotesData = () => {
  const { currentPlant } = usePlantContext();
  
  const { data, error, isLoading } = useSWR(
    currentPlant?.id ? `/api/dashboard/quotes?plant_id=${currentPlant.id}` : '/api/dashboard/quotes', 
    fetcher, 
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 1000 * 60 * 10, // Cache for 10 minutes
    }
  );

  return {
    quotesData: data?.quotesData || [],
    pendingQuotes: data?.pendingQuotes || [],
    isLoading,
    isError: error
  };
};

const useSalesData = () => {
  const { currentPlant } = usePlantContext();
  
  const { data, error, isLoading } = useSWR(
    currentPlant?.id ? `/api/dashboard/sales?plant_id=${currentPlant.id}` : '/api/dashboard/sales', 
    fetcher, 
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 1000 * 60 * 10, // Cache for 10 minutes
    }
  );

  return {
    salesData: data?.salesData || [],
    isLoading,
    isError: error
  };
};

// Lazy-loaded components
const SalesChart = ({ isLoading }: ChartProps) => {
  const { salesData, isError } = useSalesData();
  
  if (isLoading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse w-full h-64 bg-gray-200 rounded"></div>
      </div>
    );
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
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#22c55e" 
            strokeWidth={2} 
            activeDot={{ r: 8 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const PendingQuotesList = ({ isLoading }: ChartProps) => {
  const { pendingQuotes, isError } = useQuotesData();
  const displayQuotes = (pendingQuotes || []).slice(0, 5);
  
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="flex items-center justify-between animate-pulse py-2">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }
  
  if (isError) {
    return <div className="text-red-500">Error al cargar cotizaciones pendientes</div>;
  }
  
  if (displayQuotes.length === 0) {
    return <p className="text-footnote text-muted-foreground py-4">No hay cotizaciones pendientes</p>;
  }
  
  return (
    <div className="space-y-2">
      {displayQuotes.map((quote: PendingQuote) => (
        <Link
          key={quote.id}
          href={`/quotes/${quote.id}`}
          className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-callout text-gray-900 truncate">{quote.client}</p>
            <p className="text-footnote text-muted-foreground">{quote.date}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-callout font-medium text-gray-900">{quote.amount}</span>
            <Badge variant="warning">{quote.status}</Badge>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
      ))}
    </div>
  );
};

// Create a DashboardContent component to be wrapped in Suspense
function DashboardContent() {
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();
  
  // Restrict access for QUALITY_TEAM users
  if (profile?.role === 'QUALITY_TEAM') {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          
          <p className="text-lg mb-4 text-yellow-700">
            No tienes permiso para acceder al dashboard principal.
          </p>
          
          <div className="bg-white p-4 rounded-lg border border-yellow-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">¿Por qué?</h3>
            <p className="text-gray-600">
              Los usuarios del equipo de calidad tienen acceso exclusivo al módulo de calidad.
            </p>
          </div>
          
          <div className="flex gap-2">
            <Link 
              href="/quality"
              className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <Beaker className="h-4 w-4 mr-2" />
              Ir al Módulo de Calidad
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  const { dashboardData, isLoading: isLoadingDashboard, isError } = useDashboardData();
  const { pendingQuotes, isLoading: isLoadingQuotes } = useQuotesData();
  const { isLoading: isLoadingSales } = useSalesData();

  // Add dosificador quick access component
  const DosificadorQuickAccess = () => {
    if (profile?.role === 'DOSIFICADOR') {
      return (
        <div className="col-span-full mb-6">
          <div className="glass-interactive rounded-2xl p-6">
            <h2 className="text-title-3 text-gray-800 mb-4">Acceso Rápido para Dosificadores</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link 
                href="/orders" 
                className="flex items-center gap-3 p-4 glass-base rounded-xl hover:glass-interactive transition-colors"
              >
                <div className="rounded-xl bg-primary/10 p-2">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium">Ver Pedidos del Día</span>
              </Link>
              <Link 
                href="/orders?tab=calendar" 
                className="flex items-center gap-3 p-4 glass-base rounded-xl hover:glass-interactive transition-colors"
              >
                <div className="rounded-xl bg-primary/10 p-2">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium">Calendario de Pedidos</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Role-based metrics: show relevant data per role
  const roleMetricsMap: Record<string, string[]> = {
    DOSIFICADOR: ['todayOrders', 'pendingQuotes', 'monthlySales'],
    CREDIT_VALIDATOR: ['pendingCreditOrders', 'totalOutstandingBalance', 'todayOrders'],
    SALES_AGENT: ['monthlyQuotes', 'pendingQuotes', 'activeClients'],
    ADMINISTRATIVE: ['pendingCreditOrders', 'todayOrders', 'totalOutstandingBalance'],
    ADMIN_OPERATIONS: ['todayOrders', 'monthlySales', 'pendingCreditOrders'],
    EXECUTIVE: ['monthlyQuotes', 'monthlySales', 'activeClients', 'pendingCreditOrders', 'todayOrders', 'totalOutstandingBalance'],
    PLANT_MANAGER: ['monthlyQuotes', 'monthlySales', 'activeClients', 'pendingCreditOrders', 'todayOrders', 'totalOutstandingBalance'],
    EXTERNAL_SALES_AGENT: ['monthlyQuotes', 'pendingQuotes', 'activeClients'],
  };

  const allMetrics = [
    { key: 'monthlyQuotes', title: "Cotizaciones del Mes", value: dashboardData?.metrics?.monthlyQuotes || 0, growth: dashboardData?.metrics?.quoteGrowth || 0, icon: <FileText className="h-6 w-6 text-primary" />, suffix: '' },
    { key: 'monthlySales', title: "Venta Mensual (m³)", value: dashboardData?.metrics?.monthlySales || 0, growth: dashboardData?.metrics?.salesGrowth || 0, icon: <TrendingUp className="h-6 w-6 text-primary" />, suffix: ' m³' },
    { key: 'activeClients', title: "Clientes Activos", value: dashboardData?.metrics?.activeClients || 0, growth: dashboardData?.metrics?.clientGrowth || 0, icon: <Users className="h-6 w-6 text-primary" />, suffix: '' },
    { key: 'pendingCreditOrders', title: "Créditos Pendientes", value: dashboardData?.metrics?.pendingCreditOrders || 0, growth: undefined, icon: <AlertTriangle className="h-6 w-6 text-primary" />, suffix: '' },
    { key: 'todayOrders', title: "Pedidos Hoy", value: dashboardData?.metrics?.todayOrders || 0, growth: undefined, icon: <Calendar className="h-6 w-6 text-primary" />, suffix: '' },
    { key: 'totalOutstandingBalance', title: "Cartera CxC", value: dashboardData?.metrics?.totalOutstandingBalance || 0, growth: undefined, icon: <DollarSign className="h-6 w-6 text-primary" />, suffix: '$' },
    { key: 'pendingQuotes', title: "Cotizaciones Pendientes", value: dashboardData?.metrics?.pendingQuotes || 0, growth: undefined, icon: <FileText className="h-6 w-6 text-primary" />, suffix: '' },
  ];

  const role = (profile?.role || 'EXECUTIVE') as string;
  const allowedKeys = roleMetricsMap[role] ?? roleMetricsMap.EXECUTIVE;
  const metrics = allMetrics.filter((m) => allowedKeys.includes(m.key)).map(({ key, ...rest }) => rest);

  // Animations for container
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.025,
        staggerDirection: 1
      } 
    }
  };

  // Error handling
  if (isError && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error al cargar el dashboard</div>
          <button 
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
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
      <div className="mb-8">
        <p className="text-footnote text-muted-foreground uppercase tracking-wider">
          {currentPlant?.name ?? 'Todas las plantas'} · {format(new Date(), 'EEEE d MMMM', { locale: es })}
        </p>
        <h1 className="text-large-title text-gray-900 mt-1">
          {profile?.first_name ? `${profile.first_name}` : 'Dashboard'}
        </h1>
        {dashboardData?.lastUpdated && (
          <p className="text-footnote text-muted-foreground mt-2">
            Última actualización: {new Date(dashboardData.lastUpdated).toLocaleString('es-MX')}
          </p>
        )}
      </div>

      <DosificadorQuickAccess />

      {/* Main Metrics Grid - Role-based relevant metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {metrics.map((metric, index) => (
          <MetricsCard
            key={index}
            title={metric.title}
            value={metric.value}
            growth={metric.growth}
            icon={metric.icon}
            isLoading={isLoadingDashboard}
            suffix={metric.suffix}
            colorScheme="green"
          />
        ))}
      </div>

      <ApprovalTasksSection />

      {/* Charts section - only Ventas Mensuales prominent (hidden for DOSIFICADOR) */}
      {profile?.role !== 'DOSIFICADOR' && (
      <div className="grid grid-cols-1 gap-6 mb-6">
        <motion.div 
          className="glass-base rounded-2xl p-6 @container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.02 }}
        >
          <h2 className="text-title-3 text-gray-800 mb-4">Ventas Mensuales de Concreto (m³)</h2>
          <SalesChart isLoading={isLoadingSales} />
        </motion.div>
      </div>
      )}

      {/* Cotizaciones pendientes */}
      <div className="grid grid-cols-1 gap-6">
        <motion.div 
          className="glass-base rounded-2xl p-6 @container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.05 }}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-title-3 text-gray-800">Cotizaciones Pendientes</h2>
            <Link href="/quotes" className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center">
              Ver Todas <ExternalLink className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <PendingQuotesList isLoading={isLoadingQuotes} />
        </motion.div>
      </div>
    </div>
  );
}

// Main dashboard page with Suspense boundary
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
    </div>}>
      <DashboardContent />
    </Suspense>
  );
} 