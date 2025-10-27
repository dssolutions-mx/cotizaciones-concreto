'use client';

import { Fragment } from 'react';
import type { RecipeCVBreakdown } from '@/types/clientQuality';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface CvDetailsModalProps {
  overallCv: number;
  cvByRecipe?: RecipeCVBreakdown[];
  clientName?: string;
  isDemo?: boolean;
}

export default function CvDetailsModal({ overallCv, cvByRecipe, clientName, isDemo = false }: CvDetailsModalProps) {
  const hasData = Array.isArray(cvByRecipe) && cvByRecipe.length > 0;

  // Determine quality level - subtle, professional colors
  const getQualityLevel = (cv: number) => {
    if (cv <= 10) return { 
      label: 'Excelente', 
      color: 'text-emerald-700', 
      bg: 'bg-emerald-50/50', 
      border: 'border-emerald-200/50',
      icon: '✓' 
    };
    if (cv <= 15) return { 
      label: 'Muy Bueno', 
      color: 'text-blue-700', 
      bg: 'bg-blue-50/50', 
      border: 'border-blue-200/50',
      icon: '✓' 
    };
    if (cv <= 20) return { 
      label: 'Bueno', 
      color: 'text-amber-700', 
      bg: 'bg-amber-50/50', 
      border: 'border-amber-200/50',
      icon: '⚠' 
    };
    return { 
      label: 'Requiere Atención', 
      color: 'text-rose-700', 
      bg: 'bg-rose-50/50', 
      border: 'border-rose-200/50',
      icon: '⚠' 
    };
  };

  const qualityLevel = getQualityLevel(overallCv);

  return (
    <div className="space-y-6">
      {/* Overall Summary Card - Single Unified Design */}
      <div className={`rounded-2xl border ${qualityLevel.border} p-6 ${qualityLevel.bg}`}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <p className="text-caption font-medium text-gray-600 tracking-wide uppercase">Desempeño General</p>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-title-1 font-bold text-gray-900">{overallCv.toFixed(2)}</p>
              <p className="text-title-3 font-semibold text-gray-600">%</p>
            </div>
            <p className="text-footnote text-gray-600 mt-2">
              {isDemo && <span className="font-medium text-gray-700">Promedio Ponderado</span>}
            </p>
          </div>
          <div className="flex flex-col items-end justify-center">
            <span className={`text-title-1 font-bold ${qualityLevel.color}`}>{qualityLevel.icon}</span>
            <p className="text-callout font-semibold text-right mt-2 leading-tight text-gray-900">
              {qualityLevel.label}
            </p>
          </div>
        </div>
      </div>

      {/* Information Grid - Clean White Cards with Subtle Accents */}
      {hasData && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-caption font-medium text-gray-500 uppercase tracking-wide">Recetas</p>
            <p className="text-title-2 font-bold text-gray-900 mt-2">{new Set(cvByRecipe!.map(r => r.recipeCode)).size}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-caption font-medium text-gray-500 uppercase tracking-wide">Total Muestreos</p>
            <p className="text-title-2 font-bold text-gray-900 mt-2">{cvByRecipe!.reduce((sum, r) => sum + r.muestreoCount, 0)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-caption font-medium text-gray-500 uppercase tracking-wide">Total Ensayos</p>
            <p className="text-title-2 font-bold text-gray-900 mt-2">{cvByRecipe!.reduce((sum, r) => sum + r.ensayoCount, 0)}</p>
          </div>
        </div>
      )}

      {/* Professional Clean Table */}
      {hasData ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-callout font-semibold text-gray-900">Análisis por Receta</h3>
            <p className="text-footnote text-gray-600 mt-1">Datos detallados de uniformidad y resistencia</p>
          </div>
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b border-gray-200">
                  <TableHead className="text-caption font-bold text-gray-700 uppercase tracking-wider py-4">Receta</TableHead>
                  <TableHead className="text-caption font-bold text-gray-700 uppercase tracking-wider py-4">FC</TableHead>
                  <TableHead className="text-caption font-bold text-gray-700 uppercase tracking-wider py-4">Edad</TableHead>
                  <TableHead className="text-caption font-bold text-gray-700 uppercase tracking-wider py-4">CV</TableHead>
                  <TableHead className="text-caption font-bold text-gray-700 uppercase tracking-wider py-4 text-center">Muestreos</TableHead>
                  <TableHead className="text-caption font-bold text-gray-700 uppercase tracking-wider py-4 text-center">Ensayos</TableHead>
                  <TableHead className="text-caption font-bold text-gray-700 uppercase tracking-wider py-4 text-right">Resistencia</TableHead>
                  <TableHead className="text-caption font-bold text-gray-700 uppercase tracking-wider py-4 text-right">Cumplimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cvByRecipe!.map((r, idx) => {
                  // Subtle professional colors for CV only
                  const cvColor = r.coefficientVariation <= 10 ? 'text-emerald-700' :
                                  r.coefficientVariation <= 15 ? 'text-blue-700' :
                                  r.coefficientVariation <= 20 ? 'text-amber-700' :
                                  'text-rose-700';

                  const cvBg = r.coefficientVariation <= 10 ? 'bg-emerald-50 border-emerald-200' :
                               r.coefficientVariation <= 15 ? 'bg-blue-50 border-blue-200' :
                               r.coefficientVariation <= 20 ? 'bg-amber-50 border-amber-200' :
                               'bg-rose-50 border-rose-200';

                  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';

                  return (
                    <Fragment key={`${r.recipeCode}-${r.strengthFc}-${r.ageDays}-${idx}`}>
                      <TableRow className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${rowBg}`}>
                        <TableCell className="font-semibold text-callout text-gray-900 py-4">
                          <div className="max-w-xs truncate" title={r.recipeCode}>{r.recipeCode}</div>
                        </TableCell>
                        <TableCell className="text-callout text-gray-700 py-4">{r.strengthFc.toFixed(0)}</TableCell>
                        <TableCell className="text-callout text-gray-700 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-footnote font-medium">
                            {r.ageDays}d
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className={`rounded-lg px-3 py-1.5 text-center border ${cvBg} ${cvColor} font-bold text-callout`}>
                            {r.coefficientVariation.toFixed(2)}%
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-callout text-gray-700 font-medium py-4">
                          {r.muestreoCount}
                        </TableCell>
                        <TableCell className="text-center text-callout text-gray-700 font-medium py-4">
                          {r.ensayoCount}
                        </TableCell>
                        <TableCell className="text-right text-callout text-gray-900 font-semibold py-4">
                          {Number(r.avgResistencia || 0).toFixed(1)}
                          <span className="text-footnote text-gray-500 ml-1">kg/cm²</span>
                        </TableCell>
                        <TableCell className="text-right text-callout text-gray-700 font-medium py-4">
                          {Number(r.avgCompliance || 0).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-callout text-gray-600">Sin desglose por receta disponible.</p>
        </div>
      )}

      {/* Footer Legend - Professional 4-Column Grid */}
      {hasData && (
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <p className="text-caption font-semibold text-gray-700 uppercase tracking-wide">Escala de Desempeño</p>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
              <p className="text-callout font-bold text-emerald-700">≤10%</p>
              <p className="text-footnote text-gray-700 mt-1 font-medium">Excelente</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3">
              <p className="text-callout font-bold text-blue-700">10–15%</p>
              <p className="text-footnote text-gray-700 mt-1 font-medium">Muy Bueno</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
              <p className="text-callout font-bold text-amber-700">15–20%</p>
              <p className="text-footnote text-gray-700 mt-1 font-medium">Bueno</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3">
              <p className="text-callout font-bold text-rose-700">&gt;20%</p>
              <p className="text-footnote text-gray-700 mt-1 font-medium">Revisar</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
