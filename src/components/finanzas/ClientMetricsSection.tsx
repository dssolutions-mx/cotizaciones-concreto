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
  const [error, setError] = useState<string | null>(null);

  // Fetch metrics if not provided via props
  useEffect(() => {
    if (isLoading) {
      const fetchMetrics = async () => {
        try {
          console.log('Starting to fetch financial metrics...');
          
          // Calculate date range for "last 30 days" metric
          const today = new Date();
          const thirtyDaysAgo = subDays(today, 30);
          
          // Format dates for Supabase
          const endDate = format(today, 'yyyy-MM-dd');
          const startDate = format(thirtyDaysAgo, 'yyyy-MM-dd');
          
          console.log(`Fetching metrics for date range: ${startDate} to ${endDate}`);
          
          // Fetch all metrics in parallel
          console.log('Fetching all metrics in parallel...');
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

          console.log('Metrics results:', {
            totalOutstandingBalance,
            paymentsData,
            pendingCreditOrdersCount,
            overdueClientsCount
          });

          // If we have no balance data, try to create test data
          if (totalOutstandingBalance === 0 && overdueClientsCount === 0) {
            console.log('No balance data found, attempting to create test data...');
            try {
              const testDataResult = await financialService.createTestBalanceRecords();
              if (testDataResult.success) {
                console.log('Test balance data created successfully');
                // Re-fetch balance data after creating test records
                const [newTotalBalance, newOverdueCount] = await Promise.all([
                  financialService.getTotalOutstandingBalance(),
                  financialService.getOverdueClientsCount()
                ]);
                
                setMetrics({
                  totalBalance: newTotalBalance,
                  paymentsAmount: paymentsData.totalAmount,
                  paymentsCount: paymentsData.count,
                  pendingClientsCount: newOverdueCount,
                  pendingOrdersCount: pendingCreditOrdersCount
                });
                setError(null);
                setIsLoading(false);
                return; // Exit early after updating with new test data
              } else {
                console.warn('Failed to create test data:', testDataResult);
              }
            } catch (testDataError) {
              console.error('Error creating test data:', testDataError);
            }
          }

          setMetrics({
            totalBalance: totalOutstandingBalance,
            paymentsAmount: paymentsData.totalAmount,
            paymentsCount: paymentsData.count,
            pendingClientsCount: overdueClientsCount,
            pendingOrdersCount: pendingCreditOrdersCount
          });
          setError(null);
        } catch (error) {
          console.error('Error fetching metrics:', error);
          setError('Error al cargar las métricas financieras');
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
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}
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