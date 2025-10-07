'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  CheckCircle,
  Clock,
  AlertCircle,
  Edit3,
  Play,
  Pause,
  BarChart3,
  Microscope,
  Scale,
  Droplets,
  Layers,
  TestTube,
  Printer
} from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { EstudioPDF } from '@/components/quality/caracterizacion/EstudioPDF';
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
  const searchParams = useSearchParams();
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
      <span className="inline-flex items-center rounded-md bg-[#069e2d]/10 text-[#069e2d] text-[10px] font-medium px-2 py-0.5 mr-1 mb-1">
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
          {/* Botón de Imprimir Reporte Completo */}
          {estudio.estudios_seleccionados.some(e => e.estado === 'completado' && e.resultados) && (
            <PDFDownloadLink
              document={
                <EstudioPDF
                  estudio={{
                    alta_estudio: estudio,
                    estudios: estudio.estudios_seleccionados.filter(e => e.estado === 'completado' && e.resultados),
                    limites: [],
                    tamaño: estudio.estudios_seleccionados.find(e => e.resultados?.tamaño)?.resultados?.tamaño
                  }}
                />
              }
              fileName={`Reporte_Caracterizacion_${estudio.nombre_material}_${format(new Date(), 'yyyyMMdd')}.pdf`}
            >
              {({ loading }) => (
                <Button
                  variant="default"
                  className="bg-[#069E2D] hover:bg-[#069E2D]/90 text-white"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generando PDF...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir Reporte
                    </>
                  )}
                </Button>
              )}
            </PDFDownloadLink>
          )}
          
          <Button variant="outline" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>
      
      {/* Estudios Programados - Página simplificada */}
      <div className="mb-8">
        {/* Contenido de información general ahora está en el modal del ojito */}
        
        {/* Estudios Programados - Contenido principal */}
        <div className="mt-6">
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
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {estudio.estudios_seleccionados.map((estudioSel) => {
                    const IconComponent = getEstadoIcon(estudioSel.estado);
                    const EstudioIcon = getEstudioIcon(estudioSel.nombre_estudio);
                    const isCompleted = estudioSel.estado === 'completado';
                    const isInProgress = estudioSel.estado === 'en_proceso';
                    
                    return (
                      <Card 
                        key={estudioSel.id} 
                        className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02] border-l-4 ${
                          isCompleted ? 'border-l-[#069e2d] bg-gradient-to-br from-[#069e2d]/5 to-[#069e2d]/10' :
                          isInProgress ? 'border-l-amber-500 bg-gradient-to-br from-amber-50 to-amber-100/50' :
                          'border-l-gray-400 bg-gradient-to-br from-gray-50 to-gray-100/50'
                        }`}
                      >
                        {/* Header con estado */}
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-3 rounded-xl shadow-sm ${
                                isCompleted ? 'bg-[#069e2d]/10 text-[#069e2d]' :
                                isInProgress ? 'bg-amber-100 text-amber-600' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                <EstudioIcon className="h-6 w-6" />
                              </div>
                              <div>
                                <h3 className="font-bold text-lg text-gray-900 leading-tight">
                                  {estudioSel.nombre_estudio}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">
                                  {estudioSel.descripcion}
                                </p>
                              </div>
                            </div>
                            
                            {/* Badge de estado flotante */}
                            <div className="flex flex-col items-end gap-2">
                              <Badge className={`${getEstadoColor(estudioSel.estado)} text-xs font-semibold px-3 py-1 shadow-sm`}>
                                <IconComponent className="h-3 w-3 mr-1" />
                                {estudioSel.estado.charAt(0).toUpperCase() + estudioSel.estado.slice(1)}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          {/* Información técnica */}
                          <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
                              <FileText className="h-4 w-4 text-gray-500" />
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Norma de Referencia</p>
                                <p className="text-sm font-medium text-gray-900">{estudioSel.norma_referencia}</p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
                                <Calendar className="h-4 w-4 text-gray-500" />
                                <div>
                                  <p className="text-xs text-gray-500 uppercase tracking-wide">Programado</p>
                                  <p className="text-sm font-medium text-gray-900">{formatDate(estudioSel.fecha_programada)}</p>
                                </div>
                              </div>
                              
                              {estudioSel.fecha_completado && (
                                <div className="flex items-center gap-2 p-2 bg-[#069e2d]/10 rounded-lg">
                                  <CheckCircle className="h-4 w-4 text-[#069e2d]" />
                                  <div>
                                    <p className="text-xs text-[#069e2d] uppercase tracking-wide font-semibold">Completado</p>
                                    <p className="text-sm font-medium text-[#069e2d]">{formatDate(estudioSel.fecha_completado)}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Progreso visual */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">Progreso del Estudio</span>
                              <span className="text-xs font-bold text-[#069e2d]">
                                {isCompleted ? '100%' : isInProgress ? '50%' : '0%'}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  isCompleted ? 'bg-gradient-to-r from-[#069e2d] to-[#069e2d]/80 w-full' :
                                  isInProgress ? 'bg-gradient-to-r from-amber-400 to-amber-500 w-1/2' :
                                  'bg-gray-300 w-0'
                                }`}
                              ></div>
                            </div>
                          </div>

                          {/* Observaciones si existen */}
                          {estudioSel.observaciones && (
                            <div className="p-3 bg-[#069e2d]/10 border border-[#069e2d]/20 rounded-lg">
                              <p className="text-xs text-[#069e2d] font-semibold mb-1">Observaciones:</p>
                              <p className="text-sm text-gray-800">{estudioSel.observaciones}</p>
                            </div>
                          )}
                        </CardContent>

                        {/* Footer con acciones */}
                        <CardFooter className="pt-4 border-t bg-white/30">
                          <div className="w-full space-y-3">
                            {/* Botón principal */}
                            <Button
                              variant={isCompleted ? "outline" : "default"}
                              size="sm"
                              className={`w-full font-semibold ${
                                isCompleted 
                                  ? 'border-[#069e2d]/30 text-[#069e2d] hover:bg-[#069e2d]/5 bg-white' 
                                  : 'bg-[#069e2d] hover:bg-[#069e2d]/90 text-white shadow-md'
                              }`}
                              onClick={() => handleOpenFormModal(estudioSel)}
                            >
                              <Edit3 className="h-4 w-4 mr-2" />
                              {isCompleted ? 'Ver/Editar Resultados' : 'Registrar Datos'}
                            </Button>

                            {/* Botones de cambio de estado - Ocultos por solicitud */}
                          </div>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
