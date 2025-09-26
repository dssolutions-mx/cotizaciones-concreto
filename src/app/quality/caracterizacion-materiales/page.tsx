'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Loader2, 
  FlaskConical, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Trash2,
  Calendar,
  Building,
  FileText,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertCircle,
  Factory
} from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Link from 'next/link';

interface Plant {
  id: string;
  code: string;
  name: string;
}

interface EstudioHistorico {
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
  estudios_seleccionados?: EstudioSeleccionadoHistorico[];
}

interface EstudioSeleccionadoHistorico {
  id: string;
  tipo_estudio: string;
  nombre_estudio: string;
  descripcion: string;
  norma_referencia: string;
  estado: 'pendiente' | 'en_proceso' | 'completado';
  fecha_programada: string;
  fecha_completado?: string;
}

export default function CaracterizacionMaterialesHistoricoPage() {
  const { session, profile, isLoading } = useAuthBridge();
  const [estudios, setEstudios] = useState<EstudioHistorico[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [selectedTipoEstudio, setSelectedTipoEstudio] = useState<string>('all');

  // Cargar plantas
  useEffect(() => {
    const loadPlants = async () => {
      try {
        const { data, error } = await supabase
          .from('plants')
          .select('id, code, name')
          .order('code');

        if (error) throw error;
        setPlants(data || []);
      } catch (error) {
        console.error('Error loading plants:', error);
        toast.error('Error al cargar las plantas');
      }
    };

    if (session && profile) {
      loadPlants();
    }
  }, [session, profile]);

  // Cargar estudios
  useEffect(() => {
    const loadEstudios = async () => {
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
              fecha_completado
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setEstudios(data || []);
      } catch (error) {
        console.error('Error loading estudios:', error);
        toast.error('Error al cargar el histórico de estudios');
      } finally {
        setLoading(false);
      }
    };

    if (session && profile) {
      loadEstudios();
    }
  }, [session, profile]);

  // Filtrar estudios
  const filteredEstudios = estudios.filter(estudio => {
    const matchesSearch = 
      estudio.id_muestra.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estudio.nombre_material.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estudio.tecnico.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estudio.mina_procedencia.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPlant = !selectedPlant || selectedPlant === 'all' || estudio.id_planta === selectedPlant;
    const matchesMaterial = !selectedMaterial || selectedMaterial === 'all' || estudio.tipo_material === selectedMaterial;
    const matchesTipoEstudio = !selectedTipoEstudio || selectedTipoEstudio === 'all' || estudio.tipo_estudio.includes(selectedTipoEstudio);

    return matchesSearch && matchesPlant && matchesMaterial && matchesTipoEstudio;
  });

  const handleDelete = async (id: string, idMuestra: string) => {
    if (!confirm(`¿Está seguro de eliminar el estudio ${idMuestra}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('alta_estudio')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEstudios(prev => prev.filter(e => e.id !== id));
      toast.success('Estudio eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting estudio:', error);
      toast.error('Error al eliminar el estudio');
    }
  };

  const handleNavigateToDetail = (estudio: EstudioHistorico) => {
    window.location.href = `/quality/caracterizacion-materiales/${estudio.id}`;
  };

  const getEstadoGeneral = (estudio: EstudioHistorico) => {
    const estudiosSeleccionados = estudio.estudios_seleccionados || [];
    
    if (estudiosSeleccionados.length === 0) {
      return { estado: 'sin_estudios', label: 'Sin estudios', color: 'text-gray-500', icon: AlertCircle };
    }
    
    const completados = estudiosSeleccionados.filter(e => e.estado === 'completado').length;
    const enProceso = estudiosSeleccionados.filter(e => e.estado === 'en_proceso').length;
    const pendientes = estudiosSeleccionados.filter(e => e.estado === 'pendiente').length;
    
    if (completados === estudiosSeleccionados.length) {
      return { estado: 'completado', label: 'Completado', color: 'text-[#069e2d]', icon: CheckCircle };
    } else if (enProceso > 0 || completados > 0) {
      return { estado: 'en_proceso', label: 'En proceso', color: 'text-amber-600', icon: Clock };
    } else {
      return { estado: 'pendiente', label: 'Pendiente', color: 'text-gray-600', icon: Clock };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTipoEstudioBadgeColor = (tipos: string[]) => {
    if (tipos.includes('Caracterización interna')) return 'bg-[#069e2d]/10 text-[#069e2d] border-[#069e2d]/20';
    if (tipos.includes('Validación')) return 'bg-[#069e2d]/15 text-[#069e2d] border-[#069e2d]/25';
    if (tipos.includes('Nuevo prospecto')) return 'bg-[#069e2d]/20 text-[#069e2d] border-[#069e2d]/30';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (isLoading || loading) {
        return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>{isLoading ? 'Verificando autenticación...' : 'Cargando histórico...'}</span>
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
            No tiene permisos para acceder a esta página. Solo usuarios con rol QUALITY_TEAM o EXECUTIVE pueden ver el histórico de caracterización.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FlaskConical className="h-8 w-8 text-[#069e2d]" />
              Histórico de Caracterización de Materiales
            </h1>
            <p className="text-gray-600 mt-2">
              Gestione y revise todos los estudios de caracterización de agregados
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/quality/caracterizacion-materiales/diagnostico">
              <Button variant="outline" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Diagnóstico DB
              </Button>
            </Link>
            <Link href="/quality/caracterizacion-materiales/nuevo">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Estudio
              </Button>
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros de Búsqueda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Búsqueda general */}
              <div className="space-y-2">
                <Label htmlFor="search">Búsqueda General</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="ID, material, técnico..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filtro por planta */}
              <div className="space-y-2">
                <Label htmlFor="plant-filter">Planta</Label>
                <Select value={selectedPlant} onValueChange={setSelectedPlant}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las plantas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las plantas</SelectItem>
                    {plants.map((plant) => (
                      <SelectItem key={plant.id} value={plant.id}>
                        {plant.code} - {plant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por tipo de material */}
              <div className="space-y-2">
                <Label htmlFor="material-filter">Tipo de Material</Label>
                <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los materiales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los materiales</SelectItem>
                    <SelectItem value="Arena">Arena</SelectItem>
                    <SelectItem value="Grava">Grava</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por tipo de estudio */}
              <div className="space-y-2">
                <Label htmlFor="tipo-estudio-filter">Tipo de Análisis</Label>
                <Select value={selectedTipoEstudio} onValueChange={setSelectedTipoEstudio}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="Caracterización interna">Caracterización interna</SelectItem>
                    <SelectItem value="Validación">Validación</SelectItem>
                    <SelectItem value="Nuevo prospecto">Nuevo prospecto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Botón limpiar filtros */}
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedPlant('all');
                    setSelectedMaterial('all');
                    setSelectedTipoEstudio('all');
                  }}
                  className="w-full"
                >
                  Limpiar Filtros
                </Button>
                      </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Estudios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Estudios de Caracterización ({filteredEstudios.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredEstudios.length === 0 ? (
              <div className="text-center py-12">
                <FlaskConical className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">No se encontraron estudios</p>
                <p className="text-gray-400">
                  {estudios.length === 0 
                    ? 'Aún no hay estudios de caracterización registrados'
                    : 'Intente ajustar los filtros de búsqueda'
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredEstudios.map((estudio) => {
                  const estadoInfo = getEstadoGeneral(estudio);
                  const IconComponent = estadoInfo.icon;
                  const completados = estudio.estudios_seleccionados?.filter(e => e.estado === 'completado').length || 0;
                  const total = estudio.estudios_seleccionados?.length || 0;
                  const progreso = total > 0 ? (completados / total) * 100 : 0;
                  
                  return (
                    <Card 
                      key={estudio.id} 
                      className="relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-[#069e2d] bg-white"
                    >
                      {/* Header de la tarjeta */}
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <FlaskConical className="h-5 w-5 text-[#069e2d]" />
                              <CardTitle className="text-lg font-bold text-gray-900">
                                {estudio.id_muestra}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Building className="h-4 w-4" />
                              <span className="font-medium">{estudio.planta}</span>
                            </div>
                          </div>
                          
                          {/* Estado general */}
                          <div className="flex items-center gap-2">
                            <IconComponent className={`h-4 w-4 ${estadoInfo.color}`} />
                            <Badge className={`text-xs ${
                              estadoInfo.estado === 'completado' ? 'bg-[#069e2d] text-white' :
                              estadoInfo.estado === 'en_proceso' ? 'bg-amber-500 text-white' :
                              'bg-gray-500 text-white'
                            }`}>
                              {estadoInfo.label}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* Información del material */}
                        <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Material</p>
                            <p className="font-semibold text-gray-900">{estudio.nombre_material}</p>
                            <p className="text-sm text-gray-600">{estudio.tipo_material}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Técnico</p>
                            <p className="font-semibold text-gray-900">{estudio.tecnico}</p>
                          </div>
                        </div>

                        {/* Mina de procedencia */}
                        <div className="flex items-center gap-2 text-sm">
                          <Factory className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Mina:</span>
                          <span className="font-medium text-gray-900 truncate">{estudio.mina_procedencia}</span>
                        </div>

                        {/* Tipos de análisis */}
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Tipos de Análisis</p>
                          <div className="flex flex-wrap gap-1">
                            {estudio.tipo_estudio.map((tipo, index) => (
                              <Badge 
                                key={index}
                                className={`${getTipoEstudioBadgeColor(estudio.tipo_estudio)} border text-xs`}
                                variant="outline"
                              >
                                {tipo}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Estudios programados */}
                        <div className="border-t pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-gray-900">Estudios Programados</p>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[#069e2d]"></div>
                              <span className="text-sm font-bold text-[#069e2d]">
                                {completados}/{total}
                              </span>
                            </div>
                          </div>

                          {total > 0 ? (
                            <div className="space-y-3">
                              {/* Barra de progreso */}
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-[#069e2d] to-[#069e2d]/80 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${progreso}%` }}
                                ></div>
                              </div>

                              {/* Lista de estudios */}
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {estudio.estudios_seleccionados?.slice(0, 5).map((est, idx) => (
                                  <div 
                                    key={idx}
                                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-gray-50 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {est.estado === 'completado' ? (
                                        <CheckCircle className="h-3 w-3 text-[#069e2d] flex-shrink-0" />
                                      ) : est.estado === 'en_proceso' ? (
                                        <Clock className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                      ) : (
                                        <AlertCircle className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                      )}
                                      <span className="text-xs text-gray-700 truncate">
                                        {est.nombre_estudio}
                                      </span>
                                    </div>
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                      est.estado === 'completado' 
                                        ? 'bg-[#069e2d]' :
                                      est.estado === 'en_proceso' 
                                        ? 'bg-amber-500' :
                                        'bg-gray-300'
                                    }`}></div>
                                  </div>
                                ))}
                                {total > 5 && (
                                  <div className="text-center py-1">
                                    <span className="text-xs text-[#069e2d] font-medium">
                                      +{total - 5} estudios más
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2 text-gray-400 py-4 bg-gray-50 rounded-lg">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-sm">Sin estudios programados</span>
                            </div>
                          )}
                        </div>
                      </CardContent>

                      {/* Footer con acciones */}
                      <CardFooter className="pt-4 border-t bg-gray-50/50">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            <span>Muestreo: {formatDate(estudio.fecha_muestreo)}</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-[#069e2d]/10"
                              title="Ver detalles"
                            >
                              <Eye className="h-4 w-4 text-gray-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-[#069e2d]/10"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4 text-gray-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-[#069e2d]/10"
                              title="Ver detalle y registrar resultados"
                              onClick={() => handleNavigateToDetail(estudio)}
                            >
                              <ArrowRight className="h-4 w-4 text-[#069e2d]" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Eliminar"
                              onClick={() => handleDelete(estudio.id, estudio.id_muestra)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
  );
}