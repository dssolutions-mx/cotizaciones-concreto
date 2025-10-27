'use client';

import { motion } from 'framer-motion';
import QualityMetricCard from './QualityMetricCard';
import QualityChart from './QualityChart';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { DialogTitle, DialogDescription } from '@/components/ui/dialog';
import CvDetailsModal from '@/components/client-portal/quality/CvDetailsModal';
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

  // TEMPORARY: Use hardcoded example data from GRUPO INMOBICARPIO DEL BAJIO report
  // This will be replaced with real data from the API once available
  // FORCING hardcoded values to override database data for demonstration
  const isInmobicarpio = summary.clientInfo.business_name === 'GRUPO INMOBICARPIO DEL BAJIO';
  
  const tempCvByRecipe = isInmobicarpio ? [
    // Data from the FIRST manual report screenshot (the one we want to show)
    { recipeCode: 'FC150', strengthFc: 150, ageDays: 3, coefficientVariation: 9.26, muestreoCount: 2, ensayoCount: 2, avgResistencia: 165.65, avgCompliance: 100 },
    { recipeCode: 'FC150', strengthFc: 150, ageDays: 28, coefficientVariation: 7.16, muestreoCount: 2, ensayoCount: 2, avgResistencia: 175.95, avgCompliance: 100 },
    { recipeCode: 'FC200', strengthFc: 200, ageDays: 3, coefficientVariation: 20.19, muestreoCount: 18, ensayoCount: 18, avgResistencia: 212.13, avgCompliance: 100 },
    { recipeCode: 'FC200', strengthFc: 200, ageDays: 7, coefficientVariation: 15.27, muestreoCount: 15, ensayoCount: 15, avgResistencia: 245.24, avgCompliance: 100 },
    { recipeCode: 'FC200', strengthFc: 200, ageDays: 28, coefficientVariation: 3.98, muestreoCount: 8, ensayoCount: 8, avgResistencia: 255.46, avgCompliance: 100 },
  ] : summary.averages.cvByRecipe;

  // Calculate weighted average CV from the breakdown
  // Weighted CV = sum(CV * n) / sum(n)
  const tempOverallCV = isInmobicarpio && tempCvByRecipe ? (() => {
    const totalWeight = tempCvByRecipe.reduce((sum, r) => sum + r.muestreoCount, 0);
    const weightedSum = tempCvByRecipe.reduce((sum, r) => sum + (r.coefficientVariation * r.muestreoCount), 0);
    return weightedSum / totalWeight;
  })() : summary.averages.coefficientVariation;

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
          tooltip="Qué tan cerca está el volumen producido del teórico. 98–102% es típico."
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
        
        {/* CV KPI: compact card + modal for details */}
        <Dialog>
          <DialogTrigger asChild>
            <div>
              <QualityMetricCard
                title="Coeficiente de Variación"
                value={`${tempOverallCV.toFixed(2)}%${isInmobicarpio ? ' ' : ''}`}
                subtitle={`Consistencia de calidad${isInmobicarpio ? ' (Promedio Ponderado)' : ''}`}
                icon={<Activity className="w-6 h-6" />}
                trend={tempOverallCV <= 15 ? 'up' : tempOverallCV <= 20 ? 'neutral' : 'down'}
                color="info"
                delay={0.3}
                tooltip="Mide la variabilidad relativa de la resistencia. Menor es mejor. ≤10% excelente, 10–15% muy bueno."
              />
            </div>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-7xl max-h-[90vh] rounded-3xl border border-gray-200 bg-white shadow-2xl overflow-hidden flex flex-col p-0">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-gray-100/40 to-transparent rounded-full blur-3xl -z-10" />
            <div className="px-6 pt-6 pb-4 border-b border-gray-200">
              <DialogTitle className="text-title-3 font-semibold text-gray-900">
                Coeficiente de Variación
              </DialogTitle>
              <DialogDescription className="text-footnote text-gray-600 mt-2">
                Análisis detallado de uniformidad por receta. Valores menores indican mayor consistencia de calidad.
              </DialogDescription>
            </div>
            <div className="px-6 pb-6 overflow-y-auto flex-1">
              <CvDetailsModal
                overallCv={Number(tempOverallCV.toFixed(2))}
                cvByRecipe={tempCvByRecipe}
                clientName={summary.clientInfo.business_name}
                isDemo={isInmobicarpio}
              />
            </div>
          </DialogContent>
        </Dialog>
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
              xDataKey="date"
              xTickFormatter={(v: any) => {
                // v is a string like "2025-09-24" from processVolumetricTrend
                if (typeof v !== 'string' || !v) return '';
                const [year, month, day] = v.split('-');
                const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                return isNaN(d.getTime()) ? '' : format(d, 'dd MMM', { locale: es });
              }}
              yTickFormatter={(v: any) => `${v}%`}
              yIsPercent
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
              xDataKey="date"
              xTickFormatter={(v: any) => {
                // v is a string like "2025-09-24" from processResistanceTrend
                if (typeof v !== 'string' || !v) return '';
                const [year, month, day] = v.split('-');
                const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                return isNaN(d.getTime()) ? '' : format(d, 'dd MMM', { locale: es });
              }}
              yTickFormatter={(v: any) => `${v}%`}
              yIsPercent
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
              tempOverallCV <= 15 ? 'text-systemGreen' :
              tempOverallCV <= 20 ? 'text-systemOrange' :
              'text-systemRed'
            }`}>
              {tempOverallCV.toFixed(2)}%
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

