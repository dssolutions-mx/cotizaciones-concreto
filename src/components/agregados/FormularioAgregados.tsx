'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle
} from 'lucide-react';
import { 
  FormularioAgregados as FormularioAgregadosType,
  DatosGeneralesMuestra,
  TAMAÑOS_GRAVA,
  TIPOS_ORIGEN_GRAVA,
  PLANTAS_DISPONIBLES,
  MALLAS_GRANULOMETRICAS
} from '@/types/agregados';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FormularioAgregadosProps {
  onGuardar: (datos: FormularioAgregadosType) => void;
  onCancelar: () => void;
  datosIniciales?: Partial<FormularioAgregadosType>;
  modo?: 'crear' | 'editar';
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
    descripcion: 'Selección de análisis',
    icono: CheckCircle
  },
  { 
    id: 3, 
    titulo: 'Datos de Laboratorio', 
    descripcion: 'Ingreso de mediciones',
    icono: Calculator
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
  modo = 'crear'
}: FormularioAgregadosProps) {
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

  // Validación del paso actual
  const validarPaso = (paso: number): boolean => {
    const nuevosErrores: Record<string, string> = {};

    if (paso === 1) {
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

  const renderPaso2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">Seleccione los estudios a realizar</h3>
        <p className="text-gray-600">
          Marque los análisis que desea incluir en el estudio de agregados
        </p>
      </div>

      {errores.estudios && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-600">
            {errores.estudios}
          </AlertDescription>
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
    </div>
  );

  const renderPaso3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">Datos de Laboratorio</h3>
        <p className="text-gray-600">
          Los campos de datos se mostrarán según los estudios seleccionados. 
          Los cálculos se realizarán automáticamente.
        </p>
      </div>

      <Alert>
        <Calculator className="h-4 w-4" />
        <AlertDescription>
          Esta sección se desarrollará completamente una vez que confirme la estructura de datos. 
          Incluirá formularios específicos para cada tipo de estudio seleccionado con cálculos automáticos.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {Object.entries(formulario.estudiosSeleccionados)
          .filter(([_, seleccionado]) => seleccionado)
          .map(([key, _]) => {
            const estudio = ESTUDIOS_DISPONIBLES.find(e => e.key === key);
            if (!estudio) return null;
            
            const Icono = estudio.icono;
            
            return (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icono className="h-5 w-5" />
                    {estudio.nombre}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">{estudio.descripcion}</p>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Formulario específico para {estudio.nombre.toLowerCase()} se implementará aquí
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );

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
          {pasoActual === 3 && renderPaso3()}
        </CardContent>
      </Card>

      {/* Botones de navegación */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={pasoActual === 1 ? onCancelar : pasoAnterior}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          {pasoActual === 1 ? 'Cancelar' : 'Anterior'}
        </Button>

        <div className="flex gap-2">
          {pasoActual < 3 ? (
            <Button onClick={siguientePaso}>
              Siguiente
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={manejarGuardar}>
              <Save className="h-4 w-4 mr-2" />
              {modo === 'crear' ? 'Crear Estudio' : 'Guardar Cambios'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


