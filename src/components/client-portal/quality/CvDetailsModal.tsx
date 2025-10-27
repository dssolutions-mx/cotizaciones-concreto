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

  // Determine quality level and styling
  const getQualityLevel = (cv: number) => {
    if (cv <= 10) return { label: 'Excelente', color: 'text-systemGreen', bg: 'bg-systemGreen/15', icon: '✓' };
    if (cv <= 15) return { label: 'Muy Bueno', color: 'text-systemBlue', bg: 'bg-systemBlue/15', icon: '✓' };
    if (cv <= 20) return { label: 'Bueno', color: 'text-systemOrange', bg: 'bg-systemOrange/15', icon: '⚠' };
    return { label: 'Requiere Atención', color: 'text-systemRed', bg: 'bg-systemRed/15', icon: '⚠' };
  };

  const qualityLevel = getQualityLevel(overallCv);

  return (
    <div className="space-y-6">
      {/* Overall Summary Card - Enhanced HIG */}
      <div className="rounded-2xl glass-thin border border-white/20 p-6 bg-gradient-to-br from-systemPurple/10 to-transparent">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <p className="text-caption font-medium text-label-tertiary tracking-wide uppercase">Desempeño General</p>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-title-1 font-bold text-label-primary">{overallCv.toFixed(2)}</p>
              <p className="text-title-3 font-semibold text-label-secondary">%</p>
            </div>
            <p className="text-footnote text-label-tertiary mt-2">
              {isDemo && <span className="font-medium text-systemBlue">Promedio Ponderado</span>}
            </p>
          </div>
          <div className={`rounded-2xl ${qualityLevel.bg} px-4 py-3 flex flex-col items-center justify-center min-w-fit`}>
            <span className={`text-title-1 font-bold ${qualityLevel.color}`}>{qualityLevel.icon}</span>
            <p className={`text-callout font-semibold text-center mt-2 leading-tight ${qualityLevel.color}`}>
              {qualityLevel.label}
            </p>
          </div>
        </div>
      </div>

      {/* Information Grid - HIG Spacing */}
      {hasData && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl glass-thin border border-systemBlue/20 p-4 bg-gradient-to-br from-systemBlue/10 to-transparent">
            <p className="text-caption font-medium text-systemBlue uppercase tracking-wide">Recetas</p>
            <p className="text-title-2 font-bold text-label-primary mt-2">{new Set(cvByRecipe!.map(r => r.recipeCode)).size}</p>
          </div>
          <div className="rounded-xl glass-thin border border-systemGreen/20 p-4 bg-gradient-to-br from-systemGreen/10 to-transparent">
            <p className="text-caption font-medium text-systemGreen uppercase tracking-wide">Total Muestreos</p>
            <p className="text-title-2 font-bold text-label-primary mt-2">{cvByRecipe!.reduce((sum, r) => sum + r.muestreoCount, 0)}</p>
          </div>
          <div className="rounded-xl glass-thin border border-systemOrange/20 p-4 bg-gradient-to-br from-systemOrange/10 to-transparent">
            <p className="text-caption font-medium text-systemOrange uppercase tracking-wide">Total Ensayos</p>
            <p className="text-title-2 font-bold text-label-primary mt-2">{cvByRecipe!.reduce((sum, r) => sum + r.ensayoCount, 0)}</p>
          </div>
        </div>
      )}

      {/* Detailed Breakdown Table - HIG Optimized with Colors & Dividers */}
      {hasData ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-callout font-semibold text-label-primary">Análisis por Receta</h3>
            <p className="text-footnote text-label-tertiary mt-1">Datos detallados de uniformidad y resistencia</p>
          </div>
          <div className="rounded-2xl border border-white/20 overflow-hidden glass-thin">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-white/30 bg-gradient-to-r from-white/5 to-white/0">
                  <TableHead className="text-caption font-bold text-label-secondary uppercase tracking-wider py-4 px-4 border-r border-white/30">Receta</TableHead>
                  <TableHead className="text-caption font-bold text-systemBlue uppercase tracking-wider py-4 px-3 border-r border-white/30 text-center">FC</TableHead>
                  <TableHead className="text-caption font-bold text-systemBlue uppercase tracking-wider py-4 px-3 border-r border-white/30 text-center">Edad</TableHead>
                  <TableHead className="text-caption font-bold text-systemOrange uppercase tracking-wider py-4 px-3 border-r border-white/30 text-center">CV %</TableHead>
                  <TableHead className="text-caption font-bold text-systemGreen uppercase tracking-wider py-4 px-3 border-r border-white/30 text-center">Mues.</TableHead>
                  <TableHead className="text-caption font-bold text-systemGreen uppercase tracking-wider py-4 px-3 border-r border-white/30 text-center">Ens.</TableHead>
                  <TableHead className="text-caption font-bold text-label-secondary uppercase tracking-wider py-4 px-3 border-r border-white/30 text-right">Resistencia</TableHead>
                  <TableHead className="text-caption font-bold text-label-secondary uppercase tracking-wider py-4 px-3 text-right">Cumpl. %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cvByRecipe!.map((r, idx) => {
                  const cvColor = r.coefficientVariation <= 10 ? 'text-systemGreen' :
                                  r.coefficientVariation <= 15 ? 'text-systemBlue' :
                                  r.coefficientVariation <= 20 ? 'text-systemOrange' :
                                  'text-systemRed';

                  const cvBg = r.coefficientVariation <= 10 ? 'bg-systemGreen/10' :
                               r.coefficientVariation <= 15 ? 'bg-systemBlue/10' :
                               r.coefficientVariation <= 20 ? 'bg-systemOrange/10' :
                               'bg-systemRed/10';

                  // Alternating row backgrounds
                  const rowBg = idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.06]';

                  return (
                    <Fragment key={`${r.recipeCode}-${r.strengthFc}-${r.ageDays}-${idx}`}>
                      <TableRow className={`border-b border-white/10 hover:bg-white/10 transition-colors ${rowBg}`}>
                        <TableCell className="font-semibold text-callout text-label-primary py-4 px-4 border-r border-white/40">
                          <div className="max-w-xs truncate" title={r.recipeCode}>{r.recipeCode}</div>
                        </TableCell>
                        <TableCell className="text-callout text-label-secondary py-4 px-3 border-r border-white/30 text-center font-medium">{r.strengthFc.toFixed(0)}</TableCell>
                        <TableCell className="text-callout text-label-secondary py-4 px-3 border-r border-white/30 text-center font-medium">{r.ageDays}d</TableCell>
                        <TableCell className={`font-bold text-callout py-4 px-3 border-r border-white/30 text-center`}>
                          <div className={`rounded-lg px-3 py-2 text-center ${cvBg} ${cvColor} font-semibold inline-block`}>
                            {r.coefficientVariation.toFixed(2)}%
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-callout text-label-secondary font-bold py-4 px-3 border-r border-white/30">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-systemGreen/15">
                            {r.muestreoCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-callout text-label-secondary font-bold py-4 px-3 border-r border-white/30">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-systemGreen/15">
                            {r.ensayoCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-callout text-label-secondary font-medium py-4 px-3 border-r border-white/30">
                          {Number(r.avgResistencia || 0).toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right text-callout text-label-secondary font-medium py-4 px-3">
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
        <div className="rounded-2xl border border-white/20 glass-thin p-8 text-center">
          <p className="text-callout text-label-tertiary">Sin desglose por receta disponible.</p>
        </div>
      )}

      {/* Footer Legend - HIG Information Hierarchy */}
      {hasData && (
        <div className="space-y-3 pt-2 border-t border-white/20">
          <p className="text-caption font-semibold text-label-secondary uppercase tracking-wide">Escala de Desempeño</p>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl border border-systemGreen/30 bg-gradient-to-br from-systemGreen/15 to-systemGreen/5 px-3 py-3">
              <p className="text-caption font-bold text-systemGreen">≤10%</p>
              <p className="text-footnote text-label-secondary mt-2">Excelente</p>
            </div>
            <div className="rounded-xl border border-systemBlue/30 bg-gradient-to-br from-systemBlue/15 to-systemBlue/5 px-3 py-3">
              <p className="text-caption font-bold text-systemBlue">10–15%</p>
              <p className="text-footnote text-label-secondary mt-2">Muy Bueno</p>
            </div>
            <div className="rounded-xl border border-systemOrange/30 bg-gradient-to-br from-systemOrange/15 to-systemOrange/5 px-3 py-3">
              <p className="text-caption font-bold text-systemOrange">15–20%</p>
              <p className="text-footnote text-label-secondary mt-2">Bueno</p>
            </div>
            <div className="rounded-xl border border-systemRed/30 bg-gradient-to-br from-systemRed/15 to-systemRed/5 px-3 py-3">
              <p className="text-caption font-bold text-systemRed">>20%</p>
              <p className="text-footnote text-label-secondary mt-2">Revisar</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


