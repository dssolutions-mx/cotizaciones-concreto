'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, BarChart2, PieChart } from 'lucide-react';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';
import { calculateQualityStats, getQualityTrend } from '@/lib/qualityHelpers';

interface QualityAnalysisProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export function QualityAnalysis({ data, summary }: QualityAnalysisProps) {
  const stats = calculateQualityStats(data);
  const trend = getQualityTrend(data);

  return (
    <div className="space-y-6">
      {/* Analysis Header */}
      <div className="glass-thick rounded-3xl p-6">
        <h2 className="text-title-2 font-semibold text-label-primary mb-2">
          Análisis Estadístico
        </h2>
        <p className="text-body text-label-secondary">
          Análisis detallado del desempeño de calidad en el período seleccionado
        </p>
      </div>

      {/* Statistical Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Compliance Statistics */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-thick rounded-3xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-systemGreen/20">
              <BarChart2 className="w-6 h-6 text-systemGreen" />
            </div>
            <h3 className="text-title-3 font-semibold text-label-primary">
              Estadísticas de Cumplimiento
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-callout text-label-secondary">Promedio</span>
              <span className={`text-callout font-bold ${
                stats.avgCompliance >= 95 ? 'text-systemGreen' : 
                stats.avgCompliance >= 85 ? 'text-systemOrange' : 
                'text-systemRed'
              }`}>
                {stats.avgCompliance.toFixed(1)}%
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-callout text-label-secondary">Máximo</span>
              <span className="text-callout font-bold text-label-primary">
                {stats.maxCompliance.toFixed(1)}%
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-callout text-label-secondary">Desviación Estándar</span>
              <span className="text-callout font-bold text-label-primary">
                ±{stats.stdDevCompliance.toFixed(1)}%
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-callout text-label-secondary">Consistencia</span>
              <span className={`text-callout font-bold ${
                stats.stdDevCompliance <= 5 ? 'text-systemGreen' :
                stats.stdDevCompliance <= 10 ? 'text-systemBlue' :
                'text-systemOrange'
              }`}>
                {stats.stdDevCompliance <= 5 ? 'Excelente' :
                 stats.stdDevCompliance <= 10 ? 'Muy Buena' :
                 'Buena'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Resistance Statistics */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-thick rounded-3xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-systemPurple/20">
              <PieChart className="w-6 h-6 text-systemPurple" />
            </div>
            <h3 className="text-title-3 font-semibold text-label-primary">
              Estadísticas de Resistencia
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-callout text-label-secondary">Promedio</span>
              <span className="text-callout font-bold text-systemPurple">
                {stats.avgResistance.toFixed(0)} kg/cm²
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-callout text-label-secondary">Máximo</span>
              <span className="text-callout font-bold text-label-primary">
                {stats.maxResistance.toFixed(0)} kg/cm²
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-callout text-label-secondary">Desviación Estándar</span>
              <span className="text-callout font-bold text-label-primary">
                ±{stats.stdDevResistance.toFixed(0)} kg/cm²
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-callout text-label-secondary">Total Ensayos</span>
              <span className="text-callout font-bold text-label-primary">
                {stats.totalTests}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Trend Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-thick rounded-3xl p-6"
      >
        <h3 className="text-title-3 font-semibold text-label-primary mb-4">
          Indicadores de Desempeño
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-2xl border ${
            trend === 'improving' 
              ? 'bg-gradient-to-br from-systemGreen/20 to-systemGreen/5 border-systemGreen/30'
              : trend === 'stable'
              ? 'bg-gradient-to-br from-systemBlue/20 to-systemBlue/5 border-systemBlue/20'
              : 'bg-gradient-to-br from-systemOrange/20 to-systemOrange/5 border-systemOrange/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {trend === 'improving' ? (
                <TrendingUp className="w-5 h-5 text-systemGreen" />
              ) : trend === 'declining' ? (
                <TrendingDown className="w-5 h-5 text-systemOrange" />
              ) : (
                <TrendingUp className="w-5 h-5 text-systemBlue" />
              )}
              <span className="text-caption font-medium text-label-secondary">
                Tendencia de Calidad
              </span>
            </div>
            <p className={`text-title-2 font-bold ${
              trend === 'improving' ? 'text-systemGreen' :
              trend === 'declining' ? 'text-systemOrange' :
              'text-systemBlue'
            }`}>
              {trend === 'improving' ? 'Excelente' :
               trend === 'declining' ? 'En Revisión' :
               'Consistente'}
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              {trend === 'improving' ? 'Mejora continua evidenciada' :
               trend === 'declining' ? 'Oportunidad de optimización' :
               'Desempeño estable y confiable'}
            </p>
          </div>

          <div className={`p-4 rounded-2xl border ${
            summary.averages.coefficientVariation <= 15 
              ? 'bg-gradient-to-br from-systemGreen/20 to-systemGreen/5 border-systemGreen/30'
              : 'glass-thin border-white/10'
          }`}>
            <p className="text-caption font-medium text-label-secondary mb-2">
              Uniformidad de Producción
            </p>
            <p className={`text-title-2 font-bold ${
              summary.averages.coefficientVariation <= 10 ? 'text-systemGreen' : 
              summary.averages.coefficientVariation <= 15 ? 'text-systemBlue' :
              'text-systemOrange'
            }`}>
              {summary.averages.coefficientVariation <= 10 ? 'Excelente' :
               summary.averages.coefficientVariation <= 15 ? 'Muy Bueno' :
               'Bueno'}
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              CV: {summary.averages.coefficientVariation.toFixed(1)}% - Alta consistencia
            </p>
          </div>

          <div className={`p-4 rounded-2xl border ${
            stats.nonCompliantTests === 0 
              ? 'bg-gradient-to-br from-systemGreen/20 to-systemGreen/5 border-systemGreen/30'
              : 'glass-thin border-white/10'
          }`}>
            <p className="text-caption font-medium text-label-secondary mb-2">
              Control de Calidad
            </p>
            <p className={`text-title-2 font-bold ${
              stats.nonCompliantTests === 0 ? 'text-systemGreen' : 
              (stats.nonCompliantTests / stats.totalTests * 100) < 5 ? 'text-systemBlue' :
              'text-systemOrange'
            }`}>
              {stats.nonCompliantTests === 0 ? '100%' : 
               stats.totalTests > 0 ? (100 - (stats.nonCompliantTests / stats.totalTests) * 100).toFixed(1) + '%' : '0%'}
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              {stats.nonCompliantTests === 0 ? 'Excelencia total alcanzada' : 
               `${stats.totalTests - stats.nonCompliantTests} de ${stats.totalTests} dentro de especificación`}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Performance Indicators */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-thick rounded-3xl p-6"
      >
        <h3 className="text-title-3 font-semibold text-label-primary mb-4">
          Indicadores de Control de Calidad
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl glass-thin border border-white/10">
            <div className="flex justify-between items-start mb-2">
              <span className="text-callout text-label-secondary">Coeficiente de Variación</span>
              <span className={`text-callout font-bold ${
                summary.averages.coefficientVariation <= 15 ? 'text-systemGreen' :
                summary.averages.coefficientVariation <= 20 ? 'text-systemOrange' :
                'text-systemRed'
              }`}>
                {summary.averages.coefficientVariation.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  summary.averages.coefficientVariation <= 15 ? 'bg-systemGreen' :
                  summary.averages.coefficientVariation <= 20 ? 'bg-systemOrange' :
                  'bg-systemRed'
                }`}
                style={{ width: `${Math.max(0, 100 - summary.averages.coefficientVariation * 4)}%` }}
              />
            </div>
            <p className="text-caption text-label-tertiary mt-2">
              Menor es mejor (≤15% = excelente)
            </p>
          </div>

          <div className="p-4 rounded-xl glass-thin border border-white/10">
            <div className="flex justify-between items-start mb-2">
              <span className="text-callout text-label-secondary">Porcentaje de Cumplimiento</span>
              <span className={`text-callout font-bold ${
                summary.averages.complianceRate >= 100 ? 'text-systemGreen' :
                summary.averages.complianceRate >= 95 ? 'text-systemOrange' :
                'text-systemRed'
              }`}>
                {summary.averages.complianceRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  summary.averages.complianceRate >= 100 ? 'bg-systemGreen' :
                  summary.averages.complianceRate >= 95 ? 'bg-systemOrange' :
                  'bg-systemRed'
                }`}
                style={{ width: `${Math.min(summary.averages.complianceRate, 100)}%` }}
              />
            </div>
            <p className="text-caption text-label-tertiary mt-2">
              {summary.totals.ensayosEdadGarantia} ensayos a edad de garantía
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default QualityAnalysis;

