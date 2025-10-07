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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Layers, 
  Search, 
  Filter, 
  Building,
  FlaskConical,
  Mountain,
  Droplet,
  TestTube,
  Package,
  ArrowRight,
  CheckCircle,
  XCircle
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

interface Material {
  id: string;
  material_code: string;
  material_name: string;
  category: string;
  subcategory?: string;
  unit_of_measure: string;
  density?: number;
  specific_gravity?: number;
  absorption_rate?: number;
  fineness_modulus?: number;
  aggregate_type?: 'AR' | 'GR';
  aggregate_size?: number;
  is_active: boolean;
  plant_id?: string;
  supplier_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface MaterialsByCategory {
  agregados: {
    arenas: Material[];
    gravas: Material[];
  };
  cemento: Material[];
  agua: Material[];
  aditivos: Material[];
}

export default function MaterialesPage() {
  const { session, profile, isLoading } = useAuthBridge();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('agregados');

  // Cargar plantas
  useEffect(() => {
    const loadPlants = async () => {
      try {
        const { data, error } = await supabase
          .from('plants')
          .select('id, code, name')
          .eq('is_active', true)
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

  // Cargar materiales
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('materials')
          .select('*')
          .eq('is_active', true)
          .order('material_name');

        if (error) throw error;
        setMaterials(data || []);
      } catch (error) {
        console.error('Error loading materials:', error);
        toast.error('Error al cargar los materiales');
      } finally {
        setLoading(false);
      }
    };

    if (session && profile) {
      loadMaterials();
    }
  }, [session, profile]);

  // Filtrar y organizar materiales por categoría
  const organizedMaterials: MaterialsByCategory = React.useMemo(() => {
    const filtered = materials.filter(material => {
      const matchesSearch = 
        material.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.material_code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPlant = selectedPlant === 'all' || material.plant_id === selectedPlant;

      return matchesSearch && matchesPlant;
    });

    return {
      agregados: {
        arenas: filtered.filter(m => 
          m.category === 'agregado' && 
          (m.aggregate_type === 'AR' || m.subcategory === 'agregado_fino')
        ),
        gravas: filtered.filter(m => 
          m.category === 'agregado' && 
          (m.aggregate_type === 'GR' || m.subcategory === 'agregado_grueso')
        ),
      },
      cemento: filtered.filter(m => m.category === 'cemento'),
      agua: filtered.filter(m => m.category === 'agua'),
      aditivos: filtered.filter(m => m.category === 'aditivo'),
    };
  }, [materials, searchTerm, selectedPlant]);

  const getTotalMaterials = () => {
    return organizedMaterials.agregados.arenas.length +
           organizedMaterials.agregados.gravas.length +
           organizedMaterials.cemento.length +
           organizedMaterials.agua.length +
           organizedMaterials.aditivos.length;
  };

  const renderMaterialTable = (materials: Material[], showAggregateInfo: boolean = false) => {
    if (materials.length === 0) {
      return (
        <div className="text-center py-12">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">No se encontraron materiales</p>
          <p className="text-gray-400">
            {searchTerm || selectedPlant !== 'all' 
              ? 'Intente ajustar los filtros de búsqueda'
              : 'No hay materiales registrados en esta categoría'
            }
          </p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            {showAggregateInfo && (
              <>
                <TableHead>Tamaño</TableHead>
                <TableHead>Tipo</TableHead>
              </>
            )}
            <TableHead>Densidad</TableHead>
            <TableHead>Absorción</TableHead>
            <TableHead>Unidad</TableHead>
            <TableHead>Planta</TableHead>
            <TableHead className="text-center">Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((material) => {
            const plant = plants.find(p => p.id === material.plant_id);
            return (
              <TableRow key={material.id}>
                <TableCell className="font-mono text-sm">{material.material_code}</TableCell>
                <TableCell className="font-medium">{material.material_name}</TableCell>
                {showAggregateInfo && (
                  <>
                    <TableCell>
                      {material.aggregate_size ? `${material.aggregate_size} mm` : '-'}
                    </TableCell>
                    <TableCell>
                      {material.aggregate_type === 'AR' && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          Arena
                        </Badge>
                      )}
                      {material.aggregate_type === 'GR' && (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          Grava
                        </Badge>
                      )}
                      {!material.aggregate_type && '-'}
                    </TableCell>
                  </>
                )}
                <TableCell>
                  {material.density ? `${material.density} kg/m³` : 
                   material.specific_gravity ? `${material.specific_gravity} g/cm³` : '-'}
                </TableCell>
                <TableCell>
                  {material.absorption_rate ? `${(material.absorption_rate * 100).toFixed(2)}%` : '-'}
                </TableCell>
                <TableCell>{material.unit_of_measure}</TableCell>
                <TableCell>
                  {plant ? (
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-gray-400" />
                      <span>{plant.code}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {material.is_active ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Activo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      <XCircle className="h-3 w-3 mr-1" />
                      Inactivo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {(material.category === 'agregado') && (
                    <Link href={`/quality/caracterizacion-materiales?material=${material.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 hover:bg-[#069e2d]/10"
                        title="Ver caracterización"
                      >
                        <FlaskConical className="h-4 w-4 mr-1 text-[#069e2d]" />
                        Caracterización
                      </Button>
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>{isLoading ? 'Verificando autenticación...' : 'Cargando materiales...'}</span>
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
            No tiene permisos para acceder a esta página. Solo usuarios con rol QUALITY_TEAM o EXECUTIVE pueden ver los materiales.
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
              <Layers className="h-8 w-8 text-[#069e2d]" />
              Gestión de Materiales
            </h1>
            <p className="text-gray-600 mt-2">
              Visualice y gestione los materiales por planta y categoría
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/quality/caracterizacion-materiales">
              <Button className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                Caracterización de Materiales
              </Button>
            </Link>
          </div>
        </div>

        {/* Resumen de materiales */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Mountain className="h-4 w-4 text-amber-500" />
                Agregados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-gray-900">
                  {organizedMaterials.agregados.arenas.length + organizedMaterials.agregados.gravas.length}
                </p>
                <div className="text-xs text-gray-600 space-y-0.5">
                  <p>{organizedMaterials.agregados.arenas.length} Arenas</p>
                  <p>{organizedMaterials.agregados.gravas.length} Gravas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-slate-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Package className="h-4 w-4 text-slate-500" />
                Cemento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">{organizedMaterials.cemento.length}</p>
              <p className="text-xs text-gray-600">Tipos de cemento</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Droplet className="h-4 w-4 text-blue-500" />
                Agua
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">{organizedMaterials.agua.length}</p>
              <p className="text-xs text-gray-600">Fuentes de agua</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TestTube className="h-4 w-4 text-purple-500" />
                Aditivos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">{organizedMaterials.aditivos.length}</p>
              <p className="text-xs text-gray-600">Tipos de aditivos</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[#069e2d]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#069e2d]" />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">{getTotalMaterials()}</p>
              <p className="text-xs text-gray-600">Materiales totales</p>
            </CardContent>
          </Card>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Búsqueda general */}
              <div className="space-y-2">
                <Label htmlFor="search">Búsqueda General</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Nombre o código..."
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

              {/* Botón limpiar filtros */}
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedPlant('all');
                  }}
                  className="w-full"
                >
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs de categorías */}
        <Card>
          <CardHeader>
            <CardTitle>Materiales por Categoría</CardTitle>
            <CardDescription>
              Explore los materiales organizados por tipo y planta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="agregados" className="flex items-center gap-2">
                  <Mountain className="h-4 w-4" />
                  Agregados
                </TabsTrigger>
                <TabsTrigger value="cemento" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Cemento
                </TabsTrigger>
                <TabsTrigger value="agua" className="flex items-center gap-2">
                  <Droplet className="h-4 w-4" />
                  Agua
                </TabsTrigger>
                <TabsTrigger value="aditivos" className="flex items-center gap-2">
                  <TestTube className="h-4 w-4" />
                  Aditivos
                </TabsTrigger>
              </TabsList>

              {/* Tab Agregados */}
              <TabsContent value="agregados" className="space-y-6 mt-6">
                {/* Arenas */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Arenas ({organizedMaterials.agregados.arenas.length})
                    </h3>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      Agregado Fino
                    </Badge>
                  </div>
                  {renderMaterialTable(organizedMaterials.agregados.arenas, true)}
                </div>

                {/* Gravas */}
                <div className="pt-6 border-t">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Gravas ({organizedMaterials.agregados.gravas.length})
                    </h3>
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                      Agregado Grueso
                    </Badge>
                  </div>
                  {renderMaterialTable(organizedMaterials.agregados.gravas, true)}
                </div>
              </TabsContent>

              {/* Tab Cemento */}
              <TabsContent value="cemento" className="mt-6">
                {renderMaterialTable(organizedMaterials.cemento)}
              </TabsContent>

              {/* Tab Agua */}
              <TabsContent value="agua" className="mt-6">
                {renderMaterialTable(organizedMaterials.agua)}
              </TabsContent>

              {/* Tab Aditivos */}
              <TabsContent value="aditivos" className="mt-6">
                {renderMaterialTable(organizedMaterials.aditivos)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

