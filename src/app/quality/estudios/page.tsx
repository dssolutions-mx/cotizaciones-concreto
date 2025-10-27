'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Layers,
  Search,
  Box,
  Droplet,
  Factory,
  Mountain,
  FlaskConical,
  ArrowRight,
  Building,
  FileText,
} from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Link from 'next/link';
import MaterialCertificateManager from '@/components/quality/MaterialCertificateManager';
import PlantCertificateManager from '@/components/quality/PlantCertificateManager';
import PlantDossierManager from '@/components/quality/PlantDossierManager';
import PlantVerificationManager from '@/components/quality/PlantVerificationManager';

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

    const getCategoryIcon = (category: string) => {
      switch (category) {
        case 'agregado':
          return <Mountain className="h-10 w-10 text-yellow-600" />;
        case 'cemento':
          return <Factory className="h-10 w-10 text-slate-500" />;
        case 'agua':
          return <Droplet className="h-10 w-10 text-cyan-600" />;
        default:
          return <FlaskConical className="h-10 w-10 text-emerald-600" />;
      }
    };

    const getCategoryColor = (category: string) => {
      switch (category) {
        case 'agregado':
          return 'from-yellow-50 to-amber-50 border-yellow-200';
        case 'cemento':
          return 'from-slate-50 to-gray-50 border-slate-200';
        case 'agua':
          return 'from-cyan-50 to-blue-50 border-cyan-200';
        default:
          return 'from-emerald-50 to-teal-50 border-emerald-200';
      }
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {materials.map((material) => {
          const plant = plants.find((p) => p.id === material.plant_id);

          return (
            <div 
              key={material.id} 
              className={`bg-gradient-to-br ${getCategoryColor(material.category)} rounded-xl border-2 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden`}
            >
              {/* Header de la card */}
              <div className="bg-white/60 backdrop-blur-sm p-4 border-b-2 border-white/80">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm">
                    {getCategoryIcon(material.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 mb-1.5 leading-tight">
                      {material.material_name}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-mono font-bold text-gray-900">
                        {material.material_code}
                      </span>
                      {plant && (
                        <span className="flex items-center gap-1 text-xs font-bold text-gray-900">
                          <Building className="h-3 w-3" />
                          {plant.code}
                        </span>
                      )}
                      {material.subcategory && (
                        <span className="px-2 py-1 bg-gray-200 text-gray-900 text-xs font-bold rounded-md uppercase">
                          {material.subcategory.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botón de caracterizar si es agregado */}
                {material.category === 'agregado' && (
                  <Link href="/quality/caracterizacion-materiales/nuevo" className="block">
                    <Button 
                      variant="secondary"
                      className="w-full h-10 bg-white hover:bg-gray-50 !text-black rounded-lg font-bold text-sm shadow-md border-2 border-gray-300"
                    >
                      <FlaskConical className="h-4 w-4 mr-2 text-black" />
                      Caracterizar Material
                    </Button>
                  </Link>
                )}
              </div>

              {/* Cuerpo de la card - Gestión de certificados */}
              <div className="p-4">
                <MaterialCertificateManager
                  materialId={material.id}
                  materialName={material.material_name}
                />
              </div>
            </div>
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header - Rediseñado limpio */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Layers className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900">
                  Estudios de Materiales
                </h1>
                <p className="text-base text-gray-600 mt-1">
                  Gestione materiales y certificados de calidad
                </p>
              </div>
            </div>
            <Link href="/quality/caracterizacion-materiales">
              <Button 
                variant="secondary"
                className="h-11 px-5 bg-gray-900 hover:bg-black !text-white shadow-md hover:shadow-lg transition-all rounded-xl font-semibold border-2 border-gray-900"
              >
                <FlaskConical className="h-4 w-4 mr-2 text-white" />
                Ir a Caracterización
                <ArrowRight className="h-4 w-4 ml-2 text-white" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Filtros - Rediseñados con mejor contraste */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-5 mb-8">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Búsqueda */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500" />
                <Input
                  placeholder="Buscar por nombre o código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 h-11 bg-white border-gray-300 rounded-lg text-sm font-bold !text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>
            </div>
            
            {/* Selector de Planta */}
            <div className="md:w-64">
              <Select value={selectedPlant} onValueChange={setSelectedPlant}>
                <SelectTrigger className="h-11 bg-white border-gray-300 rounded-lg text-sm font-bold !text-gray-900">
                  <Building className="h-4 w-4 mr-2 text-gray-700" />
                  <SelectValue placeholder="Seleccionar planta" className="!text-gray-900" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold !text-gray-900">Todas las plantas</SelectItem>
                  {plants.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id} className="font-bold !text-gray-900">
                      {plant.code} - {plant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botón limpiar */}
            {(searchTerm || selectedPlant !== 'all') && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedPlant('all');
                }}
                className="h-11 px-5 rounded-lg border-2 border-gray-300 bg-white hover:bg-gray-100 !text-black font-semibold"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Certificados de Planta - visible solo con planta seleccionada */}
        {selectedPlant !== 'all' && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-5 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="mb-3">
                  <h2 className="text-lg font-bold text-gray-900">Certificados de Planta</h2>
                  <p className="text-sm text-gray-600">Gestiona certificados generales de la planta seleccionada</p>
                </div>
                <PlantCertificateManager
                  plantId={selectedPlant}
                  plantCode={plants.find(p => p.id === selectedPlant)?.code}
                />
              </div>
              <div>
                <div className="mb-3">
                  <h2 className="text-lg font-bold text-gray-900">Dossier de Calidad</h2>
                  <p className="text-sm text-gray-600">PDF principal del dossier (aparece en la raíz del ZIP)</p>
                </div>
                <PlantDossierManager
                  plantId={selectedPlant}
                  plantCode={plants.find(p => p.id === selectedPlant)?.code}
                />
              </div>
              <div>
                <div className="mb-3">
                  <h2 className="text-lg font-bold text-gray-900">Verificaciones de Planta</h2>
                  <p className="text-sm text-gray-600">Documentos de verificación de calidad de planta</p>
                </div>
                <PlantVerificationManager
                  plantId={selectedPlant}
                  plantCode={plants.find(p => p.id === selectedPlant)?.code}
                />
              </div>
            </div>
          </div>
        )}

        {/* Categorías - Rediseñadas como tabs */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-1.5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            <button
              onClick={() => setActiveTab('agregados')}
              className={`relative rounded-xl px-4 py-4 transition-all duration-200 ${
                activeTab === 'agregados' 
                  ? 'bg-yellow-50 shadow-sm' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  activeTab === 'agregados' ? 'bg-yellow-500' : 'bg-yellow-100'
                }`}>
                  <Mountain className={`h-6 w-6 ${activeTab === 'agregados' ? 'text-white' : 'text-yellow-700'}`} />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{agregadosArena.length + agregadosGrava.length}</p>
                  <p className="text-xs font-bold text-gray-900 mt-0.5">Agregados</p>
                  <p className="text-[10px] text-gray-600 font-medium mt-0.5">
                    {agregadosArena.length} arenas · {agregadosGrava.length} gravas
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('cemento')}
              className={`relative rounded-xl px-4 py-4 transition-all duration-200 ${
                activeTab === 'cemento' 
                  ? 'bg-slate-50 shadow-sm' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  activeTab === 'cemento' ? 'bg-slate-500' : 'bg-slate-100'
                }`}>
                  <Factory className={`h-6 w-6 ${activeTab === 'cemento' ? 'text-white' : 'text-slate-700'}`} />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{cementos.length}</p>
                  <p className="text-xs font-bold text-gray-900 mt-0.5">Cementos</p>
                  <p className="text-[10px] text-gray-600 font-medium mt-0.5">materiales</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('agua')}
              className={`relative rounded-xl px-4 py-4 transition-all duration-200 ${
                activeTab === 'agua' 
                  ? 'bg-cyan-50 shadow-sm' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  activeTab === 'agua' ? 'bg-cyan-500' : 'bg-cyan-100'
                }`}>
                  <Droplet className={`h-6 w-6 ${activeTab === 'agua' ? 'text-white' : 'text-cyan-700'}`} />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{aguas.length}</p>
                  <p className="text-xs font-bold text-gray-900 mt-0.5">Agua</p>
                  <p className="text-[10px] text-gray-600 font-medium mt-0.5">fuentes</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('aditivos')}
              className={`relative rounded-xl px-4 py-4 transition-all duration-200 ${
                activeTab === 'aditivos' 
                  ? 'bg-emerald-50 shadow-sm' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  activeTab === 'aditivos' ? 'bg-emerald-600' : 'bg-emerald-100'
                }`}>
                  <FlaskConical className={`h-6 w-6 ${activeTab === 'aditivos' ? 'text-white' : 'text-emerald-700'}`} />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{aditivos.length}</p>
                  <p className="text-xs font-bold text-gray-900 mt-0.5">Aditivos</p>
                  <p className="text-[10px] text-gray-600 font-medium mt-0.5">tipos</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Lista de Materiales - Estilo Apple */}
        <div className="space-y-6">
          {activeTab === 'agregados' && (
            <>
              {/* Arenas */}
              {agregadosArena.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Arenas</h2>
                    <span className="flex items-center justify-center w-8 h-8 bg-yellow-500 text-white text-sm font-bold rounded-lg shadow-sm">
                      {agregadosArena.length}
                    </span>
                  </div>
                  <MaterialTable materials={agregadosArena} />
                </div>
              )}

              {/* Gravas */}
              {agregadosGrava.length > 0 && (
                <div className={agregadosArena.length > 0 ? 'pt-6' : ''}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Gravas</h2>
                    <span className="flex items-center justify-center w-8 h-8 bg-yellow-500 text-white text-sm font-bold rounded-lg shadow-sm">
                      {agregadosGrava.length}
                    </span>
                  </div>
                  <MaterialTable materials={agregadosGrava} />
                </div>
              )}
            </>
          )}

          {activeTab === 'cemento' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-gray-900">Cementos</h2>
                <span className="flex items-center justify-center w-8 h-8 bg-slate-500 text-white text-sm font-bold rounded-lg shadow-sm">
                  {cementos.length}
                </span>
              </div>
              <MaterialTable materials={cementos} />
            </div>
          )}

          {activeTab === 'agua' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-gray-900">Agua</h2>
                <span className="flex items-center justify-center w-8 h-8 bg-cyan-500 text-white text-sm font-bold rounded-lg shadow-sm">
                  {aguas.length}
                </span>
              </div>
              <MaterialTable materials={aguas} />
            </div>
          )}

          {activeTab === 'aditivos' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-gray-900">Aditivos</h2>
                <span className="flex items-center justify-center w-8 h-8 bg-emerald-600 text-white text-sm font-bold rounded-lg shadow-sm">
                  {aditivos.length}
                </span>
              </div>
              <MaterialTable materials={aditivos} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

