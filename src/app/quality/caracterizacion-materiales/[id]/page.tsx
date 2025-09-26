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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  AlertTriangle, 
  ChevronLeft, 
  FileText, 
  Calendar,
  Building,
  User,
  FlaskConical,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  ArrowUpRight,
  Beaker,
  MapPin,
  Factory,
  TestTube,
  Edit3,
  Play,
  Pause,
  BarChart3,
  Microscope,
  Scale,
  Droplets,
  Layers
} from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import EstudioFormModal from '@/components/quality/caracterizacion/EstudioFormModal';

interface EstudioDetalle {
  id: string;
  id_planta: string;
  planta: string;
  tipo_material: string;
  nombre_material: string;
  mina_procedencia: string;
  ubicacion: string;
  tamaño: string;
  origen_material: string;
  tecnico: string;
  id_muestra: string;
  tipo_estudio: string[];
  fecha_muestreo: string;
  fecha_elaboracion: string;
  created_at: string;
  updated_at: string;
  estudios_seleccionados: EstudioSeleccionadoDetalle[];
}

interface EstudioSeleccionadoDetalle {
  id: string;
  tipo_estudio: string;
  nombre_estudio: string;
  descripcion: string;
  norma_referencia: string;
  estado: 'pendiente' | 'en_proceso' | 'completado';
  fecha_programada: string;
  fecha_completado?: string;
  resultados?: any;
  observaciones?: string;
}

export default function EstudioDetallePage() {
  const params = useParams();
  const router = useRouter();
  const { session, profile, isLoading } = useAuthBridge();
  const [estudio, setEstudio] = useState<EstudioDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingEstado, setUpdatingEstado] = useState<string | null>(null);
  const [selectedEstudio, setSelectedEstudio] = useState<EstudioSeleccionadoDetalle | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);

  // Cargar detalle del estudio
  useEffect(() => {
    const loadEstudioDetalle = async () => {
      if (!params.id) return;

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('alta_estudio')
          .select(`
            *,
            estudios_seleccionados (
              id,
              tipo_estudio,
              nombre_estudio,
              descripcion,
              norma_referencia,
              estado,
              fecha_programada,
              fecha_completado,
              resultados,
              observaciones
            )
          `)
          .eq('id', params.id)
          .single();

        if (error) throw error;
        setEstudio(data);
      } catch (error) {
        console.error('Error loading estudio:', error);
        setError('Error al cargar el detalle del estudio');
      } finally {
        setLoading(false);
      }
    };

    if (session && profile) {
      loadEstudioDetalle();
    }
  }, [params.id, session, profile]);

  const handleEstadoChange = async (estudioId: string, nuevoEstado: 'pendiente' | 'en_proceso' | 'completado') => {
    try {
      setUpdatingEstado(estudioId);
      
      const updateData: any = { 
        estado: nuevoEstado,
        updated_at: new Date().toISOString()
      };
      
      // Si se marca como completado, agregar fecha de completado
      if (nuevoEstado === 'completado') {
        updateData.fecha_completado = new Date().toISOString().split('T')[0];
      } else {
        updateData.fecha_completado = null;
      }

      const { error } = await supabase
        .from('estudios_seleccionados')
        .update(updateData)
        .eq('id', estudioId);

      if (error) throw error;

      // Actualizar estado local
      setEstudio(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          estudios_seleccionados: prev.estudios_seleccionados.map(est => 
            est.id === estudioId 
              ? { 
                  ...est, 
                  estado: nuevoEstado,
                  fecha_completado: nuevoEstado === 'completado' ? new Date().toISOString().split('T')[0] : undefined
                }
              : est
          )
        };
      });

      toast.success(`Estado actualizado a: ${nuevoEstado}`);
    } catch (error) {
      console.error('Error updating estado:', error);
      toast.error('Error al actualizar el estado');
    } finally {
      setUpdatingEstado(null);
    }
  };

  const handleOpenFormModal = (estudioSeleccionado: EstudioSeleccionadoDetalle) => {
    setSelectedEstudio(estudioSeleccionado);
    setShowFormModal(true);
  };

  const handleCloseFormModal = () => {
    setSelectedEstudio(null);
    setShowFormModal(false);
  };

  const handleSaveEstudio = async (estudioId: string, resultados: any) => {
    // Actualizar el estado local
    setEstudio(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        estudios_seleccionados: prev.estudios_seleccionados.map(est => 
          est.id === estudioId 
            ? { 
                ...est, 
                resultados: resultados,
                estado: 'completado' as const,
                fecha_completado: new Date().toISOString().split('T')[0]
              }
            : est
        )
      };
    });

    toast.success('Estudio completado y resultados guardados exitosamente');
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'completado': return 'bg-primary text-white';
      case 'en_proceso': return 'bg-yellow-500 text-white';
      case 'pendiente': return 'bg-primary/10 text-primary';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'completado': return CheckCircle;
      case 'en_proceso': return Clock;
      case 'pendiente': return AlertCircle;
      default: return AlertCircle;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getEstudioIcon = (nombreEstudio: string) => {
    switch (nombreEstudio) {
      case 'Análisis Granulométrico':
        return BarChart3;
      case 'Densidad':
        return Scale;
      case 'Masa Volumétrico':
        return Layers;
      case 'Pérdida por Lavado':
        return Droplets;
      case 'Absorción':
        return TestTube;
      default:
        return Microscope;
    }
  };

  const ResumenResultados = ({ e }: { e: EstudioSeleccionadoDetalle }) => {
    const nombre = e.nombre_estudio;
    const r: any = e.resultados || {};
    const Pill = ({ label, value }: { label: string; value: string | number }) => (
      <span className="inline-flex items-center rounded-md bg-blue-100 text-blue-800 text-[10px] font-medium px-2 py-0.5 mr-1 mb-1">
        {label}: {value}
      </span>
    );

    if (!e.resultados) {
      return <span className="text-xs text-gray-500">Sin resultados</span>;
    }

    switch (nombre) {
      case 'Análisis Granulométrico': {
        const mallas = Array.isArray(r.mallas) ? r.mallas : [];
        const totalRet = mallas.reduce((sum: number, m: any) => sum + (m.retenido || 0), 0);
        const conDatos = mallas.filter((m: any) => m.retenido !== null && m.retenido !== undefined).length;
        return (
          <div>
            <Pill label="Mallas c/datos" value={conDatos} />
            <Pill label="Suma retenidos (g)" value={Number(totalRet.toFixed(1))} />
          </div>
        );
      }
      case 'Densidad': {
        return (
          <div>
            {r.densidad_relativa != null && <Pill label="Relativa" value={r.densidad_relativa} />}
            {r.densidad_sss != null && <Pill label="SSS" value={r.densidad_sss} />}
            {r.absorcion != null && <Pill label="Absorción (%)" value={r.absorcion} />}
          </div>
        );
      }
      case 'Masa Volumétrico': {
        return (
          <div>
            {r.masa_volumetrica_suelta != null && (
              <Pill label="Suelta (kg/m³)" value={r.masa_volumetrica_suelta} />
            )}
            {r.masa_volumetrica_compactada != null && (
              <Pill label="Compactada (kg/m³)" value={r.masa_volumetrica_compactada} />
            )}
          </div>
        );
      }
      case 'Pérdida por Lavado': {
        return (
          <div>
            {r.perdida_lavado != null && <Pill label="Pérdida (g)" value={r.perdida_lavado} />}
            {r.porcentaje_perdida != null && <Pill label="Pérdida (%)" value={r.porcentaje_perdida} />}
          </div>
        );
      }
      case 'Absorción': {
        return (
          <div>
            {r.absorcion_porcentaje != null && (
              <Pill label="Absorción (%)" value={r.absorcion_porcentaje} />
            )}
          </div>
        );
      }
      default:
        return <span className="text-xs text-gray-500">Resultados registrados</span>;
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Cargando detalle del estudio...</span>
        </div>
      </div>
    );
  }

  if (!session || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert className="max-w-md">
          <AlertDescription>
            No se pudo verificar la autenticación. Por favor, inicie sesión nuevamente.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Verificar permisos de acceso a la página
  const hasPageAccess = profile.role === 'QUALITY_TEAM' || profile.role === 'EXECUTIVE';
  
  if (!hasPageAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert className="max-w-md">
          <AlertDescription>
            No tiene permisos para acceder a esta página. Solo usuarios con rol QUALITY_TEAM o EXECUTIVE pueden ver los detalles de caracterización.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error || !estudio) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert className="max-w-md">
          <AlertDescription>
            {error || 'No se encontró el estudio solicitado'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      
      {/* Breadcrumbs */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/quality">Calidad</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/quality/caracterizacion-materiales">Caracterización de Materiales</BreadcrumbLink>
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
            Estudio de Caracterización
          </h1>
          <p className="text-gray-500">
            ID de Muestra: {estudio.id_muestra}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>
      
      {/* Tabbed Interface */}
      <Tabs defaultValue="general" className="mb-8">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">Información General</TabsTrigger>
          <TabsTrigger value="estudios">Estudios Programados</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Información del Estudio - estilo tabloide sin cartas */}
            <div className="lg:col-span-2">
              <div className="mb-3">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <FlaskConical className="h-5 w-5 text-gray-600" />
                  Información del Estudio
                </h3>
                <p className="text-sm text-gray-500">Detalles del estudio de caracterización de materiales</p>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs uppercase text-gray-500 flex items-center gap-2">
                      <Beaker className="h-4 w-4" /> ID de Muestra
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">{estudio.id_muestra}</p>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs uppercase text-gray-500 flex items-center gap-2">
                      <Building className="h-4 w-4" /> Planta
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">{estudio.planta}</p>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs uppercase text-gray-500 flex items-center gap-2">
                      <TestTube className="h-4 w-4" /> Material
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">{estudio.nombre_material}</p>
                    <p className="text-xs text-gray-500">{estudio.tipo_material}</p>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs uppercase text-gray-500 flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Ubicación
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">{estudio.ubicacion}</p>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs uppercase text-gray-500 flex items-center gap-2">
                      <Factory className="h-4 w-4" /> Mina de Procedencia
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">{estudio.mina_procedencia}</p>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs uppercase text-gray-500 flex items-center gap-2">
                      <User className="h-4 w-4" /> Técnico
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">{estudio.tecnico}</p>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs uppercase text-gray-500 flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Fecha de Muestreo
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">{formatDate(estudio.fecha_muestreo)}</p>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs uppercase text-gray-500 flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Fecha de Elaboración
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">{formatDate(estudio.fecha_elaboracion)}</p>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs uppercase text-gray-500 flex items-center gap-2">
                      <FlaskConical className="h-4 w-4" /> Tipo de Análisis
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {estudio.tipo_estudio.map((tipo, index) => (
                        <Badge key={index} variant="secondary" className="text-blue-700 bg-blue-100">
                          {tipo}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {estudio.tamaño && (
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs uppercase text-gray-500 flex items-center gap-2">
                        <Layers className="h-4 w-4" /> Tamaño
                      </p>
                      <p className="mt-1 font-semibold text-gray-900">{estudio.tamaño}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Summary Card */}
            <Card className="border border-gray-200 bg-white shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-gray-600" />
                  Resumen de Estudios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Total Programados</span>
                    <Badge variant="outline">{estudio.estudios_seleccionados.length}</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Completados</span>
                    <Badge className="bg-primary/10 text-primary">
                      {estudio.estudios_seleccionados.filter(e => e.estado === 'completado').length}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">En Proceso</span>
                    <Badge className="bg-yellow-100 text-yellow-800">
                      {estudio.estudios_seleccionados.filter(e => e.estado === 'en_proceso').length}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Pendientes</span>
                    <Badge className="bg-gray-100 text-gray-800">
                      {estudio.estudios_seleccionados.filter(e => e.estado === 'pendiente').length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Resumen de Pruebas del Estudio */}
            <div>
              <div className="mb-3">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-primary">
                  <FileText className="h-5 w-5 text-primary" />
                  Resumen de Pruebas del Estudio
                </h3>
                <p className="text-sm text-primary/70">Resultados de los estudios completados</p>
              </div>

              {(() => {
                const completados = estudio.estudios_seleccionados.filter(e => e.estado === 'completado' && e.resultados);
                
                if (completados.length === 0) {
                  return (
                    <div className="text-center py-8 bg-primary/5 rounded-lg border border-primary/20">
                      <TestTube className="h-12 w-12 text-primary/40 mx-auto mb-3" />
                      <p className="text-primary font-medium">No hay estudios completados</p>
                      <p className="text-primary/70 text-sm">Los resultados aparecerán aquí una vez completados</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {completados.map((estudioSel) => {
                      const IconComponent = getEstudioIcon(estudioSel.nombre_estudio);
                      return (
                        <div key={estudioSel.id} className="border border-primary/20 bg-primary/5 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-2 mb-3">
                            <IconComponent className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold text-primary text-sm">{estudioSel.nombre_estudio}</h4>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-primary/70">Completado:</span>
                              <span className="text-primary font-medium">
                                {formatDate(estudioSel.fecha_completado)}
                              </span>
                            </div>
                            
                            <div className="pt-2 border-t border-primary/20">
                              <p className="text-xs text-primary/70 mb-2 font-medium">Resultados:</p>
                              <ResumenResultados e={estudioSel} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="estudios" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Estudios Programados ({estudio.estudios_seleccionados.length})
              </CardTitle>
              <CardDescription>
                Gestione el estado de cada estudio de caracterización
              </CardDescription>
            </CardHeader>
            <CardContent>
              {estudio.estudios_seleccionados.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No hay estudios programados para esta muestra</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {estudio.estudios_seleccionados.map((estudioSel) => {
                    const IconComponent = getEstadoIcon(estudioSel.estado);
                    const EstudioIcon = getEstudioIcon(estudioSel.nombre_estudio);
                    const isCompleted = estudioSel.estado === 'completado';
                    const isInProgress = estudioSel.estado === 'en_proceso';
                    
                    return (
                      <Card 
                        key={estudioSel.id} 
                        className={`relative overflow-hidden transition-all duration-200 hover:shadow-lg border-primary/20 bg-primary/5`}
                      >
                        {/* Status indicator */}
                        <div className={`absolute top-0 right-0 w-0 h-0 border-l-[40px] border-b-[40px] border-l-transparent ${
                          isCompleted ? 'border-b-primary' : isInProgress ? 'border-b-yellow-500' : 'border-b-gray-400'
                        }`}>
                          <IconComponent className={`absolute -bottom-7 -right-7 h-4 w-4 text-white`} />
                        </div>

                        <CardContent className="p-6">
                          <div className="flex items-start gap-4 mb-4">
                            <div className={`p-3 rounded-xl bg-white/60`}>
                              <EstudioIcon className={`h-6 w-6 ${
                                isCompleted ? 'text-primary' : isInProgress ? 'text-yellow-600' : 'text-gray-500'
                              }`} />
                            </div>
                            <div className="flex-1">
                              <h3 className={`font-bold text-lg mb-1 text-primary`}>
                                {estudioSel.nombre_estudio}
                              </h3>
                              <Badge className={`${getEstadoColor(estudioSel.estado)} text-xs`}>
                                {estudioSel.estado.charAt(0).toUpperCase() + estudioSel.estado.slice(1)}
                              </Badge>
                            </div>
                          </div>

                          <p className={`text-sm mb-4 text-primary/70`}>
                            {estudioSel.descripcion}
                          </p>

                          <div className={`space-y-2 text-xs mb-4 text-primary/70`}>
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3" />
                              <span><strong>Norma:</strong> {estudioSel.norma_referencia}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              <span><strong>Programado:</strong> {formatDate(estudioSel.fecha_programada)}</span>
                            </div>
                            {estudioSel.fecha_completado && (
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-3 w-3" />
                                <span><strong>Completado:</strong> {formatDate(estudioSel.fecha_completado)}</span>
                              </div>
                            )}
                          </div>

                          <Separator className="my-4" />

                          <div className="flex flex-col gap-2">
                            {/* Botón principal para dar de alta información */}
                            <Button
                              variant={isCompleted ? "outline" : "default"}
                              size="sm"
                              className={`w-full ${isCompleted ? 'border-primary/30 text-primary hover:bg-primary/5' : 'bg-primary hover:bg-primary/90 text-white'}`}
                              onClick={() => handleOpenFormModal(estudioSel)}
                            >
                              <Edit3 className="h-4 w-4 mr-2" />
                              {isCompleted ? 'Ver/Editar Datos' : 'Dar de Alta'}
                            </Button>

                            {/* Botones de cambio de estado */}
                            <div className="flex gap-1">
                              {updatingEstado === estudioSel.id ? (
                                <div className="flex items-center justify-center w-full py-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              ) : (
                                <>
                                  {estudioSel.estado !== 'pendiente' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="flex-1 text-xs"
                                      onClick={() => handleEstadoChange(estudioSel.id, 'pendiente')}
                                    >
                                      <Pause className="h-3 w-3 mr-1" />
                                      Pendiente
                                    </Button>
                                  )}
                                  {estudioSel.estado !== 'en_proceso' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="flex-1 text-xs"
                                      onClick={() => handleEstadoChange(estudioSel.id, 'en_proceso')}
                                    >
                                      <Play className="h-3 w-3 mr-1" />
                                      En Proceso
                                    </Button>
                                  )}
                                  {estudioSel.estado !== 'completado' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="flex-1 text-xs text-primary hover:text-primary/80 hover:bg-primary/5"
                                      onClick={() => handleEstadoChange(estudioSel.id, 'completado')}
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Completar
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {estudioSel.observaciones && (
                            <div className="mt-4 p-3 bg-white/50 rounded-lg border">
                              <p className="text-xs"><strong>Observaciones:</strong> {estudioSel.observaciones}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Formulario */}
      {selectedEstudio && (
        <EstudioFormModal
          isOpen={showFormModal}
          onClose={handleCloseFormModal}
          estudio={selectedEstudio}
          onSave={handleSaveEstudio}
        />
      )}
    </div>
  );
}
