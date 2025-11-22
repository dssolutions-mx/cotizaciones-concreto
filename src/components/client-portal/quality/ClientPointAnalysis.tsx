'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Target, Zap, Calendar, Beaker, TrendingUp, Activity, CheckCircle2, AlertTriangle, Clock, Building2, MapPin, FileText } from 'lucide-react';
import { DatoGraficoResistencia } from '@/types/quality';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts';

interface ClientPointAnalysisProps {
  point: DatoGraficoResistencia;
  onClose: () => void;
  className?: string;
}

export default function ClientPointAnalysis({ point, onClose, className = '' }: ClientPointAnalysisProps) {
  const [orderElemento, setOrderElemento] = useState<string | null>(null);
  const [loadingElemento, setLoadingElemento] = useState(false);
  
  // Extract data from the point's muestra structure
  const muestreo = point.muestra?.muestreo;
  const muestra = point.muestra?.muestra;
  const ensayo = point.muestra?.ensayo;
  const remision = point.muestra?.remision;
  
  // Get elemento from muestreo or remision (already included in data)
  useEffect(() => {
    const elemento = muestreo?.elemento || remision?.elemento;
    if (elemento) {
      setOrderElemento(elemento);
    } else {
      // Fallback: fetch from API if not in data
      const orderId = muestreo?.orderId || remision?.orderId;
      if (orderId) {
        const fetchOrderElemento = async () => {
          try {
            setLoadingElemento(true);
            const response = await fetch(`/api/client-portal/orders/${orderId}`);
            if (response.ok) {
              const data = await response.json();
              setOrderElemento(data.elemento || null);
            }
          } catch (error) {
            console.error('Error fetching order elemento:', error);
          } finally {
            setLoadingElemento(false);
          }
        };
        fetchOrderElemento();
      }
    }
  }, [muestreo?.elemento, muestreo?.orderId, remision?.elemento, remision?.orderId]);
  
  // Build evolution chart data - same as original: ALL ensayos from remision, grouped by timestamp
  // Matches qualityPointAnalysisService.ts fetchPointAnalysisData logic
  const evolutionData = useMemo(() => {
    if (!remision || !remision.muestreos) return [];
    
    // Get the muestreo date for age calculation (use the current muestreo's date as reference)
    const muestreoDateStr = muestreo?.fechaMuestreo || muestreo?.fecha_muestreo;
    if (!muestreoDateStr) return [];
    
    const muestreoDate = new Date(muestreoDateStr);
    const targetFc = muestreo?.recipeFc || remision?.recipeFc || 0;
    
    // Collect ALL ensayos from ALL muestreos in the remision (like qualityPointAnalysisService.ts lines 130-144)
    const evolutionMap = new Map<string, Array<{ 
      resistencia: number; 
      fecha: string; 
      fecha_ts: string;
      muestra_id: string;
      ensayo: any;
    }>>();
    
    // First, add ensayos from the current muestreo
    if (muestreo?.muestras) {
      muestreo.muestras.forEach((muestraItem: any) => {
        (muestraItem.ensayos || []).forEach((ensayoItem: any) => {
          const resistencia = ensayoItem.resistenciaCalculadaAjustada || ensayoItem.resistenciaCalculada;
          const fechaEnsayo = ensayoItem.fechaEnsayo || ensayoItem.fecha_ensayo;
          const fechaEnsayoTs = ensayoItem.fecha_ensayo_ts || fechaEnsayo;
          
          if (resistencia && resistencia > 0 && fechaEnsayo) {
            // Use timestamp as key for grouping (like original)
            const testDateKey = fechaEnsayoTs || fechaEnsayo;
            if (!evolutionMap.has(testDateKey)) {
              evolutionMap.set(testDateKey, []);
            }
            evolutionMap.get(testDateKey)!.push({
              resistencia,
              fecha: fechaEnsayo,
              fecha_ts: fechaEnsayoTs || fechaEnsayo,
              muestra_id: muestraItem.id || '',
              ensayo: ensayoItem
            });
          }
        });
      });
    }
    
    // Then, add ensayos from ALL other muestreos in the remision
    remision.muestreos.forEach((m: any) => {
      // Skip if this is the current muestreo (already processed above)
      if (m.id === muestreo?.id) return;
      
      (m.muestras || []).forEach((muestraItem: any) => {
        (muestraItem.ensayos || []).forEach((ensayoItem: any) => {
          const resistencia = ensayoItem.resistenciaCalculadaAjustada || ensayoItem.resistenciaCalculada;
          const fechaEnsayo = ensayoItem.fechaEnsayo || ensayoItem.fecha_ensayo;
          const fechaEnsayoTs = ensayoItem.fecha_ensayo_ts || fechaEnsayo;
          
          if (resistencia && resistencia > 0 && fechaEnsayo) {
            // Use timestamp as key for grouping (like original)
            const testDateKey = fechaEnsayoTs || fechaEnsayo;
            if (!evolutionMap.has(testDateKey)) {
              evolutionMap.set(testDateKey, []);
            }
            evolutionMap.get(testDateKey)!.push({
              resistencia,
              fecha: fechaEnsayo,
              fecha_ts: fechaEnsayoTs || fechaEnsayo,
              muestra_id: muestraItem.id || '',
              ensayo: ensayoItem
            });
          }
        });
      });
    });
    
    if (evolutionMap.size === 0) return [];
    
    // Convert to chart data format with precise age calculation (matches qualityPointAnalysisService.ts lines 198-222)
    const chartData = Array.from(evolutionMap.entries()).map(([testDateKey, ensayos]) => {
      const testDateStr = testDateKey;
      const testDateObj = new Date(testDateStr);
      
      // Calculate age in days/hours from muestreo date (like qualityPointAnalysisService.ts line 207-209)
      const diffMs = testDateObj.getTime() - muestreoDate.getTime();
      const ageInDaysFloat = diffMs / (1000 * 60 * 60 * 24);
      const ageInHours = diffMs / (1000 * 60 * 60);
      
      const resistencias = ensayos.map(e => e.resistencia).filter(r => r > 0);
      
      return {
        edad_dias: Number(ageInDaysFloat.toFixed(3)),
        edad_horas: ageInHours < 24 ? Number(ageInHours.toFixed(2)) : undefined,
        edad: Number(ageInDaysFloat.toFixed(3)), // For chart display
        resistencia: resistencias.length > 0 ? resistencias.reduce((a, b) => a + b, 0) / resistencias.length : 0,
        resistencia_promedio: resistencias.length > 0 ? resistencias.reduce((a, b) => a + b, 0) / resistencias.length : 0, // Alias for compatibility
        resistencia_min: resistencias.length > 0 ? Math.min(...resistencias) : 0,
        resistencia_max: resistencias.length > 0 ? Math.max(...resistencias) : 0,
        numero_muestras: resistencias.length,
        muestras: resistencias.length,
        fecha: testDateStr,
        fecha_ensayo: testDateStr,
        fecha_ensayo_ts: ensayos[0]?.fecha_ts || testDateStr,
        cumplimiento: targetFc > 0 ? ((resistencias.length > 0 ? resistencias.reduce((a, b) => a + b, 0) / resistencias.length : 0) / targetFc) * 100 : 0,
        individualPoints: ensayos.map(e => ({
          resistencia: e.resistencia,
          edad: Number(ageInDaysFloat.toFixed(3)),
          fecha: e.fecha,
          fecha_ts: e.fecha_ts,
          muestra_id: e.muestra_id,
          isIndividual: true
        }))
      };
    }).sort((a, b) => {
      // Sort by timestamp (like qualityPointAnalysisService.ts line 222)
      const dateA = a.fecha_ensayo_ts || a.fecha_ensayo;
      const dateB = b.fecha_ensayo_ts || b.fecha_ensayo;
      return dateA.localeCompare(dateB);
    });
    
    // Add day 0 point at muestreo date (like ResistanceEvolutionChart.tsx lines 45-55)
    const dayZeroPoint = {
      edad_dias: 0,
      edad: 0,
      resistencia: 0,
      resistencia_min: 0,
      resistencia_max: 0,
      numero_muestras: 0,
      muestras: 0,
      fecha: muestreoDateStr,
      fecha_ensayo: muestreoDateStr,
      fecha_ensayo_ts: muestreoDateStr,
      cumplimiento: 0,
      individualPoints: []
    };
    
    return [dayZeroPoint, ...chartData];
  }, [remision, muestreo]);
  
  // Flatten individual points for scatter overlay
  const allIndividualPoints = useMemo(() => {
    return evolutionData.flatMap(point => point.individualPoints || []);
  }, [evolutionData]);

  // Format age display
  const formatAge = () => {
    if (point.edadOriginal !== undefined && point.unidadEdad) {
      if (point.unidadEdad === 'HORA' || point.unidadEdad === 'H') {
        return `${point.edadOriginal} ${point.edadOriginal === 1 ? 'hora' : 'horas'}`;
      } else if (point.unidadEdad === 'DÍA' || point.unidadEdad === 'D') {
        return `${point.edadOriginal} ${point.edadOriginal === 1 ? 'día' : 'días'}`;
      }
    }
    return `${point.edad || 28} días`;
  };

  const formatDate = (dateString: string | Date) => {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return format(date, 'dd/MM/yyyy', { locale: es });
    } catch {
      return String(dateString);
    }
  };

  const formatDateTime = (dateString: string | Date) => {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
    } catch {
      return String(dateString);
    }
  };

  const getComplianceStatus = (percentage: number) => {
    if (percentage >= 100) return { status: 'success', icon: CheckCircle2, text: 'Cumple', color: 'text-systemGreen' };
    if (percentage >= 90) return { status: 'warning', icon: Clock, text: 'Aceptable', color: 'text-systemOrange' };
    return { status: 'error', icon: AlertTriangle, text: 'No Cumple', color: 'text-systemRed' };
  };

  const complianceStatus = getComplianceStatus(point.y);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`mt-6 glass-thick rounded-3xl border border-white/20 p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-title-2 font-semibold text-label-primary">
          Detalles del Ensayo
        </h3>
        <button
          onClick={onClose}
          className="p-2 rounded-xl glass-thin hover:glass-interactive transition-all"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5 text-label-secondary" />
        </button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-thin rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-label-tertiary" />
            <span className="text-footnote text-label-secondary">Cumplimiento</span>
          </div>
          <p className={`text-title-2 font-bold ${complianceStatus.color} mb-1`}>
            {point.y.toFixed(1)}%
          </p>
          <p className="text-caption text-label-tertiary">{complianceStatus.text}</p>
        </div>

        <div className="glass-thin rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-label-tertiary" />
            <span className="text-footnote text-label-secondary">Resistencia</span>
          </div>
          <p className="text-title-2 font-bold text-label-primary mb-1">
            {point.resistencia_calculada ? point.resistencia_calculada.toFixed(0) : 'N/A'}
          </p>
          <p className="text-caption text-label-tertiary">kg/cm²</p>
        </div>

        <div className="glass-thin rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-label-tertiary" />
            <span className="text-footnote text-label-secondary">Edad</span>
          </div>
          <p className="text-title-2 font-bold text-label-primary mb-1">
            {formatAge()}
          </p>
          <p className="text-caption text-label-tertiary">de garantía</p>
        </div>

        <div className="glass-thin rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Beaker className="w-4 h-4 text-label-tertiary" />
            <span className="text-footnote text-label-secondary">Clasificación</span>
          </div>
          <p className="text-title-2 font-bold text-label-primary mb-1">
            {point.clasificacion || 'FC'}
          </p>
          <p className="text-caption text-label-tertiary">tipo de concreto</p>
        </div>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-2 glass-thick rounded-xl p-1">
          <TabsTrigger value="details" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Detalles
          </TabsTrigger>
          <TabsTrigger value="evolution" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Evolución
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-4 space-y-4">
          {/* Muestreo Information */}
          {muestreo && (
            <div className="glass-thin rounded-2xl p-4 border border-white/10">
              <h4 className="text-callout font-semibold text-label-primary mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Información del Muestreo
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orderElemento && (
                  <div>
                    <p className="text-footnote text-label-secondary mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Elemento
                    </p>
                    <p className="text-body font-medium text-label-primary">{orderElemento}</p>
                  </div>
                )}
                {muestreo.remisionNumber && (
                  <div>
                    <p className="text-footnote text-label-secondary mb-1">Remisión</p>
                    <p className="text-body font-medium text-label-primary">{muestreo.remisionNumber}</p>
                  </div>
                )}
                {muestreo.fechaMuestreo && (
                  <div>
                    <p className="text-footnote text-label-secondary mb-1">Fecha de Muestreo</p>
                    <p className="text-body font-medium text-label-primary">
                      {formatDate(muestreo.fechaMuestreo)}
                    </p>
                  </div>
                )}
                {muestreo.constructionSite && (
                  <div>
                    <p className="text-footnote text-label-secondary mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Obra
                    </p>
                    <p className="text-body font-medium text-label-primary">{muestreo.constructionSite}</p>
                  </div>
                )}
                {muestreo.recipeCode && (
                  <div>
                    <p className="text-footnote text-label-secondary mb-1">Receta</p>
                    <p className="text-body font-medium text-label-primary">{muestreo.recipeCode}</p>
                  </div>
                )}
                {muestreo.recipeFc && (
                  <div>
                    <p className="text-footnote text-label-secondary mb-1">Resistencia Objetivo</p>
                    <p className="text-body font-medium text-label-primary">
                      {muestreo.recipeFc} kg/cm²
                    </p>
                  </div>
                )}
                {muestreo.masaUnitaria && (
                  <div>
                    <p className="text-footnote text-label-secondary mb-1">Masa Unitaria</p>
                    <p className="text-body font-medium text-label-primary">
                      {muestreo.masaUnitaria.toFixed(0)} kg/m³
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Ensayo Information */}
        {ensayo && (
          <div className="glass-thin rounded-2xl p-4 border border-white/10">
            <h4 className="text-callout font-semibold text-label-primary mb-3 flex items-center gap-2">
              <Beaker className="w-4 h-4" />
              Información del Ensayo
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {point.fecha_ensayo && (
                <div>
                  <p className="text-footnote text-label-secondary mb-1">Fecha de Ensayo</p>
                  <p className="text-body font-medium text-label-primary">
                    {formatDate(point.fecha_ensayo)}
                  </p>
                </div>
              )}
              {ensayo.cargaKg && (
                <div>
                  <p className="text-footnote text-label-secondary mb-1">Carga Aplicada</p>
                  <p className="text-body font-medium text-label-primary">
                    {ensayo.cargaKg.toFixed(0)} kg
                  </p>
                </div>
              )}
              {muestra?.tipoMuestra && (
                <div>
                  <p className="text-footnote text-label-secondary mb-1">Tipo de Muestra</p>
                  <p className="text-body font-medium text-label-primary">{muestra.tipoMuestra}</p>
                </div>
              )}
              {muestra?.identificacion && (
                <div>
                  <p className="text-footnote text-label-secondary mb-1">Identificación</p>
                  <p className="text-body font-medium text-label-primary">{muestra.identificacion}</p>
                </div>
              )}
            </div>
          </div>
        )}

          {/* Performance Indicator */}
          <div className={`glass-thin rounded-2xl p-4 border ${
            point.y >= 100 ? 'border-systemGreen/30 bg-systemGreen/10' :
            point.y >= 90 ? 'border-systemOrange/30 bg-systemOrange/10' :
            'border-systemRed/30 bg-systemRed/10'
          }`}>
            <div className="flex items-center gap-3">
              {complianceStatus.status === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-systemGreen" />
              ) : complianceStatus.status === 'warning' ? (
                <Clock className="w-5 h-5 text-systemOrange" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-systemRed" />
              )}
              <div>
                <p className="text-callout font-semibold text-label-primary">
                  {point.y >= 100 ? 'Cumplimiento Excelente' :
                   point.y >= 90 ? 'Cumplimiento Aceptable' :
                   'Cumplimiento Bajo'}
                </p>
                <p className="text-footnote text-label-secondary mt-1">
                  {point.y >= 100 ? 'El ensayo cumple con la resistencia especificada' :
                   point.y >= 90 ? 'El ensayo está cerca del cumplimiento requerido' :
                   'El ensayo no cumple con la resistencia especificada'}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Evolution Tab */}
        <TabsContent value="evolution" className="mt-4">
          {evolutionData.length > 0 && evolutionData.some(p => p.resistencia > 0) ? (
            <div className="glass-thin rounded-2xl p-4 border border-white/10">
              <h4 className="text-callout font-semibold text-label-primary mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Evolución de Resistencia del Concreto
              </h4>
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={evolutionData} margin={{ top: 20, right: 30, left: 40, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="1 1" stroke="#F1F5F9" strokeWidth={0.5} />
                    <XAxis 
                      type="number"
                      dataKey="edad"
                      stroke="#64748B"
                      fontSize={12}
                      fontWeight={400}
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0', strokeWidth: 1 }}
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      domain={[0, 'dataMax']}
                      label={{ 
                        value: 'Edad (días, horas si < 1 día)', 
                        position: 'insideBottom', 
                        offset: -15, 
                        style: { textAnchor: 'middle', fill: '#475569', fontSize: 12, fontWeight: 500 } 
                      }}
                    />
                    <YAxis 
                      stroke="#64748B"
                      fontSize={12}
                      fontWeight={400}
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0', strokeWidth: 1 }}
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      label={{ 
                        value: 'Resistencia (kg/cm²)', 
                        angle: -90, 
                        position: 'insideLeft', 
                        style: { textAnchor: 'middle', fill: '#475569', fontSize: 12, fontWeight: 500 } 
                      }}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const isIndividual = data.isIndividual;
                          
                          if (isIndividual) {
                            return (
                              <div className="glass-thick rounded-xl p-4 border border-white/20 shadow-lg">
                                <div className="mb-3">
                                  <p className="text-body font-bold text-label-primary text-center">
                                    {label < 1 ? `${(label * 24).toFixed(1)} horas desde muestreo` : `Día ${Number(label).toFixed(2)} desde muestreo`}
                                  </p>
                                  <p className="text-footnote text-label-secondary text-center mt-1">
                                    {data.fecha ? formatDate(data.fecha) : 'N/A'}
                                  </p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-2 text-center">
                                  <p className="text-footnote text-blue-600 font-medium">Resistencia Individual</p>
                                  <p className="text-title-2 font-bold text-blue-800">
                                    {data.resistencia ? data.resistencia.toFixed(1) : 'N/A'} kg/cm²
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          
                          const isDayZero = data.edad === 0;
                          return (
                            <div className="glass-thick rounded-xl p-4 border border-white/20 shadow-lg">
                              <div className="mb-3">
                                <p className="text-body font-bold text-label-primary text-center">
                                  {isDayZero
                                    ? 'Día 0 (Muestreo)'
                                    : label < 1
                                      ? `${(label * 24).toFixed(1)} horas desde muestreo`
                                      : `Día ${Number(label).toFixed(2)} desde muestreo`}
                                </p>
                                <p className="text-footnote text-label-secondary text-center mt-1">
                                  {data.fecha ? formatDate(data.fecha) : 'N/A'}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-blue-50 rounded-lg p-2 text-center">
                                  <p className="text-footnote text-blue-600 font-medium">Resistencia Promedio</p>
                                  <p className="text-title-2 font-bold text-blue-800">
                                    {data.resistencia ? data.resistencia.toFixed(1) : 'N/A'} kg/cm²
                                  </p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-2 text-center">
                                  <p className="text-footnote text-green-600 font-medium">Cumplimiento</p>
                                  <p className="text-title-2 font-bold text-green-800">
                                    {data.cumplimiento ? `${data.cumplimiento.toFixed(0)}%` : 'N/A'}
                                  </p>
                                </div>
                                <div className="bg-purple-50 rounded-lg p-2 text-center">
                                  <p className="text-footnote text-purple-600 font-medium">Muestras</p>
                                  <p className="text-title-2 font-bold text-purple-800">
                                    {data.muestras ? data.muestras : 'N/A'}
                                  </p>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-2 text-center">
                                  <p className="text-footnote text-orange-600 font-medium">Rango</p>
                                  <p className="text-footnote font-bold text-orange-800">
                                    {!isDayZero && data.resistencia_min && data.resistencia_max ? 
                                      `${data.resistencia_min.toFixed(1)} - ${data.resistencia_max.toFixed(1)}` : 
                                      'N/A'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {muestreo?.recipeFc && (
                      <ReferenceLine 
                        y={muestreo.recipeFc} 
                        stroke="#EF4444" 
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: `Objetivo: ${muestreo.recipeFc} kg/cm²`,
                          position: 'top',
                          fill: '#EF4444',
                          fontSize: 11,
                          fontWeight: 500
                        }}
                      />
                    )}
                    {/* Individual scatter points */}
                    <Line
                      type="linear"
                      dataKey="resistencia"
                      data={allIndividualPoints as any}
                      stroke="transparent"
                      dot={{ r: 3, fill: '#60A5FA', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                      activeDot={{ r: 5, fill: '#60A5FA', stroke: '#1D4ED8' }}
                      isAnimationActive={false}
                      connectNulls
                    />
                    {/* Main resistance line (average) */}
                    <Line
                      type="monotone"
                      dataKey="resistencia"
                      stroke="#B45309"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ 
                        r: 5, 
                        stroke: '#B45309', 
                        strokeWidth: 2,
                        fill: '#FFFFFF',
                      }}
                    />
                    {/* Average points on the line */}
                    <Line
                      type="linear"
                      dataKey="resistencia"
                      data={evolutionData as any}
                      stroke="transparent"
                      dot={{ r: 4, fill: '#B45309', stroke: '#FFFFFF', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: 12, paddingTop: 20 }}
                      iconType="circle"
                      formatter={(value) => (
                        <span style={{ fontSize: 12, color: '#475569' }}>{value}</span>
                      )}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {/* Chart Legend */}
              <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                  <span className="text-label-secondary font-medium">Puntos Individuales</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-amber-700"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-700"></div>
                  <span className="text-label-secondary font-medium">Promedio</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-red-500 border-dashed border-t border-red-500"></div>
                  <span className="text-label-secondary font-medium">Objetivo</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-thin rounded-2xl p-8 border border-white/10 text-center">
              <TrendingUp className="w-12 h-12 text-label-tertiary mx-auto mb-3" />
              <p className="text-body text-label-secondary">
                No hay datos de evolución disponibles para este muestreo
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

