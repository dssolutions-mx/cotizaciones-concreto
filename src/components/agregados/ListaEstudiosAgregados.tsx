'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Search, 
  Plus, 
  Eye, 
  Edit, 
  Download,
  Filter,
  Calendar,
  Building,
  User,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Scale,
  Beaker,
  Droplets,
  BarChart3
} from 'lucide-react';
import { VistaListaAgregados, EstudioAgregados } from '@/types/agregados';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ListaEstudiosAgregadosProps {
  estudios: VistaListaAgregados[];
  onVerDetalle: (id: string) => void;
  onEditar: (id: string) => void;
  onNuevoEstudio: () => void;
  onDescargarPDF: (id: string) => void;
  cargando?: boolean;
}

const ICONOS_ESTADO = {
  borrador: Clock,
  completado: CheckCircle,
  aprobado: CheckCircle,
  rechazado: XCircle
};

const COLORES_ESTADO = {
  borrador: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completado: 'bg-blue-100 text-blue-800 border-blue-200',
  aprobado: 'bg-green-100 text-green-800 border-green-200',
  rechazado: 'bg-red-100 text-red-800 border-red-200'
};

const ETIQUETAS_ESTADO = {
  borrador: 'Borrador',
  completado: 'Completado',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado'
};

const ICONOS_ESTUDIOS = {
  'Masa Específica': Scale,
  'Masa Volumétrica': Beaker,
  'Absorción': Droplets,
  'Pérdida por Lavado': Droplets,
  'Granulometría': BarChart3
};

export default function ListaEstudiosAgregados({
  estudios,
  onVerDetalle,
  onEditar,
  onNuevoEstudio,
  onDescargarPDF,
  cargando = false
}: ListaEstudiosAgregadosProps) {
  const [filtros, setFiltros] = useState({
    busqueda: '',
    estado: 'todos',
    planta: 'todas',
    fechaDesde: '',
    fechaHasta: ''
  });

  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const formatearFecha = (fecha: string) => {
    return format(new Date(fecha), "dd/MM/yyyy", { locale: es });
  };

  const estudiosLimpios = estudios || [];

  // Filtrar estudios
  const estudiosFiltrados = estudiosLimpios.filter(estudio => {
    const coincideBusqueda = 
      estudio.cliente.toLowerCase().includes(filtros.busqueda.toLowerCase()) ||
      estudio.tipoMaterial.toLowerCase().includes(filtros.busqueda.toLowerCase()) ||
      estudio.tecnicoResponsable.toLowerCase().includes(filtros.busqueda.toLowerCase());

    const coincideEstado = filtros.estado === 'todos' || estudio.estado === filtros.estado;
    
    const coincidePlanta = filtros.planta === 'todas' || estudio.plantaProcedencia === filtros.planta;

    let coincideFecha = true;
    if (filtros.fechaDesde) {
      coincideFecha = coincideFecha && new Date(estudio.fechaCreacion) >= new Date(filtros.fechaDesde);
    }
    if (filtros.fechaHasta) {
      coincideFecha = coincideFecha && new Date(estudio.fechaCreacion) <= new Date(filtros.fechaHasta);
    }

    return coincideBusqueda && coincideEstado && coincidePlanta && coincideFecha;
  });

  const limpiarFiltros = () => {
    setFiltros({
      busqueda: '',
      estado: 'todos',
      planta: 'todas',
      fechaDesde: '',
      fechaHasta: ''
    });
  };

  const renderEstudiosRealizados = (estudiosRealizados: string[]) => {
    return (
      <div className="flex flex-wrap gap-1">
        {estudiosRealizados.map((estudio, index) => {
          const Icono = ICONOS_ESTUDIOS[estudio as keyof typeof ICONOS_ESTUDIOS] || FileText;
          return (
            <Badge 
              key={index} 
              variant="secondary" 
              className="text-xs flex items-center gap-1"
            >
              <Icono className="h-3 w-3" />
              {estudio}
            </Badge>
          );
        })}
      </div>
    );
  };

  if (cargando) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex justify-between items-center p-4 border rounded">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 bg-gray-200 rounded w-16 animate-pulse"></div>
                    <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estudios de Agregados</h1>
          <p className="text-gray-600">
            Gestión de análisis de caracterización física de agregados
          </p>
        </div>
        <Button onClick={onNuevoEstudio} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Estudio
        </Button>
      </div>

      {/* Barra de búsqueda y filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por cliente, material o técnico..."
                  value={filtros.busqueda}
                  onChange={(e) => setFiltros(prev => ({ ...prev, busqueda: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtros
              </Button>
              
              {(filtros.estado !== 'todos' || filtros.planta !== 'todas' || filtros.fechaDesde || filtros.fechaHasta) && (
                <Button variant="ghost" onClick={limpiarFiltros}>
                  Limpiar
                </Button>
              )}
            </div>
          </div>

          {/* Filtros expandibles */}
          {mostrarFiltros && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <Select
                    value={filtros.estado}
                    onValueChange={(value) => setFiltros(prev => ({ ...prev, estado: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="borrador">Borrador</SelectItem>
                      <SelectItem value="completado">Completado</SelectItem>
                      <SelectItem value="aprobado">Aprobado</SelectItem>
                      <SelectItem value="rechazado">Rechazado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Planta</label>
                  <Select
                    value={filtros.planta}
                    onValueChange={(value) => setFiltros(prev => ({ ...prev, planta: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="P1">Planta 1</SelectItem>
                      <SelectItem value="P2">Planta 2</SelectItem>
                      <SelectItem value="P3">Planta 3</SelectItem>
                      <SelectItem value="P4">Planta 4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha desde</label>
                  <Input
                    type="date"
                    value={filtros.fechaDesde}
                    onChange={(e) => setFiltros(prev => ({ ...prev, fechaDesde: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha hasta</label>
                  <Input
                    type="date"
                    value={filtros.fechaHasta}
                    onChange={(e) => setFiltros(prev => ({ ...prev, fechaHasta: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen de resultados */}
      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>
          Mostrando {estudiosFiltrados.length} de {estudiosLimpios.length} estudios
        </span>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
            <span>Aprobado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
            <span>Completado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-200 rounded"></div>
            <span>Borrador</span>
          </div>
        </div>
      </div>

      {/* Lista de estudios */}
      <Card>
        <CardContent className="p-0">
          {estudiosFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No se encontraron estudios
              </h3>
              <p className="text-gray-600 mb-4">
                {estudiosLimpios.length === 0 
                  ? 'No hay estudios registrados aún.'
                  : 'Intenta ajustar los filtros de búsqueda.'
                }
              </p>
              {estudiosLimpios.length === 0 && (
                <Button onClick={onNuevoEstudio}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primer estudio
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Información General</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Planta</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Estudios</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estudiosFiltrados.map((estudio) => {
                    const IconoEstado = ICONOS_ESTADO[estudio.estado];
                    
                    return (
                      <TableRow key={estudio.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-gray-900">
                              {estudio.tipoMaterial}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Calendar className="h-3 w-3" />
                              {formatearFecha(estudio.fechaCreacion)}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="font-medium text-gray-900">
                            {estudio.cliente}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building className="h-4 w-4 text-gray-400" />
                            <span>{estudio.plantaProcedencia}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">{estudio.tecnicoResponsable}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {renderEstudiosRealizados(estudio.estudiosRealizados)}
                        </TableCell>
                        
                        <TableCell>
                          <Badge className={COLORES_ESTADO[estudio.estado]}>
                            <IconoEstado className="h-3 w-3 mr-1" />
                            {ETIQUETAS_ESTADO[estudio.estado]}
                          </Badge>
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onVerDetalle(estudio.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {estudio.estado !== 'aprobado' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEditar(estudio.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDescargarPDF(estudio.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


