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
        
        <QualityMetricCard
          title="Coeficiente de Variación"
          value={`${summary.averages.coefficientVariation.toFixed(1)}%`}
          subtitle="Consistencia de calidad"
          icon={<Activity className="w-6 h-6" />}
          trend={summary.averages.coefficientVariation <= 15 ? 'up' : summary.averages.coefficientVariation <= 20 ? 'neutral' : 'down'}
          color="info"
          delay={0.3}
        />
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

        {/* Resistance Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-thick rounded-3xl p-6"
        >
          <h3 className="text-title-3 font-semibold text-label-primary mb-4">
            Tendencia de Resistencia
          </h3>
          {resistanceData.length > 0 ? (
            <QualityChart 
              type="resistance-trend" 
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

