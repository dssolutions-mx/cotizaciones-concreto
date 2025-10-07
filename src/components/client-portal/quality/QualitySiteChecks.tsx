'use client';

import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Calendar, 
  MapPin, 
  Thermometer,
  Mountain,
  Factory,
  Droplet,
  FlaskConical,
  Building,
  Box,
  Search,
  Loader2,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';
import { getSiteChecks } from '@/lib/qualityHelpers';
import MaterialCertificateViewer from './MaterialCertificateViewer';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';

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
  supplier?: string;
  created_at: string;
  updated_at: string;
}

interface Plant {
  id: string;
  code: string;
  name: string;
}

interface QualitySiteChecksProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export function QualitySiteChecks({ data, summary }: QualitySiteChecksProps) {
  const siteChecks = getSiteChecks(data);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('agregados');
  const [selectedMaterial, setSelectedMaterial] = useState<{ id: string; name: string; category: string } | null>(null);

  // Cargar plantas y materiales
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Cargar plantas
        const plantsResponse = await fetch('/api/plants?active=true');
        if (plantsResponse.ok) {
          const plantsResult = await plantsResponse.json();
          setPlants(plantsResult.data || []);
        }

        // Cargar materiales
        const materialsResponse = await fetch('/api/materials?active=true');
        if (materialsResponse.ok) {
          const materialsResult = await materialsResponse.json();
          setMaterials(materialsResult.data || []);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filtrar materiales
  const getFilteredMaterials = (category: string, subcategory?: string) => {
    return materials.filter((material) => {
      const matchesPlant = selectedPlant === 'all' || material.plant_id === selectedPlant;
      const matchesSearch = material.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           material.material_code.toLowerCase().includes(searchTerm.toLowerCase());
      
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

  // Función para obtener color de categoría (colores de Estudios adaptados a client-portal)
  const getCategoryConfig = (category: string) => {
    switch (category) {
      case 'agregado':
        return {
          gradient: 'from-yellow-50 to-amber-50',
          icon: 'text-yellow-600',
          border: 'border-yellow-200',
          badge: 'bg-yellow-600',
          badgeCount: 'bg-yellow-600',
          emptyIcon: 'text-yellow-600'
        };
      case 'cemento':
        return {
          gradient: 'from-slate-50 to-gray-50',
          icon: 'text-slate-500',
          border: 'border-slate-200',
          badge: 'bg-slate-600',
          badgeCount: 'bg-slate-600',
          emptyIcon: 'text-slate-500'
        };
      case 'agua':
        return {
          gradient: 'from-cyan-50 to-blue-50',
          icon: 'text-cyan-600',
          border: 'border-cyan-200',
          badge: 'bg-cyan-600',
          badgeCount: 'bg-cyan-600',
          emptyIcon: 'text-cyan-600'
        };
      case 'aditivo':
        return {
          gradient: 'from-emerald-50 to-teal-50',
          icon: 'text-emerald-600',
          border: 'border-emerald-200',
          badge: 'bg-emerald-600',
          badgeCount: 'bg-emerald-600',
          emptyIcon: 'text-emerald-600'
        };
      default:
        return {
          gradient: 'from-gray-50 to-gray-100',
          icon: 'text-gray-500',
          border: 'border-gray-200',
          badge: 'bg-gray-600',
          badgeCount: 'bg-gray-600',
          emptyIcon: 'text-gray-500'
        };
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'agregado':
        return Mountain;
      case 'cemento':
        return Building;
      case 'aditivo':
        return FlaskConical;
      case 'agua':
        return Droplet;
      default:
        return Box;
    }
  };

  // Componente de tarjeta de material (colores de Estudios con estilo client-portal)
  const MaterialCard = ({ material, index }: { material: Material; index: number }) => {
    const Icon = getCategoryIcon(material.category);
    const config = getCategoryConfig(material.category);
    const plant = plants.find(p => p.id === material.plant_id);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={`bg-gradient-to-br ${config.gradient} rounded-2xl border-2 ${config.border} shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden`}
      >
        {/* Header de la card - estilo glassmorphism */}
        <div className="bg-white/60 backdrop-blur-sm p-4 border-b-2 border-white/80">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2.5 bg-white rounded-xl shadow-sm">
              <Icon className={`w-6 h-6 ${config.icon}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-callout font-bold text-gray-900 mb-1.5 leading-tight">
                {material.material_name}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-caption font-mono font-bold text-gray-900">
                  {material.material_code}
                </span>
                {plant && (
                  <span className="flex items-center gap-1 text-caption font-bold text-gray-900">
                    <Building className="h-3 w-3" />
                    {plant.code}
                  </span>
                )}
                {material.subcategory && (
                  <span className="px-2 py-1 bg-gray-200 text-gray-900 text-[10px] font-bold rounded-md uppercase">
                    {material.subcategory.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cuerpo de la card - botón de certificados */}
        <div className="p-4">
          <button
            onClick={() => setSelectedMaterial({ id: material.id, name: material.material_name, category: material.category })}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 ${config.badge} hover:opacity-90 text-white rounded-xl transition-all font-semibold text-footnote shadow-md`}
          >
            <FileText className="w-4 h-4" />
            Ver Certificados de Calidad
          </button>
        </div>
      </motion.div>
    );
  };

  const categories = [
    { id: 'agregados', name: 'Agregados', icon: Mountain },
    { id: 'cemento', name: 'Cementos', icon: Building },
    { id: 'agua', name: 'Agua', icon: Droplet },
    { id: 'aditivos', name: 'Aditivos', icon: FlaskConical }
  ];

  // Obtener categorías disponibles
  const availableCategories = categories.filter(cat => {
    if (cat.id === 'agregados') return (agregadosArena.length + agregadosGrava.length) > 0;
    if (cat.id === 'cemento') return cementos.length > 0;
    if (cat.id === 'agua') return aguas.length > 0;
    if (cat.id === 'aditivos') return aditivos.length > 0;
    return false;
  });

  // Obtener plantas únicas
  const uniquePlantIds = Array.from(new Set(materials.map(m => m.plant_id).filter(Boolean)));
  const availablePlants = plants.filter(p => uniquePlantIds.includes(p.id));

  return (
    <div className="space-y-8">
      {/* SECCIÓN DE CERTIFICADOS DE MATERIALES */}
      <div className="space-y-6">
        {/* Header */}
        <div className="glass-thick rounded-3xl p-6">
          <h2 className="text-title-2 font-semibold text-label-primary mb-2">
            Certificados de Materiales
          </h2>
          <p className="text-body text-label-secondary">
            Consulta los certificados de calidad de los materiales utilizados en tus órdenes
          </p>
        </div>

        {/* Filtros */}
        <div className="glass-thick rounded-2xl p-5">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Búsqueda */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-label-tertiary" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre o código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 glass-interactive rounded-xl border-white/10 focus:border-systemBlue/50 text-label-primary placeholder:text-label-tertiary"
                />
              </div>
            </div>

            {/* Filtro por Planta */}
            <div className="md:w-64">
              <Select value={selectedPlant} onValueChange={setSelectedPlant}>
                <SelectTrigger className="glass-interactive rounded-xl border-white/10">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-label-tertiary" />
                    <SelectValue placeholder="Todas las plantas" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las plantas</SelectItem>
                  {availablePlants.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id}>
                      {plant.code} - {plant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Tabs de Categorías - estilo iOS con colores de Estudios */}
        <div className="glass-thick rounded-2xl p-1.5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            {availableCategories.map((category) => {
              const Icon = category.icon;
              let count = 0;
              let subtitle = '';
              let categoryType = '';
              
              if (category.id === 'agregados') {
                count = agregadosArena.length + agregadosGrava.length;
                subtitle = `${agregadosArena.length} arenas · ${agregadosGrava.length} gravas`;
                categoryType = 'agregado';
              } else if (category.id === 'cemento') {
                count = cementos.length;
                subtitle = 'materiales';
                categoryType = 'cemento';
              } else if (category.id === 'agua') {
                count = aguas.length;
                subtitle = 'fuentes';
                categoryType = 'agua';
              } else if (category.id === 'aditivos') {
                count = aditivos.length;
                subtitle = 'tipos';
                categoryType = 'aditivo';
              }
              
              const config = getCategoryConfig(categoryType);
              const isActive = activeTab === category.id;
              
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveTab(category.id)}
                  className={`relative rounded-xl px-4 py-4 transition-all duration-200 border-2 ${
                    isActive 
                      ? `bg-gradient-to-br ${config.gradient} ${config.border} shadow-lg` 
                      : 'border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      isActive ? 'bg-white shadow-sm' : 'bg-white/40'
                    }`}>
                      <Icon className={`h-6 w-6 ${config.icon}`} />
                    </div>
                    <div className="text-center">
                      <p className={`text-title-3 font-bold ${isActive ? 'text-gray-900' : 'text-label-primary'}`}>
                        {count}
                      </p>
                      <p className={`text-caption font-bold mt-0.5 ${isActive ? 'text-gray-900' : 'text-label-primary'}`}>
                        {category.name}
                      </p>
                      <p className={`text-[10px] font-medium mt-0.5 ${isActive ? 'text-gray-700' : 'text-label-tertiary'}`}>
                        {subtitle}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista de Materiales */}
        <div className="min-h-[200px]">
          {loading ? (
            <div className="glass-thick rounded-2xl p-12 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-systemBlue animate-spin mb-4" />
              <p className="text-label-secondary">Cargando materiales...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* AGREGADOS con subdivisiones */}
              {activeTab === 'agregados' && (
                <>
                  {/* Arenas */}
                  {agregadosArena.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-title-3 font-bold text-label-primary">Arenas</h3>
                        <span className="flex items-center justify-center px-3 py-1 bg-yellow-600 text-white text-caption font-semibold rounded-full shadow-sm">
                          {agregadosArena.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {agregadosArena.map((material, index) => (
                          <MaterialCard key={material.id} material={material} index={index} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gravas */}
                  {agregadosGrava.length > 0 && (
                    <div className={agregadosArena.length > 0 ? 'pt-2' : ''}>
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-title-3 font-bold text-label-primary">Gravas</h3>
                        <span className="flex items-center justify-center px-3 py-1 bg-yellow-600 text-white text-caption font-semibold rounded-full shadow-sm">
                          {agregadosGrava.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {agregadosGrava.map((material, index) => (
                          <MaterialCard key={material.id} material={material} index={index} />
                        ))}
                      </div>
                    </div>
                  )}

                  {agregadosArena.length === 0 && agregadosGrava.length === 0 && (
                    <div className="glass-thick rounded-2xl p-12 text-center">
                      <Mountain className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
                      <h3 className="text-title-3 font-semibold text-label-primary mb-2">
                        No hay agregados disponibles
                      </h3>
                      <p className="text-body text-label-secondary">
                        {searchTerm || selectedPlant !== 'all' 
                          ? 'Intenta ajustar los filtros de búsqueda'
                          : 'No se encontraron agregados'}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* CEMENTO */}
              {activeTab === 'cemento' && (
                <>
                  {cementos.length > 0 ? (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-title-3 font-bold text-label-primary">Cementos</h3>
                        <span className="flex items-center justify-center px-3 py-1 bg-slate-600 text-white text-caption font-semibold rounded-full shadow-sm">
                          {cementos.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {cementos.map((material, index) => (
                          <MaterialCard key={material.id} material={material} index={index} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="glass-thick rounded-2xl p-12 text-center">
                      <Building className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                      <h3 className="text-title-3 font-semibold text-label-primary mb-2">
                        No hay cementos disponibles
                      </h3>
                      <p className="text-body text-label-secondary">
                        {searchTerm || selectedPlant !== 'all' 
                          ? 'Intenta ajustar los filtros de búsqueda'
                          : 'No se encontraron cementos'}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* AGUA */}
              {activeTab === 'agua' && (
                <>
                  {aguas.length > 0 ? (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-title-3 font-bold text-label-primary">Agua</h3>
                        <span className="flex items-center justify-center px-3 py-1 bg-cyan-600 text-white text-caption font-semibold rounded-full shadow-sm">
                          {aguas.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {aguas.map((material, index) => (
                          <MaterialCard key={material.id} material={material} index={index} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="glass-thick rounded-2xl p-12 text-center">
                      <Droplet className="w-16 h-16 text-cyan-600 mx-auto mb-4" />
                      <h3 className="text-title-3 font-semibold text-label-primary mb-2">
                        No hay agua disponible
                      </h3>
                      <p className="text-body text-label-secondary">
                        {searchTerm || selectedPlant !== 'all' 
                          ? 'Intenta ajustar los filtros de búsqueda'
                          : 'No se encontró agua registrada'}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* ADITIVOS */}
              {activeTab === 'aditivos' && (
                <>
                  {aditivos.length > 0 ? (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-title-3 font-bold text-label-primary">Aditivos</h3>
                        <span className="flex items-center justify-center px-3 py-1 bg-emerald-600 text-white text-caption font-semibold rounded-full shadow-sm">
                          {aditivos.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {aditivos.map((material, index) => (
                          <MaterialCard key={material.id} material={material} index={index} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="glass-thick rounded-2xl p-12 text-center">
                      <FlaskConical className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                      <h3 className="text-title-3 font-semibold text-label-primary mb-2">
                        No hay aditivos disponibles
                      </h3>
                      <p className="text-body text-label-secondary">
                        {searchTerm || selectedPlant !== 'all' 
                          ? 'Intenta ajustar los filtros de búsqueda'
                          : 'No se encontraron aditivos'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN DE VERIFICACIONES EN SITIO */}
      <div className="space-y-6 pt-4 border-t border-white/10">
        {/* Header */}
        <div className="glass-thick rounded-3xl p-6">
          <h2 className="text-title-2 font-semibold text-label-primary mb-2">
            Verificaciones en Sitio
          </h2>
          <p className="text-body text-label-secondary">
            Muestreos de control de calidad en obra sin ensayos de resistencia
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-thick rounded-3xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-2xl bg-systemBlue/20">
                <CheckCircle2 className="w-6 h-6 text-systemBlue" />
              </div>
              <p className="text-caption font-medium text-label-secondary">
                Total Site Checks
              </p>
            </div>
            <p className="text-title-1 font-bold text-label-primary">
              {siteChecks.length}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-thick rounded-3xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <p className="text-caption font-medium text-label-secondary">
                Porcentaje del Total
              </p>
            </div>
            <p className="text-title-1 font-bold text-systemBlue">
              {summary.totals.muestreos > 0 
                ? ((siteChecks.length / summary.totals.muestreos) * 100).toFixed(1) 
                : 0}%
            </p>
            <p className="text-caption text-label-tertiary mt-1">
              de {summary.totals.muestreos} muestreos totales
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-thick rounded-3xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <p className="text-caption font-medium text-label-secondary">
                Obras Verificadas
              </p>
            </div>
            <p className="text-title-1 font-bold text-label-primary">
              {Array.from(new Set(siteChecks.map(sc => sc.constructionSite))).length}
            </p>
          </motion.div>
        </div>

        {/* Site Checks List */}
        <div className="space-y-4">
          {siteChecks.length > 0 ? (
            siteChecks.map((siteCheck, index) => (
              <motion.div
                key={siteCheck.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                className="glass-interactive rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-callout font-semibold text-label-primary">
                        {siteCheck.remisionNumber} - M{siteCheck.numeroMuestreo}
                      </h3>
                      <span className="px-3 py-1 bg-systemBlue/10 text-systemBlue border border-systemBlue/30 rounded-full text-caption font-medium">
                        Site Check
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-footnote text-label-secondary flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(siteCheck.fechaMuestreo), 'dd MMM yyyy', { locale: es })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        {siteCheck.constructionSite}
                      </span>
                    </div>
                  </div>

                  {/* Rendimiento Badge */}
                  {siteCheck.rendimientoVolumetrico && siteCheck.rendimientoVolumetrico > 0 && (
                    <div className="text-right ml-4">
                      <p className="text-caption text-label-tertiary mb-1">Rendimiento</p>
                      <p className={`text-callout font-bold ${
                        siteCheck.rendimientoVolumetrico >= 98 
                          ? 'text-systemGreen' 
                          : siteCheck.rendimientoVolumetrico >= 95
                          ? 'text-systemOrange'
                          : 'text-systemRed'
                      }`}>
                        {siteCheck.rendimientoVolumetrico.toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-caption text-label-tertiary mb-1">Masa Unitaria</p>
                    <p className="text-footnote font-medium text-label-primary">
                      {siteCheck.masaUnitaria.toFixed(0)} kg/m³
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-caption text-label-tertiary mb-1 flex items-center gap-1">
                      <Thermometer className="w-3 h-3" />
                      Temp. Concreto
                    </p>
                    <p className="text-footnote font-medium text-label-primary">
                      {siteCheck.temperaturaConcreto.toFixed(1)}°C
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-caption text-label-tertiary mb-1 flex items-center gap-1">
                      <Thermometer className="w-3 h-3" />
                      Temp. Ambiente
                    </p>
                    <p className="text-footnote font-medium text-label-primary">
                      {siteCheck.temperaturaAmbiente.toFixed(1)}°C
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-caption text-label-tertiary mb-1">Revenimiento</p>
                    <p className="text-footnote font-medium text-label-primary">
                      {siteCheck.revenimientoSitio.toFixed(1)} cm
                    </p>
                  </div>
                </div>

                {/* Additional Info */}
                {siteCheck.concrete_specs && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-caption text-label-tertiary mb-2">Especificaciones del Concreto</p>
                    <div className="glass-thin rounded-lg p-3">
                      <pre className="text-caption text-label-secondary overflow-x-auto">
                        {JSON.stringify(siteCheck.concrete_specs, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </motion.div>
            ))
          ) : (
            <div className="glass-thick rounded-3xl p-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-label-tertiary mx-auto mb-4" />
              <h3 className="text-title-2 font-bold text-label-primary mb-3">
                No hay verificaciones en sitio
              </h3>
              <p className="text-body text-label-secondary">
                Todos los muestreos en este período tienen ensayos de resistencia
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Certificados */}
      {selectedMaterial && (
        <MaterialCertificateViewer
          materialId={selectedMaterial.id}
          materialName={selectedMaterial.name}
          materialCategory={selectedMaterial.category}
          onClose={() => setSelectedMaterial(null)}
        />
      )}
    </div>
  );
}

export default QualitySiteChecks;
