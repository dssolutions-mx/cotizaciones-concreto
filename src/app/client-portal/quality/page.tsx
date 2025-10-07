'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Beaker, Filter, Calendar } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import QualityTabs from '@/components/client-portal/quality/QualityTabs';
import DatePicker from '@/components/client-portal/quality/DatePicker';
import ClientPortalLoader from '@/components/client-portal/ClientPortalLoader';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';

export default function QualityPage() {
  const [data, setData] = useState<ClientQualityData | null>(null);
  const [summary, setSummary] = useState<ClientQualitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('Inicializando...');
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30), // Default to last 30 days
    to: new Date()
  });

  const fetchQualityData = async () => {
    try {
      setLoading(true);
      setLoadingProgress(0);
      setLoadingStage('Preparando consulta...');
      
      // Simulate progressive loading stages
      const progressStages = [
        { progress: 20, stage: 'Obteniendo remisiones...' },
        { progress: 40, stage: 'Cargando muestreos...' },
        { progress: 60, stage: 'Procesando ensayos...' },
        { progress: 80, stage: 'Calculando métricas...' },
        { progress: 95, stage: 'Finalizando...' }
      ];

      const params = new URLSearchParams({
        from: format(dateRange.from, 'yyyy-MM-dd'),
        to: format(dateRange.to, 'yyyy-MM-dd')
      });

      // Start progress simulation
      let currentStage = 0;
      const progressInterval = setInterval(() => {
        if (currentStage < progressStages.length) {
          setLoadingProgress(progressStages[currentStage].progress);
          setLoadingStage(progressStages[currentStage].stage);
          currentStage++;
        }
      }, 300);

      const response = await fetch(`/api/client-portal/quality?${params}`);
      const result = await response.json();

      clearInterval(progressInterval);
      setLoadingProgress(100);
      setLoadingStage('Completado');

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch quality data');
      }

      // Small delay to show 100% completion
      await new Promise(resolve => setTimeout(resolve, 300));

      setData(result.data);
      setSummary(result.summary);
    } catch (error) {
      console.error('Error fetching quality data:', error);
      setData(null);
      setSummary(null);
    } finally {
      setLoading(false);
      setLoadingProgress(0);
    }
  };

  useEffect(() => {
    fetchQualityData();
  }, []);

  if (loading) {
    return <ClientPortalLoader message="Cargando datos de calidad..." stage={loadingStage} />;
  }

  if (!data || !summary) {
    return (
      <div className="min-h-screen bg-background-primary">
        <Container maxWidth="2xl" className="py-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-thick rounded-3xl p-12 text-center"
          >
            <Beaker className="w-20 h-20 text-label-tertiary mx-auto mb-6" />
            <h3 className="text-title-2 font-bold text-label-primary mb-3">
              No hay datos de calidad disponibles
            </h3>
            <p className="text-body text-label-secondary">
              Los datos de calidad aparecerán aquí una vez que se realicen ensayos
            </p>
          </motion.div>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary">
      <Container maxWidth="2xl" className="py-0">
        {/* Header - iOS 26 Typography */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-large-title font-bold text-label-primary mb-3">
              Control de Calidad
            </h1>
            <p className="text-body text-label-secondary">
              {format(new Date(summary.period.from), "dd MMM", { locale: es })} - {format(new Date(summary.period.to), "dd MMM yyyy", { locale: es })}
            </p>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass-thin hover:glass-interactive text-callout text-label-secondary hover:text-label-primary transition-all"
          >
            <Filter className="w-4 h-4" />
            Filtros
          </button>
        </motion.div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden mb-8"
            >
              <div className="glass-thick rounded-3xl p-6">
                <h3 className="text-title-3 font-semibold text-label-primary mb-4">
                  Filtrar por Período
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DatePicker
                    label="Desde"
                    value={dateRange.from}
                    onChange={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                    maxDate={dateRange.to}
                  />
                  
                  <DatePicker
                    label="Hasta"
                    value={dateRange.to}
                    onChange={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                    minDate={dateRange.from}
                    maxDate={new Date()}
                  />
                </div>

                {/* Quick Filters */}
                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-caption font-medium text-label-secondary mb-3">
                    Accesos Rápidos
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Últimos 7 días', days: 7 },
                      { label: 'Últimos 30 días', days: 30 },
                      { label: 'Últimos 60 días', days: 60 },
                      { label: 'Últimos 90 días', days: 90 }
                    ].map(({ label, days }) => (
                      <button
                        key={days}
                        onClick={() => {
                          setDateRange({
                            from: subDays(new Date(), days),
                            to: new Date()
                          });
                        }}
                        className="px-4 py-2 rounded-xl glass-thin hover:glass-interactive text-footnote text-label-primary transition-all"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={fetchQualityData}
                    className="flex-1 px-6 py-3 bg-systemBlue hover:bg-systemBlue/90 text-white rounded-xl text-callout font-medium transition-all shadow-lg"
                  >
                    Aplicar Filtros
                  </button>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="px-6 py-3 glass-thin hover:glass-interactive text-label-primary rounded-xl text-callout font-medium transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quality Tabs - Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <QualityTabs data={data} summary={summary} />
        </motion.div>
      </Container>
    </div>
  );
}