'use client';

import React, { useState, useEffect } from 'react';
import KPICard from './KPICard';
import { formatCurrency } from '@/lib/utils';
import { financialService } from '@/lib/supabase/financial';
import { format, subDays } from 'date-fns';

interface ClientMetricsSectionProps {
  totalBalance?: number;
  paymentsAmount?: number;
  paymentsCount?: number;
  pendingClientsCount?: number;
  pendingOrdersCount?: number;
}

export default function ClientMetricsSection({
  totalBalance: initialTotalBalance,
  paymentsAmount: initialPaymentsAmount,
  paymentsCount: initialPaymentsCount,
  pendingClientsCount: initialPendingClientsCount,
  pendingOrdersCount: initialPendingOrdersCount
}: ClientMetricsSectionProps) {
  const [metrics, setMetrics] = useState({
    totalBalance: initialTotalBalance ?? 0,
    paymentsAmount: initialPaymentsAmount ?? 0,
    paymentsCount: initialPaymentsCount ?? 0,
    pendingClientsCount: initialPendingClientsCount ?? 0,
    pendingOrdersCount: initialPendingOrdersCount ?? 0
  });
  const [isLoading, setIsLoading] = useState(
    initialTotalBalance === undefined || 
    initialPaymentsAmount === undefined || 
    initialPaymentsCount === undefined || 
    initialPendingClientsCount === undefined || 
    initialPendingOrdersCount === undefined
  );

  // Fetch metrics if not provided via props
  useEffect(() => {
    if (isLoading) {
      const fetchMetrics = async () => {
        try {
          // Calculate date range for "last 30 days" metric
          const today = new Date();
          const thirtyDaysAgo = subDays(today, 30);
          
          // Format dates for Supabase
          const endDate = format(today, 'yyyy-MM-dd');
          const startDate = format(thirtyDaysAgo, 'yyyy-MM-dd');
          
          // Fetch all metrics in parallel
          const [
            totalOutstandingBalance,
            paymentsData,
            pendingCreditOrdersCount,
            overdueClientsCount
          ] = await Promise.all([
            financialService.getTotalOutstandingBalance(),
            financialService.getTotalPaymentsReceived(startDate, endDate),
            financialService.getPendingCreditOrdersCount(),
            financialService.getOverdueClientsCount()
          ]);

          setMetrics({
            totalBalance: totalOutstandingBalance,
            paymentsAmount: paymentsData.totalAmount,
            paymentsCount: paymentsData.count,
            pendingClientsCount: overdueClientsCount,
            pendingOrdersCount: pendingCreditOrdersCount
          });
        } catch (error) {
          console.error('Error fetching metrics:', error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchMetrics();
    }
  }, [isLoading]);

  // Show loading skeleton if data is loading
  if (isLoading) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4">Métricas Financieras</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="p-4 border rounded-md bg-gray-50 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-7 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Métricas Financieras</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Saldo Total Pendiente"
          value={formatCurrency(metrics.totalBalance)}
          description="Suma de todos los balances de clientes"
          icon={<span className="text-xl">💰</span>}
          valueClassName={metrics.totalBalance > 0 ? "text-red-600" : "text-green-600"}
        />
        
        <KPICard
          title="Pagos Recibidos (30 días)"
          value={formatCurrency(metrics.paymentsAmount)}
          description={`${metrics.paymentsCount} pagos en los últimos 30 días`}
          icon={<span className="text-xl">💳</span>}
        />
        
        <KPICard
          title="Clientes con Saldo Pendiente"
          value={metrics.pendingClientsCount}
          description="Clientes con balance mayor a cero"
          icon={<span className="text-xl">👥</span>}
        />
        
        <KPICard
          title="Órdenes Pendientes de Crédito"
          value={metrics.pendingOrdersCount}
          description="Órdenes que requieren aprobación de crédito"
          icon={<span className="text-xl">📋</span>}
        />
      </div>
    </section>
  );
} 