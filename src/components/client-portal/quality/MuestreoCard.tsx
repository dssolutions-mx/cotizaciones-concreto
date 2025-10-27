'use client';

import { motion } from 'framer-motion';
import { 
  Calendar, 
  MapPin, 
  Thermometer, 
  Beaker, 
  TestTube2, 
  Droplets,
  Package,
  Activity,
  TrendingUp,
  Scale,
  Gauge
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ComplianceBadge from './ComplianceBadge';
import { adjustEnsayoResistencia, recomputeEnsayoCompliance } from '@/lib/qualityHelpers';
import type { ClientQualityRemisionData } from '@/types/clientQuality';

interface ProcessedMuestreo {
  id: string;
  numeroMuestreo: number;
  fechaMuestreo: string;
  masaUnitaria: number;
  temperaturaAmbiente: number;
  temperaturaConcreto: number;
  revenimientoSitio: number;
  muestras: Array<{
    id: string;
    ensayos: Array<{
      id: string;
      porcentajeCumplimiento: number;
      resistenciaCalculada: number;
    }>;
  }>;
  remisionNumber: string;
  fecha: string;
  constructionSite: string;
  rendimientoVolumetrico?: number;
  volumenFabricado?: number;
  recipeFc?: number;
  recipeCode?: string;
  compliance?: number;
}

interface MuestreoCardProps {
  muestreo: ProcessedMuestreo;
  index?: number;
}

export function MuestreoCard({ muestreo, index = 0 }: MuestreoCardProps) {
  const hasTests = muestreo.muestras.some(m => m.ensayos.length > 0);
  const allEnsayos = muestreo.muestras.flatMap(m => m.ensayos);

  // Compute adjusted ensayo values (resistance and compliance) using recipe Fc
  const recipeFc = muestreo.recipeFc || 0;
  const adjustedEnsayos = allEnsayos.map(e => {
    const resAdj = adjustEnsayoResistencia(e.resistenciaCalculada || 0);
    const compAdj = recomputeEnsayoCompliance(resAdj, recipeFc);
    return {
      ...e,
      resistenciaCalculadaAjustada: resAdj,
      porcentajeCumplimientoAjustado: compAdj
    };
  });
  
  const avgCompliance = hasTests && adjustedEnsayos.length > 0
    ? adjustedEnsayos.reduce((sum, e: any) => sum + (e.porcentajeCumplimientoAjustado || 0), 0) / adjustedEnsayos.length
    : 0;

  const avgResistance = hasTests && adjustedEnsayos.length > 0
    ? adjustedEnsayos.reduce((sum, e: any) => sum + (e.resistenciaCalculadaAjustada || 0), 0) / adjustedEnsayos.length
    : 0;

  const isCompliant = avgCompliance >= 95;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="glass-interactive rounded-3xl p-6 border border-white/10 hover:border-white/20 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-title-3 font-bold text-label-primary">
              {muestreo.remisionNumber} - M{muestreo.numeroMuestreo}
            </h3>
            {hasTests ? (
              <ComplianceBadge 
                value={avgCompliance} 
                size="sm"
                showIcon={true}
                showPercentage={true}
              />
            ) : (
              <span className="px-3 py-1.5 bg-systemBlue/10 text-systemBlue border border-systemBlue/30 rounded-full text-caption font-semibold">
                Site Check
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-footnote text-label-secondary flex-wrap mb-2">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-systemBlue" />
              {format(new Date(muestreo.fechaMuestreo), 'dd MMM yyyy', { locale: es })}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-systemOrange" />
              {muestreo.constructionSite}
            </span>
          </div>

          {muestreo.recipeCode && (
            <div className="flex items-center gap-2 text-caption">
              <span className="px-2.5 py-1 glass-thin border border-white/20 rounded-lg text-label-secondary font-medium">
                {muestreo.recipeCode}
              </span>
              {muestreo.recipeFc && (
                <span className="text-label-tertiary">
                  f'c {muestreo.recipeFc} kg/cm²
                </span>
              )}
            </div>
          )}
        </div>

        {/* Rendimiento Badge */}
        {muestreo.rendimientoVolumetrico && muestreo.rendimientoVolumetrico > 0 && (
          <div className="text-right ml-4 glass-thin border border-white/20 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-systemPurple" />
              <p className="text-caption text-label-tertiary font-medium">Rendimiento</p>
            </div>
            <p className={`text-large-title font-bold ${
              muestreo.rendimientoVolumetrico >= 100 
                ? 'text-systemGreen' 
                : muestreo.rendimientoVolumetrico >= 98
                ? 'text-systemOrange'
                : 'text-systemRed'
            }`}>
              {muestreo.rendimientoVolumetrico.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {/* Revenimiento */}
        {muestreo.revenimientoSitio > 0 && (
          <div className="glass-thin border border-white/20 rounded-xl p-3 hover:border-systemBlue/40 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-systemBlue/10 rounded-lg" title="Valor ajustado ×0.92">
                <Droplets className="w-4 h-4 text-systemBlue" />
              </div>
              <p className="text-caption text-label-tertiary font-medium">Revenimiento</p>
            </div>
            <p className="text-title-2 font-bold text-label-primary">
              {muestreo.revenimientoSitio} <span className="text-footnote font-normal text-label-secondary">cm</span>
            </p>
          </div>
        )}

        {/* Masa Unitaria */}
        {muestreo.masaUnitaria > 0 && (
          <div className="glass-thin border border-white/20 rounded-xl p-3 hover:border-systemPurple/40 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-systemPurple/10 rounded-lg" title="Valor sin ajuste">
                <Scale className="w-4 h-4 text-systemPurple" />
              </div>
              <p className="text-caption text-label-tertiary font-medium">Masa Unitaria</p>
            </div>
            <p className="text-title-2 font-bold text-label-primary">
              {muestreo.masaUnitaria} <span className="text-footnote font-normal text-label-secondary">kg/m³</span>
            </p>
          </div>
        )}

        {/* Volumen Fabricado */}
        {muestreo.volumenFabricado && muestreo.volumenFabricado > 0 && (
          <div className="glass-thin border border-white/20 rounded-xl p-3 hover:border-systemIndigo/40 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-systemIndigo/10 rounded-lg" title="Valor sin ajuste">
                <Package className="w-4 h-4 text-systemIndigo" />
              </div>
              <p className="text-caption text-label-tertiary font-medium">Volumen</p>
            </div>
            <p className="text-title-2 font-bold text-label-primary">
              {muestreo.volumenFabricado.toFixed(2)} <span className="text-footnote font-normal text-label-secondary">m³</span>
            </p>
          </div>
        )}

        {/* Muestras */}
        <div className="glass-thin border border-white/20 rounded-xl p-3 hover:border-systemGreen/40 transition-colors">
            <div className="flex items-center gap-2 mb-2" title="Valores de ensayo ajustados ×0.92">
            <div className="p-1.5 bg-systemGreen/10 rounded-lg">
              <Beaker className="w-4 h-4 text-systemGreen" />
            </div>
            <p className="text-caption text-label-tertiary font-medium">Muestras</p>
          </div>
          <p className="text-title-2 font-bold text-label-primary">
            {muestreo.muestras.length}
          </p>
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {/* Temperatura Ambiente */}
        {muestreo.temperaturaAmbiente > 0 && (
          <div className="flex items-center gap-3 glass-thin border border-white/10 rounded-xl p-3">
            <div className="p-2 bg-systemOrange/10 rounded-lg">
              <Thermometer className="w-5 h-5 text-systemOrange" />
            </div>
            <div>
              <p className="text-caption text-label-tertiary">T. Ambiente</p>
              <p className="text-callout font-bold text-label-primary">
                {muestreo.temperaturaAmbiente.toFixed(1)}°C
              </p>
            </div>
          </div>
        )}

        {/* Temperatura Concreto */}
        {muestreo.temperaturaConcreto > 0 && (
          <div className="flex items-center gap-3 glass-thin border border-white/10 rounded-xl p-3">
            <div className="p-2 bg-systemRed/10 rounded-lg">
              <Gauge className="w-5 h-5 text-systemRed" />
            </div>
            <div>
              <p className="text-caption text-label-tertiary">T. Concreto</p>
              <p className="text-callout font-bold text-label-primary">
                {muestreo.temperaturaConcreto.toFixed(1)}°C
              </p>
            </div>
          </div>
        )}

        {/* Ensayos (if available) */}
        {hasTests && (
          <div className="flex items-center gap-3 glass-thin border border-white/10 rounded-xl p-3">
            <div className="p-2 bg-systemTeal/10 rounded-lg">
              <TestTube2 className="w-5 h-5 text-systemTeal" />
            </div>
            <div>
              <p className="text-caption text-label-tertiary">Ensayos</p>
              <p className="text-callout font-bold text-label-primary">
                {allEnsayos.length}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Test Results (if available) */}
      {hasTests && allEnsayos.length > 0 && (
        <div className="pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 mb-3" title="Resultados ajustados ×0.92">
            <Activity className="w-4 h-4 text-systemPurple" />
            <p className="text-callout font-semibold text-label-primary">Resultados de Ensayos</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {adjustedEnsayos.map((ensayo: any, idx: number) => (
              <div 
                key={ensayo.id}
                className="flex items-center justify-between px-3 py-2.5 glass-thin rounded-xl border border-white/10 hover:border-white/20 transition-colors"
              >
                <span className="text-callout font-medium text-label-secondary">Ensayo {idx + 1}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-callout font-bold ${
                    (ensayo.porcentajeCumplimientoAjustado || 0) >= 95 
                      ? 'text-systemGreen' 
                      : (ensayo.porcentajeCumplimientoAjustado || 0) >= 85
                      ? 'text-systemOrange'
                      : 'text-systemRed'
                  }`}>
                    {Number(ensayo.resistenciaCalculadaAjustada || 0).toFixed(0)} kg/cm²
                  </span>
                  <span className="text-label-tertiary">•</span>
                  <span className={`text-callout font-bold ${
                    (ensayo.porcentajeCumplimientoAjustado || 0) >= 95 
                      ? 'text-systemGreen' 
                      : (ensayo.porcentajeCumplimientoAjustado || 0) >= 85
                      ? 'text-systemOrange'
                      : 'text-systemRed'
                  }`}>
                    {Number(ensayo.porcentajeCumplimientoAjustado || 0).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          {hasTests && avgResistance > 0 && (
              <div className="mt-3 glass-thick border border-white/20 rounded-xl p-3" title="Promedio ajustado ×0.92">
              <div className="flex items-center justify-between">
                <span className="text-callout font-semibold text-label-primary">Resistencia Promedio</span>
                <span className={`text-title-2 font-bold ${
                  avgCompliance >= 95 
                    ? 'text-systemGreen' 
                    : avgCompliance >= 85
                    ? 'text-systemOrange'
                    : 'text-systemRed'
                }`}>
                  {avgResistance.toFixed(0)} kg/cm²
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default MuestreoCard;

