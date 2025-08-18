'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { es } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { Loader2, AlertTriangle, Plus, FileText, ChevronRight, Filter, X } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { fetchMuestreos } from '@/services/qualityService';
import type { MuestreoWithRelations } from '@/types/quality';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { subMonths } from 'date-fns';
import { formatDate } from '@/lib/utils';
import { usePlantContext } from '@/contexts/PlantContext';

export default function MuestreosPage() {
  const router = useRouter();
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();
  const [muestreos, setMuestreos] = useState<MuestreoWithRelations[]>([]);
  const [filteredMuestreos, setFilteredMuestreos] = useState<MuestreoWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filtros - sin fecha por defecto
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [planta, setPlanta] = useState<string>('todas');
  const [clasificacion, setClasificacion] = useState<string>('todas');
  const [estadoMuestreo, setEstadoMuestreo] = useState<string>('todos');
  
  // Opciones de ordenación
  const [sortBy, setSortBy] = useState<string>('fecha');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const loadMuestreos = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await fetchMuestreos({
          fechaDesde: dateRange?.from,
          fechaHasta: dateRange?.to,
          plant_id: currentPlant?.id
        });
        setMuestreos(data);
        applyFilters(data);
      } catch (err) {
        console.error('Error loading muestreos:', err);
        setError('Error al cargar los muestreos');
      } finally {
        setLoading(false);
      }
    };
    
    loadMuestreos();
  }, [dateRange, currentPlant?.id]);

  // Aplicar filtros y ordenación
  const applyFilters = (data: MuestreoWithRelations[] = muestreos) => {
    let filtered = [...data];
    
    // Filtrar por búsqueda
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        m.remision?.remision_number?.toString().toLowerCase().includes(search) ||
        m.remision?.orders?.clients?.business_name?.toLowerCase().includes(search) ||
        m.remision?.recipe?.recipe_code?.toLowerCase().includes(search) ||
        m.manual_reference?.toLowerCase().includes(search)
      );
    }
    
    // Filtrar por planta
    if (planta && planta !== 'todas') {
      filtered = filtered.filter(m => m.planta === planta);
    }
    
    // Filtrar por clasificación
    if (clasificacion && clasificacion !== 'todas') {
      filtered = filtered.filter(m => {
        // Determinar clasificación basada en notas de receta
        const recipeNotes = m.remision?.recipe?.recipe_versions?.[0]?.notes || '';
        return recipeNotes.includes(clasificacion);
      });
    }
    
    // Filtrar por estado del muestreo
    if (estadoMuestreo && estadoMuestreo !== 'todos') {
      filtered = filtered.filter(m => {
        if (!m.muestras || m.muestras.length === 0) return false;
        
        switch (estadoMuestreo) {
          case 'completado':
            return m.muestras.every(muestra => muestra.estado === 'ENSAYADO');
          case 'en-proceso':
            return m.muestras.some(muestra => muestra.estado === 'ENSAYADO') && 
                   !m.muestras.every(muestra => muestra.estado === 'ENSAYADO');
          case 'pendiente':
            return m.muestras.every(muestra => muestra.estado === 'PENDIENTE');
          default:
            return true;
        }
      });
    }
    
    // Ordenar resultados
    filtered.sort((a, b) => {
      let valA, valB;
      
      switch (sortBy) {
        case 'fecha':
          valA = new Date(a.fecha_muestreo || 0).getTime();
          valB = new Date(b.fecha_muestreo || 0).getTime();
          break;
        case 'remision':
          valA = a.remision?.remision_number || 0;
          valB = b.remision?.remision_number || 0;
          break;
        case 'f_c':
          valA = a.remision?.recipe?.strength_fc || 0;
          valB = b.remision?.recipe?.strength_fc || 0;
          break;
        default:
          valA = a.fecha_muestreo ? new Date(a.fecha_muestreo).getTime() : 0;
          valB = b.fecha_muestreo ? new Date(b.fecha_muestreo).getTime() : 0;
      }
      
      return sortDirection === 'asc' 
        ? (valA > valB ? 1 : -1) 
        : (valA < valB ? 1 : -1);
    });
    
    setFilteredMuestreos(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [searchQuery, planta, clasificacion, estadoMuestreo, sortBy, sortDirection]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
  };

  const handleRowClick = (id: string) => {
    router.push(`/quality/muestreos/${id}`);
  };

  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setPlanta('todas');
    setClasificacion('todas');
    setEstadoMuestreo('todos');
    setDateRange(undefined);
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    
    return sortDirection === 'asc' 
      ? <span className="ml-1">↑</span> 
      : <span className="ml-1">↓</span>;
  };

  // Verificar roles permitidos
  const allowedRoles = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE'];
  const hasAccess = profile && allowedRoles.includes(profile.role);
  
  // Plantas disponibles para el select local (si se quiere usar por código)
  const plantas = ['P001', 'P002', 'P003', 'P004'];
  
  // Clasificaciones
  const clasificaciones = ['FC', 'MR'];
  
  // Estados de muestreo
  const estadosMuestreo = [
    { id: 'completado', label: 'Completado' },
    { id: 'en-proceso', label: 'En Proceso' },
    { id: 'pendiente', label: 'Pendiente' }
  ];

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          
          <p className="text-lg mb-4 text-yellow-700">
            No tienes permiso para acceder a la lista de muestreos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Muestreos de Concreto</h1>
          <p className="text-gray-500">
            Historial de muestreos realizados
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={() => router.push('/quality/muestreos/new')}
            className="bg-primary"
          >
            <Plus className="mr-1 h-4 w-4" />
            Nuevo Muestreo
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-1 h-4 w-4" />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </Button>
        </div>
      </div>
      
      {showFilters && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle>Filtrar Muestreos</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowFilters(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-range">Rango de Fechas</Label>
                <DatePickerWithRange
                  value={dateRange}
                  onChange={handleDateRangeChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="planta">Planta</Label>
                <Select value={planta} onValueChange={setPlanta}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las plantas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las plantas</SelectItem>
                    {plantas.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Nota: para alinear con plant_id y business unit, el filtrado principal se hace usando currentPlant (contexto) */}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="clasificacion">Clasificación</Label>
                <Select value={clasificacion} onValueChange={setClasificacion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las clasificaciones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las clasificaciones</SelectItem>
                    {clasificaciones.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="estado-muestreo">Estado</Label>
                <Select value={estadoMuestreo} onValueChange={setEstadoMuestreo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    {estadosMuestreo.map(estado => (
                      <SelectItem key={estado.id} value={estado.id}>{estado.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <Button 
                onClick={clearFilters} 
                variant="outline"
                size="sm"
                className="mr-2"
              >
                Limpiar Filtros
              </Button>
              <Button 
                onClick={() => setShowFilters(false)}
                size="sm"
              >
                Aplicar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search" className="mb-2 block">Buscar</Label>
              <Input
                id="search"
                placeholder="Buscar por remisión, obra, cliente o receta"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="w-full md:w-48">
              <Label htmlFor="sort-by" className="mb-2 block">Ordenar por</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Fecha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fecha">Fecha</SelectItem>
                  <SelectItem value="remision">Remisión</SelectItem>
                  <SelectItem value="f_c">f'c</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-full md:w-48">
              <Label htmlFor="sort-direction" className="mb-2 block">Dirección</Label>
              <Select
                value={sortDirection}
                onValueChange={(value) => setSortDirection(value as 'asc' | 'desc')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Descendente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descendente</SelectItem>
                  <SelectItem value="asc">Ascendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-600">Cargando muestreos...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
            <span>{error}</span>
          </div>
        </div>
      ) : filteredMuestreos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <FileText className="h-12 w-12 text-gray-300 mb-2" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No se encontraron muestreos</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || planta !== 'todas' || clasificacion !== 'todas' || estadoMuestreo !== 'todos' || dateRange
                ? 'No hay muestreos que coincidan con los filtros seleccionados.'
                : 'No hay muestreos registrados.'}
            </p>
            
            {(searchQuery || planta !== 'todas' || clasificacion !== 'todas' || estadoMuestreo !== 'todos' || dateRange) && (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar Todos los Filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer" 
                  onClick={() => handleSortChange('fecha')}
                >
                  Fecha {renderSortIcon('fecha')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSortChange('remision')}
                >
                  Remisión {renderSortIcon('remision')}
                </TableHead>
                <TableHead>Cliente / Obra</TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSortChange('f_c')}
                >
                  f'c {renderSortIcon('f_c')}
                </TableHead>
                <TableHead>Muestras</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMuestreos.map((muestreo) => (
                <TableRow 
                  key={muestreo.id} 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(muestreo.id as string)}
                >
                  <TableCell>
                    {muestreo.fecha_muestreo 
                      ? formatDate(muestreo.fecha_muestreo, 'dd/MM/yyyy')
                      : 'N/A'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {muestreo.remision?.remision_number || muestreo.manual_reference || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {muestreo.planta || 'Sin planta'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {muestreo.remision?.orders?.clients?.business_name || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Sin obra
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {muestreo.remision?.recipe?.strength_fc || 'N/A'} kg/cm²
                    </div>
                    <div className="text-xs text-gray-500">
                      {muestreo.remision?.recipe?.recipe_code || 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center font-medium">
                      {muestreo.muestras?.length || 0}
                    </div>
                  </TableCell>
                  <TableCell>
                    {muestreo.muestras && muestreo.muestras.every(m => m.estado === 'ENSAYADO') ? (
                      <Badge variant="success" className="bg-green-100 text-green-800 hover:bg-green-200">
                        Completado
                      </Badge>
                    ) : muestreo.muestras && muestreo.muestras.some(m => m.estado === 'ENSAYADO') ? (
                      <Badge variant="warning" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                        En Proceso
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-gray-200">
                        Pendiente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(muestreo.id as string);
                    }}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
} 