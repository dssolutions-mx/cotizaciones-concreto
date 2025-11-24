'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  TrendingUp,
  DollarSign,
  CheckCircle,
  Truck,
  FileText,
  BarChart3,
  Calendar,
  MapPin,
  Clock
} from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { MetricCard } from '@/components/ui/MetricCard';
import { ActivityCard } from '@/components/ui/ActivityCard';
import { QuickAction } from '@/components/ui/QuickAction';
import ClientPortalLoader from '@/components/client-portal/ClientPortalLoader';
import { PermissionGate } from '@/components/client-portal/shared/PermissionGate';
import { useUserPermissions } from '@/hooks/client-portal/useUserPermissions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ENSAYO_ADJUSTMENT_FACTOR } from '@/lib/qualityHelpers';

// Helper to parse date string (YYYY-MM-DD) without timezone conversion
const parseLocalDate = (dateString: string): Date => {
  if (!dateString) return new Date();
  // Handle both date-only and datetime formats
  if (dateString.includes('T')) {
    // It's a datetime string, use normal parsing
    return new Date(dateString);
  }
  // It's a date-only string, parse without timezone
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

interface DashboardData {
  metrics: {
    totalOrders: number;
    deliveredVolume: number;
    currentBalance: number;
    qualityScore: number;
  };
  recentActivity: Array<{
    id: string;
    type: 'delivery' | 'order' | 'payment' | 'quality';
    title: string;
    description: string;
    timestamp: string;
    status?: 'success' | 'warning' | 'error' | 'pending';
  }>;
  upcomingDeliveries: Array<{
    id: string;
    orderNumber: string;
    site: string;
    date: string;
    volume: number;
  }>;
}

export default function ClientPortalDashboard() {
  const router = useRouter();
  const { 
    canViewOrders, 
    canViewPrices, 
    canViewQualityData, 
    canCreateOrders 
  } = useUserPermissions();
  const [metrics, setMetrics] = useState<DashboardData['metrics'] | null>(null);
  const [recentActivity, setRecentActivity] = useState<DashboardData['recentActivity']>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState('Cargando métricas...');
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        // Stage 1: Fetch metrics first (faster)
        setLoadingStage('Cargando métricas...');
        const metricsResponse = await fetch('/api/client-portal/dashboard?activity=false');
        const metricsResult = await metricsResponse.json();

        if (metricsResponse.ok) {
          console.log('Metrics loaded:', metricsResult);
          setMetrics(metricsResult.metrics);
          setMetricsLoaded(true);
          setLoading(false); // Hide main loader after metrics load
        }

        // Stage 2: Fetch activity (slower, loads separately in background)
        const activityResponse = await fetch('/api/client-portal/dashboard?metrics=false&activity_limit=10');
        const activityResult = await activityResponse.json();

        if (activityResponse.ok) {
          console.log('Activity loaded:', activityResult);
          setRecentActivity(activityResult.recentActivity || []);
          setActivityLoaded(true);
        }

      } catch (error) {
        console.error('Error fetching dashboard:', error);
        setMetrics({
          totalOrders: 0,
          deliveredVolume: 0,
          currentBalance: 0,
          qualityScore: 0
        });
        setRecentActivity([]);
        setMetricsLoaded(true);
        setActivityLoaded(true);
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  // Show main loader only until metrics are ready
  if (loading) {
    return <ClientPortalLoader message="Bienvenido" stage={loadingStage} />;
  }

  return (
    <div className="min-h-screen bg-background-primary">
      <Container maxWidth="4xl" className="py-0">
        {/* Welcome Header - iOS 26 Typography with entrance animation */}
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            duration: 0.6,
            ease: [0.25, 0.1, 0.25, 1.0]
          }}
          className="mb-12"
        >
          <motion.h1 
            className="text-large-title font-bold text-label-primary mb-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            Bienvenido
          </motion.h1>
          <motion.p 
            className="text-body text-label-secondary"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          </motion.p>
        </motion.div>

        {/* Key Metrics - iOS 26 Spacing with staggered animation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {metricsLoaded && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
              >
                <MetricCard
                  title="Pedidos Totales"
                  value={metrics?.totalOrders || 0}
                  subtitle="Histórico"
                  icon={<Package className="w-6 h-6" />}
                  color="blue"
                  onClick={() => router.push('/client-portal/orders')}
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
              >
                <MetricCard
                  title="Volumen Entregado"
                  value={`${(metrics?.deliveredVolume || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³`}
                  subtitle="Mes actual"
                  icon={<TrendingUp className="w-6 h-6" />}
                  color="green"
                  onClick={() => router.push('/client-portal/orders')}
                />
              </motion.div>
              {canViewPrices && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
                >
                  <MetricCard
                    title="Balance Actual"
                    value={`$${(metrics?.currentBalance || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    subtitle="Saldo pendiente"
                    icon={<DollarSign className="w-6 h-6" />}
                    color="orange"
                    onClick={() => router.push('/client-portal/balance')}
                  />
                </motion.div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
              >
                <MetricCard
                  title="Calidad Promedio"
                  value={`${(((metrics?.qualityScore || 0) * ENSAYO_ADJUSTMENT_FACTOR)).toFixed(2)}%`}
                  subtitle="Cumplimiento"
                  icon={<CheckCircle className="w-6 h-6" />}
                  color="blue"
                  onClick={() => router.push('/client-portal/quality')}
                />
              </motion.div>
            </>
          )}
        </div>

        {/* Quick Actions - iOS 26 Glass Effect */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mb-12"
        >
          <div className="glass-thick rounded-3xl p-8">
            <h2 className="text-title-2 font-bold text-label-primary mb-8">
              Acciones Rápidas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <QuickAction
                icon={<Package className="w-6 h-6" />}
                label="Ver Pedidos"
                onClick={() => router.push('/client-portal/orders')}
                color="blue"
              />
              <QuickAction
                icon={<FileText className="w-6 h-6" />}
                label="Balance"
                onClick={() => router.push('/client-portal/balance')}
                color="green"
              />
              <QuickAction
                icon={<BarChart3 className="w-6 h-6" />}
                label="Calidad"
                onClick={() => router.push('/client-portal/quality')}
                color="blue"
              />
              <QuickAction
                icon={<Calendar className="w-6 h-6" />}
                label="Programar"
                onClick={() => router.push('/client-portal/orders/schedule')}
                color="orange"
              />
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 lg:gap-10">
          {/* Recent Activity (real ensayos) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="glass-thick rounded-3xl p-8 h-full">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-title-2 font-bold text-label-primary">
                  Actividad Reciente
                </h2>
              </div>

              <div className="space-y-4">
                {!activityLoaded && (
                  <div className="text-center py-12">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-12 h-12 border-4 border-gray-300 border-t-gray-700 rounded-full mx-auto mb-4"
                    />
                    <p className="text-body text-label-secondary">
                      Cargando actividad reciente...
                    </p>
                  </div>
                )}
                {activityLoaded && recentActivity.map((activity, index) => {
                  // Select icon based on activity type
                  let icon = <CheckCircle className="w-5 h-5" />;
                  if (activity.type === 'order') {
                    icon = <Package className="w-5 h-5" />;
                  } else if (activity.type === 'payment') {
                    icon = <DollarSign className="w-5 h-5" />;
                  } else if (activity.type === 'quality') {
                    icon = <CheckCircle className="w-5 h-5" />;
                  } else if (activity.type === 'delivery') {
                    icon = <Truck className="w-5 h-5" />;
                  }

                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.3 }}
                    >
                      <ActivityCard
                        icon={icon}
                        title={activity.title}
                        description={activity.description}
                        timestamp={format(parseLocalDate(activity.timestamp), "dd MMM yyyy", { locale: es })}
                        status={activity.status as any}
                      />
                    </motion.div>
                  );
                })}
                {activityLoaded && recentActivity.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-label-tertiary mx-auto mb-4" />
                    <p className="text-body text-label-secondary">
                      No hay actividad reciente
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </Container>
    </div>
  );
}