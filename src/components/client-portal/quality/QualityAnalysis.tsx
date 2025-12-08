'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, BarChart2, PieChart, Target, Shield, Award, CheckCircle2, ArrowUpRight, ArrowDownRight, Minus, Activity, Eye, TestTube } from 'lucide-react';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';
import { calculateQualityStats, getQualityTrend, ENSAYO_ADJUSTMENT_FACTOR } from '@/lib/qualityHelpers';

interface QualityAnalysisProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export function QualityAnalysis({ data, summary }: QualityAnalysisProps) {
  const stats = calculateQualityStats(data);
  const trend = getQualityTrend(data);
  const factor = ENSAYO_ADJUSTMENT_FACTOR;
  // Match dashboard calculation: multiply by factor to show adjusted compliance
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

  // Calculate recipe performance breakdown (using adjusted values to match dashboard)
  const recipePerformance = useMemo(() => {
    const recipeMap = new Map<string, {
      recipeCode: string;
      recipeFc: number;
      count: number;
      totalCompliance: number;
      totalResistance: number;
      complianceCount: number;
      resistanceCount: number;
    }>();

    data.remisiones.forEach(remision => {
      const key = remision.recipeCode || 'N/A';
      if (!recipeMap.has(key)) {
        recipeMap.set(key, {
          recipeCode: key,
          recipeFc: remision.recipeFc || 0,
          count: 0,
          totalCompliance: 0,
          totalResistance: 0,
          complianceCount: 0,
          resistanceCount: 0
        });
      }

      const recipe = recipeMap.get(key)!;
      recipe.count += 1;

      // Get valid ensayos (edad garantia, not fuera de tiempo)
      const validEnsayos = remision.muestreos.flatMap(m =>
        m.muestras.flatMap(mu =>
          mu.ensayos.filter(e =>
            e.isEdadGarantia && 
            !e.isEnsayoFueraTiempo && 
            (e.resistenciaCalculada || 0) > 0 &&
            (e.porcentajeCumplimiento || 0) > 0
          )
        )
      );

      // Calculate adjusted values (matching dashboard calculation)
      validEnsayos.forEach(e => {
        const adjustedResistance = (e.resistenciaCalculada || 0) * factor;
        const adjustedCompliance = adjustedResistance > 0 && recipe.recipeFc > 0
          ? (adjustedResistance / recipe.recipeFc) * 100
          : (e.porcentajeCumplimiento || 0) * factor;
        
        recipe.totalResistance += adjustedResistance;
        recipe.resistanceCount += 1;
        recipe.totalCompliance += adjustedCompliance;
        recipe.complianceCount += 1;
      });
    });

    return Array.from(recipeMap.values())
      .map(r => ({
        recipeCode: r.recipeCode,
        recipeFc: r.recipeFc,
        count: r.count,
        avgCompliance: r.complianceCount > 0 ? r.totalCompliance / r.complianceCount : 0,
        avgResistance: r.resistanceCount > 0 ? r.totalResistance / r.resistanceCount : 0
      }))
      .filter(r => r.complianceCount > 0 && r.avgResistance > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [data.remisiones, factor]);

  // Calculate quality assurance level (confidence/assurance instead of risk)
  const qualityAssuranceLevel = useMemo(() => {
    let confidenceScore = 0;
    
    // Compliance contributes to confidence (using adjustedCompliance to match dashboard)
    if (adjustedCompliance >= 100) confidenceScore += 3;
    else if (adjustedCompliance >= 95) confidenceScore += 2;
    else if (adjustedCompliance >= 90) confidenceScore += 1;

    // Consistency (lower CV = higher confidence)
    if (summary.averages.coefficientVariation <= 10) confidenceScore += 3;
    else if (summary.averages.coefficientVariation <= 15) confidenceScore += 2;
    else if (summary.averages.coefficientVariation <= 20) confidenceScore += 1;

    // Test compliance rate - use adjustedCompliance to match dashboard
    if (adjustedCompliance >= 95) confidenceScore += 2;
    else if (adjustedCompliance >= 90) confidenceScore += 1;

    if (confidenceScore >= 7) return { 
      level: 'Excelente', 
      color: 'text-systemGreen', 
      bg: 'bg-systemGreen/20',
      description: 'Garantía de calidad sobresaliente'
    };
    if (confidenceScore >= 5) return { 
      level: 'Muy Alta', 
      color: 'text-systemBlue', 
      bg: 'bg-systemBlue/20',
      description: 'Alto nivel de confianza en calidad'
    };
    if (confidenceScore >= 3) return { 
      level: 'Alta', 
      color: 'text-systemBlue', 
      bg: 'bg-systemBlue/20',
      description: 'Nivel de confianza sólido'
    };
    return { 
      level: 'Buena', 
      color: 'text-systemOrange', 
      bg: 'bg-systemOrange/20',
      description: 'Calidad confiable'
    };
  }, [adjustedCompliance, summary, stats]);

  // Calculate testing coverage metrics based on orders and cubic meters frequency
  const testingMetrics = useMemo(() => {
    // Group remisiones by orderId to calculate order-based coverage
    const orderMap = new Map<string, {
      totalVolume: number;
      hasMuestreos: boolean;
    }>();

    // Calculate total volume and total muestreos globally
    let totalVolume = 0;
    let totalMuestreos = 0;

    data.remisiones.forEach(remision => {
      const orderId = remision.orderId || 'unknown';
      if (!orderMap.has(orderId)) {
        orderMap.set(orderId, {
          totalVolume: 0,
          hasMuestreos: false
        });
      }
      
      const orderData = orderMap.get(orderId)!;
      orderData.totalVolume += remision.volume || 0;
      totalVolume += remision.volume || 0;
      
      // Check if remision has any muestreos (sampling events)
      if (remision.muestreos && remision.muestreos.length > 0) {
        orderData.hasMuestreos = true;
        // Count all muestreos (sampling events)
        remision.muestreos.forEach(m => {
          if (m.muestras && m.muestras.length > 0) {
            totalMuestreos += 1;
          }
        });
      }
    });

    // Calculate global sampling frequency: total volume / total muestreos
    // This gives us "sampling every X cubic meters on average"
    const averageSamplingFrequency = totalMuestreos > 0
      ? totalVolume / totalMuestreos
      : 0;

    // Calculate order coverage: percentage of orders that have at least one muestreo
    const totalOrders = orderMap.size;
    const ordersWithMuestreos = Array.from(orderMap.values()).filter(o => o.hasMuestreos).length;
    const ordersSampledPct = totalOrders > 0 
      ? (ordersWithMuestreos / totalOrders) * 100 
      : 0;

    // Calculate average tests per remision
    const totalRemisiones = summary.totals.remisiones || 0;
    const avgTestsPerRemision = totalRemisiones > 0 
      ? (stats.totalTests / totalRemisiones) 
      : 0;

    return {
      averageSamplingFrequency,
      ordersSampledPct,
      avgTestsPerRemision,
      totalTests: stats.totalTests,
      // Use adjustedCompliance to match dashboard (multiplied by factor)
      compliantRate: adjustedCompliance
    };
  }, [data, summary, stats]);

  // Calculate uniformity score (inverted CV for positive framing)
  const uniformityScore = useMemo(() => {
    const cv = summary.averages.coefficientVariation || 0;
    // Lower CV = higher score (max score 100 when CV is 0)
    // Score decreases as CV increases
    let score = 100;
    if (cv <= 10) score = 100;
    else if (cv <= 15) score = 90;
    else if (cv <= 20) score = 75;
    else if (cv <= 25) score = 60;
    else score = Math.max(40, 100 - (cv * 2));

    let level = 'Excelente';
    if (cv <= 10) level = 'Excelente';
    else if (cv <= 15) level = 'Muy Buena';
    else if (cv <= 20) level = 'Buena';
    else level = 'Aceptable';

    return { score, level, cv };
  }, [summary.averages.coefficientVariation]);


  return (
    <div className="space-y-6">
      {/* Analysis Header */}
      <div className="glass-thick rounded-3xl p-6">
        <h2 className="text-title-2 font-semibold text-label-primary mb-2">
          Garantía de Calidad
        </h2>
        <p className="text-body text-label-secondary">
          Indicadores de confianza, desempeño y transparencia en el control de calidad de su concreto
        </p>
      </div>

      {/* Key Insights Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quality Assurance Level */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`glass-thick rounded-3xl p-6 border-2 ${qualityAssuranceLevel.bg} border-current`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-2xl ${qualityAssuranceLevel.bg}`}>
              <Shield className={`w-6 h-6 ${qualityAssuranceLevel.color}`} />
            </div>
            <h3 className="text-title-3 font-semibold text-label-primary">
              Nivel de Confianza
            </h3>
          </div>
          <p className={`text-title-1 font-bold ${qualityAssuranceLevel.color} mb-2`}>
            {qualityAssuranceLevel.level}
          </p>
          <p className="text-footnote text-label-secondary">
            {qualityAssuranceLevel.description}
          </p>
        </motion.div>

        {/* Performance Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`glass-thick rounded-3xl p-6 ${
            trend === 'improving' 
              ? 'bg-gradient-to-br from-systemGreen/20 to-systemGreen/5 border-2 border-systemGreen/30'
              : trend === 'declining'
              ? 'bg-gradient-to-br from-systemBlue/20 to-systemBlue/5 border-2 border-systemBlue/30'
              : 'bg-gradient-to-br from-systemBlue/20 to-systemBlue/5 border-2 border-systemBlue/30'
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            {trend === 'improving' ? (
              <TrendingUp className="w-6 h-6 text-systemGreen" />
            ) : (
              <Activity className="w-6 h-6 text-systemBlue" />
            )}
            <h3 className="text-title-3 font-semibold text-label-primary">
              Desempeño
            </h3>
          </div>
          <p className={`text-title-1 font-bold ${
            trend === 'improving' ? 'text-systemGreen' :
            'text-systemBlue'
          } mb-2`}>
            {trend === 'improving' ? 'Mejora Continua' :
             trend === 'declining' ? 'Consistente' :
             'Estable y Confiable'}
          </p>
          {monthlyTrends && (
            <p className="text-footnote text-label-secondary">
              {monthlyTrends.complianceChange > 0 
                ? `+${monthlyTrends.complianceChange.toFixed(1)}% mejora vs mes anterior`
                : 'Desempeño consistente en el tiempo'}
            </p>
          )}
        </motion.div>

        {/* Compliance Achievement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-thick rounded-3xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-systemGreen/20">
              <Award className="w-6 h-6 text-systemGreen" />
            </div>
            <h3 className="text-title-3 font-semibold text-label-primary">
              Cumplimiento
            </h3>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className={`text-title-1 font-bold ${
              adjustedCompliance >= 100 ? 'text-systemGreen' :
              adjustedCompliance >= 95 ? 'text-systemBlue' :
              adjustedCompliance >= 90 ? 'text-systemBlue' :
              'text-systemOrange'
            }`}>
              {adjustedCompliance.toFixed(1)}%
            </p>
            <span className="text-callout text-label-secondary">de especificación</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                adjustedCompliance >= 100 ? 'bg-systemGreen' :
                adjustedCompliance >= 95 ? 'bg-systemBlue' :
                adjustedCompliance >= 90 ? 'bg-systemBlue' :
                'bg-systemOrange'
              }`}
              style={{ width: `${Math.min(adjustedCompliance, 100)}%` }}
            />
          </div>
          <p className="text-footnote text-label-secondary">
            {adjustedCompliance >= 100 
              ? 'Excelencia: Cumplimiento total de especificaciones'
              : adjustedCompliance >= 95
              ? 'Sobresaliente: Cumplimiento superior al estándar'
              : 'Cumplimiento dentro de parámetros establecidos'}
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

      {/* Performance Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-thick rounded-3xl p-6"
      >
        <h3 className="text-title-3 font-semibold text-label-primary mb-4">
          Indicadores de Desempeño
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-2xl border ${
            trend === 'improving' 
              ? 'bg-gradient-to-br from-systemGreen/20 to-systemGreen/5 border-systemGreen/30'
              : 'bg-gradient-to-br from-systemBlue/20 to-systemBlue/5 border-systemBlue/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {trend === 'improving' ? (
                <TrendingUp className="w-5 h-5 text-systemGreen" />
              ) : (
                <Activity className="w-5 h-5 text-systemBlue" />
              )}
              <span className="text-caption font-medium text-label-secondary">
                Tendencia de Calidad
              </span>
            </div>
            <p className={`text-title-2 font-bold ${
              trend === 'improving' ? 'text-systemGreen' :
              'text-systemBlue'
            }`}>
              {trend === 'improving' ? 'Mejora Continua' :
               trend === 'declining' ? 'Consistente' :
               'Estable y Confiable'}
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              {trend === 'improving' ? 'Mejora continua evidenciada en el tiempo' :
               trend === 'declining' ? 'Desempeño consistente y confiable' :
               'Calidad estable y predecible'}
            </p>
          </div>

          <div className={`p-4 rounded-2xl border ${
            uniformityScore.level === 'Excelente' || uniformityScore.level === 'Muy Buena'
              ? 'bg-gradient-to-br from-systemGreen/20 to-systemGreen/5 border-systemGreen/30'
              : 'bg-gradient-to-br from-systemBlue/20 to-systemBlue/5 border-systemBlue/20'
          }`}>
            <p className="text-caption font-medium text-label-secondary mb-2">
              Uniformidad de Producción
            </p>
            <p className={`text-title-2 font-bold ${
              uniformityScore.level === 'Excelente' ? 'text-systemGreen' : 
              uniformityScore.level === 'Muy Buena' ? 'text-systemBlue' :
              'text-systemBlue'
            }`}>
              {uniformityScore.level}
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              CV: {uniformityScore.cv.toFixed(1)}% - {uniformityScore.level === 'Excelente' 
                ? 'Consistencia excepcional'
                : uniformityScore.level === 'Muy Buena'
                ? 'Alta consistencia en producción'
                : 'Consistencia confiable'}
            </p>
          </div>

          <div className={`p-4 rounded-2xl border ${
            adjustedCompliance >= 95
              ? 'bg-gradient-to-br from-systemGreen/20 to-systemGreen/5 border-systemGreen/30'
              : adjustedCompliance >= 90
              ? 'bg-gradient-to-br from-systemBlue/20 to-systemBlue/5 border-systemBlue/20'
              : 'glass-thin border-white/10'
          }`}>
            <p className="text-caption font-medium text-label-secondary mb-2">
              Confiabilidad de Ensayos
            </p>
            <p className={`text-title-2 font-bold ${
              adjustedCompliance >= 95 ? 'text-systemGreen' : 
              adjustedCompliance >= 90 ? 'text-systemBlue' :
              'text-systemBlue'
            }`}>
              {adjustedCompliance.toFixed(1)}%
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              {adjustedCompliance >= 95 
                ? 'Excelencia en cumplimiento de especificaciones'
                : 'Confiabilidad dentro de parámetros aceptables'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Transparency & Trust */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-thick rounded-3xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-systemPurple/20">
            <Eye className="w-6 h-6 text-systemPurple" />
          </div>
          <h3 className="text-title-3 font-semibold text-label-primary">
            Transparencia y Control de Calidad
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Testing Frequency */}
          <div className="p-4 rounded-2xl glass-thin border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <TestTube className="w-5 h-5 text-systemBlue" />
              <span className="text-caption font-medium text-label-secondary">
                Frecuencia de Ensayos
              </span>
            </div>
            <p className="text-title-2 font-bold text-label-primary">
              {testingMetrics.avgTestsPerRemision.toFixed(1)}
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              Ensayos promedio por remisión - Control riguroso de calidad
            </p>
          </div>

          {/* Order Coverage */}
          <div className="p-4 rounded-2xl glass-thin border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-systemGreen" />
              <span className="text-caption font-medium text-label-secondary">
                Cobertura de Pedidos
              </span>
            </div>
            <p className={`text-title-2 font-bold ${
              testingMetrics.ordersSampledPct >= 80 ? 'text-systemGreen' : 
              testingMetrics.ordersSampledPct >= 60 ? 'text-systemBlue' :
              'text-systemOrange'
            }`}>
              {testingMetrics.ordersSampledPct.toFixed(1)}%
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              {testingMetrics.ordersSampledPct >= 80 
                ? 'Excelente cobertura de pedidos'
                : 'Porcentaje de pedidos con control de calidad'}
            </p>
          </div>

          {/* Total Tests */}
          <div className="p-4 rounded-2xl glass-thin border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-systemPurple" />
              <span className="text-caption font-medium text-label-secondary">
                Total de Ensayos Realizados
              </span>
            </div>
            <p className="text-title-2 font-bold text-label-primary">
              {testingMetrics.totalTests}
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              Ensayos de resistencia realizados en el período - Máxima transparencia
            </p>
          </div>
        </div>
      </motion.div>

      {/* Quality Assurance Highlights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-thick rounded-3xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-systemBlue/20">
            <CheckCircle2 className="w-6 h-6 text-systemBlue" />
          </div>
          <h3 className="text-title-3 font-semibold text-label-primary">
            Indicadores de Garantía de Calidad
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sampling Frequency */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-systemBlue/20 to-systemBlue/5 border border-systemBlue/30">
            <div className="flex items-center gap-2 mb-2">
              <TestTube className="w-5 h-5 text-systemBlue" />
              <span className="text-caption font-medium text-label-secondary">
                Frecuencia de Muestreo
              </span>
            </div>
            <p className={`text-title-2 font-bold ${
              testingMetrics.averageSamplingFrequency > 0 && testingMetrics.averageSamplingFrequency <= 100 
                ? 'text-systemGreen' : 
              testingMetrics.averageSamplingFrequency > 0 && testingMetrics.averageSamplingFrequency <= 150
                ? 'text-systemBlue' :
              'text-systemOrange'
            }`}>
              {testingMetrics.averageSamplingFrequency > 0 
                ? `${testingMetrics.averageSamplingFrequency.toFixed(0)} m³`
                : 'N/A'}
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              {testingMetrics.averageSamplingFrequency > 0
                ? `Muestreo cada ${testingMetrics.averageSamplingFrequency.toFixed(0)} m³ en promedio`
                : 'Datos de muestreo no disponibles'}
            </p>
          </div>

          {/* Compliance Achievement */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-systemGreen/20 to-systemGreen/5 border border-systemGreen/30">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-systemGreen" />
              <span className="text-caption font-medium text-label-secondary">
                Cumplimiento de Especificaciones
              </span>
            </div>
            <p className={`text-title-2 font-bold ${
              adjustedCompliance >= 95 ? 'text-systemGreen' : 
              adjustedCompliance >= 90 ? 'text-systemBlue' :
              'text-systemOrange'
            }`}>
              {adjustedCompliance.toFixed(1)}%
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              {adjustedCompliance >= 95 
                ? 'Excelencia en cumplimiento'
                : 'Cumplimiento dentro de parámetros establecidos'}
            </p>
          </div>

          {/* Uniformity Excellence */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-systemPurple/20 to-systemPurple/5 border border-systemPurple/30">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-systemPurple" />
              <span className="text-caption font-medium text-label-secondary">
                Uniformidad de Producción
              </span>
            </div>
            <p className={`text-title-2 font-bold ${
              uniformityScore.level === 'Excelente' ? 'text-systemGreen' : 
              uniformityScore.level === 'Muy Buena' ? 'text-systemBlue' :
              'text-systemOrange'
            }`}>
              {uniformityScore.level}
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              CV: {uniformityScore.cv.toFixed(1)}% - {uniformityScore.level === 'Excelente' 
                ? 'Consistencia excepcional'
                : uniformityScore.level === 'Muy Buena'
                ? 'Alta consistencia'
                : 'Consistencia confiable'}
            </p>
          </div>
        </div>
      </motion.div>


      {/* Recipe Performance Breakdown */}
      {recipePerformance.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="glass-thick rounded-3xl p-6"
        >
          <h3 className="text-title-3 font-semibold text-label-primary mb-2">
            Desempeño por Tipo de Concreto
          </h3>
          <p className="text-body text-label-secondary mb-4">
            Análisis de cumplimiento y resistencia promedio por receta utilizada en sus proyectos
          </p>
          <div className="space-y-3">
            {recipePerformance.map((recipe, idx) => (
              <div key={idx} className="p-4 rounded-xl glass-thin border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-callout font-semibold text-label-primary">
                      {recipe.recipeCode}
                    </p>
                    <p className="text-footnote text-label-secondary">
                      Resistencia especificada: {recipe.recipeFc} kg/cm² • {recipe.count} entregas
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-callout font-bold ${
                      recipe.avgCompliance >= 100 ? 'text-systemGreen' :
                      recipe.avgCompliance >= 95 ? 'text-systemBlue' :
                      'text-systemBlue'
                    }`}>
                      {recipe.avgCompliance.toFixed(1)}%
                    </p>
                    <p className="text-footnote text-label-secondary">
                      Resistencia promedio: {recipe.avgResistance.toFixed(0)} kg/cm²
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full ${
                      recipe.avgCompliance >= 100 ? 'bg-systemGreen' :
                      recipe.avgCompliance >= 95 ? 'bg-systemBlue' :
                      'bg-systemBlue'
                    }`}
                    style={{ width: `${Math.min(recipe.avgCompliance, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Compliance Statistics */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 }}
          className="glass-thick rounded-3xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-systemGreen/20">
              <BarChart2 className="w-6 h-6 text-systemGreen" />
            </div>
            <h3 className="text-title-3 font-semibold text-label-primary">
              Métricas de Cumplimiento
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-callout text-label-secondary">Cumplimiento Promedio</span>
              <span className={`text-callout font-bold ${
                adjustedCompliance >= 95 ? 'text-systemGreen' : 
                adjustedCompliance >= 90 ? 'text-systemBlue' : 
                'text-systemBlue'
              }`}>
                {adjustedCompliance.toFixed(1)}%
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-callout text-label-secondary">Cumplimiento Máximo</span>
              <span className="text-callout font-bold text-label-primary">
                {stats.maxCompliance.toFixed(1)}%
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-callout text-label-secondary">Variabilidad</span>
              <span className="text-callout font-bold text-label-primary">
                ±{stats.stdDevCompliance.toFixed(1)}%
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-callout text-label-secondary">Nivel de Consistencia</span>
              <span className={`text-callout font-bold ${
                stats.stdDevCompliance <= 5 ? 'text-systemGreen' :
                stats.stdDevCompliance <= 10 ? 'text-systemBlue' :
                'text-systemBlue'
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
          transition={{ delay: 1.0 }}
          className="glass-thick rounded-3xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-systemPurple/20">
              <PieChart className="w-6 h-6 text-systemPurple" />
            </div>
            <h3 className="text-title-3 font-semibold text-label-primary">
              Métricas de Resistencia
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-callout text-label-secondary">Resistencia Promedio</span>
              <span className="text-callout font-bold text-systemPurple">
                {stats.avgResistance > 0 ? (stats.avgResistance * factor).toFixed(0) : '0'} kg/cm²
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-callout text-label-secondary">Resistencia Máxima</span>
              <span className="text-callout font-bold text-label-primary">
                {stats.maxResistance.toFixed(0)} kg/cm²
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-callout text-label-secondary">Variabilidad</span>
              <span className="text-callout font-bold text-label-primary">
                ±{stats.stdDevResistance.toFixed(0)} kg/cm²
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-callout text-label-secondary">Total de Ensayos</span>
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

