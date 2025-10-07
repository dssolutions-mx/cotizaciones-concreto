'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingDown, 
  TrendingUp, 
  Calendar,
  Download,
  CreditCard,
  Building
} from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Card as BaseCard } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { DataList } from '@/components/ui/DataList';
import { Button } from '@/components/ui/button';
import ClientPortalLoader from '@/components/client-portal/ClientPortalLoader';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface BalanceData {
  general: {
    current_balance: number;
    total_delivered: number;
    total_paid: number;
    total_volume: number;
  };
  sites: Array<{
    site_name: string;
    balance: number;
    volume: number;
    monetary_amount: number;
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
  }>;
}

export default function BalancePage() {
  const router = useRouter();
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBalance() {
      try {
        // Use the dedicated balance API which returns complete financial data
        const response = await fetch('/api/client-portal/balance');
        const balanceData = await response.json();

        if (!response.ok) throw new Error(balanceData.error || 'Failed to fetch balance data');

        console.log('Balance data received:', balanceData);
        setData({
          general: {
            current_balance: balanceData.general?.current_balance || 0,
            total_delivered: balanceData.general?.total_delivered || 0,
            total_paid: balanceData.general?.total_paid || 0,
            total_volume: balanceData.general?.total_volume || 0
          },
          sites: balanceData.sites || [],
          recentPayments: balanceData.recentPayments || []
        });
      } catch (error) {
        console.error('Error fetching balance:', error);
        setData({
          general: { current_balance: 0, total_delivered: 0, total_paid: 0, total_volume: 0 },
          sites: [],
          recentPayments: []
        });
      } finally {
        setLoading(false);
      }
    }

    fetchBalance();
  }, []);

  if (loading) {
    return <ClientPortalLoader message="Cargando balance..." />;
  }

  return (
    <div className="min-h-screen bg-background-primary">
      <Container maxWidth="2xl" className="py-8">
        {/* Header - iOS 26 Typography */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl glass-thick flex items-center justify-center border border-white/30">
              <DollarSign className="w-6 h-6 text-label-primary" />
            </div>
            <div>
              <h1 className="text-large-title font-bold text-label-primary">
                Balance Financiero
              </h1>
              <p className="text-body text-label-secondary">
                Estado de cuenta actualizado
              </p>
            </div>
          </div>
        </motion.div>

        {/* Main Balance Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="glass-base rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-callout text-label-tertiary uppercase tracking-wide mb-3">
                  Saldo Actual
                </p>
                <h2 
                  className={`text-6xl font-bold ${
                    (data?.general.current_balance || 0) > 0 
                      ? 'text-red-600' 
                      : (data?.general.current_balance || 0) < 0 
                        ? 'text-green-600' 
                        : 'text-label-primary'
                  }`}
                >
                  ${(data?.general.current_balance || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <p className="text-caption text-label-tertiary mt-2">
                  {(data?.general.current_balance || 0) > 0 
                    ? 'Pendiente de pago' 
                    : (data?.general.current_balance || 0) < 0 
                      ? 'Saldo a favor' 
                      : 'Al corriente'}
                </p>
              </div>
              <Button
                variant="glass"
                size="lg"
                onClick={() => router.push('/client-portal/balance/payments')}
                className="flex items-center gap-2"
              >
                <Calendar className="w-5 h-5" />
                Historial
              </Button>
            </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="glass-thin rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <TrendingUp className="w-5 h-5 text-label-tertiary" />
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide">
                      Total Entregado
                    </p>
                  </div>
                  <p className="text-title-2 font-bold text-label-primary">
                    ${(data?.general.total_delivered || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-caption text-label-tertiary mt-2">
                    {(data?.general.total_volume || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³
                  </p>
                </div>

                <div className="glass-thin rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <TrendingDown className="w-5 h-5 text-label-tertiary" />
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide">
                      Total Pagado
                    </p>
                  </div>
                  <p className="text-title-2 font-bold text-label-primary">
                    ${(data?.general.total_paid || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="glass-thin rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <DollarSign className="w-5 h-5 text-label-tertiary" />
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide">
                      Pendiente
                    </p>
                  </div>
                  <p 
                    className={`text-title-2 font-bold ${
                      (data?.general.current_balance || 0) > 0 
                        ? 'text-red-600' 
                        : (data?.general.current_balance || 0) < 0 
                          ? 'text-green-600' 
                          : 'text-label-primary'
                    }`}
                  >
                    ${Math.abs(data?.general.current_balance || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Balance by Site */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="glass-base rounded-3xl p-8 h-full">
              <div className="flex items-center gap-4 mb-8">
                <Building className="w-6 h-6 text-label-tertiary" />
                <h2 className="text-title-2 font-bold text-label-primary">
                  Balance por Obra
                </h2>
              </div>

              {data?.sites && data.sites.length > 0 ? (
                <div className="space-y-4">
                  {data.sites.map((site, index) => (
                    <motion.div
                      key={site.site_name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                      className="glass-thin rounded-xl p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-body font-semibold text-label-primary">
                          {site.site_name}
                        </p>
                        <p 
                          className={`text-title-3 font-bold ${
                            site.balance > 0 
                              ? 'text-red-600' 
                              : site.balance < 0 
                                ? 'text-green-600' 
                                : 'text-label-primary'
                          }`}
                        >
                          ${site.balance.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10">
                        <div>
                          <p className="text-caption text-label-tertiary mb-1">
                            Volumen Entregado
                          </p>
                          <p className="text-callout font-semibold text-label-secondary">
                            {site.volume.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³
                          </p>
                        </div>
                        <div>
                          <p className="text-caption text-label-tertiary mb-1">
                            Monto Entregado
                          </p>
                          <p className="text-callout font-semibold text-label-secondary">
                            ${site.monetary_amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Building className="w-16 h-16 text-label-tertiary mx-auto mb-4" />
                  <p className="text-body text-label-secondary">
                    No hay balances por obra
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent Payments */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="glass-base rounded-3xl p-8 h-full">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <CreditCard className="w-6 h-6 text-label-tertiary" />
                  <h2 className="text-title-2 font-bold text-label-primary">
                    Pagos Recientes
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/client-portal/balance/payments')}
                >
                  Ver todos
                </Button>
              </div>

              {data?.recentPayments && data.recentPayments.length > 0 ? (
                <div className="space-y-4">
                  {data.recentPayments.map((payment, index) => (
                    <motion.div
                      key={payment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className="glass-thin rounded-xl p-6"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl glass-thin flex items-center justify-center border border-white/20">
                            <CreditCard className="w-5 h-5 text-label-tertiary" />
                          </div>
                          <div>
                            <p className="text-body font-semibold text-label-primary">
                              ${payment.amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-caption text-label-secondary">
                              {payment.payment_method}
                            </p>
                          </div>
                        </div>
                        <p className="text-footnote text-label-tertiary">
                          {format(new Date(payment.payment_date), 'd MMM', { locale: es })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CreditCard className="w-16 h-16 text-label-tertiary mx-auto mb-4" />
                  <p className="text-body text-label-secondary">
                    No hay pagos registrados
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </Container>
    </div>
  );
}