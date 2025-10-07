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
              <span className="text-callout text-label-secondary">Mínimo</span>
              <span className="text-callout font-bold text-label-primary">
                {stats.minCompliance.toFixed(1)}%
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
              <span className="text-callout text-label-secondary">Ensayos Conformes</span>
              <span className="text-callout font-bold text-systemGreen">
                {stats.compliantTests} / {stats.totalTests}
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
              <span className="text-callout text-label-secondary">Mínimo</span>
              <span className="text-callout font-bold text-label-primary">
                {stats.minResistance.toFixed(0)} kg/cm²
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
          Análisis de Tendencias
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-systemBlue/20 to-systemBlue/5 border border-systemBlue/20">
            <div className="flex items-center gap-2 mb-2">
              {trend === 'improving' ? (
                <TrendingUp className="w-5 h-5 text-systemGreen" />
              ) : trend === 'declining' ? (
                <TrendingDown className="w-5 h-5 text-systemRed" />
              ) : (
                <TrendingUp className="w-5 h-5 text-systemBlue" />
              )}
              <span className="text-caption font-medium text-label-secondary">
                Tendencia General
              </span>
            </div>
            <p className={`text-title-2 font-bold ${
              trend === 'improving' ? 'text-systemGreen' :
              trend === 'declining' ? 'text-systemRed' :
              'text-systemBlue'
            }`}>
              {trend === 'improving' ? 'Mejorando' :
               trend === 'declining' ? 'Decreciendo' :
               'Estable'}
            </p>
          </div>

          <div className="p-4 rounded-2xl glass-thin border border-white/10">
            <p className="text-caption font-medium text-label-secondary mb-2">
              Tasa de Conformidad
            </p>
            <p className={`text-title-2 font-bold ${
              (stats.compliantTests / stats.totalTests * 100) >= 95 ? 'text-systemGreen' : 'text-systemOrange'
            }`}>
              {stats.totalTests > 0 ? ((stats.compliantTests / stats.totalTests) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              {stats.compliantTests} de {stats.totalTests} ensayos
            </p>
          </div>

          <div className="p-4 rounded-2xl glass-thin border border-white/10">
            <p className="text-caption font-medium text-label-secondary mb-2">
              Ensayos No Conformes
            </p>
            <p className={`text-title-2 font-bold ${
              stats.nonCompliantTests > 0 ? 'text-systemRed' : 'text-systemGreen'
            }`}>
              {stats.nonCompliantTests}
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              {stats.totalTests > 0 ? ((stats.nonCompliantTests / stats.totalTests) * 100).toFixed(1) : 0}% del total
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
          Indicadores de Desempeño
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl glass-thin border border-white/10">
            <div className="flex justify-between items-start mb-2">
              <span className="text-callout text-label-secondary">Cobertura de Muestreo</span>
              <span className="text-callout font-bold text-label-primary">
                {summary.totals.porcentajeCoberturaMuestreo.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  summary.totals.porcentajeCoberturaMuestreo >= 75 ? 'bg-systemGreen' :
                  summary.totals.porcentajeCoberturaMuestreo >= 50 ? 'bg-systemOrange' :
                  'bg-systemRed'
                }`}
                style={{ width: `${Math.min(summary.totals.porcentajeCoberturaMuestreo, 100)}%` }}
              />
            </div>
            <p className="text-caption text-label-tertiary mt-2">
              {summary.totals.remisionesMuestreadas} de {summary.totals.remisiones} remisiones
            </p>
          </div>

          <div className="p-4 rounded-xl glass-thin border border-white/10">
            <div className="flex justify-between items-start mb-2">
              <span className="text-callout text-label-secondary">Cobertura de Calidad</span>
              <span className="text-callout font-bold text-label-primary">
                {summary.totals.porcentajeCoberturaCalidad.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  summary.totals.porcentajeCoberturaCalidad >= 75 ? 'bg-systemGreen' :
                  summary.totals.porcentajeCoberturaCalidad >= 50 ? 'bg-systemOrange' :
                  'bg-systemRed'
                }`}
                style={{ width: `${Math.min(summary.totals.porcentajeCoberturaCalidad, 100)}%` }}
              />
            </div>
            <p className="text-caption text-label-tertiary mt-2">
              {summary.totals.remisionesConDatosCalidad} remisiones con ensayos
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default QualityAnalysis;

