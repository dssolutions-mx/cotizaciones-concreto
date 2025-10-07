// Helper functions for quality data processing and calculations

import type { ClientQualityRemisionData, ClientQualityData } from '@/types/clientQuality';

/**
 * Calculate if a muestreo has ensayos
 */
export function hasEnsayos(muestreo: any): boolean {
  return muestreo.muestras.some((m: any) => m.ensayos && m.ensayos.length > 0);
}

/**
 * Calculate average resistance from a muestreo
 */
export function calculateAvgResistance(muestreo: any): number {
  const allEnsayos = muestreo.muestras.flatMap((m: any) => m.ensayos || []);
  if (allEnsayos.length === 0) return 0;
  
  const sum = allEnsayos.reduce((acc: number, e: any) => acc + (e.resistenciaCalculada || 0), 0);
  return sum / allEnsayos.length;
}

/**
 * Calculate average compliance from a muestreo
 * IMPORTANT: Uses all edad_garantia ensayos (including fuera de tiempo)
 * Timing is tracked separately via onTimeTestingRate
 */
export function calculateMuestreoCompliance(muestreo: any): number {
  const validEnsayos = muestreo.muestras.flatMap((m: any) => m.ensayos || [])
    .filter((e: any) => 
      e.isEdadGarantia && 
      e.porcentajeCumplimiento !== null && 
      e.porcentajeCumplimiento !== undefined
    );
  
  if (validEnsayos.length === 0) return 0;
  
  const sum = validEnsayos.reduce((acc: number, e: any) => acc + (e.porcentajeCumplimiento || 0), 0);
  return sum / validEnsayos.length;
}

/**
 * Calculate daily average of muestreos
 */
export function calculateDailyAverage(muestreos: any[]): string {
  if (muestreos.length === 0) return '0';
  
  // Group by date
  const byDate = muestreos.reduce((acc: any, m: any) => {
    const date = new Date(m.fechaMuestreo).toDateString();
    if (!acc[date]) acc[date] = 0;
    acc[date]++;
    return acc;
  }, {});
  
  const dates = Object.keys(byDate);
  if (dates.length === 0) return '0';
  
  const total = Object.values(byDate).reduce((sum: number, count: any) => sum + count, 0);
  return (total / dates.length).toFixed(1);
}

/**
 * Process muestreos data for timeline chart
 */
export function processMuestreosForChart(muestreos: any[]): any[] {
  // Group by date
  const byDate = muestreos.reduce((acc: any, m: any) => {
    const date = new Date(m.fechaMuestreo).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = {
        date,
        muestreos: 0,
        rendimientoSum: 0,
        rendimientoCount: 0,
        cumplimientoSum: 0,
        cumplimientoCount: 0
      };
    }
    
    acc[date].muestreos++;
    
    if (m.rendimientoVolumetrico && m.rendimientoVolumetrico > 0) {
      acc[date].rendimientoSum += m.rendimientoVolumetrico;
      acc[date].rendimientoCount++;
    }
    
    if (m.compliance && m.compliance > 0) {
      acc[date].cumplimientoSum += m.compliance;
      acc[date].cumplimientoCount++;
    }
    
    return acc;
  }, {});
  
  // Convert to array and calculate averages
  return Object.values(byDate).map((day: any) => ({
    date: day.date,
    muestreos: day.muestreos,
    rendimiento: day.rendimientoCount > 0 ? day.rendimientoSum / day.rendimientoCount : 0,
    cumplimiento: day.cumplimientoCount > 0 ? day.cumplimientoSum / day.cumplimientoCount : 0
  }));
}

/**
 * Process compliance distribution for chart
 * IMPORTANT: Uses all edad_garantia ensayos (including fuera de tiempo)
 */
export function processComplianceDistribution(data: ClientQualityData): any[] {
  const allEnsayos = data.remisiones.flatMap(r => 
    r.muestreos.flatMap(m => 
      m.muestras.flatMap(mu => 
        mu.ensayos.filter(e => 
          e.isEdadGarantia && 
          e.porcentajeCumplimiento !== null &&
          e.porcentajeCumplimiento !== undefined
        )
      )
    )
  );
  
  const ranges = [
    { range: '< 70%', min: 0, max: 70, count: 0 },
    { range: '70-80%', min: 70, max: 80, count: 0 },
    { range: '80-90%', min: 80, max: 90, count: 0 },
    { range: '90-95%', min: 90, max: 95, count: 0 },
    { range: '95-100%', min: 95, max: 100, count: 0 },
    { range: '> 100%', min: 100, max: 999, count: 0 }
  ];
  
  allEnsayos.forEach(ensayo => {
    const comp = ensayo.porcentajeCumplimiento || 0;
    const range = ranges.find(r => comp >= r.min && comp < r.max);
    if (range) range.count++;
  });
  
  return ranges;
}

/**
 * Process resistance trend for chart
 */
export function processResistanceTrend(data: ClientQualityData): any[] {
  // Group by date
  const byDate = data.remisiones.reduce((acc: any, r: any) => {
    if (!r.avgResistencia || r.avgResistencia <= 0) return acc;
    
    const date = new Date(r.fecha).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = {
        date,
        resistenciaSum: 0,
        count: 0
      };
    }
    
    acc[date].resistenciaSum += r.avgResistencia;
    acc[date].count++;
    
    return acc;
  }, {});
  
  // Convert to array and calculate averages
  return Object.values(byDate).map((day: any) => ({
    date: day.date,
    resistencia: day.count > 0 ? day.resistenciaSum / day.count : 0
  })).sort((a: any, b: any) => a.date.localeCompare(b.date));
}

/**
 * Process volumetric percentage trend for chart
 * Normalizes data to avoid unrealistic values above 110%
 */
export function processVolumetricTrend(data: ClientQualityData): any[] {
  // Group by date, filtering out invalid values
  const byDate = data.remisiones.reduce((acc: any, r: any) => {
    // Skip invalid values: <= 0 or > 110%
    if (!r.rendimientoVolumetrico || 
        r.rendimientoVolumetrico <= 0 || 
        r.rendimientoVolumetrico > 110) {
      return acc;
    }
    
    const date = new Date(r.fecha).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = {
        date,
        rendimientoSum: 0,
        count: 0,
        values: []
      };
    }
    
    acc[date].rendimientoSum += r.rendimientoVolumetrico;
    acc[date].count++;
    acc[date].values.push(r.rendimientoVolumetrico);
    
    return acc;
  }, {});
  
  // Convert to array and calculate averages
  return Object.values(byDate).map((day: any) => ({
    date: day.date,
    rendimiento: day.count > 0 ? Math.min(day.rendimientoSum / day.count, 110) : 0
  })).sort((a: any, b: any) => a.date.localeCompare(b.date));
}

/**
 * Identify site checks (muestreos without ensayos)
 */
export function getSiteChecks(data: ClientQualityData): any[] {
  const siteChecks: any[] = [];
  
  data.remisiones.forEach(remision => {
    remision.muestreos.forEach(muestreo => {
      if (!hasEnsayos(muestreo)) {
        siteChecks.push({
          ...muestreo,
          remisionNumber: remision.remisionNumber,
          fecha: remision.fecha,
          constructionSite: remision.constructionSite,
          rendimientoVolumetrico: remision.rendimientoVolumetrico
        });
      }
    });
  });
  
  return siteChecks;
}

/**
 * Calculate quality statistics for analysis
 * IMPORTANT: Uses all edad_garantia ensayos (including fuera de tiempo)
 */
export function calculateQualityStats(data: ClientQualityData) {
  const allEnsayos = data.remisiones.flatMap(r => 
    r.muestreos.flatMap(m => 
      m.muestras.flatMap(mu => mu.ensayos.filter(e => e.isEdadGarantia))
    )
  );
  
  if (allEnsayos.length === 0) {
    return {
      totalTests: 0,
      compliantTests: 0,
      nonCompliantTests: 0,
      avgCompliance: 0,
      minCompliance: 0,
      maxCompliance: 0,
      avgResistance: 0,
      minResistance: 0,
      maxResistance: 0,
      stdDevCompliance: 0,
      stdDevResistance: 0
    };
  }
  
  const compliances = allEnsayos.map(e => e.porcentajeCumplimiento);
  const resistances = allEnsayos.map(e => e.resistenciaCalculada);
  
  const avgCompliance = compliances.reduce((sum, c) => sum + c, 0) / compliances.length;
  const avgResistance = resistances.reduce((sum, r) => sum + r, 0) / resistances.length;
  
  // Standard deviation
  const varianceCompliance = compliances.reduce((sum, c) => sum + Math.pow(c - avgCompliance, 2), 0) / compliances.length;
  const varianceResistance = resistances.reduce((sum, r) => sum + Math.pow(r - avgResistance, 2), 0) / resistances.length;
  
  return {
    totalTests: allEnsayos.length,
    compliantTests: allEnsayos.filter(e => e.porcentajeCumplimiento >= 95).length,
    nonCompliantTests: allEnsayos.filter(e => e.porcentajeCumplimiento < 85).length,
    avgCompliance,
    minCompliance: Math.min(...compliances),
    maxCompliance: Math.max(...compliances),
    avgResistance,
    minResistance: Math.min(...resistances),
    maxResistance: Math.max(...resistances),
    stdDevCompliance: Math.sqrt(varianceCompliance),
    stdDevResistance: Math.sqrt(varianceResistance)
  };
}

/**
 * Get quality trend direction
 * Optimized to highlight positive performance and stability
 */
export function getQualityTrend(data: ClientQualityData): 'improving' | 'declining' | 'stable' {
  const remisionesWithCompliance = data.remisiones
    .filter(r => r.avgCompliance !== undefined && r.avgCompliance > 0)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  
  if (remisionesWithCompliance.length < 3) {
    // If limited data but good compliance, show as improving
    const avgCompliance = remisionesWithCompliance.reduce((sum, r) => sum + (r.avgCompliance || 0), 0) / remisionesWithCompliance.length;
    return avgCompliance >= 95 ? 'improving' : 'stable';
  }
  
  // Compare first third vs last third with enhanced sensitivity for improvements
  const thirdSize = Math.floor(remisionesWithCompliance.length / 3);
  const firstThird = remisionesWithCompliance.slice(0, thirdSize);
  const lastThird = remisionesWithCompliance.slice(-thirdSize);
  
  const avgFirst = firstThird.reduce((sum, r) => sum + (r.avgCompliance || 0), 0) / firstThird.length;
  const avgLast = lastThird.reduce((sum, r) => sum + (r.avgCompliance || 0), 0) / lastThird.length;
  
  const difference = avgLast - avgFirst;
  
  // More sensitive to improvements, less sensitive to declines
  // If consistently high performance (>95%), show as improving even with slight variations
  if (difference > 0.5 || (avgLast >= 95 && avgFirst >= 95)) return 'improving';
  if (difference < -3) return 'declining'; // Only show declining if significant drop
  return 'stable';
}

