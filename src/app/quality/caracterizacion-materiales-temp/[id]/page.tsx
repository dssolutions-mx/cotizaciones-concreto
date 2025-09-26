'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  ArrowLeft, 
  FlaskConical, 
  Building, 
  User, 
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  Save,
  X
} from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Link from 'next/link';

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
  const [editingEstudio, setEditingEstudio] = useState<string | null>(null);
  const [updatingEstado, setUpdatingEstado] = useState<string | null>(null);

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

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'completado': return 'bg-green-100 text-green-800';
      case 'en_proceso': return 'bg-yellow-100 text-yellow-800';
      case 'pendiente': return 'bg-blue-100 text-blue-800';
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/quality/caracterizacion-materiales">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al Histórico
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <FlaskConical className="h-8 w-8 text-blue-600" />
                Estudio de Caracterización
              </h1>
              <p className="text-gray-600 mt-1">
                ID de Muestra: <span className="font-medium">{estudio.id_muestra}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Planta</p>
                    <p className="font-medium">{estudio.planta}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Material</p>
                  <p className="font-medium">{estudio.nombre_material}</p>
                  <p className="text-sm text-gray-400">{estudio.tipo_material}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Mina de Procedencia</p>
                  <p className="font-medium">{estudio.mina_procedencia}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Técnico</p>
                    <p className="font-medium">{estudio.tecnico}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ubicación</p>
                  <p className="font-medium">{estudio.ubicacion}</p>
                </div>
                {estudio.tamaño && (
                  <div>
                    <p className="text-sm text-gray-500">Tamaño</p>
                    <Badge variant="outline">{estudio.tamaño}</Badge>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Fecha de Muestreo</p>
                    <p className="font-medium">{formatDate(estudio.fecha_muestreo)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha de Elaboración</p>
                  <p className="font-medium">{formatDate(estudio.fecha_elaboracion)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tipo de Análisis</p>
                  <div className="flex flex-wrap gap-1">
                    {estudio.tipo_estudio.map((tipo, index) => (
                      <Badge key={index} variant="secondary">{tipo}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estudios Programados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Estudios Programados ({estudio.estudios_seleccionados.length})
            </CardTitle>
            <CardDescription>
              Gestione el estado y resultados de cada estudio de caracterización
            </CardDescription>
          </CardHeader>
          <CardContent>
            {estudio.estudios_seleccionados.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No hay estudios programados para esta muestra</p>
              </div>
            ) : (
              <div className="space-y-4">
                {estudio.estudios_seleccionados.map((estudioSel) => {
                  const IconComponent = getEstadoIcon(estudioSel.estado);
                  return (
                    <div key={estudioSel.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{estudioSel.nombre_estudio}</h3>
                            <Badge className={getEstadoColor(estudioSel.estado)}>
                              <IconComponent className="h-3 w-3 mr-1" />
                              {estudioSel.estado.charAt(0).toUpperCase() + estudioSel.estado.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-gray-600 mb-2">{estudioSel.descripcion}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span><strong>Norma:</strong> {estudioSel.norma_referencia}</span>
                            <span><strong>Programado:</strong> {formatDate(estudioSel.fecha_programada)}</span>
                            {estudioSel.fecha_completado && (
                              <span><strong>Completado:</strong> {formatDate(estudioSel.fecha_completado)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {updatingEstado === estudioSel.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              {estudioSel.estado !== 'pendiente' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEstadoChange(estudioSel.id, 'pendiente')}
                                >
                                  Pendiente
                                </Button>
                              )}
                              {estudioSel.estado !== 'en_proceso' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEstadoChange(estudioSel.id, 'en_proceso')}
                                >
                                  En Proceso
                                </Button>
                              )}
                              {estudioSel.estado !== 'completado' && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleEstadoChange(estudioSel.id, 'completado')}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Completar
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      
                      {estudioSel.observaciones && (
                        <div className="mt-3 p-3 bg-gray-50 rounded">
                          <p className="text-sm"><strong>Observaciones:</strong> {estudioSel.observaciones}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
