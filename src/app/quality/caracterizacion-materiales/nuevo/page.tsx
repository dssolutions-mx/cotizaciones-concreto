'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FlaskConical, Save, Plus, ArrowLeft } from 'lucide-react';
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
  material_name: string;
  category: string;
  subcategory: string;
  aggregate_type: 'AR' | 'GR' | null;
  plant_id: string;
}

interface EstudioData {
  id_planta: string;
  planta: string;
  tipo_material: 'Arena' | 'Grava';
  nombre_material: string;
  material_id: string | null;
  mina_procedencia: string;
  ubicacion: string;
  tamaño: string;
  origen_material: string;
  tecnico: string;
  id_muestra: string;
  tipo_estudio: string;
  fecha_muestreo: string;
  fecha_elaboracion: string;
}

interface EstudioSeleccionado {
  tipo_estudio: string;
  nombre_estudio: string;
  descripcion: string;
  norma_referencia: string;
  fecha_programada?: string;
}

interface TipoEstudioDisponible {
  categoria: string;
  estudios: {
    id: string;
    nombre: string;
    descripcion: string;
    norma: string;
    aplicable_arena: boolean;
    aplicable_grava: boolean;
  }[];
}

// Definición de estudios disponibles para caracterización de agregados
const ESTUDIOS_DISPONIBLES: TipoEstudioDisponible[] = [
  {
    categoria: "Estudios de Caracterización de Agregados",
    estudios: [
      {
        id: "granulometria",
        nombre: "Análisis Granulométrico",
        descripcion: "Determinación de la distribución de tamaños de partículas",
        norma: "NMX-C-077",
        aplicable_arena: true,
        aplicable_grava: true
      },
      {
        id: "densidad",
        nombre: "Densidad",
        descripcion: "Determinación de la densidad relativa del agregado",
        norma: "NMX-C-164 / NMX-C-165",
        aplicable_arena: true,
        aplicable_grava: true
      },
      {
        id: "masa_volumetrico",
        nombre: "Masa Volumétrica",
        descripcion: "Determinación de la masa volumétrica suelto y compactado",
        norma: "NMX-C-073",
        aplicable_arena: true,
        aplicable_grava: true
      },
      {
        id: "perdida_lavado",
        nombre: "Pérdida por Lavado",
        descripcion: "Determinación del material fino que pasa la malla No. 200",
        norma: "NMX-C-084",
        aplicable_arena: true,
        aplicable_grava: true
      },
      {
        id: "absorcion",
        nombre: "Absorción",
        descripcion: "Determinación de la capacidad de absorción de agua",
        norma: "NMX-C-164 / NMX-C-165",
        aplicable_arena: true,
        aplicable_grava: true
      }
    ]
  }
];

export default function CaracterizacionMaterialesPage() {
  const { session, profile, isLoading } = useAuthBridge();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPlants, setLoadingPlants] = useState(true);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [estudiosSeleccionados, setEstudiosSeleccionados] = useState<EstudioSeleccionado[]>([]);

  const [formData, setFormData] = useState<EstudioData>({
    id_planta: '',
    planta: '',
    tipo_material: 'Arena',
    nombre_material: '',
    material_id: null,
    mina_procedencia: '',
    ubicacion: '',
    tamaño: '',
    origen_material: '',
    tecnico: '',
    id_muestra: '',
    tipo_estudio: '',
    fecha_muestreo: new Date().toISOString().split('T')[0],
    fecha_elaboracion: new Date().toISOString().split('T')[0]
  });

  // Cargar plantas al montar el componente (depende del perfil para filtrado)
  useEffect(() => {
    if (profile) {
      loadPlants();
      loadMaterials();
    }
  }, [profile]);

  // Filtrar materiales cuando cambie la planta o tipo de material
  useEffect(() => {
    filterMaterials();
  }, [formData.id_planta, formData.tipo_material, materials]);

  const loadPlants = async () => {
    try {
      setLoadingPlants(true);
      
      let query = supabase
        .from('plants')
        .select('id, code, name, business_unit_id')
        .eq('is_active', true)
        .order('code');

      // Filtrar plantas según business_unit del usuario
      if (profile?.business_unit_id) {
        query = query.eq('business_unit_id', profile.business_unit_id);
      }
      // Si no tiene business_unit_id pero tiene plant_id, solo su planta
      else if (profile?.plant_id) {
        query = query.eq('id', profile.plant_id);
      }
      // Si no tiene ninguno (EXECUTIVE global), todas las plantas

      const { data, error } = await query;

      if (error) throw error;
      setPlants(data || []);
    } catch (error) {
      console.error('Error loading plants:', error);
      toast.error('Error al cargar las plantas');
    } finally {
      setLoadingPlants(false);
    }
  };

  const loadMaterials = async () => {
    try {
      setLoadingMaterials(true);
      const { data, error } = await supabase
        .from('materials')
        .select('id, material_name, category, subcategory, aggregate_type, plant_id')
        .eq('is_active', true)
        .eq('category', 'agregado')
        .order('material_name');

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Error loading materials:', error);
      toast.error('Error al cargar los materiales');
    } finally {
      setLoadingMaterials(false);
    }
  };

  const filterMaterials = () => {
    if (!formData.id_planta || !formData.tipo_material) {
      setFilteredMaterials([]);
      return;
    }

    const aggregateTypeMap = {
      'Arena': 'AR',
      'Grava': 'GR'
    };

    const filtered = materials.filter(material => 
      material.plant_id === formData.id_planta &&
      material.aggregate_type === aggregateTypeMap[formData.tipo_material]
    );

    setFilteredMaterials(filtered);
  };

  const handlePlantChange = (plantId: string) => {
    const selectedPlant = plants.find(p => p.id === plantId);
    setFormData(prev => ({
      ...prev,
      id_planta: plantId,
      planta: selectedPlant ? `${selectedPlant.code} - ${selectedPlant.name}` : '',
      nombre_material: '',
      material_id: null,
    }));
  };

  const handleMaterialChange = (materialName: string) => {
    const mat = filteredMaterials.find(m => m.material_name === materialName);
    setFormData(prev => ({
      ...prev,
      nombre_material: materialName,
      material_id: mat?.id ?? null,
    }));
  };

  const handleTipoEstudioChange = (tipo: string) => {
    setFormData(prev => ({
      ...prev,
      tipo_estudio: tipo
    }));
  };

  const handleInputChange = (field: keyof EstudioData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'tipo_material' && { nombre_material: '', material_id: null })
    }));
  };

  const handleEstudioToggle = (estudio: any) => {
    console.log('Toggle estudio:', estudio.nombre);
    
    const estudioSeleccionado: EstudioSeleccionado = {
      tipo_estudio: estudio.categoria,
      nombre_estudio: estudio.nombre,
      descripcion: estudio.descripcion,
      norma_referencia: estudio.norma,
      fecha_programada: new Date().toISOString().split('T')[0]
    };

    setEstudiosSeleccionados(prev => {
      const exists = prev.find(e => e.nombre_estudio === estudio.nombre);
      console.log('Estudio exists:', exists);
      console.log('Previous estudios:', prev);
      
      if (exists) {
        // Remover si ya existe
        const newList = prev.filter(e => e.nombre_estudio !== estudio.nombre);
        console.log('Removing estudio, new list:', newList);
        return newList;
      } else {
        // Agregar si no existe
        const newList = [...prev, estudioSeleccionado];
        console.log('Adding estudio, new list:', newList);
        return newList;
      }
    });
  };

  const isEstudioSelected = (nombreEstudio: string) => {
    return estudiosSeleccionados.some(e => e.nombre_estudio === nombreEstudio);
  };

  const getEstudiosAplicables = () => {
    return ESTUDIOS_DISPONIBLES.map(categoria => ({
      ...categoria,
      estudios: categoria.estudios.filter(estudio => 
        formData.tipo_material === 'Arena' ? estudio.aplicable_arena : estudio.aplicable_grava
      )
    })).filter(categoria => categoria.estudios.length > 0);
  };

  const generateMuestraId = () => {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const plantCode = plants.find(p => p.id === formData.id_planta)?.code || 'XXX';
    return `${plantCode}-${timestamp}-${random}`;
  };

  const validateForm = (): string | null => {

    if (!formData.id_planta) return 'Debe seleccionar una planta';
    if (!formData.tipo_material) return 'Debe seleccionar el tipo de material';
    if (!formData.nombre_material.trim()) return 'Debe seleccionar un material';
    if (!formData.mina_procedencia.trim()) return 'Debe ingresar la mina de procedencia';
    if (!formData.ubicacion.trim()) return 'Debe ingresar la ubicación';
    if (!formData.tecnico.trim()) return 'Debe ingresar el nombre del técnico';
    if (!formData.fecha_muestreo) return 'Debe seleccionar la fecha de muestreo';
    if (!formData.fecha_elaboracion) return 'Debe seleccionar la fecha de elaboración';
    if (!formData.tipo_estudio.trim()) return 'Debe seleccionar un tipo de análisis';
    
    // Validación específica para grava
    if (formData.tipo_material === 'Grava' && !formData.tamaño.trim()) {
      return 'Debe ingresar el tamaño para materiales tipo Grava';
    }

    // Validación de UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(formData.id_planta)) {
      return 'ID de planta inválido';
    }
    
    return null;
  };

  const handleSave = async () => {
    // Verificar autenticación

    if (!session || !session.user) {
      const errorMsg = 'Usuario no autenticado. Por favor, inicie sesión nuevamente.';
      toast.error(errorMsg);
      setAuthError(errorMsg);
      return;
    }

    if (!profile) {
      const errorMsg = 'Perfil de usuario no encontrado. Contacte al administrador.';
      toast.error(errorMsg);
      setAuthError(errorMsg);
      return;
    }

    setAuthError(null);

    // Verificar permisos - solo QUALITY_TEAM y EXECUTIVE
    const hasPermission = profile.role === 'QUALITY_TEAM' || profile.role === 'EXECUTIVE';

    if (!hasPermission) {
      const errorMsg = 'No tiene permisos para crear estudios de caracterización. Solo usuarios con rol QUALITY_TEAM o EXECUTIVE pueden acceder.';
      toast.error(errorMsg);
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setSaving(true);

      // Generar ID de muestra si no existe
      const muestraId = formData.id_muestra || generateMuestraId();

      const dataToSave = {
        ...formData,
        id_muestra: muestraId,
        tipo_estudio: [formData.tipo_estudio] // Convertir string a array para la base de datos
      };

      const { data, error } = await supabase
        .from('alta_estudio')
        .insert([dataToSave])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Crear registro en caracterizacion automáticamente
      const { error: caracError } = await supabase
        .from('caracterizacion')
        .insert([{
          alta_estudio_id: data.id
        }]);

      if (caracError) {
        console.error('Error creating caracterizacion record:', caracError);
        // No fallar completamente, solo registrar el error
      }

      // Debug: Verificar estudios seleccionados
      console.log('Estudios seleccionados antes de guardar:', estudiosSeleccionados);
      console.log('Cantidad de estudios seleccionados:', estudiosSeleccionados.length);
      
      // Guardar estudios seleccionados si existen
      if (estudiosSeleccionados.length > 0) {
        const estudiosData = estudiosSeleccionados.map(estudio => ({
          alta_estudio_id: data.id,
          tipo_estudio: estudio.tipo_estudio,
          nombre_estudio: estudio.nombre_estudio,
          descripcion: estudio.descripcion,
          norma_referencia: estudio.norma_referencia,
          fecha_programada: estudio.fecha_programada,
          estado: 'pendiente'
        }));

        const { error: estudiosError } = await supabase
          .from('estudios_seleccionados')
          .insert(estudiosData);

        if (estudiosError) {
          console.error('Error saving estudios:', estudiosError);
          // No fallar completamente si hay error en estudios
          toast.success('Estudio guardado, pero hubo un problema con algunos estudios seleccionados');
        } else {
          toast.success(`Estudio guardado exitosamente con ${estudiosSeleccionados.length} estudios programados`);
        }
      } else {
        toast.success('Estudio de caracterización guardado exitosamente');
      }
      
      // Redirigir al histórico después de un breve delay
      setTimeout(() => {
        window.location.href = '/quality/caracterizacion-materiales';
      }, 1500);

    } catch (error) {
      // Intentar extraer información del error
      let errorMessage = 'Error al guardar el estudio de caracterización';
      
      console.error('Full error object:', error);
      
      if (error) {
        if (typeof error === 'string') {
          errorMessage += `: ${error}`;
        } else if (error && typeof error === 'object') {
          if ('message' in error && error.message) {
            errorMessage += `: ${error.message}`;
            
            // Verificar si es un error de tabla no encontrada
            if (error.message.includes('relation') && error.message.includes('does not exist')) {
              errorMessage = 'Error: Las tablas de caracterización no existen en la base de datos. Ve a "Diagnóstico DB" para más información.';
            }
          } else if ('details' in error && error.details) {
            errorMessage += `: ${error.details}`;
          } else if ('hint' in error && error.hint) {
            errorMessage += `: ${error.hint}`;
          } else {
            errorMessage += ': Error desconocido';
          }
        }
      }
      
      toast.error(errorMessage, {
        duration: 8000, // Mostrar por más tiempo para errores importantes
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loadingPlants) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>{isLoading ? 'Verificando autenticación...' : 'Cargando plantas...'}</span>
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
            No tiene permisos para acceder a esta página. Solo usuarios con rol QUALITY_TEAM o EXECUTIVE pueden crear estudios de caracterización.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FlaskConical className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Nuevo Estudio de Caracterización
                </h1>
                <p className="text-gray-600">
                  Registro de estudios de caracterización de agregados
                </p>
              </div>
            </div>
            <Link href="/quality/caracterizacion-materiales">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver al Histórico
              </Button>
            </Link>
          </div>
        </div>

        {/* Formulario Principal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Datos Generales del Estudio</span>
            </CardTitle>
            <CardDescription>
              Complete la información básica del material a caracterizar
            </CardDescription>
            {authError && (
              <Alert className="mt-4">
                <AlertDescription className="text-red-600">
                  {authError}
                </AlertDescription>
              </Alert>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Información Básica */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo_estudio">Tipo de Análisis *</Label>
                <Select 
                  value={formData.tipo_estudio} 
                  onValueChange={handleTipoEstudioChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Caracterización interna">Caracterización interna</SelectItem>
                    <SelectItem value="Validación">Validación</SelectItem>
                    <SelectItem value="Nuevo prospecto">Nuevo prospecto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="planta">Planta *</Label>
                <Select 
                  value={formData.id_planta} 
                  onValueChange={handlePlantChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {plants.map((plant) => (
                      <SelectItem key={plant.id} value={plant.id}>
                        {plant.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo_material">Tipo de Material *</Label>
                <Select 
                  value={formData.tipo_material} 
                  onValueChange={(value: 'Arena' | 'Grava') => handleInputChange('tipo_material', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Arena">Arena</SelectItem>
                    <SelectItem value="Grava">Grava</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Material y Fechas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre_material">Material *</Label>
                <Select 
                  value={formData.nombre_material} 
                  onValueChange={handleMaterialChange}
                  disabled={!formData.id_planta || !formData.tipo_material || loadingMaterials}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !formData.id_planta || !formData.tipo_material 
                        ? "Seleccionar planta y tipo"
                        : loadingMaterials 
                        ? "Cargando..."
                        : "Seleccionar material"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMaterials.map((material) => (
                      <SelectItem key={material.id} value={material.material_name}>
                        {material.material_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filteredMaterials.length === 0 && formData.id_planta && formData.tipo_material && !loadingMaterials && (
                  <p className="text-xs text-amber-600">
                    Sin materiales disponibles
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_muestreo">Fecha Muestreo *</Label>
                <Input
                  id="fecha_muestreo"
                  type="date"
                  value={formData.fecha_muestreo}
                  onChange={(e) => handleInputChange('fecha_muestreo', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_elaboracion">Fecha Elaboración *</Label>
                <Input
                  id="fecha_elaboracion"
                  type="date"
                  value={formData.fecha_elaboracion}
                  onChange={(e) => handleInputChange('fecha_elaboracion', e.target.value)}
                />
              </div>
            </div>

            {/* Información de Procedencia */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mina_procedencia">Mina de Procedencia *</Label>
                <Input
                  id="mina_procedencia"
                  value={formData.mina_procedencia}
                  onChange={(e) => handleInputChange('mina_procedencia', e.target.value)}
                  placeholder="Nombre de la mina"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ubicacion">Ubicación *</Label>
                <Input
                  id="ubicacion"
                  value={formData.ubicacion}
                  onChange={(e) => handleInputChange('ubicacion', e.target.value)}
                  placeholder="Ubicación geográfica"
                />
              </div>
            </div>

            {/* Características y Técnico */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="origen_material">Origen</Label>
                <Input
                  id="origen_material"
                  value={formData.origen_material}
                  onChange={(e) => handleInputChange('origen_material', e.target.value)}
                  placeholder="Ej: Volcánica, Basáltica"
                />
              </div>

              {formData.tipo_material === 'Grava' && (
                <div className="space-y-2">
                  <Label htmlFor="tamaño">Tamaño *</Label>
                  <Input
                    id="tamaño"
                    value={formData.tamaño}
                    onChange={(e) => handleInputChange('tamaño', e.target.value)}
                    placeholder="Ej: 20mm, 40mm"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="tecnico">Muestreado por *</Label>
                <Input
                  id="tecnico"
                  value={formData.tecnico}
                  onChange={(e) => handleInputChange('tecnico', e.target.value)}
                  placeholder="Nombre del técnico"
                />
              </div>
            </div>

            {/* ID de Muestra */}
            <div className="space-y-2">
              <Label htmlFor="id_muestra">ID de la Muestra</Label>
              <Input
                id="id_muestra"
                value={formData.id_muestra}
                onChange={(e) => handleInputChange('id_muestra', e.target.value)}
                placeholder="Se generará automáticamente si se deja vacío"
                className="max-w-md"
              />
              {formData.id_muestra === '' && (
                <p className="text-xs text-gray-500">
                  💡 Se generará automáticamente basado en la planta y fecha
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sección de Estudios a Realizar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FlaskConical className="h-5 w-5" />
              <span>Estudios a Realizar</span>
            </CardTitle>
            <CardDescription>
              Seleccione los estudios de caracterización que se realizarán al material
              {formData.tipo_material && (
                <span className="font-medium text-blue-600"> ({formData.tipo_material})</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {formData.tipo_material ? (
              <>
                {getEstudiosAplicables().map((categoria, categoriaIndex) => (
                  <div key={categoriaIndex} className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                      {categoria.categoria}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {categoria.estudios.map((estudio, estudioIndex) => (
                        <div
                          key={estudio.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-all ${
                            isEstudioSelected(estudio.nombre)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleEstudioToggle({...estudio, categoria: categoria.categoria})}
                        >
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              checked={isEstudioSelected(estudio.nombre)}
                              onChange={() => handleEstudioToggle({...estudio, categoria: categoria.categoria})}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">
                                {estudio.nombre}
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                {estudio.descripcion}
                              </p>
                              <p className="text-xs text-blue-600 mt-2 font-medium">
                                {estudio.norma}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {estudiosSeleccionados.length > 0 && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">
                      Estudios Seleccionados ({estudiosSeleccionados.length})
                    </h4>
                    <div className="space-y-2">
                      {estudiosSeleccionados.map((estudio, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-green-700">{estudio.nombre_estudio}</span>
                          <span className="text-green-600 text-xs">{estudio.norma_referencia}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Seleccione el tipo de material para ver los estudios disponibles</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botones de Acción */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end space-x-4">
              <Link href="/quality/caracterizacion-materiales">
                <Button variant="outline">
                  Cancelar
                </Button>
              </Link>
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="min-w-[120px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Estudio
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Información Adicional */}
        <Alert>
          <FlaskConical className="h-4 w-4" />
          <AlertDescription>
            <strong>Nota:</strong> Una vez guardado el estudio, podrá proceder con las pruebas de caracterización 
            correspondientes (granulometría, densidad, absorción, etc.) en las secciones específicas del módulo de calidad.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}