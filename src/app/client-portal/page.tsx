'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch('/api/client-portal/dashboard');
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch dashboard data');
        }

        console.log('Dashboard data received:', result);
        setData(result);
      } catch (error) {
        console.error('Error fetching dashboard:', error);
        setData({
          metrics: {
            totalOrders: 0,
            deliveredVolume: 0,
            currentBalance: 0,
            qualityScore: 0
          },
          recentActivity: []
        });
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-slate-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary">
      <Container maxWidth="4xl" className="py-0">
        {/* Welcome Header - iOS 26 Typography */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <h1 className="text-large-title font-bold text-label-primary mb-3">
                Bienvenido
              </h1>
              <p className="text-body text-label-secondary">
                {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
              </p>
            </motion.div>

        {/* Key Metrics - iOS 26 Spacing */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
        >
          <MetricCard
            title="Pedidos Totales"
            value={data?.metrics.totalOrders || 0}
            subtitle="Histórico"
            icon={<Package className="w-6 h-6" />}
            color="blue"
            onClick={() => router.push('/client-portal/orders')}
          />
          <MetricCard
            title="Volumen Entregado"
            value={`${data?.metrics.deliveredVolume || 0} m³`}
            subtitle="Total acumulado"
            icon={<TrendingUp className="w-6 h-6" />}
            trend={{ value: 12.5, label: 'vs mes anterior' }}
            color="green"
            onClick={() => router.push('/client-portal/orders')}
          />
          <MetricCard
            title="Balance Actual"
            value={`$${(data?.metrics.currentBalance || 0).toLocaleString('es-MX')}`}
            subtitle="Saldo pendiente"
            icon={<DollarSign className="w-6 h-6" />}
            color="orange"
            onClick={() => router.push('/client-portal/balance')}
          />
          <MetricCard
            title="Calidad Promedio"
            value={`${data?.metrics.qualityScore || 0}%`}
            subtitle="Cumplimiento"
            icon={<CheckCircle className="w-6 h-6" />}
            trend={{ value: 2.3, label: 'vs mes anterior' }}
            color="blue"
            onClick={() => router.push('/client-portal/quality')}
          />
        </motion.div>

        {/* Quick Actions - iOS 26 Glass Effect */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
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
                onClick={() => router.push('/client-portal/orders')}
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
                {(data?.recentActivity || []).map((activity) => {
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
                    <ActivityCard
                      key={activity.id}
                      icon={icon}
                      title={activity.title}
                      description={activity.description}
                      timestamp={format(new Date(activity.timestamp), "dd MMM yyyy", { locale: es })}
                      status={activity.status as any}
                    />
                  );
                })}
                {(!data?.recentActivity || data.recentActivity.length === 0) && (
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