'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  X, 
  Beaker, 
  Activity, 
  TrendingUp, 
  BarChart3, 
  Target, 
  Thermometer, 
  Droplets, 
  Calendar,
  MapPin,
  Building2,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';
import { DatoGraficoResistencia } from '@/types/quality';
import { PointAnalysisData, fetchPointAnalysisData } from '@/services/qualityPointAnalysisService';
import ResistanceEvolutionChart from './ResistanceEvolutionChart';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DetailedPointAnalysisProps {
  point: DatoGraficoResistencia;
  onClose: () => void;
  className?: string;
}

export default function DetailedPointAnalysis({ point, onClose, className = '' }: DetailedPointAnalysisProps) {
  const [analysisData, setAnalysisData] = useState<PointAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAnalysisData = async () => {
      try {
        setLoading(true);
        const data = await fetchPointAnalysisData(point);
        if (data) {

          setAnalysisData(data);
        } else {
          setError('No se pudieron cargar los datos de análisis');
        }
      } catch (err) {
        setError('Error al cargar los datos de análisis');
        console.error('Error loading analysis data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAnalysisData();
  }, [point]);

  if (loading) {
    return (
      <div className={`mt-6 p-6 border border-slate-200/60 rounded-xl bg-gradient-to-br from-white/90 to-slate-50/90 backdrop-blur shadow-lg ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !analysisData) {
    return (
      <div className={`mt-6 p-6 border border-red-200/60 rounded-xl bg-gradient-to-br from-red-50/90 to-white/90 backdrop-blur shadow-lg ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold text-red-800">Error en el Análisis</h3>
          </div>
          <Button size="sm" variant="outline" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-red-600 mb-4">{error || 'No se pudieron cargar los datos'}</p>
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      // For date-only strings (like "2025-07-14"), treat as local date to avoid timezone issues
      if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Parse as local date to avoid UTC conversion
        const [year, month, day] = dateString.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);
        return format(localDate, 'dd/MM/yyyy', { locale: es });
      } else {
        // For other date formats, use the original logic
        return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
      }
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string, timezone?: string) => {
    try {
      // Parse the UTC timestamp and convert to local time
      const date = new Date(dateString);
      // Format the converted local time (UTC 08:00 -> Mexico City 02:00)
      return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
    } catch {
      return dateString;
    }
  };

  const getComplianceStatus = (percentage: number) => {
    if (percentage >= 100) return { status: 'success', icon: CheckCircle, text: 'Cumple' };
    if (percentage >= 90) return { status: 'warning', icon: Clock, text: 'Aceptable' };
    return { status: 'error', icon: AlertTriangle, text: 'No Cumple' };
  };

  const complianceStatus = getComplianceStatus(point.y);

  return (
    <div className={`mt-6 space-y-6 ${className}`}>
      {/* Header Section */}
      <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <CardTitle className="text-xl font-semibold text-slate-800">
                Análisis Detallado del Punto
              </CardTitle>
              {point.isAggregated && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Promedio de {point.aggregatedCount || 2} muestras
                </Badge>
              )}
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onClose}
              className="hover:bg-slate-50"
            >
              <X className="w-4 h-4 mr-2" />
              Cerrar
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Cumplimiento</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {point.y.toFixed(1)}%
              </p>
              <Badge 
                variant={complianceStatus.status === 'success' ? 'default' : 
                         complianceStatus.status === 'warning' ? 'secondary' : 'destructive'}
                className="text-xs mt-1"
              >
                {complianceStatus.text}
              </Badge>
            </div>
            
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">Resistencia</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {point.resistencia_calculada ? 
                  `${typeof point.resistencia_calculada === 'number' ? point.resistencia_calculada.toFixed(1) : point.resistencia_calculada}` :
                  'N/A'
                }
              </p>
              <p className="text-xs text-green-700 mt-1">kg/cm²</p>
            </div>
            
            <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-700">Edad</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {point.edad}
              </p>
              <p className="text-xs text-purple-700 mt-1">días</p>
            </div>
            
            <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-100">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Beaker className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-medium text-orange-700">Muestras</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {analysisData.muestras.length}
              </p>
              <p className="text-xs text-orange-700 mt-1">total</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-white/70 backdrop-blur border border-slate-200/60">
          <TabsTrigger value="overview" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            <Activity className="w-4 h-4 mr-2" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="evolution" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            <TrendingUp className="w-4 h-4 mr-2" />
            Evolución
          </TabsTrigger>
          <TabsTrigger value="samples" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            <Beaker className="w-4 h-4 mr-2" />
            Muestras
          </TabsTrigger>
          <TabsTrigger value="project" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            <Building2 className="w-4 h-4 mr-2" />
            Proyecto
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Technical Specifications */}
            <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Target className="w-5 h-5 text-slate-600" />
                  Especificaciones Técnicas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">Resistencia Objetivo:</p>
                    <p className="font-semibold text-lg text-blue-600">
                      {analysisData.recipe.strength_fc} kg/cm²
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">Revenimiento:</p>
                    <p className="font-semibold text-lg text-green-600">
                      {analysisData.recipe.slump} cm
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">Edad de Diseño:</p>
                    <p className="font-semibold text-lg text-purple-600">
                      {analysisData.recipe.age_days} días
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">Clasificación:</p>
                    <p className="font-semibold text-lg text-orange-600">
                      {analysisData.muestreo.concrete_specs?.clasificacion || 'FC'}
                    </p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600 mb-2">Código de Receta:</p>
                  <Badge variant="outline" className="text-sm font-mono bg-slate-50">
                    {analysisData.recipe.recipe_code}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Muestreo Conditions */}
            <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Thermometer className="w-5 h-5 text-slate-600" />
                  Condiciones del Muestreo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">Temperatura Ambiente:</p>
                    <p className="font-semibold text-lg text-blue-600">
                      {analysisData.muestreo.temperatura_ambiente}°C
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">Temperatura Concreto:</p>
                    <p className="font-semibold text-lg text-green-600">
                      {analysisData.muestreo.temperatura_concreto}°C
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">Revenimiento Sitio:</p>
                    <p className="font-semibold text-lg text-purple-600">
                      {analysisData.muestreo.revenimiento_sitio} cm
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">Masa Unitaria:</p>
                    <p className="font-semibold text-lg text-orange-600">
                      {analysisData.muestreo.masa_unitaria} kg/m³
                    </p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600 mb-2">Fecha de Muestreo:</p>
                  <p className="font-semibold text-slate-800">
                    {analysisData.muestreo.fecha_muestreo_ts 
                      ? formatDateTime(analysisData.muestreo.fecha_muestreo_ts, analysisData.muestreo.event_timezone)
                      : formatDate(analysisData.muestreo.fecha_muestreo)
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Evolution Tab */}
        <TabsContent value="evolution" className="mt-4">
          <ResistanceEvolutionChart data={analysisData} />
          
          {/* Fallback information if no evolution data */}
          {analysisData.resistanceEvolution.length === 0 && (
            <Card className="bg-amber-50/70 backdrop-blur border border-amber-200/60 rounded-2xl mt-4">
              <CardContent className="pt-6">
                <div className="text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-500" />
                  <h4 className="text-lg font-semibold text-amber-800 mb-2">
                    Información Limitada de Evolución
                  </h4>
                  <p className="text-amber-700 mb-4">
                    Solo se encontraron datos para una fecha de ensayo.
                    Para ver la evolución completa, se necesitan ensayos en diferentes fechas para mostrar el progreso de la resistencia a través del tiempo.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-amber-100 rounded-lg">
                      <p className="text-sm font-medium text-amber-800">Fecha Muestreo</p>
                      <p className="text-lg font-bold text-amber-900">
                        {new Date(analysisData.muestreo.fecha_muestreo).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-amber-100 rounded-lg">
                      <p className="text-sm font-medium text-amber-800">Muestras</p>
                      <p className="text-lg font-bold text-amber-900">
                        {analysisData.muestras.length}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-amber-100 rounded-lg">
                      <p className="text-sm font-medium text-amber-800">Ensayos</p>
                      <p className="text-lg font-bold text-amber-900">
                        {analysisData.muestras.reduce((sum, m) => sum + m.ensayos.length, 0)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-amber-100 rounded-lg">
                      <p className="text-sm font-medium text-amber-800">Estado</p>
                      <p className="text-sm font-medium text-amber-900">
                        {analysisData.muestras.some(m => m.estado === 'ENSAYADO') ? 'Ensayado' : 'Pendiente'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Samples Tab */}
        <TabsContent value="samples" className="mt-4">
          <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Beaker className="w-5 h-5 text-slate-600" />
                Detalle de Muestras y Ensayos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysisData.muestras.map((muestra, index) => (
                  <div key={muestra.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {muestra.tipo_muestra}
                        </Badge>
                        <span className="font-medium text-slate-800">
                          {muestra.identificacion}
                        </span>
                      </div>
                      <Badge 
                        variant={muestra.estado === 'ENSAYADO' ? 'default' : 
                                 muestra.estado === 'PENDIENTE' ? 'secondary' : 'destructive'}
                      >
                        {muestra.estado}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Fecha Programada:</p>
                        <p className="font-medium text-slate-800">
                          {formatDate(muestra.fecha_programada_ensayo)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Ensayos Realizados:</p>
                        <p className="font-medium text-slate-800">
                          {muestra.ensayos.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Estado:</p>
                        <p className="font-medium text-slate-800">
                          {muestra.estado}
                        </p>
                      </div>
                    </div>
                    
                    {muestra.ensayos.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <h4 className="font-medium text-slate-700 mb-3">Resultados de Ensayos:</h4>
                        <div className="space-y-2">
                          {muestra.ensayos.map((ensayo) => (
                            <div key={ensayo.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                              <div className="flex items-center gap-4">
                                <div>
                                  <p className="text-sm text-slate-600">Fecha:</p>
                                  <p className="font-medium text-slate-800">
                                    {ensayo.fecha_ensayo_ts 
                                      ? formatDateTime(ensayo.fecha_ensayo_ts, ensayo.event_timezone)
                                      : formatDate(ensayo.fecha_ensayo)
                                    }
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-slate-600">Carga:</p>
                                  <p className="font-medium text-slate-800">
                                    {ensayo.carga_kg.toFixed(1)} kg
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-slate-600">Resistencia:</p>
                                  <p className="font-medium text-slate-800">
                                    {ensayo.resistencia_calculada.toFixed(1)} kg/cm²
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge 
                                  variant={ensayo.porcentaje_cumplimiento >= 100 ? 'default' : 
                                           ensayo.porcentaje_cumplimiento >= 90 ? 'secondary' : 'destructive'}
                                >
                                  {ensayo.porcentaje_cumplimiento.toFixed(1)}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Project Tab */}
        <TabsContent value="project" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Information */}
            <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-600" />
                  Información del Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-600">Cliente:</p>
                      <p className="font-medium text-slate-800">
                        {analysisData.project.client_name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-600">Obra:</p>
                      <p className="font-medium text-slate-800">
                        {analysisData.project.construction_site}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-600">Orden:</p>
                      <p className="font-medium text-slate-800">
                        {analysisData.project.order_number}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plant Information */}
            <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-slate-600" />
                  Información de la Planta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-slate-600">Planta:</p>
                    <Badge variant="outline" className="text-sm bg-slate-50">
                      {analysisData.muestreo.planta}
                    </Badge>
                  </div>
                  
                  <div>
                    <p className="text-sm text-slate-600">Fecha de Muestreo:</p>
                    <p className="font-medium text-slate-800">
                      {analysisData.muestreo.fecha_muestreo_ts 
                        ? formatDateTime(analysisData.muestreo.fecha_muestreo_ts, analysisData.muestreo.event_timezone)
                        : formatDate(analysisData.muestreo.fecha_muestreo)
                      }
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-slate-600">Clasificación:</p>
                    <p className="font-medium text-slate-800">
                      {analysisData.muestreo.concrete_specs?.clasificacion || 'No especificada'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 justify-center">
            <Button 
              size="sm" 
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                const params = new URLSearchParams();
                if (analysisData.project.client_name !== 'No disponible') {
                  params.append('client', analysisData.project.client_name);
                }
                if (analysisData.project.construction_site !== 'No disponible') {
                  params.append('site', analysisData.project.construction_site);
                }
                if (analysisData.recipe.id) {
                  params.append('recipe', analysisData.recipe.id);
                }
                
                window.open(`/quality/reportes?${params.toString()}`, '_blank');
              }}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Ver Reporte Detallado
            </Button>
            
            {analysisData.muestreo.id && (
              <Button 
                size="sm" 
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  window.open(`/quality/muestreos/${analysisData.muestreo.id}`, '_blank');
                }}
              >
                <Beaker className="w-4 h-4 mr-2" />
                Ver Detalle del Muestreo
              </Button>
            )}
            
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                const params = new URLSearchParams();
                if (analysisData.muestreo.planta) {
                  params.append('plant', analysisData.muestreo.planta);
                }
                if (analysisData.recipe.id) {
                  params.append('recipe', analysisData.recipe.id);
                }
                
                window.open(`/quality/muestreos?${params.toString()}`, '_blank');
              }}
            >
              <Activity className="w-4 h-4 mr-2" />
              Ver Muestreos Relacionados
            </Button>
            
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                const params = new URLSearchParams();
                if (analysisData.muestreo.id) {
                  params.append('muestreo', analysisData.muestreo.id);
                }
                
                window.open(`/quality/ensayos?${params.toString()}`, '_blank');
              }}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Ver Ensayos del Muestreo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
