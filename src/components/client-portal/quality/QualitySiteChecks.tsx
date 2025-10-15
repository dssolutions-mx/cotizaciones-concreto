'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mountain,
  Droplet,
  FlaskConical,
  Building,
  Box,
  Search,
  Loader2,
  FileText,
  Download,
  Sparkles,
  X
} from 'lucide-react';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';
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
  const [materials, setMaterials] = useState<Material[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('agregados');
  const [selectedMaterial, setSelectedMaterial] = useState<{ id: string; name: string; category: string } | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  // Función para obtener color de categoría - iOS 26 Refined Colors
  const getCategoryConfig = (category: string) => {
    switch (category) {
      case 'agregado':
        return {
          gradient: 'from-amber-100 via-yellow-50 to-amber-50',
          icon: 'text-amber-700',
          border: 'border-amber-200',
          badge: 'bg-amber-600',
          badgeCount: 'bg-amber-600',
          emptyIcon: 'text-amber-600'
        };
      case 'cemento':
        return {
          gradient: 'from-gray-100 via-slate-50 to-gray-50',
          icon: 'text-slate-600',
          border: 'border-slate-200',
          badge: 'bg-slate-600',
          badgeCount: 'bg-slate-600',
          emptyIcon: 'text-slate-500'
        };
      case 'agua':
        return {
          gradient: 'from-blue-100 via-cyan-50 to-blue-50',
          icon: 'text-cyan-700',
          border: 'border-cyan-200',
          badge: 'bg-cyan-600',
          badgeCount: 'bg-cyan-600',
          emptyIcon: 'text-cyan-600'
        };
      case 'aditivo':
        return {
          gradient: 'from-teal-100 via-emerald-50 to-teal-50',
          icon: 'text-emerald-700',
          border: 'border-emerald-200',
          badge: 'bg-emerald-600',
          badgeCount: 'bg-emerald-600',
          emptyIcon: 'text-emerald-600'
        };
      default:
        return {
          gradient: 'from-gray-100 via-gray-50 to-gray-100',
          icon: 'text-gray-600',
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

  // Componente de tarjeta de material - iOS 26 Liquid Glass Style
  const MaterialCard = ({ material, index }: { material: Material; index: number }) => {
    const Icon = getCategoryIcon(material.category);
    const config = getCategoryConfig(material.category);
    const plant = plants.find(p => p.id === material.plant_id);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.4 }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="glass-thick rounded-3xl overflow-hidden border border-white/20 hover:border-white/40 transition-all duration-300 shadow-md hover:shadow-xl"
      >
        {/* Header de la card */}
        <div className="p-6 border-b border-white/20">
          <div className="flex items-start gap-4">
            {/* Icon Container */}
            <div className={`p-3 rounded-2xl bg-gradient-to-br ${config.gradient} shadow-sm flex-shrink-0`}>
              <Icon className={`w-7 h-7 ${config.icon}`} />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-title-3 font-semibold text-label-primary mb-2 leading-tight">
                {material.material_name}
              </h3>
              
              {/* Metadata */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-label-primary text-caption font-mono font-bold rounded-lg border border-white/30 shadow-sm">
                  {material.material_code}
                </span>
                
                {plant && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-label-secondary text-caption font-semibold rounded-lg border border-white/30 shadow-sm">
                    <Building className="h-3.5 w-3.5" />
                    {plant.code}
                  </span>
                )}
                
                {material.subcategory && (
                  <span className={`px-2.5 py-1 ${config.badge} text-white text-caption font-bold rounded-lg shadow-sm`}>
                    {material.subcategory.replace('_', ' ').toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cuerpo de la card - botón de certificados */}
        <div className="p-6">
          <motion.button
            onClick={() => setSelectedMaterial({ id: material.id, name: material.material_name, category: material.category })}
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.99 }}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-4 glass-interactive border-2 border-white/30 hover:border-white/50 text-label-primary rounded-2xl transition-all duration-300 font-semibold text-callout shadow-sm hover:shadow-md"
          >
            <FileText className="w-5 h-5" />
            Ver Certificados de Calidad
          </motion.button>
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
      {/* Header - iOS 26 Style */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-start justify-between gap-6 mb-3">
          <div className="flex-1">
            <h1 className="text-large-title font-bold text-label-primary mb-3">
              Dossier de Calidad
            </h1>
            <p className="text-body text-label-secondary">
              Consulta los certificados de calidad de los materiales utilizados en tus órdenes
            </p>
          </div>
          
          {/* Download Dossier Button */}
          <motion.button
            onClick={async () => {
              try {
                setDownloading(true);
                const params = new URLSearchParams();
                if (selectedPlant && selectedPlant !== 'all') params.set('plant_id', selectedPlant);
                const res = await fetch(`/api/client-portal/quality/dossier${params.toString() ? `?${params.toString()}` : ''}`);
                if (!res.ok) {
                  console.error('Dossier download failed');
                  setDownloading(false);
                  return;
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const today = new Date();
                const y = String(today.getFullYear());
                const m = String(today.getMonth() + 1).padStart(2, '0');
                const d = String(today.getDate()).padStart(2, '0');
                a.download = `dossier_calidad_${y}${m}${d}.zip`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              } catch (e) {
                console.error('Error downloading dossier:', e);
              } finally {
                setDownloading(false);
              }
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={downloading}
            className={`flex items-center gap-2.5 px-6 py-3.5 glass-interactive border-2 border-white/30 hover:border-white/50 text-label-primary rounded-2xl transition-all duration-300 font-semibold text-callout shadow-sm hover:shadow-md flex-shrink-0 ${downloading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {downloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="hidden md:inline">Preparando...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span className="hidden md:inline">Descargar Dossier</span>
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Filtros - iOS 26 Refined */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="glass-thick rounded-3xl p-6"
      >
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          {/* Búsqueda */}
          <div className="flex-1 min-w-0">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-label-tertiary pointer-events-none z-10" />
              <Input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 glass-interactive rounded-2xl border-white/10 focus:border-systemBlue/50 text-body text-label-primary placeholder:text-label-tertiary h-12 transition-all duration-200"
              />
            </div>
          </div>

          {/* Filtro por Planta */}
          <div className="md:w-80 w-full flex-shrink-0">
            <Select value={selectedPlant} onValueChange={setSelectedPlant}>
              <SelectTrigger className="w-full glass-interactive rounded-2xl border-white/10 h-12 text-body">
                <div className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-label-tertiary flex-shrink-0" />
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
      </motion.div>

      {/* Tabs de Categorías - iOS 26 Segmented Control Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="glass-thick rounded-3xl p-2"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
                <motion.button
                  key={category.id}
                  onClick={() => setActiveTab(category.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative rounded-2xl px-4 py-5 transition-all duration-300 ${
                    isActive 
                      ? 'bg-white dark:bg-gray-800 shadow-lg' 
                      : 'hover:bg-white/30 dark:hover:bg-gray-700/30'
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    {/* Icon Container */}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                      isActive 
                        ? `bg-gradient-to-br ${config.gradient} shadow-md` 
                        : 'bg-white/60 dark:bg-gray-700/60'
                    }`}>
                      <Icon className={`h-7 w-7 ${config.icon}`} />
                    </div>
                    
                    {/* Text Content */}
                    <div className="text-center space-y-0.5">
                      <p className={`text-title-2 font-bold transition-colors ${
                        isActive ? 'text-label-primary' : 'text-label-secondary'
                      }`}>
                        {count}
                      </p>
                      <p className={`text-callout font-semibold transition-colors ${
                        isActive ? 'text-label-primary' : 'text-label-secondary'
                      }`}>
                        {category.name}
                      </p>
                      <p className={`text-caption transition-colors ${
                        isActive ? 'text-label-secondary' : 'text-label-tertiary'
                      }`}>
                        {subtitle}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

      {/* Lista de Materiales */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="min-h-[200px]"
      >
        {loading ? (
          <div className="glass-thick rounded-3xl p-16 flex flex-col items-center justify-center">
            <Loader2 className="w-16 h-16 text-systemBlue animate-spin mb-4" />
            <p className="text-callout text-label-secondary">Cargando materiales...</p>
          </div>
        ) : (
            <div className="space-y-8">
              {/* AGREGADOS con subdivisiones */}
              {activeTab === 'agregados' && (
                <>
                  {/* Arenas */}
                  {agregadosArena.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <h3 className="text-title-2 font-bold text-label-primary">Arenas</h3>
                        <span className="flex items-center justify-center min-w-[32px] h-8 px-3 bg-amber-600 text-white text-footnote font-bold rounded-full shadow-sm">
                          {agregadosArena.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {agregadosArena.map((material, index) => (
                          <MaterialCard key={material.id} material={material} index={index} />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Gravas */}
                  {agregadosGrava.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className={agregadosArena.length > 0 ? 'pt-4' : ''}
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <h3 className="text-title-2 font-bold text-label-primary">Gravas</h3>
                        <span className="flex items-center justify-center min-w-[32px] h-8 px-3 bg-amber-600 text-white text-footnote font-bold rounded-full shadow-sm">
                          {agregadosGrava.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {agregadosGrava.map((material, index) => (
                          <MaterialCard key={material.id} material={material} index={index} />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {agregadosArena.length === 0 && agregadosGrava.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                      className="glass-thick rounded-3xl p-16 text-center"
                    >
                      <Mountain className="w-20 h-20 text-amber-600 mx-auto mb-6" />
                      <h3 className="text-title-2 font-bold text-label-primary mb-3">
                        No hay agregados disponibles
                      </h3>
                      <p className="text-callout text-label-secondary max-w-md mx-auto">
                        {searchTerm || selectedPlant !== 'all' 
                          ? 'Intenta ajustar los filtros de búsqueda'
                          : 'No se encontraron agregados'}
                      </p>
                    </motion.div>
                  )}
                </>
              )}

              {/* CEMENTO */}
              {activeTab === 'cemento' && (
                <>
                  {cementos.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <h3 className="text-title-2 font-bold text-label-primary">Cementos</h3>
                        <span className="flex items-center justify-center min-w-[32px] h-8 px-3 bg-slate-600 text-white text-footnote font-bold rounded-full shadow-sm">
                          {cementos.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {cementos.map((material, index) => (
                          <MaterialCard key={material.id} material={material} index={index} />
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                      className="glass-thick rounded-3xl p-16 text-center"
                    >
                      <Building className="w-20 h-20 text-slate-500 mx-auto mb-6" />
                      <h3 className="text-title-2 font-bold text-label-primary mb-3">
                        No hay cementos disponibles
                      </h3>
                      <p className="text-callout text-label-secondary max-w-md mx-auto">
                        {searchTerm || selectedPlant !== 'all' 
                          ? 'Intenta ajustar los filtros de búsqueda'
                          : 'No se encontraron cementos'}
                      </p>
                    </motion.div>
                  )}
                </>
              )}

              {/* AGUA */}
              {activeTab === 'agua' && (
                <>
                  {aguas.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <h3 className="text-title-2 font-bold text-label-primary">Agua</h3>
                        <span className="flex items-center justify-center min-w-[32px] h-8 px-3 bg-cyan-600 text-white text-footnote font-bold rounded-full shadow-sm">
                          {aguas.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {aguas.map((material, index) => (
                          <MaterialCard key={material.id} material={material} index={index} />
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                      className="glass-thick rounded-3xl p-16 text-center"
                    >
                      <Droplet className="w-20 h-20 text-cyan-600 mx-auto mb-6" />
                      <h3 className="text-title-2 font-bold text-label-primary mb-3">
                        No hay agua disponible
                      </h3>
                      <p className="text-callout text-label-secondary max-w-md mx-auto">
                        {searchTerm || selectedPlant !== 'all' 
                          ? 'Intenta ajustar los filtros de búsqueda'
                          : 'No se encontró agua registrada'}
                      </p>
                    </motion.div>
                  )}
                </>
              )}

              {/* ADITIVOS */}
              {activeTab === 'aditivos' && (
                <>
                  {aditivos.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <h3 className="text-title-2 font-bold text-label-primary">Aditivos</h3>
                        <span className="flex items-center justify-center min-w-[32px] h-8 px-3 bg-emerald-600 text-white text-footnote font-bold rounded-full shadow-sm">
                          {aditivos.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {aditivos.map((material, index) => (
                          <MaterialCard key={material.id} material={material} index={index} />
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                      className="glass-thick rounded-3xl p-16 text-center"
                    >
                      <FlaskConical className="w-20 h-20 text-emerald-600 mx-auto mb-6" />
                      <h3 className="text-title-2 font-bold text-label-primary mb-3">
                        No hay aditivos disponibles
                      </h3>
                      <p className="text-callout text-label-secondary max-w-md mx-auto">
                        {searchTerm || selectedPlant !== 'all' 
                          ? 'Intenta ajustar los filtros de búsqueda'
                          : 'No se encontraron aditivos'}
                      </p>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          )}
      </motion.div>

      {/* Modal de Certificados */}
      {selectedMaterial && (
        <MaterialCertificateViewer
          materialId={selectedMaterial.id}
          materialName={selectedMaterial.name}
          materialCategory={selectedMaterial.category}
          onClose={() => setSelectedMaterial(null)}
        />
      )}

      {/* Coming Soon Modal - iOS 26 Style */}
      <AnimatePresence>
        {showComingSoon && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowComingSoon(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="glass-thick rounded-3xl shadow-2xl max-w-md w-full border border-white/30 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with refined accent */}
              <div className="relative p-8 pb-6">
                {/* Sparkle icon with subtle background */}
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-gray-100 to-slate-200 dark:from-slate-700 dark:via-gray-800 dark:to-slate-700 rounded-full blur-xl opacity-60"></div>
                    <div className="relative p-4 bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100 dark:from-slate-700 dark:via-gray-800 dark:to-slate-700 rounded-full shadow-lg">
                      <Sparkles className="w-8 h-8 text-slate-600 dark:text-slate-300" />
                    </div>
                  </div>
                </div>

                {/* Close button */}
                <motion.button
                  onClick={() => setShowComingSoon(false)}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  className="absolute top-6 right-6 p-2 hover:bg-white/20 dark:hover:bg-gray-700/40 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-label-secondary" />
                </motion.button>

                <h3 className="text-title-1 font-bold text-label-primary mb-3 text-center">
                  Próximamente
                </h3>
                <p className="text-callout text-label-secondary text-center leading-relaxed">
                  La descarga del <span className="font-semibold text-label-primary">Dossier de Calidad</span> completo estará disponible muy pronto
                </p>
              </div>

              {/* Feature preview section */}
              <div className="px-8 pb-8">
                <div className="glass-thin rounded-2xl p-4 border border-white/20">
                  <p className="text-footnote text-label-secondary text-center mb-3 font-medium">
                    Esta función incluirá:
                  </p>
                  <ul className="space-y-2.5 text-footnote text-label-secondary">
                    <li className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                      <span>Todos los certificados en un solo archivo</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                      <span>Reporte completo de conformidad</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                      <span>Formato PDF optimizado</span>
                    </li>
                  </ul>
                </div>

                {/* CTA Button */}
                <motion.button
                  onClick={() => setShowComingSoon(false)}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full mt-6 px-6 py-4 glass-interactive border-2 border-white/30 hover:border-white/50 text-label-primary rounded-2xl font-semibold text-callout shadow-sm hover:shadow-md transition-all duration-300"
                >
                  Entendido
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default QualitySiteChecks;
