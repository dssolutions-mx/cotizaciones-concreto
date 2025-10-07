'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Calendar, MapPin, Thermometer } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';
import { getSiteChecks } from '@/lib/qualityHelpers';

interface QualitySiteChecksProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export function QualitySiteChecks({ data, summary }: QualitySiteChecksProps) {
  const siteChecks = getSiteChecks(data);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-thick rounded-3xl p-6">
        <h2 className="text-title-2 font-semibold text-label-primary mb-2">
          Verificaciones en Sitio
        </h2>
        <p className="text-body text-label-secondary">
          Muestreos de control de calidad en obra sin ensayos de resistencia
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-thick rounded-3xl p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-2xl bg-systemBlue/20">
              <CheckCircle2 className="w-6 h-6 text-systemBlue" />
            </div>
            <p className="text-caption font-medium text-label-secondary">
              Total Site Checks
            </p>
          </div>
          <p className="text-title-1 font-bold text-label-primary">
            {siteChecks.length}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-thick rounded-3xl p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <p className="text-caption font-medium text-label-secondary">
              Porcentaje del Total
            </p>
          </div>
          <p className="text-title-1 font-bold text-systemBlue">
            {summary.totals.muestreos > 0 
              ? ((siteChecks.length / summary.totals.muestreos) * 100).toFixed(1) 
              : 0}%
          </p>
          <p className="text-caption text-label-tertiary mt-1">
            de {summary.totals.muestreos} muestreos totales
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-thick rounded-3xl p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <p className="text-caption font-medium text-label-secondary">
              Obras Verificadas
            </p>
          </div>
          <p className="text-title-1 font-bold text-label-primary">
            {[...new Set(siteChecks.map(sc => sc.constructionSite))].length}
          </p>
        </motion.div>
      </div>

      {/* Site Checks List */}
      <div className="space-y-4">
        {siteChecks.length > 0 ? (
          siteChecks.map((siteCheck, index) => (
            <motion.div
              key={siteCheck.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
              className="glass-interactive rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-callout font-semibold text-label-primary">
                      {siteCheck.remisionNumber} - M{siteCheck.numeroMuestreo}
                    </h3>
                    <span className="px-3 py-1 bg-systemBlue/10 text-systemBlue border border-systemBlue/30 rounded-full text-caption font-medium">
                      Site Check
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-footnote text-label-secondary flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(siteCheck.fechaMuestreo), 'dd MMM yyyy', { locale: es })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      {siteCheck.constructionSite}
                    </span>
                  </div>
                </div>

                {/* Rendimiento Badge (if available) */}
                {siteCheck.rendimientoVolumetrico && siteCheck.rendimientoVolumetrico > 0 && (
                  <div className="text-right ml-4">
                    <p className="text-caption text-label-tertiary mb-1">Rendimiento</p>
                    <p className={`text-callout font-bold ${
                      siteCheck.rendimientoVolumetrico >= 98 
                        ? 'text-systemGreen' 
                        : siteCheck.rendimientoVolumetrico >= 95
                        ? 'text-systemOrange'
                        : 'text-systemRed'
                    }`}>
                      {siteCheck.rendimientoVolumetrico.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                <div>
                  <p className="text-caption text-label-tertiary mb-1">Masa Unitaria</p>
                  <p className="text-footnote font-medium text-label-primary">
                    {siteCheck.masaUnitaria.toFixed(0)} kg/m³
                  </p>
                </div>
                
                <div>
                  <p className="text-caption text-label-tertiary mb-1 flex items-center gap-1">
                    <Thermometer className="w-3 h-3" />
                    Temp. Concreto
                  </p>
                  <p className="text-footnote font-medium text-label-primary">
                    {siteCheck.temperaturaConcreto.toFixed(1)}°C
                  </p>
                </div>
                
                <div>
                  <p className="text-caption text-label-tertiary mb-1 flex items-center gap-1">
                    <Thermometer className="w-3 h-3" />
                    Temp. Ambiente
                  </p>
                  <p className="text-footnote font-medium text-label-primary">
                    {siteCheck.temperaturaAmbiente.toFixed(1)}°C
                  </p>
                </div>
                
                <div>
                  <p className="text-caption text-label-tertiary mb-1">Revenimiento</p>
                  <p className="text-footnote font-medium text-label-primary">
                    {siteCheck.revenimientoSitio.toFixed(1)} cm
                  </p>
                </div>
              </div>

              {/* Additional Info */}
              {siteCheck.concrete_specs && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-caption text-label-tertiary mb-2">Especificaciones del Concreto</p>
                  <div className="glass-thin rounded-lg p-3">
                    <pre className="text-caption text-label-secondary overflow-x-auto">
                      {JSON.stringify(siteCheck.concrete_specs, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </motion.div>
          ))
        ) : (
          <div className="glass-thick rounded-3xl p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-label-tertiary mx-auto mb-4" />
            <h3 className="text-title-2 font-bold text-label-primary mb-3">
              No hay verificaciones en sitio
            </h3>
            <p className="text-body text-label-secondary">
              Todos los muestreos en este período tienen ensayos de resistencia
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default QualitySiteChecks;

