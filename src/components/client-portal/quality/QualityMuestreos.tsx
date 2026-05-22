'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { List, BarChart3, Download, FileSpreadsheet } from 'lucide-react';
import MuestreoCard from './MuestreoCard';
import { QualityChartSection } from '@/components/quality/QualityChartSection';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';
import {
  hasEnsayos,
  calculateDailyAverage,
  processMuestreosForChart,
  resolveEnsayoResistenciaReportada,
  resolveEnsayoPorcentajeCumplimiento,
  calendarDateToChartMs,
} from '@/lib/qualityHelpers';
import type { DatoGraficoResistencia } from '@/types/quality';
import { toast } from 'sonner';
import { downloadClientPortalMuestreosExcel } from '@/lib/quality/muestreosExcelExport';

interface QualityMuestreosProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export function QualityMuestreos({ data, summary }: QualityMuestreosProps) {
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  
  // Process all muestreos from remisiones
  const allMuestreos = data.remisiones.flatMap(remision => 
    remision.muestreos.map(muestreo => {
      // Build adjusted ensayo fields per muestreo using recipe f'c
      const adjustedMuestras = (muestreo.muestras || []).map(m => {
        const adjEnsayos = (m.ensayos || []).map(e => {
          const resAdj = resolveEnsayoResistenciaReportada(e);
          const compAdj = resolveEnsayoPorcentajeCumplimiento(e, remision.recipeFc || 0);
          return {
            ...e,
            resistenciaCalculadaAjustada: resAdj,
            porcentajeCumplimientoAjustado: compAdj
          };
        });
        return { ...m, ensayos: adjEnsayos };
      });
      const allAdjEnsayos = adjustedMuestras.flatMap(m => m.ensayos);
      const avgCompAdj = allAdjEnsayos.length > 0
        ? allAdjEnsayos.reduce((s, e: any) => s + (e.porcentajeCumplimientoAjustado || 0), 0) / allAdjEnsayos.length
        : 0;
      const avgResAdj = allAdjEnsayos.length > 0
        ? allAdjEnsayos.reduce((s, e: any) => s + (e.resistenciaCalculadaAjustada || 0), 0) / allAdjEnsayos.length
        : 0;

      return {
        ...muestreo,
        muestras: adjustedMuestras,
        avgComplianceAjustado: avgCompAdj,
        avgResistanceAjustada: avgResAdj,
        remisionNumber: remision.remisionNumber,
        fecha: remision.fecha,
        constructionSite: remision.constructionSite,
        rendimientoVolumetrico: remision.rendimientoVolumetrico,
        volumenFabricado: remision.volume,
        recipeFc: remision.recipeFc,
        recipeCode: remision.recipeCode,
        // Use adjusted average for charts/summary in this component
        compliance: avgCompAdj
      };
    })
  ).sort((a, b) => {
    // Sort by date descending (most recent first)
    const dateA = new Date(a.fecha);
    const dateB = new Date(b.fecha);
    return dateB.getTime() - dateA.getTime();
  });

  const chartData = processMuestreosForChart(allMuestreos);
  const totalPages = Math.max(1, Math.ceil(allMuestreos.length / pageSize));
  const start = (page - 1) * pageSize;
  const visibleMuestreos = allMuestreos.slice(start, start + pageSize);

  // Prepare scatter chart data
  const datosGrafico: DatoGraficoResistencia[] = allMuestreos.flatMap((muestreo: any) =>
    (muestreo.muestras || []).flatMap((muestra: any) =>
      (muestra.ensayos || [])
        .filter((ensayo: any) => 
          ensayo.isEdadGarantia && 
          !ensayo.isEnsayoFueraTiempo && 
          (ensayo.resistenciaCalculada || ensayo.resistenciaCalculadaAjustada || 0) > 0 && 
          (ensayo.porcentajeCumplimiento || ensayo.porcentajeCumplimientoAjustado || 0) > 0
        )
        .map((ensayo: any) => {
          // Parse concrete_specs if it's a string
          let specs = muestreo.concrete_specs;
          if (typeof specs === 'string') {
            try {
              specs = JSON.parse(specs);
            } catch {
              specs = {};
            }
          }
          specs = specs || {};
          
          const valorEdad = specs.valor_edad;
          const unidadEdad = specs.unidad_edad;
          
          // Use raw valor_edad for edad field (same as internal dashboard ClientMuestreosCharts.tsx)
          // QualityChartSection groups by edadOriginal + unidadEdad, not by converted edad
          const edad = typeof valorEdad === 'number' && valorEdad > 0
            ? valorEdad
            : 28;
          
          const clasificacion = (specs.clasificacion as 'FC' | 'MR') || 'FC';
          
          // Find the remision this muestreo belongs to
          const remision = data.remisiones.find(r => 
            r.muestreos.some(m => m.id === muestreo.id)
          );
          
          return {
            x:
              calendarDateToChartMs(
                muestreo.fechaMuestreo || muestreo.fecha_muestreo || muestreo.fecha
              ) ?? Date.now(),
            y: ensayo.porcentajeCumplimientoAjustado || ensayo.porcentajeCumplimiento || 0,
            clasificacion,
            edad, // Raw valor_edad value (not converted)
            edadOriginal: valorEdad, // REQUIRED for QualityChartSection grouping
            unidadEdad: unidadEdad, // REQUIRED for QualityChartSection grouping
            fecha_ensayo: ensayo.fechaEnsayo || ensayo.fecha_ensayo,
            resistencia_calculada: ensayo.resistenciaCalculadaAjustada || ensayo.resistenciaCalculada,
            muestra: { muestreo, muestra, ensayo, remision }
          } as DatoGraficoResistencia;
        })
    )
  );

  // Extract unique construction sites
  const constructionSites = [...new Set(data.remisiones.map(r => r.constructionSite).filter(Boolean))];

  const exportToExcel = async () => {
    if (allMuestreos.length === 0) {
      toast.error('No hay muestreos para exportar');
      return;
    }

    const periodLabel =
      summary?.period?.from && summary?.period?.to
        ? `${summary.period.from} – ${summary.period.to}`
        : undefined;

    setIsExporting(true);
    try {
      await toast.promise(
        downloadClientPortalMuestreosExcel({
          clientName: data.clientInfo.business_name,
          periodLabel,
          muestreos: allMuestreos as import('@/lib/quality/muestreosExcelRows').ClientPortalMuestreoExport[],
        }),
        {
          loading: 'Preparando archivo Excel…',
          success: 'Archivo Excel descargado exitosamente',
          error: 'Error al generar el archivo Excel',
        }
      );
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with View Mode Toggle and Export Button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-title-2 font-semibold text-label-primary">
          Muestreos Realizados ({allMuestreos.length})
        </h2>
        
        <div className="flex items-center gap-3">
          {/* Export to Excel Button */}
          <motion.button
            onClick={exportToExcel}
            disabled={isExporting || allMuestreos.length === 0}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center gap-2.5 px-5 py-2.5 glass-interactive border-2 border-white/30 hover:border-white/50 rounded-2xl transition-all duration-300 font-semibold text-callout shadow-sm hover:shadow-md ${
              isExporting || allMuestreos.length === 0
                ? 'opacity-50 cursor-not-allowed'
                : 'text-systemGreen'
            }`}
          >
            {isExporting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Download className="w-5 h-5" />
                </motion.div>
                <span className="hidden sm:inline">Exportando...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-5 h-5" />
                <span className="hidden sm:inline">Exportar Excel</span>
                <span className="sm:hidden">Excel</span>
              </>
            )}
          </motion.button>

          {/* View Mode Toggle */}
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
              <span className="text-callout hidden sm:inline">Lista</span>
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
              <span className="text-callout hidden sm:inline">Gráfico</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'list' ? (
        allMuestreos.length > 0 ? (
          <div className="space-y-4">
            {visibleMuestreos.map((muestreo, index) => (
              <MuestreoCard 
                key={muestreo.id} 
                muestreo={muestreo} 
                index={index}
              />
            ))}
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`px-4 py-2 rounded-xl glass-thin hover:glass-interactive text-callout ${page === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Anterior
                </button>
                <div className="glass-thin rounded-xl px-3 py-2 text-footnote text-label-secondary">
                  Página {page} de {totalPages}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`px-4 py-2 rounded-xl glass-thin hover:glass-interactive text-callout ${page === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-thick rounded-3xl p-12 text-center">
            <p className="text-label-tertiary">No hay muestreos en el período seleccionado</p>
          </div>
        )
      ) : (
        <div>
          {datosGrafico.length > 0 ? (
            <QualityChartSection 
              datosGrafico={datosGrafico} 
              loading={false} 
              soloEdadGarantia={true} 
              constructionSites={constructionSites}
              useClientPortalAnalysis={true}
            />
          ) : (
            <div className="glass-thick rounded-3xl p-12 text-center">
              <p className="text-label-tertiary">Sin datos suficientes para el gráfico</p>
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

