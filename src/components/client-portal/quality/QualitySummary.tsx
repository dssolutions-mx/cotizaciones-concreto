'use client';

import { motion } from 'framer-motion';
import QualityMetricCard from './QualityMetricCard';
import QualityChart from './QualityChart';
import { Target, Award, TrendingUp, Activity, AlertTriangle, XCircle } from 'lucide-react';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';
import { processVolumetricTrend, processResistanceTrend } from '@/lib/qualityHelpers';

interface QualitySummaryProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export function QualitySummary({ data, summary }: QualitySummaryProps) {
  const volumetricData = processVolumetricTrend(data);
  const resistanceData = processResistanceTrend(data);

  // Helper to get CV color based on value
  const getCVColor = (cv: number) => {
    if (cv <= 15) return 'text-systemGreen';
    if (cv <= 20) return 'text-systemOrange';
    return 'text-systemRed';
  };

  return (
    <div className="space-y-6">
      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <QualityMetricCard
          title="Rendimiento Volumétrico"
          value={summary.averages.rendimientoVolumetrico > 0 ? `${summary.averages.rendimientoVolumetrico.toFixed(1)}%` : 'N/A'}
          subtitle="Eficiencia de producción"
          icon={<Target className="w-6 h-6" />}
          trend={summary.averages.rendimientoVolumetrico >= 100 ? 'up' : summary.averages.rendimientoVolumetrico >= 98 ? 'neutral' : 'down'}
          color="primary"
          delay={0}
        />
        
        <QualityMetricCard
          title="Cumplimiento"
          value={`${summary.averages.complianceRate.toFixed(1)}%`}
          subtitle={`${summary.totals.ensayosEdadGarantia} ensayos válidos`}
          icon={<Award className="w-6 h-6" />}
          trend={summary.averages.complianceRate >= 95 ? 'up' : summary.averages.complianceRate >= 85 ? 'neutral' : 'down'}
          color="success"
          delay={0.1}
        />
        
        <QualityMetricCard
          title="Resistencia Promedio"
          value={`${summary.averages.resistencia.toFixed(0)} kg/cm²`}
          subtitle="En edad de garantía"
          icon={<TrendingUp className="w-6 h-6" />}
          color="warning"
          delay={0.2}
        />
        
        {/* Expanded CV Card with per-recipe breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3, ease: 'easeOut' }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="
            glass-thick 
            rounded-3xl 
            p-6
            border
            border-systemPurple/20
            bg-gradient-to-br from-systemPurple/20 to-systemPurple/5
            transition-all duration-200
            hover:shadow-lg
            relative
            overflow-hidden
          "
        >
          {/* Subtle gradient overlay */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl" />
          
          <div className="relative">
            {/* Header with icon */}
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-2xl glass-thin text-systemPurple">
                <Activity className="w-6 h-6" />
              </div>
              {summary.averages.coefficientVariation > 0 && (
                <div className="flex items-center gap-1">
                  {summary.averages.coefficientVariation <= 15 ? (
                    <TrendingUp className="w-4 h-4 text-systemGreen" />
                  ) : summary.averages.coefficientVariation <= 20 ? (
                    <Activity className="w-4 h-4 text-label-tertiary" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-systemRed" />
                  )}
                </div>
              )}
            </div>

            {/* Value */}
            <div className="mb-2">
              <h3 className="text-title-1 font-bold text-label-primary mb-1">
                {summary.averages.coefficientVariation.toFixed(1)}%
              </h3>
              <p className="text-callout font-medium text-label-secondary">
                Coeficiente de Variación
              </p>
            </div>

            {/* Subtitle */}
            <p className="text-footnote text-label-tertiary mb-3">
              Consistencia de calidad
            </p>

            {/* Per-recipe breakdown */}
            {summary.averages.cvByRecipe && summary.averages.cvByRecipe.length > 0 && (
              <div className="mt-4 pt-4 border-t border-fill-tertiary">
                <p className="text-caption font-semibold text-label-secondary mb-2">
                  Por Receta:
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                  {summary.averages.cvByRecipe.map((recipe, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-caption"
                    >
                      <span className="text-label-secondary">
                        FC{recipe.strengthFc.toFixed(0)} - {recipe.ageDays} días
                      </span>
                      <span className={`font-bold ${getCVColor(recipe.coefficientVariation)}`}>
                        {recipe.coefficientVariation.toFixed(1)}%
                        <span className="text-label-tertiary font-normal ml-1">
                          (n={recipe.muestreoCount})
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volumetric Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-thick rounded-3xl p-6"
        >
          <h3 className="text-title-3 font-semibold text-label-primary mb-4">
            Rendimiento Volumétrico en el Tiempo
          </h3>
          {volumetricData.length > 0 ? (
            <QualityChart 
              type="volumetric-trend" 
              data={volumetricData}
              height={300}
              showLegend={false}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-label-tertiary">
              <p>Sin datos de rendimiento volumétrico</p>
            </div>
          )}
        </motion.div>

        {/* Compliance Performance Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-thick rounded-3xl p-6"
        >
          <div className="mb-4">
            <h3 className="text-title-3 font-semibold text-label-primary mb-3">
              Desempeño de Cumplimiento
            </h3>
            <div className="flex items-center gap-5 text-callout text-label-secondary">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3.5 h-3.5 rounded-full shadow-sm flex-shrink-0"
                  style={{ 
                    backgroundColor: '#34C759',
                    border: '1px solid rgba(52, 199, 89, 0.2)'
                  }}
                ></div>
                <span>Excelente: ≥100%</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-3.5 h-3.5 rounded-full shadow-sm flex-shrink-0"
                  style={{ 
                    backgroundColor: '#FF9500',
                    border: '1px solid rgba(255, 149, 0, 0.2)'
                  }}
                ></div>
                <span>Aceptable: 98-100%</span>
              </div>
            </div>
          </div>
          {resistanceData.length > 0 ? (
            <QualityChart 
              type="resistance-performance" 
              data={resistanceData}
              height={300}
              showLegend={false}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-label-tertiary">
              <p>Sin datos suficientes</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Alerts */}
      {summary.alerts && summary.alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-thick rounded-3xl p-6"
        >
          <h3 className="text-title-3 font-semibold text-label-primary mb-4">
            Alertas y Notificaciones
          </h3>
          <div className="space-y-3">
            {summary.alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-4 rounded-xl transition-all ${
                  alert.type === 'error'
                    ? 'bg-red-500/10 border border-red-500/20'
                    : alert.type === 'warning'
                    ? 'bg-yellow-500/10 border border-yellow-500/20'
                    : 'bg-blue-500/10 border border-blue-500/20'
                }`}
              >
                {alert.type === 'error' ? (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-callout font-medium text-label-primary mb-1">
                    {alert.metric}
                  </p>
                  <p className="text-footnote text-label-secondary">
                    {alert.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Performance Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-thick rounded-3xl p-6"
      >
        <h3 className="text-title-3 font-semibold text-label-primary mb-4">
          Resumen de Desempeño
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-caption text-label-tertiary mb-1">Tendencia de Calidad</p>
            <p className={`text-callout font-bold ${
              summary.performance.qualityTrend === 'improving' ? 'text-systemGreen' :
              summary.performance.qualityTrend === 'declining' ? 'text-systemRed' :
              'text-systemBlue'
            }`}>
              {summary.performance.qualityTrend === 'improving' ? 'Mejorando' :
               summary.performance.qualityTrend === 'declining' ? 'Decreciendo' :
               'Estable'}
            </p>
          </div>
          <div>
            <p className="text-caption text-label-tertiary mb-1">Promedio de Cumplimiento</p>
            <p className={`text-callout font-bold ${
              summary.averages.complianceRate >= 95 ? 'text-systemGreen' : 
              summary.averages.complianceRate >= 85 ? 'text-systemOrange' : 'text-systemRed'
            }`}>
              {summary.averages.complianceRate.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-caption text-label-tertiary mb-1">Coef. Variación</p>
            <p className={`text-callout font-bold ${
              summary.averages.coefficientVariation <= 15 ? 'text-systemGreen' :
              summary.averages.coefficientVariation <= 20 ? 'text-systemOrange' :
              'text-systemRed'
            }`}>
              {summary.averages.coefficientVariation.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-caption text-label-tertiary mb-1">Total Muestreos</p>
            <p className="text-callout font-bold text-label-primary">
              {summary.totals.muestreos}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default QualitySummary;

