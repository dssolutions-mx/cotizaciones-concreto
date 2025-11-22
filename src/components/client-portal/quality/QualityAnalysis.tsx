'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, BarChart2, PieChart, Target, AlertCircle, CheckCircle2, Lightbulb, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';
import { calculateQualityStats, getQualityTrend, ENSAYO_ADJUSTMENT_FACTOR } from '@/lib/qualityHelpers';
import QualityChart from './QualityChart';

interface QualityAnalysisProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export function QualityAnalysis({ data, summary }: QualityAnalysisProps) {
  const stats = calculateQualityStats(data);
  const trend = getQualityTrend(data);
  const factor = ENSAYO_ADJUSTMENT_FACTOR;
  const adjustedCompliance = (summary.averages.complianceRate || 0) * factor;

  // Calculate monthly trends
  const monthlyTrends = useMemo(() => {
    const monthlyData = data.monthlyStats || [];
    if (monthlyData.length < 2) return null;

    const sorted = [...monthlyData].sort((a, b) => {
      const dateA = new Date(`${a.year}-${a.month}-01`);
      const dateB = new Date(`${b.year}-${b.month}-01`);
      return dateA.getTime() - dateB.getTime();
    });

    const lastMonth = sorted[sorted.length - 1];
    const previousMonth = sorted[sorted.length - 2];

    const complianceChange = lastMonth.avgResistencia > 0 && previousMonth.avgResistencia > 0
      ? ((lastMonth.avgResistencia - previousMonth.avgResistencia) / previousMonth.avgResistencia) * 100
      : 0;

    return {
      lastMonth: lastMonth.month,
      complianceChange,
      volumeChange: previousMonth.volume > 0
        ? ((lastMonth.volume - previousMonth.volume) / previousMonth.volume) * 100
        : 0,
      muestreosChange: previousMonth.muestreos > 0
        ? ((lastMonth.muestreos - previousMonth.muestreos) / previousMonth.muestreos) * 100
        : 0
    };
  }, [data.monthlyStats]);

  // Calculate recipe performance breakdown
  const recipePerformance = useMemo(() => {
    const recipeMap = new Map<string, {
      recipeCode: string;
      recipeFc: number;
      count: number;
      avgCompliance: number;
      avgResistance: number;
      cv: number;
    }>();

    data.remisiones.forEach(remision => {
      const key = remision.recipeCode || 'N/A';
      if (!recipeMap.has(key)) {
        recipeMap.set(key, {
          recipeCode: key,
          recipeFc: remision.recipeFc || 0,
          count: 0,
          avgCompliance: 0,
          avgResistance: 0,
          cv: 0
        });
      }

      const recipe = recipeMap.get(key)!;
      recipe.count += 1;

      const validEnsayos = remision.muestreos.flatMap(m =>
        m.muestras.flatMap(mu =>
          mu.ensayos.filter(e =>
            e.isEdadGarantia && !e.isEnsayoFueraTiempo && e.resistenciaCalculada > 0
          )
        )
      );

      if (validEnsayos.length > 0) {
        const avgComp = validEnsayos.reduce((sum, e) => sum + (e.porcentajeCumplimiento || 0), 0) / validEnsayos.length;
        const avgRes = validEnsayos.reduce((sum, e) => sum + (e.resistenciaCalculada || 0), 0) / validEnsayos.length;
        recipe.avgCompliance = (recipe.avgCompliance * (recipe.count - 1) + avgComp) / recipe.count;
        recipe.avgResistance = (recipe.avgResistance * (recipe.count - 1) + avgRes) / recipe.count;
      }
    });

    return Array.from(recipeMap.values())
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [data.remisiones]);

  // Generate actionable recommendations
  const recommendations = useMemo(() => {
    const recs: Array<{ type: 'success' | 'warning' | 'info'; message: string; priority: number }> = [];

    if (adjustedCompliance >= 100) {
      recs.push({
        type: 'success',
        message: 'Excelente cumplimiento. Mantener los estándares actuales de producción.',
        priority: 1
      });
    } else if (adjustedCompliance >= 95) {
      recs.push({
        type: 'info',
        message: 'Cumplimiento sólido. Oportunidad de optimización para alcanzar 100%.',
        priority: 2
      });
    } else {
      recs.push({
        type: 'warning',
        message: 'Revisar procesos de producción y curado de especímenes para mejorar cumplimiento.',
        priority: 3
      });
    }

    if (summary.averages.coefficientVariation > 15) {
      recs.push({
        type: 'warning',
        message: 'Variabilidad alta detectada. Reforzar control en mezclado y dosificación.',
        priority: 3
      });
    } else if (summary.averages.coefficientVariation <= 10) {
      recs.push({
        type: 'success',
        message: 'Excelente uniformidad de producción. Proceso muy controlado.',
        priority: 1
      });
    }

    if (summary.averages.rendimientoVolumetrico < 98) {
      recs.push({
        type: 'warning',
        message: 'Rendimiento volumétrico bajo. Verificar calibración y pérdidas en planta/obra.',
        priority: 2
      });
    }

    if (stats.nonCompliantTests > 0 && (stats.nonCompliantTests / stats.totalTests) > 0.05) {
      recs.push({
        type: 'warning',
        message: `${stats.nonCompliantTests} ensayos fuera de especificación. Revisar causas raíz.`,
        priority: 3
      });
    }

    return recs.sort((a, b) => b.priority - a.priority);
  }, [adjustedCompliance, summary, stats]);

  // Calculate risk assessment
  const riskLevel = useMemo(() => {
    let riskScore = 0;
    if (adjustedCompliance < 90) riskScore += 3;
    else if (adjustedCompliance < 95) riskScore += 2;
    else if (adjustedCompliance < 100) riskScore += 1;

    if (summary.averages.coefficientVariation > 20) riskScore += 3;
    else if (summary.averages.coefficientVariation > 15) riskScore += 2;
    else if (summary.averages.coefficientVariation > 10) riskScore += 1;

    if (stats.nonCompliantTests / stats.totalTests > 0.1) riskScore += 2;
    else if (stats.nonCompliantTests / stats.totalTests > 0.05) riskScore += 1;

    if (riskScore <= 2) return { level: 'Bajo', color: 'text-systemGreen', bg: 'bg-systemGreen/20' };
    if (riskScore <= 4) return { level: 'Moderado', color: 'text-systemOrange', bg: 'bg-systemOrange/20' };
    return { level: 'Alto', color: 'text-systemRed', bg: 'bg-systemRed/20' };
  }, [adjustedCompliance, summary, stats]);

  // Prepare compliance distribution chart data
  const complianceDistribution = useMemo(() => {
    const ranges = [
      { range: '< 85%', min: 0, max: 85, count: 0, color: '#ef4444' },
      { range: '85-90%', min: 85, max: 90, count: 0, color: '#f59e0b' },
      { range: '90-95%', min: 90, max: 95, count: 0, color: '#eab308' },
      { range: '95-100%', min: 95, max: 100, count: 0, color: '#3b82f6' },
      { range: '100-105%', min: 100, max: 105, count: 0, color: '#22c55e' },
      { range: '> 105%', min: 105, max: 999, count: 0, color: '#10b981' }
    ];

    data.remisiones.forEach(r => {
      r.muestreos.forEach(m => {
        m.muestras.forEach(mu => {
          mu.ensayos
            .filter(e => e.isEdadGarantia && !e.isEnsayoFueraTiempo)
            .forEach(e => {
              const comp = (e.porcentajeCumplimiento || 0) * factor;
              const range = ranges.find(r => comp >= r.min && comp < r.max);
              if (range) range.count++;
            });
        });
      });
    });

    return ranges.filter(r => r.count > 0);
  }, [data, factor]);

  return (
    <div className="space-y-6">
      {/* Analysis Header */}
      <div className="glass-thick rounded-3xl p-6">
        <h2 className="text-title-2 font-semibold text-label-primary mb-2">
          Análisis Avanzado de Calidad
        </h2>
        <p className="text-body text-label-secondary">
          Insights profundos, tendencias y recomendaciones basadas en datos del período seleccionado
        </p>
      </div>

      {/* Key Insights Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Risk Assessment */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`glass-thick rounded-3xl p-6 border-2 ${riskLevel.bg} border-current`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-2xl ${riskLevel.bg}`}>
              <AlertCircle className={`w-6 h-6 ${riskLevel.color}`} />
            </div>
            <h3 className="text-title-3 font-semibold text-label-primary">
              Nivel de Riesgo
            </h3>
          </div>
          <p className={`text-title-1 font-bold ${riskLevel.color} mb-2`}>
            {riskLevel.level}
          </p>
          <p className="text-footnote text-label-secondary">
            Evaluación basada en cumplimiento, variabilidad y ensayos fuera de especificación
          </p>
        </motion.div>

        {/* Trend Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`glass-thick rounded-3xl p-6 ${
            trend === 'improving' 
              ? 'bg-gradient-to-br from-systemGreen/20 to-systemGreen/5 border-2 border-systemGreen/30'
              : trend === 'declining'
              ? 'bg-gradient-to-br from-systemOrange/20 to-systemOrange/5 border-2 border-systemOrange/30'
              : 'bg-gradient-to-br from-systemBlue/20 to-systemBlue/5 border-2 border-systemBlue/30'
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            {trend === 'improving' ? (
              <ArrowUpRight className="w-6 h-6 text-systemGreen" />
            ) : trend === 'declining' ? (
              <ArrowDownRight className="w-6 h-6 text-systemOrange" />
            ) : (
              <Minus className="w-6 h-6 text-systemBlue" />
            )}
            <h3 className="text-title-3 font-semibold text-label-primary">
              Tendencia
            </h3>
          </div>
          <p className={`text-title-1 font-bold ${
            trend === 'improving' ? 'text-systemGreen' :
            trend === 'declining' ? 'text-systemOrange' :
            'text-systemBlue'
          } mb-2`}>
            {trend === 'improving' ? 'Mejorando' :
             trend === 'declining' ? 'Decreciendo' :
             'Estable'}
          </p>
          {monthlyTrends && (
            <p className="text-footnote text-label-secondary">
              {monthlyTrends.complianceChange > 0 ? '+' : ''}{monthlyTrends.complianceChange.toFixed(1)}% vs mes anterior
            </p>
          )}
        </motion.div>

        {/* Overall Performance Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-thick rounded-3xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-systemBlue/20">
              <Target className="w-6 h-6 text-systemBlue" />
            </div>
            <h3 className="text-title-3 font-semibold text-label-primary">
              Puntuación General
            </h3>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className={`text-title-1 font-bold ${
              adjustedCompliance >= 100 ? 'text-systemGreen' :
              adjustedCompliance >= 95 ? 'text-systemBlue' :
              adjustedCompliance >= 90 ? 'text-systemOrange' :
              'text-systemRed'
            }`}>
              {adjustedCompliance.toFixed(1)}
            </p>
            <span className="text-callout text-label-secondary">/ 100</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                adjustedCompliance >= 100 ? 'bg-systemGreen' :
                adjustedCompliance >= 95 ? 'bg-systemBlue' :
                adjustedCompliance >= 90 ? 'bg-systemOrange' :
                'bg-systemRed'
              }`}
              style={{ width: `${Math.min(adjustedCompliance, 100)}%` }}
            />
          </div>
          <p className="text-footnote text-label-secondary">
            Basado en cumplimiento, uniformidad y control de calidad
          </p>
        </motion.div>
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

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-thick rounded-3xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-systemPurple/20">
              <Lightbulb className="w-6 h-6 text-systemPurple" />
            </div>
            <h3 className="text-title-3 font-semibold text-label-primary">
              Recomendaciones Accionables
            </h3>
          </div>
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-4 rounded-xl border ${
                  rec.type === 'success'
                    ? 'bg-systemGreen/10 border-systemGreen/20'
                    : rec.type === 'warning'
                    ? 'bg-systemOrange/10 border-systemOrange/20'
                    : 'bg-systemBlue/10 border-systemBlue/20'
                }`}
              >
                {rec.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-systemGreen flex-shrink-0 mt-0.5" />
                ) : rec.type === 'warning' ? (
                  <AlertCircle className="w-5 h-5 text-systemOrange flex-shrink-0 mt-0.5" />
                ) : (
                  <Lightbulb className="w-5 h-5 text-systemBlue flex-shrink-0 mt-0.5" />
                )}
                <p className="text-callout text-label-primary flex-1">
                  {rec.message}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Compliance Distribution Chart */}
      {complianceDistribution.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-thick rounded-3xl p-6"
        >
          <h3 className="text-title-3 font-semibold text-label-primary mb-4">
            Distribución de Cumplimiento
          </h3>
          <QualityChart
            type="compliance-distribution"
            data={complianceDistribution}
            height={300}
            showLegend={true}
          />
        </motion.div>
      )}

      {/* Recipe Performance Breakdown */}
      {recipePerformance.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-thick rounded-3xl p-6"
        >
          <h3 className="text-title-3 font-semibold text-label-primary mb-4">
            Desempeño por Receta
          </h3>
          <div className="space-y-3">
            {recipePerformance.map((recipe, idx) => (
              <div key={idx} className="p-4 rounded-xl glass-thin border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-callout font-semibold text-label-primary">
                      {recipe.recipeCode}
                    </p>
                    <p className="text-footnote text-label-secondary">
                      f'c: {recipe.recipeFc} kg/cm² • {recipe.count} remisiones
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-callout font-bold ${
                      recipe.avgCompliance >= 100 ? 'text-systemGreen' :
                      recipe.avgCompliance >= 95 ? 'text-systemBlue' :
                      'text-systemOrange'
                    }`}>
                      {(recipe.avgCompliance * factor).toFixed(1)}%
                    </p>
                    <p className="text-footnote text-label-secondary">
                      {recipe.avgResistance.toFixed(0)} kg/cm²
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full ${
                      recipe.avgCompliance >= 100 ? 'bg-systemGreen' :
                      recipe.avgCompliance >= 95 ? 'bg-systemBlue' :
                      'bg-systemOrange'
                    }`}
                    style={{ width: `${Math.min(recipe.avgCompliance * factor, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Statistical Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Compliance Statistics */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
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
                adjustedCompliance >= 95 ? 'text-systemGreen' : 
                adjustedCompliance >= 85 ? 'text-systemOrange' : 
                'text-systemRed'
              }`}>
                {adjustedCompliance.toFixed(1)}%
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
          transition={{ delay: 0.8 }}
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
                {(stats.avgResistance * factor).toFixed(0)} kg/cm²
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
    </div>
  );
}

export default QualityAnalysis;

