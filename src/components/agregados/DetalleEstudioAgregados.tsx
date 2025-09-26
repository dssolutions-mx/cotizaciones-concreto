'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, BarChart3, Scale, TestTube, CheckCircle2, Clock } from 'lucide-react';
import FormularioMasaEspecifica from './FormularioMasaEspecifica';
import FormularioGranulometria from './FormularioGranulometria';
import { caracterizacionService } from '@/services/caracterizacionService';
import type { AltaEstudio } from '@/types/agregados';

interface DetalleEstudioAgregadosProps {
  estudio: AltaEstudio;
  onVolver: () => void;
}

interface EstadoFormulario {
  completado: boolean;
  fechaActualizacion?: string;
}

export default function DetalleEstudioAgregados({
  estudio,
  onVolver
}: DetalleEstudioAgregadosProps) {
  const [vistaActual, setVistaActual] = useState<'resumen' | 'masa-especifica' | 'granulometria'>('resumen');
  const [estadosFormularios, setEstadosFormularios] = useState<Record<string, EstadoFormulario>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Verificar qué formularios están disponibles según los estudios seleccionados
  const estudiosDisponibles = estudio.tipo_estudio || [];
  
  const formularios = [
    {
      id: 'masa-especifica',
      titulo: 'Masa Específica',
      descripcion: 'Determinación de la masa específica (s.s.s. y seca)',
      icono: Scale,
      disponible: estudiosDisponibles.includes('Masa específica (s.s.s. y seca)'),
      vista: 'masa-especifica' as const
    },
    {
      id: 'granulometria',
      titulo: 'Granulometría',
      descripcion: 'Análisis granulométrico por tamizado',
      icono: BarChart3,
      disponible: estudiosDisponibles.includes('Granulometría'),
      vista: 'granulometria' as const
    },
    {
      id: 'masa-volumetrica',
      titulo: 'Masa Volumétrica',
      descripción: 'Masa volumétrica suelta y compactada',
      icono: TestTube,
      disponible: estudiosDisponibles.includes('Masa volumétrica (suelta y compactada)'),
      vista: null // Por implementar
    },
    {
      id: 'absorcion',
      titulo: 'Absorción',
      descripcion: 'Determinación del porcentaje de absorción',
      icono: TestTube,
      disponible: estudiosDisponibles.includes('Absorción (%)'),
      vista: null // Por implementar
    }
  ];

  useEffect(() => {
    // Aquí podrías cargar el estado de los formularios desde la base de datos
    // Por ahora, simulamos que están pendientes
    const estados: Record<string, EstadoFormulario> = {};
    formularios.forEach(formulario => {
      if (formulario.disponible) {
        estados[formulario.id] = {
          completado: false
        };
      }
    });
    setEstadosFormularios(estados);
  }, [estudio.id]);

  const manejarGuardarMasaEspecifica = async (datos: any) => {
    setIsLoading(true);
    try {
      console.log('Guardando datos de masa específica:', datos);
      
      // Guardar en la tabla caracterizacion
      await caracterizacionService.guardarCaracterizacion(estudio.id!, {
        masa_especifica: datos.mes || null,
        masa_especifica_sss: datos.messs || null,
        masa_especifica_seca: datos.me || null,
        masa_muestra_sss: datos.a || null,
        masa_muestra_seca_lavada: datos.ms || null,
        volumen_desplazado: datos.v || null
      });
      
      // Actualizar estado
      setEstadosFormularios(prev => ({
        ...prev,
        'masa-especifica': {
          completado: true,
          fechaActualizacion: new Date().toISOString()
        }
      }));
      
      setVistaActual('resumen');
    } catch (error) {
      console.error('Error al guardar masa específica:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const manejarGuardarGranulometria = async (datos: any) => {
    setIsLoading(true);
    try {
      console.log('Guardando datos de granulometría:', datos);
      
      // Guardar en la tabla granulometrias
      await caracterizacionService.guardarGranulometria(estudio.id!, datos);
      
      // Actualizar estado
      setEstadosFormularios(prev => ({
        ...prev,
        'granulometria': {
          completado: true,
          fechaActualizacion: new Date().toISOString()
        }
      }));
      
      setVistaActual('resumen');
    } catch (error) {
      console.error('Error al guardar granulometría:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizar vista específica
  if (vistaActual === 'masa-especifica') {
    return (
      <FormularioMasaEspecifica
        altaEstudioId={estudio.id!}
        onGuardar={manejarGuardarMasaEspecifica}
        onCancelar={() => setVistaActual('resumen')}
        isLoading={isLoading}
      />
    );
  }

  if (vistaActual === 'granulometria') {
    return (
      <FormularioGranulometria
        altaEstudioId={estudio.id!}
        onGuardar={manejarGuardarGranulometria}
        onCancelar={() => setVistaActual('resumen')}
        isLoading={isLoading}
      />
    );
  }

  // Vista principal del detalle
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={onVolver}
          className="mb-4 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la Lista
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Estudio de {estudio.tipo_material} - {estudio.nombre_material}
            </h1>
            <p className="text-gray-600">
              Creado el {new Date(estudio.created_at || '').toLocaleDateString('es-ES')}
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {estudio.tipo_material}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información General</CardTitle>
        </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-600">Material:</span>
              <p className="text-sm">{estudio.nombre_material}</p>
                </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Mina de Procedencia:</span>
              <p className="text-sm">{estudio.mina_procedencia}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Técnico Responsable:</span>
              <p className="text-sm">{estudio.tecnico}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Planta:</span>
              <p className="text-sm">{estudio.planta}</p>
          </div>
        </CardContent>
      </Card>

        {/* Progreso */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progreso del Estudio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {formularios.filter(f => f.disponible).map(formulario => {
                const estado = estadosFormularios[formulario.id];
    return (
                  <div key={formulario.id} className="flex items-center justify-between">
                    <span className="text-sm">{formulario.titulo}</span>
                    {estado?.completado ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Completado:</span>
                <span className="text-sm font-bold">
                  {Object.values(estadosFormularios).filter(e => e.completado).length} / {Object.keys(estadosFormularios).length}
                </span>
            </div>
          </div>
        </CardContent>
      </Card>

        {/* Estudios Solicitados */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estudios Solicitados</CardTitle>
        </CardHeader>
          <CardContent>
              <div className="space-y-2">
              {estudiosDisponibles.map((estudio, index) => (
                <Badge key={index} variant="secondary" className="block w-full text-center py-1">
                  {estudio}
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Formularios Disponibles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Formularios de Laboratorio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formularios.filter(f => f.disponible).map(formulario => {
              const estado = estadosFormularios[formulario.id];
              const IconoFormulario = formulario.icono;
              
              return (
                <Card 
                  key={formulario.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    estado?.completado ? 'border-green-200 bg-green-50' : 'border-gray-200'
                  }`}
                  onClick={() => formulario.vista && setVistaActual(formulario.vista)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <IconoFormulario className={`h-6 w-6 ${
                        estado?.completado ? 'text-green-600' : 'text-blue-600'
                      }`} />
                      {estado?.completado ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-orange-500" />
                      )}
              </div>
              
                    <h3 className="font-semibold text-sm mb-1">{formulario.titulo}</h3>
                    <p className="text-xs text-gray-600 mb-3">{formulario.descripcion}</p>
                    
                    <div className="flex justify-between items-center">
                      <Badge 
                        variant={estado?.completado ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {estado?.completado ? "Completado" : "Pendiente"}
                      </Badge>
                      
                      {formulario.vista ? (
                        <Button size="sm" variant="outline">
                          {estado?.completado ? "Ver/Editar" : "Iniciar"}
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Próximamente
                        </Badge>
                      )}
            </div>
            
                    {estado?.fechaActualizacion && (
                      <p className="text-xs text-gray-500 mt-2">
                        Actualizado: {new Date(estado.fechaActualizacion).toLocaleDateString('es-ES')}
                      </p>
                    )}
        </CardContent>
      </Card>
    );
            })}
            </div>
            
          {formularios.filter(f => f.disponible).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay formularios disponibles para este estudio.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}