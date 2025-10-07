'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { List, BarChart3 } from 'lucide-react';
import MuestreoCard from './MuestreoCard';
import QualityChart from './QualityChart';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';
import { hasEnsayos, calculateDailyAverage, processMuestreosForChart } from '@/lib/qualityHelpers';

interface QualityMuestreosProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export function QualityMuestreos({ data, summary }: QualityMuestreosProps) {
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');
  
  // Process all muestreos from remisiones
  const allMuestreos = data.remisiones.flatMap(remision => 
    remision.muestreos.map(muestreo => ({
      ...muestreo,
      remisionNumber: remision.remisionNumber,
      fecha: remision.fecha,
      constructionSite: remision.constructionSite,
      rendimientoVolumetrico: remision.rendimientoVolumetrico,
      compliance: remision.avgCompliance
    }))
  );

  const chartData = processMuestreosForChart(allMuestreos);

  return (
    <div className="space-y-6">
      {/* Header with View Mode Toggle */}
      <div className="flex justify-between items-center">
        <h2 className="text-title-2 font-semibold text-label-primary">
          Muestreos Realizados ({allMuestreos.length})
        </h2>
        
        <div className="glass-thin rounded-xl p-1 inline-flex">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              viewMode === 'list' 
                ? 'bg-white dark:bg-gray-800 shadow-sm' 
                : 'hover:bg-white/50'
            }`}
          >
            <List className="w-4 h-4" />
            <span className="text-callout">Lista</span>
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              viewMode === 'chart' 
                ? 'bg-white dark:bg-gray-800 shadow-sm' 
                : 'hover:bg-white/50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span className="text-callout">Gráfico</span>
          </button>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'list' ? (
        allMuestreos.length > 0 ? (
          <div className="space-y-4">
            {allMuestreos.map((muestreo, index) => (
              <MuestreoCard 
                key={muestreo.id} 
                muestreo={muestreo} 
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="glass-thick rounded-3xl p-12 text-center">
            <p className="text-label-tertiary">No hay muestreos en el período seleccionado</p>
          </div>
        )
      ) : (
        <div className="glass-thick rounded-3xl p-6">
          {chartData.length > 0 ? (
            <QualityChart
              type="muestreos-timeline"
              data={chartData}
              height={400}
            />
          ) : (
            <div className="flex items-center justify-center h-96 text-label-tertiary">
              <p>Sin datos suficientes para el gráfico</p>
            </div>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-thick rounded-3xl p-6"
      >
        <h3 className="text-title-3 font-semibold text-label-primary mb-4">
          Estadísticas de Muestreos
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-caption text-label-tertiary mb-1">Total</p>
            <p className="text-title-2 font-bold text-label-primary">
              {allMuestreos.length}
            </p>
          </div>
          <div>
            <p className="text-caption text-label-tertiary mb-1">Con Ensayos</p>
            <p className="text-title-2 font-bold text-systemGreen">
              {allMuestreos.filter(m => hasEnsayos(m)).length}
            </p>
          </div>
          <div>
            <p className="text-caption text-label-tertiary mb-1">Site Checks</p>
            <p className="text-title-2 font-bold text-systemBlue">
              {allMuestreos.filter(m => !hasEnsayos(m)).length}
            </p>
          </div>
          <div>
            <p className="text-caption text-label-tertiary mb-1">Promedio Diario</p>
            <p className="text-title-2 font-bold text-label-primary">
              {calculateDailyAverage(allMuestreos)}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default QualityMuestreos;

