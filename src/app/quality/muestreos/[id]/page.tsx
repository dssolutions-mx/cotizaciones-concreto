'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
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
  ChevronLeft, 
  FileText, 
  Calendar,
  Building,
  User,
  Truck,
  Beaker,
  CheckCircle,
  Clock
} from 'lucide-react';
import { fetchMuestreoById } from '@/services/qualityService';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { MuestreoWithRelations } from '@/types/quality';
import Link from 'next/link';
import { formatDate, createSafeDate } from '@/lib/utils';

export default function MuestreoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuthBridge();
  const [muestreo, setMuestreo] = useState<MuestreoWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchMuestreoDetails = async () => {
      if (!params.id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const muestreoId = Array.isArray(params.id) ? params.id[0] : params.id;
        const data = await fetchMuestreoById(muestreoId);
        setMuestreo(data);
      } catch (err) {
        console.error('Error al cargar detalle de muestreo:', err);
        setError('No se pudo cargar la información del muestreo');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMuestreoDetails();
  }, [params.id]);

  // Verificar roles permitidos
  const allowedRoles = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE'];
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
            <p className="text-gray-500">Cargando detalle del muestreo...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !muestreo) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => router.back()} 
          className="mb-6"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-3xl mx-auto">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
            <div>
              <h3 className="text-xl font-medium text-red-800 mb-2">
                Error al cargar el muestreo
              </h3>
              <p className="text-red-700">
                {error || 'No se encontró el muestreo solicitado'}
              </p>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            className="mt-2"
            onClick={() => {
              const muestreoId = Array.isArray(params.id) ? params.id[0] : params.id;
              if (muestreoId) {
                fetchMuestreoById(muestreoId);
              }
            }}
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  // Agrupar muestras por tipo
  const cilindros = muestreo.muestras?.filter(m => m.tipo_muestra === 'CILINDRO') || [];
  const vigas = muestreo.muestras?.filter(m => m.tipo_muestra === 'VIGA') || [];
  const cubos = muestreo.muestras?.filter(m => m.tipo_muestra === 'CUBO') || [];
  const firstEnsayoId = (
    muestreo.muestras?.flatMap(m => m.ensayos || []) || []
  ).map(e => e.id)[0];

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
            <BreadcrumbLink href="/quality/muestreos">Muestreos</BreadcrumbLink>
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
            Muestreo #{muestreo.numero_muestreo}
          </h1>
          <p className="text-gray-500">
            Remisión {muestreo.remision?.remision_number || muestreo.manual_reference || 'Sin remisión'}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Información de la remisión */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Información del Muestreo
            </CardTitle>
            <CardDescription>
              Detalles del muestreo y la remisión asociada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Fecha Muestreo</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <p className="font-medium">
                      {formatDate(muestreo.fecha_muestreo, 'PPP')}
                    </p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Planta</p>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-400" />
                    <Badge>{muestreo.planta}</Badge>
                  </div>
                </div>
                
                {/* Tipo de muestreo no disponible en el tipo actual */}
                
                {muestreo.revenimiento_sitio && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Revenimiento en Sitio</p>
                    <p className="font-medium">{muestreo.revenimiento_sitio} cm</p>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Cliente</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <p className="font-medium">{muestreo.remision?.orders?.clients?.business_name || 'No disponible'}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Remisión</p>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-gray-400" />
                    <p className="font-medium">{muestreo.remision?.remision_number || muestreo.manual_reference || 'No disponible'}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Fórmula</p>
                  <p className="font-medium">{muestreo.remision?.recipe?.recipe_code || 'No disponible'}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Resistencia Diseño</p>
                  <p className="font-medium">{muestreo.remision?.recipe?.strength_fc || '-'} kg/cm²</p>
                </div>
              </div>
            </div>
            
            {/* Observaciones removidas: campo no definido en el tipo */}
          </CardContent>
        </Card>
        
        {/* Resumen Muestras */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-primary" />
              Resumen de Muestras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Cilindros</p>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-2xl font-bold">{cilindros.length}</p>
                  <Badge variant="outline">{cilindros.filter(c => c.estado === 'ENSAYADO').length} ensayados</Badge>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Vigas</p>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-2xl font-bold">{vigas.length}</p>
                  <Badge variant="outline">{vigas.filter(v => v.estado === 'ENSAYADO').length} ensayadas</Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Cubos</p>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-2xl font-bold">{cubos.length}</p>
                  <Badge variant="outline">{cubos.filter(c => c.estado === 'ENSAYADO').length} ensayados</Badge>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <p className="text-sm font-medium text-gray-500">Próximo Ensayo</p>
                {muestreo.muestras && muestreo.muestras.some(m => m.estado === 'PENDIENTE') ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <p className="text-amber-600 font-medium">
                      {(() => {
                        const proxima = [...muestreo.muestras]
                          .filter(m => m.estado === 'PENDIENTE' && m.fecha_programada_ensayo)
                          .sort((a, b) => {
                            const dateA = createSafeDate(a.fecha_programada_ensayo!) || new Date();
                            const dateB = createSafeDate(b.fecha_programada_ensayo!) || new Date();
                            return dateA.getTime() - dateB.getTime();
                          })[0];
                        
                        return proxima?.fecha_programada_ensayo 
                          ? formatDate(proxima.fecha_programada_ensayo, 'PPP')
                          : 'Fecha no programada';
                      })()}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <p className="text-green-600">Todos los ensayos completados</p>
                  </div>
                )}
              </div>
              
              <div className="pt-4">
                {firstEnsayoId ? (
                  <Link href={`/quality/ensayos/${firstEnsayoId}`}>
                    <Button className="w-full">
                      Ver Ensayo
                    </Button>
                  </Link>
                ) : (
                  <Button className="w-full" variant="outline" disabled>
                    No hay ensayos
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Listado de muestras */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            Muestras
          </CardTitle>
          <CardDescription>
            Listado de especímenes para ensayo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {muestreo.muestras && muestreo.muestras.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {muestreo.muestras.map((muestra) => (
                <div 
                  key={muestra.id} 
                  className={`border rounded-lg overflow-hidden ${
                    muestra.estado === 'ENSAYADO' 
                      ? 'border-green-200 bg-green-50' 
                      : muestra.estado === 'DESCARTADO' 
                        ? 'border-red-200 bg-red-50'
                        : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant={muestra.tipo_muestra === 'CILINDRO' ? 'default' : 'secondary'}>
                        {muestra.tipo_muestra === 'CILINDRO' ? 'Cilindro' : muestra.tipo_muestra === 'VIGA' ? 'Viga' : 'Cubo'}
                      </Badge>
                      <Badge 
                        variant={
                          muestra.estado === 'ENSAYADO' 
                            ? 'outline' 
                            : muestra.estado === 'DESCARTADO'
                              ? 'destructive'
                              : 'outline'
                        }
                      >
                        {muestra.estado}
                      </Badge>
                    </div>
                    
                    <h3 className="font-medium mb-1">{muestra.identificacion}</h3>
                    
                    {muestra.fecha_programada_ensayo && (
                      <div className="text-xs text-gray-600 mb-2">
                        Ensayo programado: {formatDate(muestra.fecha_programada_ensayo, 'PPP')}
                      </div>
                    )}
                    
                    {muestra.estado === 'PENDIENTE' ? (
                      <Link href={`/quality/ensayos/new?muestra=${muestra.id}`}>
                        <Button size="sm" className="w-full">
                          Registrar Ensayo
                        </Button>
                      </Link>
                    ) : (
                      (muestra.ensayos && muestra.ensayos.length > 0) ? (
                        <Link href={`/quality/ensayos/${muestra.ensayos[0].id}`}>
                          <Button size="sm" variant="outline" className="w-full">
                            Ver Ensayo
                          </Button>
                        </Link>
                      ) : (
                        <Button size="sm" variant="outline" className="w-full" disabled>
                          Ver Ensayo
                        </Button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              No hay muestras registradas para este muestreo
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 