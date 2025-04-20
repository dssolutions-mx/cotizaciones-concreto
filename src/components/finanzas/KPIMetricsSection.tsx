'use client';

import React from 'react';
import KPICard from '@/components/finanzas/KPICard';
import { formatCurrency } from '@/lib/utils';
// Import lucide icons directly
import { Wallet, CreditCard, Users, ClipboardList } from 'lucide-react';

interface KPIMetricsSectionProps {
  metricsData: {
    totalOutstandingBalance: number;
    paymentsLastThirtyDays: {
      totalAmount: number;
      count: number;
    };
    overdueClientsCount: number;
    pendingCreditOrdersCount: number;
  };
}

export default function KPIMetricsSection({ metricsData }: KPIMetricsSectionProps) {
  // Apply defaults for any potentially missing data
  const {
    totalOutstandingBalance = 0,
    paymentsLastThirtyDays = { totalAmount: 0, count: 0 },
    overdueClientsCount = 0,
    pendingCreditOrdersCount = 0
  } = metricsData || {};
  
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Métricas Financieras</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Saldo Total Pendiente"
          value={formatCurrency(totalOutstandingBalance)}
          description="Suma de todos los balances de clientes"
          icon={<Wallet size={18} />}
          valueClassName={totalOutstandingBalance > 0 ? "text-red-600" : "text-green-600"}
        />
        
        <KPICard
          title="Pagos Recibidos (30 días)"
          value={formatCurrency(paymentsLastThirtyDays.totalAmount)}
          description={`${paymentsLastThirtyDays.count} pagos en los últimos 30 días`}
          icon={<CreditCard size={18} />}
        />
        
        <KPICard
          title="Clientes con Saldo Pendiente"
          value={overdueClientsCount}
          description="Clientes con balance mayor a cero"
          icon={<Users size={18} />}
        />
        
        <KPICard
          title="Órdenes Pendientes de Crédito"
          value={pendingCreditOrdersCount}
          description="Órdenes que requieren aprobación de crédito"
          icon={<ClipboardList size={18} />}
        />
      </div>
    </section>
  );
} 