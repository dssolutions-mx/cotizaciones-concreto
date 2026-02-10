'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  FileText,
  Building,
  Calendar,
  User,
  Truck,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  FileImage,
  Download,
  Calculator,
  Clock,
  Shield,
  Clock3,
  AlertCircle,
  Settings2
} from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchEnsayoById } from '@/services/qualityEnsayoService';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { EnsayoWithRelations } from '@/types/quality';
import Link from 'next/link';
import Image from 'next/image';
import { formatDate, createSafeDate } from '@/lib/utils';
import { getNormalizedSpecs, formatAgeUnitLabel } from '@/lib/quality-normalization';

export default function EnsayoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuthBridge();
  const [ensayo, setEnsayo] = useState<EnsayoWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Factor de corrección de resistencia (solo para FC)
  const [usarFactorCorreccion, setUsarFactorCorreccion] = useState(false);
  const [factorCorreccion, setFactorCorreccion] = useState(0.92);
  
  useEffect(() => {
    const fetchEnsayoDetails = async () => {
      if (!params.id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const ensayoId = Array.isArray(params.id) ? params.id[0] : params.id;
        const data = await fetchEnsayoById(ensayoId);
        setEnsayo(data);
      } catch (err) {
        console.error('Error al cargar detalle de ensayo:', err);
        setError('No se pudo cargar la información del ensayo');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEnsayoDetails();
  }, [params.id]);

  // Verificar roles permitidos
  const allowedRoles = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'PLANT_MANAGER'];
  const hasAccess = profile && allowedRoles.includes(profile.role);

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          
          <p className="text-lg mb-4 text-yellow-700">
            No tienes permiso para acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
            <p className="text-gray-500">Cargando detalle del ensayo...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !ensayo) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => router.back()} 
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-3xl mx-auto">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
            <div>
              <h3 className="text-xl font-medium text-red-800 mb-2">
                Error al cargar el ensayo
              </h3>
              <p className="text-red-700">
                {error || 'No se encontró el ensayo solicitado'}
              </p>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            className="mt-2"
            onClick={() => {
              const ensayoId = Array.isArray(params.id) ? params.id[0] : params.id;
              if (ensayoId) {
                fetchEnsayoById(ensayoId);
              }
            }}
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  // Determinar clasificación y edad programada desde la muestra (derivado por posición) en lugar de concrete_specs
  const recipe = ensayo.muestra?.muestreo?.remision?.recipe as any;
  const recipeVersions = recipe?.recipe_versions || [];
  const currentVersion = recipeVersions.find((v: any) => v.is_current === true);
  const hasMR = (currentVersion?.notes || '').toString().toUpperCase().includes('MR');
  const clasificacion = hasMR ? 'MR' : 'FC';
  const muestreoBaseTs = (() => {
    const m = ensayo.muestra?.muestreo as any;
    if (!m) return null;
    const baseTs = m.fecha_muestreo_ts
      ? new Date(m.fecha_muestreo_ts)
      : (m.fecha_muestreo ? new Date(`${m.fecha_muestreo}T${(m.hora_muestreo || '00:00')}`) : null);
    return baseTs;
  })();
  const scheduledTs = (() => {
    const ms = ensayo.muestra as any;
    if (!ms) return null;
    return ms.fecha_programada_ensayo_ts
      ? new Date(ms.fecha_programada_ensayo_ts)
      : (ms.fecha_programada_ensayo ? new Date(`${ms.fecha_programada_ensayo}T12:00:00`) : null);
  })();
  const plannedDiffHours = (muestreoBaseTs && scheduledTs)
    ? Math.max(0, Math.floor((scheduledTs.getTime() - muestreoBaseTs.getTime()) / 3600000))
    : null;
  const plannedAgeValue = plannedDiffHours !== null
    ? (plannedDiffHours <= 48 ? plannedDiffHours : Math.round(plannedDiffHours / 24))
    : null;
  const plannedAgeUnitLabel = plannedDiffHours !== null
    ? (plannedDiffHours <= 48 ? 'horas' : 'días')
    : '—';
  
  // Calcular la edad del ensayo
  const fechaMuestreo = createSafeDate(ensayo.muestra?.muestreo?.fecha_muestreo);
  const fechaEnsayo = createSafeDate(ensayo.fecha_ensayo);
  const edadEnsayo = fechaMuestreo && fechaEnsayo
    ? differenceInDays(fechaEnsayo, fechaMuestreo)
    : null;

  // Calcular la diferencia entre hora de carga y hora de ensayo (matching database logic)
  const calculateTimeDifference = () => {
    // Get ensayo timestamp (prefer fecha_ensayo_ts, fallback to fecha_ensayo + hora_ensayo)
    let ensayoDate: Date | null = null;
    
    if ((ensayo as any).fecha_ensayo_ts) {
      ensayoDate = new Date((ensayo as any).fecha_ensayo_ts);
    } else if (ensayo.fecha_ensayo && ensayo.hora_ensayo) {
      // Combine fecha_ensayo and hora_ensayo like the database does
      ensayoDate = new Date(`${ensayo.fecha_ensayo}T${ensayo.hora_ensayo}`);
    } else if (ensayo.fecha_ensayo) {
      // Use fecha_ensayo with default time (matching database behavior)
      ensayoDate = new Date(`${ensayo.fecha_ensayo}T12:00:00`);
    }

    // Get carga time - prefer muestreo date over remision date
    const remision = ensayo.muestra?.muestreo?.remision;
    const cargaTime = remision?.hora_carga;
    
    // Prefer fecha_muestreo_ts, then fecha_muestreo, then remision.fecha
    const muestreo = ensayo.muestra?.muestreo;
    let cargaFecha: string | null = null;
    
    if ((muestreo as any)?.fecha_muestreo_ts) {
      // Use muestreo timestamp directly
      const muestreoDate = new Date((muestreo as any).fecha_muestreo_ts);
      cargaFecha = muestreoDate.toISOString().split('T')[0]; // Extract date part
    } else if (muestreo?.fecha_muestreo) {
      cargaFecha = muestreo.fecha_muestreo;
    } else if (remision?.fecha) {
      cargaFecha = remision.fecha;
    }

    if (!ensayoDate || !cargaTime || !cargaFecha) return null;

    // Parse hora_carga (format: "HH:MM:SS" or "HH:MM")
    const timeParts = cargaTime.split(':');
    const hours = parseInt(timeParts[0]) || 0;
    const minutes = parseInt(timeParts[1]) || 0;
    const seconds = parseInt(timeParts[2]) || 0;

    // Create carga date using muestreo date + hora_carga (preferred logic)
    const cargaDate = new Date(`${cargaFecha}T${cargaTime}`);
    
    // Ensure cargaDate is valid
    if (isNaN(cargaDate.getTime())) {
      console.warn('Invalid carga date:', cargaFecha, cargaTime);
      return null;
    }

    // Calculate difference in milliseconds
    const diffMs = ensayoDate.getTime() - cargaDate.getTime();
    const isNegative = diffMs < 0;
    const absDiffMs = Math.abs(diffMs);

    // Calculate days, hours, minutes (matching database format)
    const diffDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((absDiffMs % (1000 * 60)) / 1000);

    // Format the difference string (matching database format)
    const formatDifference = () => {
      if (diffDays > 0) {
        return `${diffDays} día${diffDays !== 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        return `${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
      } else if (diffMinutes > 0) {
        return `${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
      } else {
        return `${diffSeconds} segundo${diffSeconds !== 1 ? 's' : ''}`;
      }
    };

    // Format for detailed display (matching database format like "21 days 03:35:51.753")
    const formatDetailed = () => {
      const parts = [];
      if (diffDays > 0) {
        parts.push(`${diffDays} día${diffDays !== 1 ? 's' : ''}`);
      }
      if (diffHours > 0 || diffMinutes > 0 || diffSeconds > 0) {
        const timeStr = `${diffHours.toString().padStart(2, '0')}:${diffMinutes.toString().padStart(2, '0')}:${diffSeconds.toString().padStart(2, '0')}`;
        parts.push(timeStr);
      }
      return parts.join(' ');
    };

    return {
      days: diffDays,
      hours: diffHours,
      minutes: diffMinutes,
      seconds: diffSeconds,
      isNegative,
      totalHours: (absDiffMs / (1000 * 60 * 60)),
      formatted: formatDifference(),
      detailed: formatDetailed(),
      rawMs: diffMs,
      cargaDate,
      ensayoDate
    };
  };

  const timeDifference = calculateTimeDifference();

  // Function to format database time to human readable format
  const formatDatabaseTime = (dbTime: string): string => {
    if (!dbTime) return '';
    
    // Parse database format like "7 days 04:55:14.546" or "27 days"
    const parts = dbTime.split(' ');
    const result = [];
    
    // Extract days
    const dayMatch = dbTime.match(/(\d+)\s*days?/i);
    if (dayMatch) {
      const days = parseInt(dayMatch[1]);
      result.push(`${days} día${days !== 1 ? 's' : ''}`);
    }
    
    // Extract time part (HH:MM:SS)
    const timeMatch = dbTime.match(/(\d{1,2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const seconds = parseInt(timeMatch[3]);
      
      if (hours > 0) {
        result.push(`${hours} hora${hours !== 1 ? 's' : ''}`);
      }
      if (minutes > 0) {
        result.push(`${minutes} minuto${minutes !== 1 ? 's' : ''}`);
      }
      if (seconds > 0 && hours === 0 && minutes === 0) {
        result.push(`${seconds} segundo${seconds !== 1 ? 's' : ''}`);
      }
    }
    
    return result.join(' ') || dbTime;
  };

  // Calculate guarantee age metrics using the same logic as database functions
  const calculateGuaranteeAgeMetrics = () => {
    if (!ensayo.muestra?.muestreo?.concrete_specs) return null;

    const concreteSpecs = ensayo.muestra.muestreo.concrete_specs as any;
    const valorEdad = concreteSpecs?.valor_edad;
    const unidadEdad = concreteSpecs?.unidad_edad;
    const clasificacion = concreteSpecs?.clasificacion;
    
    if (!valorEdad || !unidadEdad) return null;

    // Calculate guarantee age in hours (matching database function)
    let edadGarantiaHoras: number;
    if (unidadEdad === 'HORA') {
      edadGarantiaHoras = valorEdad;
    } else if (unidadEdad === 'DÍA') {
      edadGarantiaHoras = valorEdad * 24;
    } else {
      edadGarantiaHoras = valorEdad * 24; // Default to days
    }

    // Get timestamps
    const fechaMuestreo = (ensayo.muestra.muestreo as any).fecha_muestreo_ts 
      ? new Date((ensayo.muestra.muestreo as any).fecha_muestreo_ts)
      : createSafeDate(ensayo.muestra.muestreo.fecha_muestreo);
    const fechaEnsayo = (ensayo as any).fecha_ensayo_ts
      ? new Date((ensayo as any).fecha_ensayo_ts)
      : createSafeDate(ensayo.fecha_ensayo);
    
    if (!fechaMuestreo || !fechaEnsayo) return null;

    // Calculate guarantee age end (matching database function)
    const fechaEdadGarantia = new Date(fechaMuestreo.getTime() + (edadGarantiaHoras * 60 * 60 * 1000));

    // Calculate tolerance (matching database function)
    let toleranceMinutes: number;
    if (edadGarantiaHoras <= 24) {
      toleranceMinutes = 30; // ±30 minutes
    } else if (edadGarantiaHoras <= 72) {
      toleranceMinutes = 120; // ±2 hours
    } else if (edadGarantiaHoras <= 168) {
      toleranceMinutes = 360; // ±6 hours
    } else if (edadGarantiaHoras <= 336) {
      toleranceMinutes = 720; // ±12 hours
    } else if (edadGarantiaHoras <= 672) {
      toleranceMinutes = 1200; // ±20 hours
    } else {
      toleranceMinutes = 2880; // ±48 hours
    }
    
    const toleranceHours = toleranceMinutes / 60;
    
    // Calculate guarantee age window (matching database logic)
    const guaranteeAgeStart = new Date(fechaEdadGarantia.getTime() - (toleranceMinutes * 60 * 1000));
    const guaranteeAgeEnd = new Date(fechaEdadGarantia.getTime() + (toleranceMinutes * 60 * 1000));
    
    // Calculate differences
    const diffFromStart = (fechaEnsayo.getTime() - guaranteeAgeStart.getTime()) / (1000 * 60 * 60);
    const diffFromEnd = (fechaEnsayo.getTime() - fechaEdadGarantia.getTime()) / (1000 * 60 * 60);
    const diffFromGuarantee = Math.abs(diffFromEnd);
    
    // Determine status (matching database logic)
    const isAtGuaranteeAge = fechaEnsayo >= guaranteeAgeStart; // Any time after (guarantee_age_end - tolerance)
    const isOutOfTime = isAtGuaranteeAge && fechaEnsayo > guaranteeAgeEnd; // After (guarantee_age_end + tolerance)
    const isTooEarly = fechaEnsayo < guaranteeAgeStart; // Before (guarantee_age_end - tolerance)
    
    return {
      valorEdad,
      unidadEdad,
      clasificacion,
      edadGarantiaHoras,
      fechaMuestreo,
      fechaEnsayo,
      fechaEdadGarantia,
      guaranteeAgeStart,
      guaranteeAgeEnd,
      diffFromStart,
      diffFromEnd,
      diffFromGuarantee,
      toleranceHours,
      toleranceMinutes,
      isAtGuaranteeAge,
      isOutOfTime,
      isTooEarly,
      isEdadGarantia: ensayo.is_edad_garantia || false
    };
  };

  const guaranteeAgeMetrics = calculateGuaranteeAgeMetrics();

  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Breadcrumbs */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/quality">Calidad</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/quality/ensayos">Ensayos</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>Detalle</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            Detalle de Ensayo
          </h1>
          <p className="text-gray-500">
            Información completa del ensayo y sus resultados
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Información de la muestra */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Información del Ensayo
            </CardTitle>
            <CardDescription>
              Detalles del ensayo y la muestra evaluada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Muestra</p>
                  <p className="text-lg font-semibold">{ensayo.muestra?.identificacion}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Tipo de Muestra</p>
                  <Badge variant={ensayo.muestra?.tipo_muestra === 'CILINDRO' ? 'default' : 'secondary'}>
                    {ensayo.muestra?.tipo_muestra}
                  </Badge>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Fecha de Ensayo</p>
                  <p className="font-medium">
                    {(ensayo as any).fecha_ensayo_ts 
                      ? format(new Date((ensayo as any).fecha_ensayo_ts), 'PPP \u00e1 HH:mm', { locale: es })
                      : formatDate(ensayo.fecha_ensayo, 'PPP')}
                  </p>
                  {guaranteeAgeMetrics && (
                    <p className="text-xs text-gray-400 mt-1">
                      Muestreo: {format(guaranteeAgeMetrics.fechaMuestreo, 'PPP \u00e1 HH:mm', { locale: es })}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                 <div>
                  <p className="text-sm font-medium text-gray-500">Clasificación</p>
                  <Badge variant={clasificacion === 'MR' ? 'outline' : 'default'}>
                    {clasificacion} {plannedAgeValue ?? ''} {plannedAgeUnitLabel}
                  </Badge>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Planta</p>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span>{ensayo.muestra?.muestreo?.planta}</span>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Remisión</p>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-gray-400" />
                    <span>{ensayo.muestra?.muestreo?.manual_reference}</span>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Cliente</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span>
                      {(ensayo.muestra?.muestreo?.remision as any)?.orders &&
                       (ensayo.muestra?.muestreo?.remision as any)?.orders.clients?.business_name || 'No disponible'}
                    </span>
                  </div>
                </div>

                {timeDifference && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tiempo desde Muestreo</p>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className={`font-medium ${
                        timeDifference.isNegative ? 'text-amber-600' : 'text-gray-900'
                      }`}>
                        {ensayo.tiempo_desde_carga ? formatDatabaseTime(ensayo.tiempo_desde_carga) : timeDifference.formatted}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Muestreo: {guaranteeAgeMetrics?.fechaMuestreo ? format(guaranteeAgeMetrics.fechaMuestreo, 'PPP \u00e1 HH:mm', { locale: es }) : 'No disponible'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Resultados del ensayo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Resultados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Carga (kg)</p>
                <p className="text-2xl font-bold">{ensayo.carga_kg.toLocaleString('es-MX')}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Resistencia Calculada</p>
                <p className="text-2xl font-bold">{ensayo.resistencia_calculada.toFixed(2)} kg/cm²</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">% Cumplimiento</p>
                <div className="flex items-center gap-2">
                  <div 
                    className={`text-2xl font-bold ${
                      ensayo.porcentaje_cumplimiento >= 100 ? 'text-green-600' : 'text-amber-600'
                    }`}
                  >
                    {ensayo.porcentaje_cumplimiento.toFixed(2)}%
                  </div>
                  {ensayo.porcentaje_cumplimiento >= 100 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-amber-600" />
                  )}
                </div>
              </div>
              
              {/* Factor de Corrección - Solo para FC */}
              {clasificacion === 'FC' && (
                <>
                  <Separator />
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-gray-500" />
                        <Label htmlFor="factor-correccion" className="text-sm font-medium text-gray-700">
                          Factor de Corrección
                        </Label>
                      </div>
                      <Switch
                        id="factor-correccion"
                        checked={usarFactorCorreccion}
                        onCheckedChange={setUsarFactorCorreccion}
                      />
                    </div>
                    
                    {usarFactorCorreccion && (
                      <>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="valor-factor" className="text-sm text-gray-600 whitespace-nowrap">
                            Factor:
                          </Label>
                          <Input
                            id="valor-factor"
                            type="number"
                            step="0.01"
                            min="0.5"
                            max="1.5"
                            value={factorCorreccion}
                            onChange={(e) => setFactorCorreccion(parseFloat(e.target.value) || 0.92)}
                            className="w-24 h-8 text-center"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="bg-white rounded-lg p-3 border">
                            <p className="text-xs font-medium text-gray-500 mb-1">Resistencia Corregida</p>
                            <p className="text-lg font-bold text-blue-600">
                              {(ensayo.resistencia_calculada * factorCorreccion).toFixed(2)} kg/cm²
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border">
                            <p className="text-xs font-medium text-gray-500 mb-1">% Cumplimiento Corregido</p>
                            <div className="flex items-center gap-1">
                              {(() => {
                                const porcentajeCorregido = ensayo.porcentaje_cumplimiento * factorCorreccion;
                                return (
                                  <>
                                    <span className={`text-lg font-bold ${
                                      porcentajeCorregido >= 100 ? 'text-green-600' : 'text-amber-600'
                                    }`}>
                                      {porcentajeCorregido.toFixed(2)}%
                                    </span>
                                    {porcentajeCorregido >= 100 ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-amber-600" />
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-xs text-gray-500 italic">
                          El factor de corrección multiplica la resistencia original para obtener valores ajustados.
                        </p>
                      </>
                    )}
                  </div>
                </>
              )}
              
              <Separator />
              
              <div>
                <p className="text-sm font-medium text-gray-500">Observaciones</p>
                <p className="text-gray-700 mt-1">
                  {ensayo.observaciones || 'Sin observaciones'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Guarantee Age and Tolerance Metrics */}
      {guaranteeAgeMetrics && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Métricas de Edad Garantía
            </CardTitle>
            <CardDescription>
              Información sobre el cumplimiento de la edad garantía y tolerancias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Edad Garantía Status */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Estado Edad Garantía</p>
                <div className="flex items-center gap-2">
                  {guaranteeAgeMetrics.isEdadGarantia ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Edad Garantía
                      </Badge>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-gray-400" />
                      <Badge variant="secondary">
                        No Garantía
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              {/* Tolerance Status */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Estado Tolerancia</p>
                <div className="flex items-center gap-2">
                  {guaranteeAgeMetrics.isTooEarly ? (
                    <>
                      <Clock3 className="h-5 w-5 text-blue-600" />
                      <Badge variant="outline" className="border-blue-300 text-blue-700">
                        Muy Temprano
                      </Badge>
                    </>
                  ) : guaranteeAgeMetrics.isAtGuaranteeAge && !guaranteeAgeMetrics.isOutOfTime ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Dentro Tolerancia
                      </Badge>
                    </>
                  ) : guaranteeAgeMetrics.isOutOfTime ? (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <Badge variant="destructive">
                        Fuera Tolerancia
                      </Badge>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <Badge variant="outline" className="border-amber-300 text-amber-700">
                        Fuera Tolerancia
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              {/* Out of Time Status */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Estado Tiempo</p>
                <div className="flex items-center gap-2">
                  {guaranteeAgeMetrics.isOutOfTime ? (
                    <>
                      <Clock3 className="h-5 w-5 text-red-600" />
                      <Badge variant="destructive">
                        Fuera de Tiempo
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Clock className="h-5 w-5 text-green-600" />
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        A Tiempo
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              {/* Age Difference */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Diferencia de Edad</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className={`font-medium ${
                    guaranteeAgeMetrics.isTooEarly ? 'text-blue-600' :
                    guaranteeAgeMetrics.isAtGuaranteeAge && !guaranteeAgeMetrics.isOutOfTime ? 'text-green-600' :
                    guaranteeAgeMetrics.isOutOfTime ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {guaranteeAgeMetrics.diffFromEnd < 0 ? '-' : '+'}
                    {Math.abs(guaranteeAgeMetrics.diffFromEnd) < 1 
                      ? `${Math.round(Math.abs(guaranteeAgeMetrics.diffFromEnd) * 60)} min`
                      : Math.abs(guaranteeAgeMetrics.diffFromEnd) < 24
                        ? `${Math.abs(guaranteeAgeMetrics.diffFromEnd).toFixed(1)} hrs`
                        : `${(Math.abs(guaranteeAgeMetrics.diffFromEnd) / 24).toFixed(1)} días`
                    }
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Tolerancia: {guaranteeAgeMetrics.toleranceHours < 24 ? `±${guaranteeAgeMetrics.toleranceHours} hrs` : `±${guaranteeAgeMetrics.toleranceHours / 24} días`}
                </p>
              </div>
            </div>

            {/* Additional Details */}
            <Separator className="my-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-700">Edad Garantía del Diseño</p>
                <p className="text-gray-600">
                  {guaranteeAgeMetrics.valorEdad} {guaranteeAgeMetrics.unidadEdad === 'HORA' ? 'horas' : 'días'}
                </p>
                <p className="text-xs text-gray-500">
                  ({guaranteeAgeMetrics.edadGarantiaHoras} horas)
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Fecha Garantía Exacta</p>
                <p className="text-gray-600">
                  {format(guaranteeAgeMetrics.fechaEdadGarantia, 'PPP \u00e1 HH:mm', { locale: es })}
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Ventana de Tolerancia</p>
                <p className="text-gray-600">
                  {format(guaranteeAgeMetrics.guaranteeAgeStart, 'PPP \u00e1 HH:mm', { locale: es })}
                </p>
                <p className="text-xs text-gray-500">
                  hasta {format(guaranteeAgeMetrics.guaranteeAgeEnd, 'PPP \u00e1 HH:mm', { locale: es })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Evidencias */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5 text-primary" />
            Evidencias
          </CardTitle>
          <CardDescription>
            Fotografías y documentos del ensayo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ensayo.evidencias && ensayo.evidencias.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {ensayo.evidencias.map((evidencia) => (
                <a 
                  key={evidencia.id}
                  href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/quality/${evidencia.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="aspect-square relative mb-2 overflow-hidden rounded bg-gray-100">
                    {evidencia.tipo_archivo.startsWith('image/') ? (
                      <Image
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/quality/${evidencia.path}`}
                        alt={evidencia.nombre_archivo}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {evidencia.nombre_archivo}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {evidencia.tamano_kb} KB
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              No hay evidencias registradas para este ensayo
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 