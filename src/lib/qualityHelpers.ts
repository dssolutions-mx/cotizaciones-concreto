// Helper functions for quality data processing and calculations

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/parseLocalDate';
import type { ClientQualityRemisionData, ClientQualityData } from '@/types/clientQuality';

/** Shape accepted from API (camelCase or snake_case). */
export type EnsayoResistenciaFields = {
  resistencia_calculada?: number | null;
  resistenciaCalculada?: number | null;
  resistencia_corregida?: number | null;
  resistenciaCorregida?: number | null;
  factor_correccion?: number | null;
  factorCorreccion?: number | null;
  porcentaje_cumplimiento?: number | null;
  porcentajeCumplimiento?: number | null;
};

/**
 * Strength from the test only (`resistencia_calculada`), without correction factor.
 * Used on ISO 7.8 informes where reported fc must not include the shape factor.
 */
export function resolveEnsayoResistenciaSinFactor(e: EnsayoResistenciaFields): number {
  const base = Number(e.resistencia_calculada ?? e.resistenciaCalculada);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.round(base * 100) / 100;
}

/**
 * Reported strength for an ensayo: prefer persisted `resistencia_corregida`, else raw × factor.
 */
export function resolveEnsayoResistenciaReportada(e: EnsayoResistenciaFields): number {
  const corrected = Number(e.resistencia_corregida ?? e.resistenciaCorregida);
  if (Number.isFinite(corrected) && corrected > 0) {
    return Math.round(corrected * 100) / 100;
  }
  const base = Number(e.resistencia_calculada ?? e.resistenciaCalculada) || 0;
  if (base <= 0) return 0;
  const f = Number(e.factor_correccion ?? e.factorCorreccion);
  const factor = Number.isFinite(f) && f > 0 ? f : 1;
  return Math.round(base * factor * 100) / 100;
}

/**
 * Compliance % from DB when present (already accounts for correction + age rules server-side).
 * Otherwise linear vs f'c from reported resistance.
 */
export function resolveEnsayoPorcentajeCumplimiento(e: EnsayoResistenciaFields, recipeFc?: number): number {
  const rawPct = e.porcentaje_cumplimiento ?? e.porcentajeCumplimiento;
  if (rawPct != null && rawPct !== undefined && Number.isFinite(Number(rawPct))) {
    return Number(rawPct);
  }
  const r = resolveEnsayoResistenciaReportada(e);
  return recomputeEnsayoCompliance(r, recipeFc || 0);
}

/**
 * @deprecated Use resolveEnsayoResistenciaReportada with the full ensayo object from the API.
 * Passing only a number returns raw strength (no client-side factor).
 */
export function adjustEnsayoResistencia(
  resistenciaCalculada: number,
  ensayo?: EnsayoResistenciaFields
): number {
  if (ensayo) {
    return resolveEnsayoResistenciaReportada({
      ...ensayo,
      resistenciaCalculada: resistenciaCalculada ?? ensayo.resistenciaCalculada,
    });
  }
  const value = Number(resistenciaCalculada) || 0;
  return value > 0 ? value : 0;
}

/**
 * Linear compliance vs f'c (fallback when DB % is missing).
 */
export function recomputeEnsayoCompliance(resistenciaAjustada: number, recipeFc: number): number {
  const fc = Number(recipeFc) || 0;
  if (fc <= 0) return 0;
  const r = Number(resistenciaAjustada) || 0;
  if (r <= 0) return 0;
  return (r / fc) * 100;
}

/**
 * Returns a shallow-cloned muestreo with adjusted ensayo fields and averages.
 * Uses DB-corrected resistance and compliance when available.
 */
export function mapMuestreoWithAdjustment(muestreo: any, recipeFc?: number) {
  const cloned = { ...muestreo };
  let sumRes = 0;
  let sumComp = 0;
  let count = 0;
  cloned.muestras = (muestreo.muestras || []).map((m: any) => {
    const ensayos = (m.ensayos || []).map((e: any) => {
      const resAdj = resolveEnsayoResistenciaReportada(e);
      const compAdj = resolveEnsayoPorcentajeCumplimiento(e, recipeFc || 0);
      if (resAdj > 0) {
        sumRes += resAdj;
        count += 1;
      }
      if (compAdj > 0) {
        sumComp += compAdj;
      }
      return {
        ...e,
        resistenciaCalculadaAjustada: resAdj,
        porcentajeCumplimientoAjustado: compAdj
      };
    });
    return { ...m, ensayos };
  });
  const avgRes = count > 0 ? sumRes / count : 0;
  const avgComp = count > 0 ? sumComp / count : 0;
  return {
    ...cloned,
    avgResistanceAjustada: avgRes,
    avgComplianceAjustado: avgComp
  };
}

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

/** YYYY-MM-DD (or ISO date prefix) as calendar date — no UTC midnight shift. */
export function formatCalendarDateShort(
  dateInput: string | null | undefined,
  pattern = 'dd/MM/yyyy'
): string | null {
  if (!dateInput) return null;
  const day = String(dateInput).split('T')[0]?.trim();
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  try {
    return format(parseLocalDate(day), pattern, { locale: es });
  } catch {
    return null;
  }
}

/** Sampling date for display/export: prefers final calendar date from MV, not timestamp TZ. */
export function formatMuestreoDateShort(
  muestreo: Record<string, unknown> | null | undefined,
  pattern = 'dd/MM/yyyy'
): string | null {
  if (!muestreo) return null;
  const dStr = (muestreo.fechaMuestreo ?? muestreo.fecha_muestreo) as string | undefined;
  const fromCalendar = formatCalendarDateShort(dStr, pattern);
  if (fromCalendar) return fromCalendar;
  const hora = (muestreo.hora_muestreo as string | undefined) || '12:00:00';
  if (dStr) {
    const day = String(dStr).split('T')[0];
    try {
      return format(new Date(`${day}T${hora}`), pattern, { locale: es });
    } catch {
      return null;
    }
  }
  return null;
}

/** Ms at local noon for chart axes from a calendar sampling date. */
export function calendarDateToChartMs(dateInput: string | null | undefined): number | null {
  if (!dateInput) return null;
  const day = String(dateInput).split('T')[0]?.trim();
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = parseLocalDate(day);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

export function calculateDailyAverage(muestreos: any[]): string {
  if (muestreos.length === 0) return '0';
  
  // Group by date
  const byDate = muestreos.reduce((acc: any, m: any) => {
    const date =
      formatCalendarDateShort(m.fechaMuestreo ?? m.fecha_muestreo, 'yyyy-MM-dd') ?? 'unknown';
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
    const date =
      formatCalendarDateShort(m.fechaMuestreo ?? m.fecha_muestreo, 'yyyy-MM-dd') ?? 'unknown';
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
 * Process resistance trend for chart - Shows compliance percentage
 * Returns compliance percentage directly from ensayos
 * Includes ALL ensayos at edad_garantia (including fuera de tiempo)
 */
export function processResistanceTrend(data: ClientQualityData): any[] {
  // Group by date
  const byDate = data.remisiones.reduce((acc: any, r: any) => {
    const date = new Date(r.fecha).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = {
        date,
        compliances: [],
        resistencias: [],
        targets: []
      };
    }
    
    // Collect ALL ensayos at edad_garantia (including fuera de tiempo)
    const recipeFc = r.recipeFc || 0;
    r.muestreos.forEach((m: any) => {
      m.muestras.forEach((mu: any) => {
        mu.ensayos.forEach((e: any) => {
          // Include all ensayos at edad_garantia, regardless of timing
          if (e.isEdadGarantia && e.porcentajeCumplimiento !== null && e.porcentajeCumplimiento !== undefined) {
            const resAdj = resolveEnsayoResistenciaReportada(e);
            const compAdj = resolveEnsayoPorcentajeCumplimiento(e, recipeFc);
            acc[date].compliances.push(compAdj);
            
            // Also collect resistance and target for tooltip
            if (resAdj && resAdj > 0) {
              acc[date].resistencias.push(resAdj);
            }
            if (e.resistenciaEspecificada && e.resistenciaEspecificada > 0) {
              acc[date].targets.push(e.resistenciaEspecificada);
            }
          }
        });
      });
    });
    
    return acc;
  }, {});
  
  // Convert to simple array and filter to only show compliance >= 98%
  return Object.values(byDate)
    .filter((day: any) => day.compliances.length > 0)
    .map((day: any) => {
      const avgCompliance = day.compliances.reduce((sum: number, c: number) => sum + c, 0) / day.compliances.length;
      const avgResistencia = day.resistencias.length > 0
        ? day.resistencias.reduce((sum: number, r: number) => sum + r, 0) / day.resistencias.length
        : null;
      const avgTarget = day.targets.length > 0 
        ? day.targets.reduce((sum: number, t: number) => sum + t, 0) / day.targets.length 
        : null;
      
      return {
        date: day.date,
        cumplimiento: Math.round(avgCompliance * 10) / 10, // Main data - compliance %
        resistencia: avgResistencia ? Math.round(avgResistencia) : null,
        objetivo: avgTarget ? Math.round(avgTarget) : null,
        ensayos: day.compliances.length
      };
    })
    .filter((item: any) => item.cumplimiento >= 98) // Only show compliance >= 98%
    .sort((a: any, b: any) => a.date.localeCompare(b.date));
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
 * IMPORTANT: Only uses edad_garantia ensayos that are NOT fuera de tiempo
 * Ensayos fuera de tiempo should NOT count for compliance measurement
 */
export function calculateQualityStats(data: ClientQualityData) {
  const allEnsayos = data.remisiones.flatMap(r => 
    r.muestreos.flatMap(m => 
      m.muestras.flatMap(mu => mu.ensayos.filter(e => 
        e.isEdadGarantia && 
        !e.isEnsayoFueraTiempo &&
        (e.resistenciaCalculada || 0) > 0 &&
        (e.porcentajeCumplimiento || 0) > 0
      ))
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
  
  const compliances = allEnsayos.map(e => resolveEnsayoPorcentajeCumplimiento(e, 0));
  const resistances = allEnsayos.map(e => resolveEnsayoResistenciaReportada(e));
  
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

/** Sample specimen type → Spanish label (client portal). */
export function formatTipoMuestraLabel(tipo?: string | null): string {
  if (!tipo) return '—';
  const u = String(tipo).toUpperCase();
  if (u === 'CILINDRO') return 'Cilindro';
  if (u === 'CUBO') return 'Cubo';
  if (u === 'VIGA') return 'Viga';
  return tipo;
}

/** Instant (ms) when the muestreo was taken — aligns with ClientPointAnalysis. */
export function resolveMuestreoInstantMs(muestreo: Record<string, unknown> | null | undefined): number | null {
  if (!muestreo) return null;
  const ts = muestreo.fecha_muestreo_ts;
  if (typeof ts === 'string' && ts) {
    const t = new Date(ts).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const dStr = (muestreo.fechaMuestreo ?? muestreo.fecha_muestreo) as string | undefined;
  if (dStr) {
    const day = String(dStr).split('T')[0];
    const hora = (muestreo.hora_muestreo as string | undefined) || '12:00:00';
    const t = new Date(`${day}T${hora}`).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

/** Instant (ms) when the ensayo was run — aligns with ClientPointAnalysis. */
export function resolveEnsayoInstantMs(ensayo: Record<string, unknown> | null | undefined): number | null {
  if (!ensayo) return null;
  const ts = ensayo.fecha_ensayo_ts;
  if (typeof ts === 'string' && ts) {
    const t = new Date(ts).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const fechaEnsayo = (ensayo.fechaEnsayo ?? ensayo.fecha_ensayo) as string | undefined;
  if (fechaEnsayo) {
    const day = String(fechaEnsayo).split('T')[0];
    const hora = (ensayo.hora_ensayo as string | undefined) || '12:00:00';
    const t = new Date(`${day}T${hora}`).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

/**
 * Elapsed time from muestreo to ensayo, formatted for clients (horas if &lt; 24 h, else días).
 */
export function formatEdadAlEnsayoShort(muestreo: Record<string, unknown>, ensayo: Record<string, unknown>): string | null {
  const start = resolveMuestreoInstantMs(muestreo);
  const end = resolveEnsayoInstantMs(ensayo);
  if (start == null || end == null) return null;
  const diffMs = end - start;
  if (diffMs < 0) return null;
  const ageInHours = diffMs / (1000 * 60 * 60);
  const ageInDays = diffMs / (1000 * 60 * 60 * 24);
  if (ageInHours < 24) {
    const rounded = ageInHours < 2 ? ageInHours.toFixed(2) : ageInHours.toFixed(1);
    const n = Number(rounded);
    return `${rounded} ${n === 1 ? 'hora' : 'horas'}`;
  }
  const dayStr = ageInDays >= 10 ? ageInDays.toFixed(0) : ageInDays.toFixed(1);
  const dn = Number(dayStr);
  return `${dayStr} ${dn === 1 ? 'día' : 'días'}`;
}

export function formatEnsayoDateShort(ensayo: Record<string, unknown>): string | null {
  const fechaOnly = (ensayo.fechaEnsayo ?? ensayo.fecha_ensayo) as string | undefined;
  const fromCalendar = formatCalendarDateShort(fechaOnly);
  if (fromCalendar) return fromCalendar;
  const ms = resolveEnsayoInstantMs(ensayo);
  if (ms == null) return null;
  try {
    return format(new Date(ms), 'dd/MM/yyyy', { locale: es });
  } catch {
    return null;
  }
}

/** Recipe guarantee age from concrete_specs (valor_edad + unidad_edad). */
export function formatEdadGarantiaReceta(specs: unknown): string | null {
  if (!specs || typeof specs !== 'object') return null;
  const s = specs as Record<string, unknown>;
  const valorRaw = s.valor_edad ?? s.valorEdad;
  const unidadRaw = s.unidad_edad ?? s.unidadEdad;
  const v = typeof valorRaw === 'number' ? valorRaw : Number(valorRaw);
  if (!Number.isFinite(v) || v <= 0) return null;
  const u = String(unidadRaw || 'DÍA').toUpperCase();
  if (u === 'HORA' || u === 'H') return `${v} ${v === 1 ? 'hora' : 'horas'}`;
  if (u === 'DÍA' || u === 'D') return `${v} ${v === 1 ? 'día' : 'días'}`;
  return `${v} ${unidadRaw}`;
}

