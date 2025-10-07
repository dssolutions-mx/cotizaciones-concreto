'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  Layers,
  Search,
  Filter,
  Box,
  Droplet,
  Factory,
  Mountain,
  FlaskConical,
  Plus,
  Eye,
  ArrowRight,
  Building,
  AlertCircle,
  FileText,
  Upload,
} from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Link from 'next/link';
import MaterialCertificateManager from '@/components/quality/MaterialCertificateManager';

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
  strength_class?: string;
  aggregate_type?: 'AR' | 'GR';
  aggregate_size?: number;
  aggregate_lithology?: string;
  is_active: boolean;
  plant_id?: string;
  created_at: string;
  updated_at: string;
}

export default function EstudiosPage() {
  const { session, profile, isLoading } = useAuthBridge();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('agregados');

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

  // Filtrar materiales
  const getFilteredMaterials = (category: string, subcategory?: string) => {
    return materials.filter((material) => {
      // Filtro por planta
      const matchesPlant = selectedPlant === 'all' || material.plant_id === selectedPlant;

      // Filtro por búsqueda
      const matchesSearch =
        searchTerm === '' ||
        material.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.material_code.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtro por categoría
      let matchesCategory = false;
      if (category === 'agregado') {
        matchesCategory = material.category === 'agregado';
        if (subcategory) {
          if (subcategory === 'arena') {
            matchesCategory = matchesCategory && (material.aggregate_type === 'AR' || material.subcategory === 'agregado_fino');
          } else if (subcategory === 'grava') {
            matchesCategory = matchesCategory && (material.aggregate_type === 'GR' || material.subcategory === 'agregado_grueso');
          }
        }
      } else {
        matchesCategory = material.category === category;
      }

      return matchesPlant && matchesSearch && matchesCategory;
    });
  };

  // Obtener materiales por categoría
  const agregadosArena = getFilteredMaterials('agregado', 'arena');
  const agregadosGrava = getFilteredMaterials('agregado', 'grava');
  const cementos = getFilteredMaterials('cemento');
  const aguas = getFilteredMaterials('agua');
  const aditivos = getFilteredMaterials('aditivo');

  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);

  const MaterialTable = ({ materials }: { materials: Material[] }) => {
    if (materials.length === 0) {
      return (
        <div className="text-center py-12">
          <Box className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">No se encontraron materiales</p>
          <p className="text-gray-400">
            {selectedPlant === 'all'
              ? 'Intente ajustar los filtros de búsqueda'
              : 'No hay materiales registrados para esta planta y categoría'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {materials.map((material) => {
          const plant = plants.find((p) => p.id === material.plant_id);
          const isExpanded = expandedMaterialId === material.id;
          
          return (
            <Card key={material.id} className="overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Material Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {material.category === 'agregado' ? (
                          <Mountain className="h-5 w-5 text-amber-500" />
                        ) : material.category === 'cemento' ? (
                          <Factory className="h-5 w-5 text-slate-500" />
                        ) : material.category === 'agua' ? (
                          <Droplet className="h-5 w-5 text-blue-500" />
                        ) : (
                          <FlaskConical className="h-5 w-5 text-purple-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">
                            {material.material_name}
                          </h3>
                          {material.subcategory && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {material.subcategory.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {material.material_code}
                          </span>
                          {plant && (
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              <span>{plant.code}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedMaterialId(isExpanded ? null : material.id)}
                      className="h-8 px-3"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      {isExpanded ? 'Ocultar' : 'Certificados'}
                    </Button>
                    {material.category === 'agregado' && (
                      <Link href="/quality/caracterizacion-materiales/nuevo">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-[#069e2d] hover:text-[#069e2d] hover:bg-[#069e2d]/10"
                        >
                          <FlaskConical className="h-4 w-4 mr-1" />
                          Caracterizar
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Expanded Certificate Section */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Certificados de Calidad
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Suba certificados de calidad en formato PDF (máx. 10MB)
                      </p>
                    </div>
                    <MaterialCertificateManager
                      materialId={material.id}
                      materialName={material.material_name}
                    />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
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
            No tiene permisos para acceder a esta página. Solo usuarios con rol QUALITY_TEAM o
            EXECUTIVE pueden ver los materiales.
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
              Estudios de Materiales
            </h1>
            <p className="text-gray-600 mt-2">
              Consulte y administre los materiales por planta y categoría antes de crear estudios
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/quality/caracterizacion-materiales">
              <Button className="flex items-center gap-2 bg-[#069e2d] hover:bg-[#069e2d]/90">
                <FlaskConical className="h-4 w-4" />
                Estudios de Caracterización
                <ArrowRight className="h-4 w-4" />
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

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Agregados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {agregadosArena.length + agregadosGrava.length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {agregadosArena.length} arenas, {agregadosGrava.length} gravas
                  </p>
                </div>
                <Mountain className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-slate-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Cementos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{cementos.length}</p>
                  <p className="text-xs text-gray-500 mt-1">materiales</p>
                </div>
                <Factory className="h-8 w-8 text-slate-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Agua</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{aguas.length}</p>
                  <p className="text-xs text-gray-500 mt-1">fuentes</p>
                </div>
                <Droplet className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Aditivos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{aditivos.length}</p>
                  <p className="text-xs text-gray-500 mt-1">tipos</p>
                </div>
                <FlaskConical className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

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
                  <Factory className="h-4 w-4" />
                  Cemento
                </TabsTrigger>
                <TabsTrigger value="agua" className="flex items-center gap-2">
                  <Droplet className="h-4 w-4" />
                  Agua
                </TabsTrigger>
                <TabsTrigger value="aditivos" className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  Aditivos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="agregados" className="space-y-6 mt-6">
                {/* Arenas */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Arenas ({agregadosArena.length})
                    </h3>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      Agregado Fino
                    </Badge>
                  </div>
                  <MaterialTable materials={agregadosArena} />
                </div>

                {/* Gravas */}
                <div className="pt-6 border-t">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Gravas ({agregadosGrava.length})
                    </h3>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      Agregado Grueso
                    </Badge>
                  </div>
                  <MaterialTable materials={agregadosGrava} />
                </div>
              </TabsContent>

              <TabsContent value="cemento" className="mt-6">
                <MaterialTable materials={cementos} />
              </TabsContent>

              <TabsContent value="agua" className="mt-6">
                <MaterialTable materials={aguas} />
              </TabsContent>

              <TabsContent value="aditivos" className="mt-6">
                <MaterialTable materials={aditivos} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Información adicional */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Nota:</strong> Para realizar estudios de caracterización de agregados (arenas y
            gravas), haga clic en el botón "Caracterizar" junto al material deseado o acceda
            directamente a la sección de Estudios de Caracterización.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

