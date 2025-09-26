'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription as AlertDesc } from "@/components/ui/alert";
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  FileText, 
  Calculator,
  Beaker,
  Scale,
  Droplets,
  BarChart3,
  CheckCircle,
  CheckCircle2,
  Info,
  AlertTriangle
} from 'lucide-react';
import { 
  FormularioAgregados as FormularioAgregadosType,
  DatosGeneralesMuestra,
  TAMAÑOS_GRAVA,
  TIPOS_ORIGEN_GRAVA,
  PLANTAS_DISPONIBLES,
  MALLAS_GRANULOMETRICAS
} from '@/types/agregados';
import { caracterizacionService } from '@/services/caracterizacionService';
import { Material } from '@/types/recipes';
import { usePlantContext } from '@/contexts/PlantContext';

interface FormularioAgregadosProps {
  onGuardar: (datos: FormularioAgregadosType) => void;
  onCancelar: () => void;
  datosIniciales?: Partial<FormularioAgregadosType>;
  modo?: 'crear' | 'editar';
  isLoading?: boolean;
}

const PASOS_FORMULARIO = [
  { 
    id: 1, 
    titulo: 'Datos Generales', 
    descripcion: 'Información básica de la muestra',
    icono: FileText
  },
  { 
    id: 2, 
    titulo: 'Estudios a Realizar', 
    descripcion: 'Selección de análisis y resumen',
    icono: CheckCircle
  }
];

const ESTUDIOS_DISPONIBLES = [
  {
    key: 'masaEspecifica' as const,
    nombre: 'Masa Específica (s.s.s. y seca)',
    descripcion: 'Ref. NMX-C-164-ONNCCE-2014',
    icono: Scale
  },
  {
    key: 'masaVolumetrica' as const,
    nombre: 'Masa Volumétrica',
    descripcion: 'Ref. NMX-C-073-ONNCCE-2004',
    icono: Beaker
  },
  {
    key: 'absorcion' as const,
    nombre: 'Absorción',
    descripcion: 'Ref. NMX-C-164-ONNCCE-2014',
    icono: Droplets
  },
  {
    key: 'perdidaPorLavado' as const,
    nombre: 'Pérdida por Lavado',
    descripcion: 'Ref. NMX-C-084-ONNCCE-2018',
    icono: Droplets
  },
  {
    key: 'granulometria' as const,
    nombre: 'Granulometría',
    descripcion: 'Ref. NMX-C-077-ONNCCE-2019',
    icono: BarChart3
  }
];

export default function FormularioAgregados({
  onGuardar,
  onCancelar,
  datosIniciales,
  modo = 'crear',
  isLoading = false
}: FormularioAgregadosProps) {
  const { currentPlant } = usePlantContext();
  const [pasoActual, setPasoActual] = useState(1);
  const [formulario, setFormulario] = useState<FormularioAgregadosType>({
    datosGenerales: datosIniciales?.datosGenerales || {},
    estudiosSeleccionados: datosIniciales?.estudiosSeleccionados || {
      masaEspecifica: false,
      masaVolumetrica: false,
      absorcion: false,
      perdidaPorLavado: false,
      granulometria: false
    },
    datosEstudios: datosIniciales?.datosEstudios || {}
  });

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [materialesDisponibles, setMaterialesDisponibles] = useState<Material[]>([]);
  const [cargandoMateriales, setCargandoMateriales] = useState(false);

  // Cargar materiales cuando cambie el tipo de material
  useEffect(() => {
    const cargarMateriales = async () => {
      if (!currentPlant?.id || !formulario.datosGenerales.tipoMaterial) {
        setMaterialesDisponibles([]);
        return;
      }

      try {
        setCargandoMateriales(true);
        const materiales = await caracterizacionService.getMaterialesPorTipoYPlanta(
          currentPlant.id, 
          formulario.datosGenerales.tipoMaterial as 'Arena' | 'Grava'
        );
        
        setMaterialesDisponibles(materiales);
        
        // Limpiar errores si se cargaron materiales exitosamente
        if (errores.nombreMaterial && materiales.length > 0) {
          setErrores(prev => {
            const nuevos = { ...prev };
            delete nuevos.nombreMaterial;
            return nuevos;
          });
        }
      } catch (error) {
        console.error('Error al cargar materiales:', error);
        setMaterialesDisponibles([]);
        // Mostrar error al usuario si es necesario
        setErrores(prev => ({
          ...prev,
          nombreMaterial: 'Error al cargar materiales. Intente de nuevo.'
        }));
      } finally {
        setCargandoMateriales(false);
      }
    };

    cargarMateriales();
  }, [currentPlant?.id, formulario.datosGenerales.tipoMaterial]);

  // Limpiar material seleccionado cuando cambie el tipo
  useEffect(() => {
    if (formulario.datosGenerales.nombreMaterial && formulario.datosGenerales.tipoMaterial) {
      // Verificar si el material seleccionado sigue siendo válido para el nuevo tipo
      const materialValido = materialesDisponibles.some(
        m => m.material_name === formulario.datosGenerales.nombreMaterial
      );
      
      if (!materialValido) {
        actualizarDatosGenerales('nombreMaterial', '');
      }
    }
  }, [materialesDisponibles, formulario.datosGenerales.tipoMaterial]);

  // Validación del paso actual
  const validarPaso = (paso: number): boolean => {
    const nuevosErrores: Record<string, string> = {};

    if (paso === 1) {
      if (!formulario.datosGenerales.tipoMaterial) {
        nuevosErrores.tipoMaterial = 'Campo requerido';
      }
      if (!formulario.datosGenerales.nombreMaterial) {
        nuevosErrores.nombreMaterial = 'Campo requerido';
      }
      if (!formulario.datosGenerales.minaProcedencia) {
        nuevosErrores.minaProcedencia = 'Campo requerido';
      }
      if (!formulario.datosGenerales.cliente) {
        nuevosErrores.cliente = 'Campo requerido';
      }
      if (!formulario.datosGenerales.plantaProcedencia) {
        nuevosErrores.plantaProcedencia = 'Campo requerido';
      }
    }

    if (paso === 2) {
      const algunEstudioSeleccionado = Object.values(formulario.estudiosSeleccionados).some(Boolean);
      if (!algunEstudioSeleccionado) {
        nuevosErrores.estudios = 'Debe seleccionar al menos un estudio';
      }
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const siguientePaso = () => {
    if (validarPaso(pasoActual)) {
      setPasoActual(Math.min(pasoActual + 1, 3));
    }
  };

  const pasoAnterior = () => {
    setPasoActual(Math.max(pasoActual - 1, 1));
  };

  const actualizarDatosGenerales = (campo: keyof DatosGeneralesMuestra, valor: string) => {
    setFormulario(prev => ({
      ...prev,
      datosGenerales: {
        ...prev.datosGenerales,
        [campo]: valor
      }
    }));
    
    // Limpiar error si existe
    if (errores[campo]) {
      setErrores(prev => {
        const nuevos = { ...prev };
        delete nuevos[campo];
        return nuevos;
      });
    }
  };

  const toggleEstudio = (estudio: keyof typeof formulario.estudiosSeleccionados) => {
    setFormulario(prev => ({
      ...prev,
      estudiosSeleccionados: {
        ...prev.estudiosSeleccionados,
        [estudio]: !prev.estudiosSeleccionados[estudio]
      }
    }));
  };

  const manejarGuardar = () => {
    if (validarPaso(pasoActual)) {
      onGuardar(formulario);
    }
  };

  const renderPaso1 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="tipoMaterial">Tipo de Material *</Label>
          <Select
            value={formulario.datosGenerales.tipoMaterial || ''}
            onValueChange={(value) => actualizarDatosGenerales('tipoMaterial', value)}
          >
            <SelectTrigger className={errores.tipoMaterial ? 'border-red-500' : ''}>
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Arena">Arena</SelectItem>
              <SelectItem value="Grava">Grava</SelectItem>
            </SelectContent>
          </Select>
          {errores.tipoMaterial && (
            <p className="text-sm text-red-500">{errores.tipoMaterial}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nombreMaterial">Nombre del Material *</Label>
          <Select
            value={formulario.datosGenerales.nombreMaterial || ''}
            onValueChange={(value) => actualizarDatosGenerales('nombreMaterial', value)}
            disabled={!formulario.datosGenerales.tipoMaterial || cargandoMateriales}
          >
            <SelectTrigger className={errores.nombreMaterial ? 'border-red-500' : ''}>
              <SelectValue placeholder={
                !formulario.datosGenerales.tipoMaterial 
                  ? "Primero seleccione el tipo" 
                  : cargandoMateriales 
                    ? "Cargando materiales..." 
                    : materialesDisponibles.length === 0
                      ? "No hay materiales disponibles"
                      : "Seleccionar material"
              } />
            </SelectTrigger>
            <SelectContent>
              {materialesDisponibles
                .filter(material => {
                  // Filtrar materiales con nombres válidos
                  const hasValidName = material.material_name && 
                                      typeof material.material_name === 'string' && 
                                      material.material_name.trim() !== '';
                  const hasValidId = material.id && material.id.trim() !== '';
                  return hasValidName && hasValidId;
                })
                .map((material) => (
                  <SelectItem 
                    key={material.id} 
                    value={material.material_name.trim()}
                  >
                    {material.material_name} ({material.material_code || 'Sin código'})
                  </SelectItem>
                ))}
              {materialesDisponibles.length === 0 && formulario.datosGenerales.tipoMaterial && !cargandoMateriales && (
                <div className="px-2 py-1.5 text-sm text-gray-500 text-center">
                  No hay materiales de tipo {formulario.datosGenerales.tipoMaterial} disponibles
                </div>
              )}
            </SelectContent>
          </Select>
          {errores.nombreMaterial && (
            <p className="text-sm text-red-500">{errores.nombreMaterial}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="minaProcedencia">Mina de Procedencia *</Label>
          <Input
            id="minaProcedencia"
            value={formulario.datosGenerales.minaProcedencia || ''}
            onChange={(e) => actualizarDatosGenerales('minaProcedencia', e.target.value)}
            placeholder="Ingrese el nombre de la mina"
            className={errores.minaProcedencia ? 'border-red-500' : ''}
          />
          {errores.minaProcedencia && (
            <p className="text-sm text-red-500">{errores.minaProcedencia}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ubicacion">Ubicación</Label>
          <Input
            id="ubicacion"
            value={formulario.datosGenerales.ubicacion || ''}
            onChange={(e) => actualizarDatosGenerales('ubicacion', e.target.value)}
            placeholder="Ubicación geográfica"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tamanoGrava">Tamaño de la Grava</Label>
          <Select
            value={formulario.datosGenerales.tamanoGrava || ''}
            onValueChange={(value) => actualizarDatosGenerales('tamanoGrava', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tamaño" />
            </SelectTrigger>
            <SelectContent>
              {TAMAÑOS_GRAVA.map(tamano => (
                <SelectItem key={tamano.value} value={tamano.value}>
                  {tamano.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="origenGrava">Origen de la Grava</Label>
          <Select
            value={formulario.datosGenerales.origenGrava || ''}
            onValueChange={(value) => actualizarDatosGenerales('origenGrava', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar origen" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_ORIGEN_GRAVA.map(origen => (
                <SelectItem key={origen} value={origen}>
                  {origen}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="muestreaPor">Muestreada por</Label>
          <Input
            id="muestreaPor"
            value={formulario.datosGenerales.muestreaPor || ''}
            onChange={(e) => actualizarDatosGenerales('muestreaPor', e.target.value)}
            placeholder="Nombre del técnico"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cliente">Cliente *</Label>
          <Input
            id="cliente"
            value={formulario.datosGenerales.cliente || ''}
            onChange={(e) => actualizarDatosGenerales('cliente', e.target.value)}
            placeholder="Nombre del cliente"
            className={errores.cliente ? 'border-red-500' : ''}
          />
          {errores.cliente && (
            <p className="text-sm text-red-500">{errores.cliente}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="idMuestra">ID de la Muestra</Label>
          <Input
            id="idMuestra"
            value={formulario.datosGenerales.idMuestra || ''}
            onChange={(e) => actualizarDatosGenerales('idMuestra', e.target.value)}
            placeholder="Identificador único"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="plantaProcedencia">Planta de Procedencia *</Label>
          <Select
            value={formulario.datosGenerales.plantaProcedencia || ''}
            onValueChange={(value) => actualizarDatosGenerales('plantaProcedencia', value)}
          >
            <SelectTrigger className={errores.plantaProcedencia ? 'border-red-500' : ''}>
              <SelectValue placeholder="Seleccionar planta" />
            </SelectTrigger>
            <SelectContent>
              {PLANTAS_DISPONIBLES.map(planta => (
                <SelectItem key={planta.value} value={planta.value}>
                  {planta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errores.plantaProcedencia && (
            <p className="text-sm text-red-500">{errores.plantaProcedencia}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderPaso2 = () => {
    const todosSeleccionados = Object.values(formulario.estudiosSeleccionados).every(Boolean);
    const algunoSeleccionado = Object.values(formulario.estudiosSeleccionados).some(Boolean);

    const toggleTodos = () => {
      const nuevoEstado = !todosSeleccionados;
      setFormulario(prev => ({
        ...prev,
        estudiosSeleccionados: {
          masaEspecifica: nuevoEstado,
          masaVolumetrica: nuevoEstado,
          absorcion: nuevoEstado,
          perdidaPorLavado: nuevoEstado,
          granulometria: nuevoEstado
        }
      }));
    };

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold mb-2">Seleccione los estudios a realizar</h3>
          <p className="text-gray-600">
            Marque los análisis que desea incluir en el estudio de agregados
          </p>
        </div>

        <div className="flex justify-center mb-4">
          <Button
            type="button"
            variant={todosSeleccionados ? "destructive" : "default"}
            onClick={toggleTodos}
            className="flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            {todosSeleccionados ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
          </Button>
        </div>

        {errores.estudios && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDesc className="text-red-600">
              {errores.estudios}
            </AlertDesc>
          </Alert>
        )}

        <div className="grid gap-4">
          {ESTUDIOS_DISPONIBLES.map(estudio => {
            const Icono = estudio.icono;
            const seleccionado = formulario.estudiosSeleccionados[estudio.key];
            
            return (
              <Card 
                key={estudio.key}
                className={`cursor-pointer transition-all ${
                  seleccionado 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'hover:border-gray-300 hover:shadow-sm'
                }`}
                onClick={() => toggleEstudio(estudio.key)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <Checkbox
                      checked={seleccionado}
                      onChange={() => toggleEstudio(estudio.key)}
                      className="pointer-events-none"
                    />
                    <Icono className={`h-6 w-6 ${seleccionado ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div className="flex-1">
                      <h4 className={`font-medium ${seleccionado ? 'text-blue-900' : 'text-gray-900'}`}>
                        {estudio.nombre}
                      </h4>
                      <p className={`text-sm ${seleccionado ? 'text-blue-700' : 'text-gray-600'}`}>
                        {estudio.descripcion}
                      </p>
                    </div>
                    {seleccionado && (
                      <Badge className="bg-blue-100 text-blue-800">
                        Seleccionado
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Resumen cuando hay estudios seleccionados */}
        {Object.entries(formulario.estudiosSeleccionados).filter(([_, sel]) => sel).length > 0 && (
          <div className="border-t pt-6 mt-8">
            <h3 className="text-lg font-semibold mb-4">Resumen del Estudio</h3>
            
            {/* Resumen de datos generales */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-base">Datos Generales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Tipo de Material:</span>
                    <p>{formulario.datosGenerales.tipoMaterial}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Material:</span>
                    <p>{formulario.datosGenerales.nombreMaterial}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Mina de Procedencia:</span>
                    <p>{formulario.datosGenerales.minaProcedencia}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Técnico:</span>
                    <p>{formulario.datosGenerales.muestreaPor}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Estudios seleccionados */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-base">Estudios Seleccionados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(formulario.estudiosSeleccionados)
                    .filter(([_, seleccionado]) => seleccionado)
                    .map(([key, _]) => {
                      const estudio = ESTUDIOS_DISPONIBLES.find(e => e.key === key);
                      if (!estudio) return null;
                      
                      const Icono = estudio.icono;
                      
                      return (
                        <div key={key} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                          <Icono className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">{estudio.nombre}</span>
                          <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDesc>
                <strong>¿Qué sucede después?</strong><br />
                Una vez creado el estudio, podrá acceder a los formularios específicos de cada prueba 
                desde la vista de detalle para ingresar los datos de laboratorio.
              </AlertDesc>
            </Alert>
          </div>
        )}
      </div>
    );
  };


  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {modo === 'crear' ? 'Nuevo' : 'Editar'} Estudio de Agregados
        </h1>
        <p className="text-gray-600">
          Complete la información para el análisis de caracterización de materiales
        </p>
      </div>

      {/* Indicador de pasos */}
      <div className="flex items-center justify-between mb-8">
        {PASOS_FORMULARIO.map((paso, index) => {
          const Icono = paso.icono;
          const esActual = paso.id === pasoActual;
          const esCompletado = paso.id < pasoActual;
          
          return (
            <div key={paso.id} className="flex items-center">
              <div className={`flex flex-col items-center ${index < PASOS_FORMULARIO.length - 1 ? 'flex-1' : ''}`}>
                <div className={`
                  flex items-center justify-center w-10 h-10 rounded-full border-2 mb-2
                  ${esActual ? 'border-blue-500 bg-blue-50 text-blue-600' : ''}
                  ${esCompletado ? 'border-green-500 bg-green-50 text-green-600' : ''}
                  ${!esActual && !esCompletado ? 'border-gray-300 bg-gray-50 text-gray-400' : ''}
                `}>
                  <Icono className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-medium ${esActual ? 'text-blue-600' : esCompletado ? 'text-green-600' : 'text-gray-400'}`}>
                    {paso.titulo}
                  </p>
                  <p className="text-xs text-gray-500">{paso.descripcion}</p>
                </div>
              </div>
              {index < PASOS_FORMULARIO.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${esCompletado ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Contenido del paso actual */}
      <Card className="mb-6">
        <CardContent className="p-6">
          {pasoActual === 1 && renderPaso1()}
          {pasoActual === 2 && renderPaso2()}
        </CardContent>
      </Card>

      {/* Botones de navegación */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={pasoActual === 1 ? onCancelar : pasoAnterior}
          disabled={isLoading}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          {pasoActual === 1 ? 'Cancelar' : 'Anterior'}
        </Button>

        <div className="flex gap-2">
          {pasoActual < 2 ? (
            <Button onClick={siguientePaso} disabled={isLoading}>
              Siguiente
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={manejarGuardar} disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {modo === 'crear' ? 'Crear Estudio' : 'Guardar Cambios'}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


