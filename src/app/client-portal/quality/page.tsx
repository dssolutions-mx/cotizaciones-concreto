'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Beaker, 
  CheckCircle, 
  Target,
  Award,
  FlaskConical
} from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { MetricCard } from '@/components/ui/MetricCard';
import { Badge } from '@/components/ui/badge';
import { DataList } from '@/components/ui/DataList';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface QualityMetrics {
  avgRendimiento: number;
  complianceRate: number;
  totalTests: number;
  approvedTestsRate: number;
}

interface TestResult {
  id: string;
  fecha_ensayo: string;
  resistencia_calculada: string;
  porcentaje_cumplimiento: string;
  carga_kg: string;
  observaciones?: string;
}

export default function QualityPage() {
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [recentTests, setRecentTests] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQuality() {
      try {
        // Use the dashboard API which has the correct RLS filtering for quality data
        const response = await fetch('/api/client-portal/dashboard');
        const dashboardData = await response.json();

        if (!response.ok) throw new Error(dashboardData.error || 'Failed to fetch quality data');

        console.log('Quality data received:', dashboardData);
        // Use data from dashboard API
        setMetrics({
          avgRendimiento: dashboardData.metrics?.qualityScore || 0,
          complianceRate: 0, // Will be calculated from recent activity
          totalTests: 0, // Will be calculated from recent activity
          approvedTestsRate: 0 // Will be calculated from recent activity
        });

        // Use recent activity from dashboard API as test results
        const testResults = (dashboardData.recentActivity || []).map((activity: any) => ({
          id: activity.id,
          fecha_ensayo: activity.timestamp,
          resistencia_calculada: activity.description.split('·')[0]?.replace('Resistencia ', '') || '-',
          porcentaje_cumplimiento: activity.description.split('·')[1]?.replace('% cumplimiento', '').trim() || '0',
          carga_kg: '0',
          observaciones: ''
        }));

        setRecentTests(testResults);
      } catch (error) {
        console.error('Error fetching quality data:', error);
        setMetrics({
          avgRendimiento: 0,
          complianceRate: 0,
          totalTests: 0,
          approvedTestsRate: 0
        });
        setRecentTests([]);
      } finally {
        setLoading(false);
      }
    }

    fetchQuality();
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
        {/* Header - iOS 26 Typography */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl glass-thick flex items-center justify-center border border-white/30">
              <Beaker className="w-6 h-6 text-label-primary" />
            </div>
            <div>
              <h1 className="text-large-title font-bold text-label-primary">
                Control de Calidad
              </h1>
              <p className="text-body text-label-secondary">
                Resultados de ensayos y rendimiento volumétrico
              </p>
            </div>
          </div>
        </motion.div>

        {/* Key Metrics */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <MetricCard
            title="Rendimiento Volumétrico"
            value={`${metrics?.avgRendimiento || 0}%`}
            subtitle="Promedio"
            icon={<Target className="w-6 h-6" />}
            color="blue"
            trend={metrics?.avgRendimiento >= 98 ? { value: 0, label: 'Óptimo' } : undefined}
          />
          <MetricCard
            title="Cumplimiento"
            value={`${metrics?.complianceRate || 0}%`}
            subtitle="Promedio general"
            icon={<Award className="w-6 h-6" />}
            color="green"
          />
          <MetricCard
            title="Total de Ensayos"
            value={metrics?.totalTests || 0}
            subtitle="Registrados"
            icon={<FlaskConical className="w-6 h-6" />}
            color="orange"
          />
          <MetricCard
            title="Ensayos Aprobados"
            value={`${metrics?.approvedTestsRate || 0}%`}
            subtitle="≥95% cumplimiento"
            icon={<CheckCircle className="w-6 h-6" />}
            color="blue"
          />
        </motion.div>

        {/* Rendimiento Volumétrico Info - Refined Glass Effect */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="glass-base rounded-3xl p-8">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 rounded-2xl glass-thin flex items-center justify-center border border-white/20 flex-shrink-0">
                <Target className="w-6 h-6 text-label-tertiary" />
              </div>
              <div>
                <h2 className="text-title-2 font-bold text-label-primary mb-3">
                  ¿Qué es el Rendimiento Volumétrico?
                </h2>
                <p className="text-body text-label-secondary">
                  Es una métrica clave que evalúa la eficiencia en la producción de concreto,
                  comparando el volumen real obtenido contra el volumen teórico esperado.
                  Un rendimiento del 98% o superior indica excelente calidad y control en el proceso.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Tests - Refined Glass Effect */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="glass-base rounded-3xl p-8">
            <div className="flex items-center gap-4 mb-8">
              <Beaker className="w-6 h-6 text-label-tertiary" />
              <h2 className="text-title-2 font-bold text-label-primary">
                Resultados de Ensayos Recientes
              </h2>
            </div>

            {recentTests.length > 0 ? (
              <div className="space-y-4">
                {recentTests.map((ensayo, index) => (
                  <motion.div
                    key={ensayo.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                    className="glass-thin rounded-2xl p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <p className="text-callout font-medium text-label-primary">
                        Ensayo - {format(new Date(ensayo.fecha_ensayo), 'dd MMM yyyy', { locale: es })}
                      </p>
                      <Badge
                        variant={
                          parseFloat(ensayo.porcentaje_cumplimiento) >= 95
                            ? 'success'
                            : parseFloat(ensayo.porcentaje_cumplimiento) >= 85
                              ? 'warning'
                              : 'error'
                        }
                      >
                        {ensayo.porcentaje_cumplimiento}% Cumplimiento
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mt-4 text-footnote">
                      <div>
                        <p className="text-label-tertiary">Resistencia Calculada</p>
                        <p className="text-label-primary font-medium">
                          {ensayo.resistencia_calculada} kg/cm²
                        </p>
                      </div>
                      <div>
                        <p className="text-label-tertiary">Carga</p>
                        <p className="text-label-primary font-medium">
                          {ensayo.carga_kg} kg
                        </p>
                      </div>
                    </div>

                    {ensayo.observaciones && (
                      <p className="mt-4 text-caption text-label-secondary">
                        {ensayo.observaciones}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FlaskConical className="w-16 h-16 text-label-tertiary mx-auto mb-4" />
                <h3 className="text-title-2 font-bold text-label-primary mb-3">
                  No hay ensayos registrados
                </h3>
                <p className="text-body text-label-secondary">
                  Los resultados de calidad aparecerán aquí una vez realizados
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </Container>
    </div>
  );
}