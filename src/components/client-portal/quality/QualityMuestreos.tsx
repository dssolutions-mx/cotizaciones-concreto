'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { List, BarChart3, Download, FileSpreadsheet } from 'lucide-react';
import MuestreoCard from './MuestreoCard';
import { QualityChartSection } from '@/components/quality/QualityChartSection';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';
import { hasEnsayos, calculateDailyAverage, processMuestreosForChart, adjustEnsayoResistencia, recomputeEnsayoCompliance } from '@/lib/qualityHelpers';
import type { DatoGraficoResistencia } from '@/types/quality';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

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
          const resAdj = adjustEnsayoResistencia(e.resistenciaCalculada || 0);
          const compAdj = recomputeEnsayoCompliance(resAdj, remision.recipeFc || 0);
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
          const specs = muestreo.concrete_specs || {};
          const edad = typeof specs.valor_edad === 'number' && specs.valor_edad > 0
            ? specs.valor_edad
            : 28;
          const clasificacion = (specs.clasificacion as 'FC' | 'MR') || 'FC';
          return {
            x: new Date(muestreo.fechaMuestreo || muestreo.fecha_muestreo || muestreo.fecha || Date.now()).getTime(),
            y: ensayo.porcentajeCumplimientoAjustado || ensayo.porcentajeCumplimiento || 0,
            clasificacion,
            edad,
            edadOriginal: specs.valor_edad,
            unidadEdad: specs.unidad_edad,
            fecha_ensayo: ensayo.fechaEnsayo || ensayo.fecha_ensayo,
            resistencia_calculada: ensayo.resistenciaCalculadaAjustada || ensayo.resistenciaCalculada,
            muestra: { muestreo, muestra, ensayo }
          } as DatoGraficoResistencia;
        })
    )
  );

  // Extract unique construction sites
  const constructionSites = [...new Set(data.remisiones.map(r => r.constructionSite).filter(Boolean))];

  // Función para exportar a Excel
  const exportToExcel = async () => {
    try {
      setIsExporting(true);
      
      if (allMuestreos.length === 0) {
        toast.error('No hay muestreos para exportar');
        return;
      }

      toast.loading('Preparando datos para exportar...');

      // Preparar datos para exportar
      const excelData: any[] = [];

      allMuestreos.forEach((muestreo) => {
        const hasTests = muestreo.muestras.some(m => m.ensayos.length > 0);
        const allEnsayos = muestreo.muestras.flatMap(m => m.ensayos);
        
        const avgCompliance = hasTests && allEnsayos.length > 0
          ? allEnsayos.reduce((sum, e: any) => sum + (e.porcentajeCumplimientoAjustado || 0), 0) / allEnsayos.length
          : null;

        const avgResistance = hasTests && allEnsayos.length > 0
          ? allEnsayos.reduce((sum, e: any) => sum + (e.resistenciaCalculadaAjustada || 0), 0) / allEnsayos.length
          : null;

        // Crear fila base del muestreo
        const baseRow = {
          'Remisión': muestreo.remisionNumber,
          'No. Muestreo': muestreo.numeroMuestreo,
          'Fecha Muestreo': format(new Date(muestreo.fechaMuestreo), 'dd/MM/yyyy', { locale: es }),
          'Obra': muestreo.constructionSite,
          'Código Receta': muestreo.recipeCode || 'N/A',
          "f'c Diseño (kg/cm²)": muestreo.recipeFc || 'N/A',
          'Revenimiento (cm)': muestreo.revenimientoSitio || 'N/A',
          'Masa Unitaria (kg/m³)': muestreo.masaUnitaria || 'N/A',
          'Volumen Fabricado (m³)': muestreo.volumenFabricado ? muestreo.volumenFabricado.toFixed(2) : 'N/A',
          'Temperatura Ambiente (°C)': muestreo.temperaturaAmbiente || 'N/A',
          'Temperatura Concreto (°C)': muestreo.temperaturaConcreto || 'N/A',
          'Rendimiento Volumétrico (%)': muestreo.rendimientoVolumetrico 
            ? muestreo.rendimientoVolumetrico.toFixed(1) 
            : 'N/A',
          'Total Muestras': muestreo.muestras.length,
          'Total Ensayos': allEnsayos.length,
          'Tipo': hasTests ? 'Con Ensayos' : 'Site Check',
        };

        if (hasTests && allEnsayos.length > 0) {
          // Si hay ensayos, agregar información de cada ensayo
          allEnsayos.forEach((ensayo, idx) => {
            excelData.push({
              ...baseRow,
              'No. Ensayo': idx + 1,
              'Resistencia (kg/cm²)': Number((ensayo as any).resistenciaCalculadaAjustada || 0).toFixed(0),
              'Cumplimiento (%)': Number((ensayo as any).porcentajeCumplimientoAjustado || 0).toFixed(1),
              'Resistencia Promedio (kg/cm²)': avgResistance ? avgResistance.toFixed(0) : 'N/A',
              'Cumplimiento Promedio (%)': avgCompliance ? avgCompliance.toFixed(1) : 'N/A',
            });
          });
        } else {
          // Si no hay ensayos, agregar solo una fila con la información del muestreo
          excelData.push({
            ...baseRow,
            'No. Ensayo': 'N/A',
            'Resistencia (kg/cm²)': 'N/A',
            'Cumplimiento (%)': 'N/A',
            'Resistencia Promedio (kg/cm²)': 'N/A',
            'Cumplimiento Promedio (%)': 'N/A',
          });
        }
      });

      // Crear hoja de cálculo
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Ajustar ancho de columnas
      const columnWidths = [
        { wch: 15 }, // Remisión
        { wch: 12 }, // No. Muestreo
        { wch: 15 }, // Fecha Muestreo
        { wch: 30 }, // Obra
        { wch: 15 }, // Código Receta
        { wch: 18 }, // f'c Diseño
        { wch: 16 }, // Revenimiento
        { wch: 20 }, // Masa Unitaria
        { wch: 22 }, // Volumen Fabricado
        { wch: 22 }, // Temperatura Ambiente
        { wch: 22 }, // Temperatura Concreto
        { wch: 24 }, // Rendimiento Volumétrico
        { wch: 14 }, // Total Muestras
        { wch: 14 }, // Total Ensayos
        { wch: 14 }, // Tipo
        { wch: 12 }, // No. Ensayo
        { wch: 20 }, // Resistencia
        { wch: 16 }, // Cumplimiento
        { wch: 26 }, // Resistencia Promedio
        { wch: 24 }, // Cumplimiento Promedio
      ];
      worksheet['!cols'] = columnWidths;

      // Crear libro de trabajo
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Muestreos');

      // Generar archivo
      const fileName = `Muestreos_${data.clientInfo.business_name}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success('Archivo Excel descargado exitosamente');
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      toast.error('Error al generar el archivo Excel');
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

