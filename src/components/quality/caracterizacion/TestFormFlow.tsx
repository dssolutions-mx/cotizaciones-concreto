'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TestTube, 
  CheckCircle, 
  XCircle, 
  Play,
  Save,
  FlaskConical
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface EstudioSeleccionado {
  tipo_estudio: string;
  nombre_estudio: string;
  descripcion: string;
  norma_referencia: string;
  fecha_programada?: string;
}

const ESTUDIOS_DISPONIBLES = [
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
        nombre: "Masa Volumétrico",
        descripcion: "Determinación de la masa volumétrica suelto y compactado",
        norma: "NMX-C-073",
        aplicable_arena: true,
        aplicable_grava: true
      }
    ]
  }
];

export default function TestFormFlow() {
  const [testing, setTesting] = useState(false);
  const [estudiosSeleccionados, setEstudiosSeleccionados] = useState<EstudioSeleccionado[]>([]);
  const [formData, setFormData] = useState({
    planta: 'P001 - Planta Test Flow',
    tipo_material: 'Arena' as const,
    nombre_material: 'Arena Test Flow',
    mina_procedencia: 'Mina Test Flow',
    ubicacion: 'Ubicación Test',
    tecnico: 'Técnico Test',
    fecha_muestreo: new Date().toISOString().split('T')[0],
    fecha_elaboracion: new Date().toISOString().split('T')[0]
  });
  const [result, setResult] = useState<any>(null);

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

  const handleSave = async () => {
    setTesting(true);
    setResult(null);

    try {
      console.log('=== INICIANDO GUARDADO ===');
      console.log('Form data:', formData);
      console.log('Estudios seleccionados:', estudiosSeleccionados);
      console.log('Cantidad de estudios:', estudiosSeleccionados.length);

      // Generar ID de muestra
      const muestraId = `FLOW-TEST-${Date.now()}`;
      
      // Preparar datos para alta_estudio
      const dataToSave = {
        ...formData,
        id_muestra: muestraId,
        tipo_estudio: [formData.tipo_material] // Convertir string a array para la base de datos
      };

      console.log('Data to save:', dataToSave);

      // PASO 1: Guardar alta_estudio
      const { data, error } = await supabase
        .from('alta_estudio')
        .insert([dataToSave])
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('Alta estudio guardado:', data);

      // PASO 2: Crear registro en caracterizacion
      const { error: caracError } = await supabase
        .from('caracterizacion')
        .insert([{
          alta_estudio_id: data.id
        }]);

      if (caracError) {
        console.error('Error creating caracterizacion record:', caracError);
      } else {
        console.log('Caracterización creada exitosamente');
      }

      // PASO 3: Guardar estudios seleccionados
      console.log('=== GUARDANDO ESTUDIOS SELECCIONADOS ===');
      console.log('Estudios a guardar:', estudiosSeleccionados);
      
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

        console.log('Estudios data to insert:', estudiosData);

        const { data: estudiosResult, error: estudiosError } = await supabase
          .from('estudios_seleccionados')
          .insert(estudiosData)
          .select();

        if (estudiosError) {
          console.error('Error saving estudios:', estudiosError);
          throw estudiosError;
        } else {
          console.log('Estudios guardados exitosamente:', estudiosResult);
        }
      } else {
        console.log('No hay estudios seleccionados para guardar');
      }

      // PASO 4: Verificar resultado final
      const { data: finalCheck, error: finalError } = await supabase
        .from('alta_estudio')
        .select(`
          *,
          caracterizacion(*),
          estudios_seleccionados(*)
        `)
        .eq('id', data.id)
        .single();

      if (finalError) {
        console.error('Error en verificación final:', finalError);
      } else {
        console.log('Verificación final:', finalCheck);
        setResult(finalCheck);
      }

      toast.success(`¡Estudio guardado exitosamente con ${estudiosSeleccionados.length} estudios programados!`);

    } catch (error) {
      console.error('Error en el flujo:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      setResult({ error: error instanceof Error ? error.message : 'Error desconocido' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-blue-600" />
            Prueba de Flujo Completo - Formulario de Nuevo Estudio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Datos básicos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Planta</label>
              <Input 
                value={formData.planta} 
                onChange={(e) => setFormData(prev => ({ ...prev, planta: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tipo Material</label>
              <Select 
                value={formData.tipo_material} 
                onValueChange={(value: 'Arena' | 'Grava') => setFormData(prev => ({ ...prev, tipo_material: value }))}
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
            <div>
              <label className="block text-sm font-medium mb-2">Nombre Material</label>
              <Input 
                value={formData.nombre_material} 
                onChange={(e) => setFormData(prev => ({ ...prev, nombre_material: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Técnico</label>
              <Input 
                value={formData.tecnico} 
                onChange={(e) => setFormData(prev => ({ ...prev, tecnico: e.target.value }))}
              />
            </div>
          </div>

          {/* Estudios a realizar */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Estudios a Realizar
            </h3>
            
            <div className="space-y-4">
              {ESTUDIOS_DISPONIBLES.map((categoria, categoriaIndex) => (
                <div key={categoriaIndex} className="space-y-3">
                  <h4 className="font-medium text-gray-800">{categoria.categoria}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoria.estudios.map((estudio) => (
                      <div
                        key={estudio.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-all ${
                          isEstudioSelected(estudio.nombre)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleEstudioToggle(estudio)}
                      >
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            checked={isEstudioSelected(estudio.nombre)}
                            onChange={() => handleEstudioToggle(estudio)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <h5 className="font-medium text-gray-900 text-sm">
                              {estudio.nombre}
                            </h5>
                            <p className="text-xs text-gray-600 mt-1">
                              {estudio.descripcion}
                            </p>
                            <p className="text-xs text-blue-600 mt-1 font-medium">
                              {estudio.norma}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Estudios seleccionados */}
            {estudiosSeleccionados.length > 0 && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <h5 className="font-medium text-green-800 mb-2">
                  Estudios Seleccionados ({estudiosSeleccionados.length})
                </h5>
                <div className="space-y-1">
                  {estudiosSeleccionados.map((estudio, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-green-700">{estudio.nombre_estudio}</span>
                      <Badge variant="outline" className="text-xs">
                        {estudio.norma_referencia}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Botón de guardar */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={testing || estudiosSeleccionados.length === 0}
              className="flex items-center gap-2"
            >
              {testing ? (
                <TestTube className="h-4 w-4 animate-pulse" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {testing ? 'Guardando...' : 'Guardar Estudio'}
            </Button>
          </div>

          {/* Resultado */}
          {result && (
            <Alert>
              {result.error ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {result.error ? (
                  <div>
                    <p><strong>Error:</strong> {result.error}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p><strong>¡Éxito!</strong> Estudio guardado correctamente:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>ID Muestra: {result.id_muestra}</li>
                      <li>Material: {result.nombre_material}</li>
                      <li>Caracterización: {result.caracterizacion ? '✅ Creada' : '❌ No creada'}</li>
                      <li>Estudios programados: {result.estudios_seleccionados?.length || 0}</li>
                    </ul>
                    {result.estudios_seleccionados && result.estudios_seleccionados.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium text-sm">Estudios programados:</p>
                        <ul className="list-disc list-inside text-xs space-y-1 ml-4">
                          {result.estudios_seleccionados.map((est: any, idx: number) => (
                            <li key={idx}>{est.nombre_estudio} - {est.estado}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
