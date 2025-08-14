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
  Calculator
} from 'lucide-react';
import { fetchEnsayoById } from '@/services/qualityService';
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
                  <p className="text-sm font-medium text-gray-500">Edad Programada y Unidad</p>
                  <p className="font-medium">{plannedAgeValue ?? '—'} {plannedAgeUnitLabel}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Fecha Ensayo</p>
                  <p className="font-medium">
                    {formatDate(ensayo.fecha_ensayo, 'PPP')}
                  </p>
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
                    <span>{ensayo.muestra?.muestreo?.remision?.remision_number}</span>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Cliente</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span>
                      {ensayo.muestra?.muestreo?.remision?.orders && 
                       ensayo.muestra?.muestreo?.remision?.orders.clients?.business_name || 'No disponible'}
                    </span>
                  </div>
                </div>
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