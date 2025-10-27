'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Beaker, Filter, Calendar, Info } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import QualityTabs from '@/components/client-portal/quality/QualityTabs';
import GlossaryModal from '@/components/client-portal/quality/GlossaryModal';
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
  const [showGlossary, setShowGlossary] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: startOfDay(subDays(new Date(), 90)), // Default to last 3 months
    to: endOfDay(new Date())
  });
  const [limit] = useState(500);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

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
        to: formatDateForAPI(rangeToUse.to),
        limit: String(limit),
        offset: '0'
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
      setOffset(result.data?.remisiones?.length || 0);
    } catch (error) {
      console.error('Error fetching quality data:', error);
      setData(null);
      setSummary(null);
    } finally {
      setLoading(false);
      setLoadingProgress(0);
    }
  };

  const loadMore = async () => {
    if (!summary) return;
    try {
      setLoadingMore(true);
      const params = new URLSearchParams({
        from: summary.period.from,
        to: summary.period.to,
        limit: String(limit),
        offset: String(offset)
      });
      const response = await fetch(`/api/client-portal/quality?${params}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load more');
      }
      setData(prev => {
        if (!prev) return result.data;
        return {
          ...prev,
          remisiones: [...prev.remisiones, ...(result.data?.remisiones || [])]
        };
      });
      setOffset(prev => prev + (result.data?.remisiones?.length || 0));
    } catch (e) {
      console.error('Error loading more quality data:', e);
    } finally {
      setLoadingMore(false);
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
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass-thin hover:glass-interactive text-callout text-label-secondary hover:text-label-primary transition-all"
            >
              <Filter className="w-4 h-4" />
              Filtros
            </button>
            <button
              onClick={() => setShowGlossary(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl glass-thin hover:glass-interactive text-callout text-label-secondary hover:text-label-primary transition-all"
              aria-label="Glosario"
            >
              <Info className="w-4 h-4" />
              Ayuda
            </button>
          </div>
        </motion.div>

        {/* Date Range Filter Modal */}
        <AnimatePresence>
          {showFilters && (
            <DateRangeFilter
              dateRange={dateRange}
              onApply={(newRange) => {
                setDateRange(newRange);
                setShowFilters(false);
                setOffset(0);
                fetchQualityData(newRange);
              }}
              onCancel={() => setShowFilters(false)}
            />
          )}
        </AnimatePresence>

        {/* Glossary Modal */}
        <GlossaryModal open={showGlossary} onOpenChange={setShowGlossary} />

        {/* Quality Tabs - Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <QualityTabs data={data} summary={summary} />
        </motion.div>

        {/* Load More - fetch additional remisiones slices */}
        {data && summary && (data.remisiones.length < summary.totals.remisiones) && (
          <div className="flex items-center justify-center mt-6">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className={`px-5 py-2.5 rounded-2xl glass-interactive border-2 border-white/30 hover:border-white/50 text-callout font-semibold transition-all ${loadingMore ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {loadingMore ? 'Cargando más…' : `Cargar más datos (${data.remisiones.length} / ${summary.totals.remisiones})`}
            </button>
          </div>
        )}
      </Container>
    </div>
  );
}