'use client';

import { motion } from 'framer-motion';
import { Calendar, MapPin, Thermometer, Beaker, TestTube2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ComplianceBadge from './ComplianceBadge';
import type { ClientQualityRemisionData } from '@/types/clientQuality';

interface ProcessedMuestreo {
  id: string;
  numeroMuestreo: number;
  fechaMuestreo: string;
  masaUnitaria: number;
  temperaturaConcreto: number;
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
  compliance?: number;
}

interface MuestreoCardProps {
  muestreo: ProcessedMuestreo;
  index?: number;
}

export function MuestreoCard({ muestreo, index = 0 }: MuestreoCardProps) {
  const hasTests = muestreo.muestras.some(m => m.ensayos.length > 0);
  const allEnsayos = muestreo.muestras.flatMap(m => m.ensayos);
  
  const avgCompliance = hasTests && allEnsayos.length > 0
    ? allEnsayos.reduce((sum, e) => sum + e.porcentajeCumplimiento, 0) / allEnsayos.length
    : 0;

  const avgResistance = hasTests && allEnsayos.length > 0
    ? allEnsayos.reduce((sum, e) => sum + e.resistenciaCalculada, 0) / allEnsayos.length
    : 0;

  const isCompliant = avgCompliance >= 95;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="glass-interactive rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-callout font-semibold text-label-primary">
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
              <span className="px-3 py-1 bg-systemBlue/10 text-systemBlue border border-systemBlue/30 rounded-full text-caption font-medium">
                Site Check
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-footnote text-label-secondary flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {format(new Date(muestreo.fechaMuestreo), 'dd MMM yyyy', { locale: es })}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {muestreo.constructionSite}
            </span>
          </div>
        </div>

        {/* Rendimiento Badge */}
        {muestreo.rendimientoVolumetrico && muestreo.rendimientoVolumetrico > 0 && (
          <div className="text-right ml-4">
            <p className="text-caption text-label-tertiary mb-1">Rendimiento</p>
            <p className={`text-callout font-bold ${
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

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
        <div>
          <p className="text-caption text-label-tertiary mb-1 flex items-center gap-1">
            <Beaker className="w-3 h-3" />
            Muestras
          </p>
          <p className="text-footnote font-medium text-label-primary">
            {muestreo.muestras.length}
          </p>
        </div>
        
        {hasTests && (
          <>
            <div>
              <p className="text-caption text-label-tertiary mb-1 flex items-center gap-1">
                <TestTube2 className="w-3 h-3" />
                Ensayos
              </p>
              <p className="text-footnote font-medium text-label-primary">
                {allEnsayos.length}
              </p>
            </div>
            
            <div>
              <p className="text-caption text-label-tertiary mb-1">Resistencia</p>
              <p className="text-footnote font-medium text-label-primary">
                {avgResistance.toFixed(0)} kg/cm²
              </p>
            </div>
          </>
        )}
        
        <div>
          <p className="text-caption text-label-tertiary mb-1 flex items-center gap-1">
            <Thermometer className="w-3 h-3" />
            Temperatura
          </p>
          <p className="text-footnote font-medium text-label-primary">
            {muestreo.temperaturaConcreto.toFixed(1)}°C
          </p>
        </div>
      </div>

      {/* Test Results (if available) */}
      {hasTests && allEnsayos.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-caption text-label-tertiary mb-2">Resultados de Ensayos</p>
          <div className="flex flex-wrap gap-2">
            {allEnsayos.map((ensayo, idx) => (
              <div 
                key={ensayo.id}
                className="px-3 py-1.5 glass-thin rounded-lg text-caption border border-white/10"
              >
                <span className="text-label-secondary">E{idx + 1}:</span>{' '}
                <span className={`font-medium ${
                  ensayo.porcentajeCumplimiento >= 95 
                    ? 'text-systemGreen' 
                    : ensayo.porcentajeCumplimiento >= 85
                    ? 'text-systemOrange'
                    : 'text-systemRed'
                }`}>
                  {ensayo.resistenciaCalculada.toFixed(0)} kg/cm²
                </span>
                <span className="text-label-tertiary mx-1">·</span>
                <span className={`font-medium ${
                  ensayo.porcentajeCumplimiento >= 95 
                    ? 'text-systemGreen' 
                    : ensayo.porcentajeCumplimiento >= 85
                    ? 'text-systemOrange'
                    : 'text-systemRed'
                }`}>
                  {ensayo.porcentajeCumplimiento.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default MuestreoCard;

