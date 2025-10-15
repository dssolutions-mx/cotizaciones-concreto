'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Beaker, Filter, Calendar } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import QualityTabs from '@/components/client-portal/quality/QualityTabs';
import DateRangeFilter from '@/components/client-portal/DateRangeFilter';
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
    from: startOfDay(subDays(new Date(), 365)), // Default to last 12 months
    to: endOfDay(new Date())
  });

  // Helper to format date without timezone conversion
  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to parse date string (YYYY-MM-DD) without timezone conversion
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const fetchQualityData = async (range?: { from: Date; to: Date }) => {
    const rangeToUse = range || dateRange;
    
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
        from: formatDateForAPI(rangeToUse.from),
        to: formatDateForAPI(rangeToUse.to)
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
              {format(parseLocalDate(summary.period.from), "dd MMM", { locale: es })} - {format(parseLocalDate(summary.period.to), "dd MMM yyyy", { locale: es })}
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

        {/* Date Range Filter Modal */}
        <AnimatePresence>
          {showFilters && (
            <DateRangeFilter
              dateRange={dateRange}
              onApply={(newRange) => {
                setDateRange(newRange);
                setShowFilters(false);
                fetchQualityData(newRange);
              }}
              onCancel={() => setShowFilters(false)}
            />
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