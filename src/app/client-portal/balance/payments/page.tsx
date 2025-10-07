'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CreditCard, Calendar, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Container } from '@/components/ui/Container';

// Helper to parse date string (YYYY-MM-DD) without timezone conversion
const parseLocalDate = (dateString: string | null | undefined): Date => {
  if (!dateString) {
    return new Date(); // Return current date as fallback
  }
  
  const parts = dateString.split('-');
  if (parts.length !== 3) {
    return new Date(); // Return current date as fallback
  }
  
  const [year, month, day] = parts.map(Number);
  
  // Validate the parsed numbers
  if (isNaN(year) || isNaN(month) || isNaN(day) || 
      year < 1900 || year > 2100 || 
      month < 1 || month > 12 || 
      day < 1 || day > 31) {
    return new Date(); // Return current date as fallback
  }
  
  return new Date(year, month - 1, day);
};

type Payment = {
  id: string;
  payment_date: string;
  amount: number;
  reference_number?: string | null;
  payment_method: string;
  construction_site?: string | null;
  notes?: string | null;
};

export default function ClientPortalPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('client_payments')
        .select('id, payment_date, amount, reference_number, payment_method, construction_site, notes')
        .order('payment_date', { ascending: false })
        .limit(200);
      
      if (error) {
        console.error('Error loading payments:', error);
      }
      setPayments((data || []) as any[]);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-primary">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-label-tertiary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary">
      <Container maxWidth="2xl" className="py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            {/* iOS 26-style back affordance */}
            <button
              onClick={() => router.back()}
              className="group flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-white/60 dark:bg-white/5 border border-white/30 backdrop-blur-sm transition-colors hover:bg-white/70"
            >
              <ChevronLeft className="w-4 h-4 text-label-primary" />
              <span className="text-callout font-medium text-label-primary group-hover:text-label-primary/90">Volver</span>
            </button>
            <div className="w-12 h-12 rounded-2xl glass-thick flex items-center justify-center border border-white/30">
              <CreditCard className="w-6 h-6 text-label-primary" />
            </div>
            <div>
              <h1 className="text-large-title font-bold text-label-primary">
                Historial de Pagos
              </h1>
              <p className="text-body text-label-secondary">
                {payments.length} pago{payments.length !== 1 ? 's' : ''} registrado{payments.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Payments Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="glass-base rounded-3xl p-8">
            {payments.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-label-tertiary mx-auto mb-4" />
                <h3 className="text-title-2 font-bold text-label-primary mb-3">
                  No hay pagos registrados
                </h3>
                <p className="text-body text-label-secondary">
                  Los pagos aparecerán aquí una vez que sean procesados
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/20">
                <table className="w-full">
                  <thead className="glass-thin">
                    <tr className="border-b border-white/20">
                      <th className="px-6 py-4 text-left text-footnote font-semibold text-label-tertiary uppercase tracking-wide">
                        Fecha
                      </th>
                      <th className="px-6 py-4 text-right text-footnote font-semibold text-label-tertiary uppercase tracking-wide">
                        Monto
                      </th>
                      <th className="px-6 py-4 text-left text-footnote font-semibold text-label-tertiary uppercase tracking-wide">
                        Método
                      </th>
                      <th className="px-6 py-4 text-left text-footnote font-semibold text-label-tertiary uppercase tracking-wide">
                        Obra
                      </th>
                      <th className="px-6 py-4 text-left text-footnote font-semibold text-label-tertiary uppercase tracking-wide">
                        Referencia
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {payments.map((payment, index) => (
                      <motion.tr
                        key={payment.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + index * 0.05 }}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="px-6 py-4 text-body text-label-primary">
                          {(() => {
                            try {
                              const date = parseLocalDate(payment.payment_date);
                              return date.toLocaleDateString('es-MX');
                            } catch (error) {
                              console.warn('Invalid date format:', payment.payment_date);
                              return 'Fecha inválida';
                            }
                          })()}
                        </td>
                        <td className="px-6 py-4 text-body font-semibold text-label-primary text-right">
                          ${payment.amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-body text-label-secondary">
                          {payment.payment_method || '-'}
                        </td>
                        <td className="px-6 py-4 text-body text-label-secondary truncate max-w-[200px]" title={payment.construction_site || 'General'}>
                          {payment.construction_site || 'General'}
                        </td>
                        <td className="px-6 py-4 text-body text-label-secondary">
                          {payment.reference_number || '-'}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </Container>
    </div>
  );
}


