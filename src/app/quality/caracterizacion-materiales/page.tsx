'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  AlertCircle
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
      return { estado: 'completado', label: 'Completado', color: 'text-green-600', icon: CheckCircle };
    } else if (enProceso > 0 || completados > 0) {
      return { estado: 'en_proceso', label: 'En proceso', color: 'text-yellow-600', icon: Clock };
    } else {
      return { estado: 'pendiente', label: 'Pendiente', color: 'text-blue-600', icon: Clock };
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
    if (tipos.includes('Caracterización interna')) return 'bg-blue-100 text-blue-800';
    if (tipos.includes('Validación')) return 'bg-green-100 text-green-800';
    if (tipos.includes('Nuevo prospecto')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
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
              <FlaskConical className="h-8 w-8 text-blue-600" />
              Histórico de Caracterización de Materiales
            </h1>
            <p className="text-gray-600 mt-2">
              Gestione y revise todos los estudios de caracterización de agregados
            </p>
          </div>
          <Link href="/quality/caracterizacion-materiales/nuevo">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Estudio
            </Button>
          </Link>
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
              <div className="text-center py-8">
                <FlaskConical className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No se encontraron estudios</p>
                <p className="text-gray-400">
                  {estudios.length === 0 
                    ? 'Aún no hay estudios de caracterización registrados'
                    : 'Intente ajustar los filtros de búsqueda'
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Muestra</TableHead>
                      <TableHead>Planta</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Mina</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Tipo de Análisis</TableHead>
                      <TableHead>Estudios Programados</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-center">Ver Detalle</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEstudios.map((estudio) => (
                      <TableRow key={estudio.id}>
                        <TableCell className="font-medium">
                          {estudio.id_muestra}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-gray-400" />
                            {estudio.planta}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{estudio.nombre_material}</div>
                            <div className="text-sm text-gray-500">{estudio.tipo_material}</div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {estudio.mina_procedencia}
                        </TableCell>
                        <TableCell>{estudio.tecnico}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {estudio.tipo_estudio.map((tipo, index) => (
                              <Badge 
                                key={index}
                                className={getTipoEstudioBadgeColor(estudio.tipo_estudio)}
                                variant="secondary"
                              >
                                {tipo}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {estudio.estudios_seleccionados && estudio.estudios_seleccionados.length > 0 ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {estudio.estudios_seleccionados.length} estudios
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {estudio.estudios_seleccionados.slice(0, 2).map((est, idx) => (
                                  <Badge 
                                    key={idx}
                                    variant="secondary"
                                    className={`text-xs ${
                                      est.estado === 'completado' ? 'bg-green-100 text-green-800' :
                                      est.estado === 'en_proceso' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {est.nombre_estudio.split(' ')[0]}
                                  </Badge>
                                ))}
                                {estudio.estudios_seleccionados.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{estudio.estudios_seleccionados.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">Sin estudios</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const estadoInfo = getEstadoGeneral(estudio);
                            const IconComponent = estadoInfo.icon;
                            return (
                              <div className="flex items-center gap-2">
                                <IconComponent className={`h-4 w-4 ${estadoInfo.color}`} />
                                <span className={`text-sm font-medium ${estadoInfo.color}`}>
                                  {estadoInfo.label}
                                </span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-blue-50"
                            title="Ver detalle y registrar resultados"
                            onClick={() => handleNavigateToDetail(estudio)}
                          >
                            <ArrowRight className="h-4 w-4 text-blue-600" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Ver detalles"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              title="Eliminar"
                              onClick={() => handleDelete(estudio.id, estudio.id_muestra)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </CardContent>
      </Card>
          </div>
    </div>
  );
}