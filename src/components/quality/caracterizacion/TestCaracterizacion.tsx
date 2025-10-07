'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TestTube, 
  CheckCircle, 
  XCircle, 
  Play,
  Database,
  FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface TestResult {
  test: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  data?: any;
}

export default function TestCaracterizacion() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const runTests = async () => {
    setTesting(true);
    setResults([]);
    const testResults: TestResult[] = [];

    try {
      // Test 1: Crear un nuevo estudio
      testResults.push({ test: 'Crear estudio', status: 'pending', message: 'Iniciando...' });
      setResults([...testResults]);

      const testData = {
        planta: 'P001 - Planta Test',
        tipo_material: 'Arena' as const,
        nombre_material: 'Arena Test Automatizada',
        mina_procedencia: 'Mina Test Auto',
        ubicacion: 'Ubicación Test Auto',
        tecnico: 'Técnico Test Auto',
        id_muestra: `AUTO-TEST-${Date.now()}`,
        tipo_estudio: ['Caracterización interna'],
        fecha_muestreo: new Date().toISOString().split('T')[0],
        fecha_elaboracion: new Date().toISOString().split('T')[0]
      };

      const { data: altaEstudio, error: altaError } = await supabase
        .from('alta_estudio')
        .insert([testData])
        .select()
        .single();

      if (altaError) throw altaError;

      testResults[0] = { 
        test: 'Crear estudio', 
        status: 'success', 
        message: `Estudio creado con ID: ${altaEstudio.id}`,
        data: altaEstudio
      };
      setResults([...testResults]);

      // Test 2: Verificar que se creó el registro en caracterizacion
      testResults.push({ test: 'Verificar caracterización', status: 'pending', message: 'Verificando...' });
      setResults([...testResults]);

      const { data: caracData, error: caracError } = await supabase
        .from('caracterizacion')
        .select('*')
        .eq('alta_estudio_id', altaEstudio.id)
        .single();

      if (caracError) throw caracError;

      testResults[1] = { 
        test: 'Verificar caracterización', 
        status: 'success', 
        message: `Registro de caracterización creado con ID: ${caracData.id}`,
        data: caracData
      };
      setResults([...testResults]);

      // Test 3: Crear estudios seleccionados
      testResults.push({ test: 'Crear estudios seleccionados', status: 'pending', message: 'Creando...' });
      setResults([...testResults]);

      const estudiosData = [
        {
          alta_estudio_id: altaEstudio.id,
          tipo_estudio: 'Caracterización interna',
          nombre_estudio: 'Densidad',
          descripcion: 'Análisis de densidad del material',
          norma_referencia: 'NMX-C-164 / NMX-C-165',
          fecha_programada: new Date().toISOString().split('T')[0],
          estado: 'pendiente'
        },
        {
          alta_estudio_id: altaEstudio.id,
          tipo_estudio: 'Caracterización interna',
          nombre_estudio: 'Masa Volumétrico',
          descripcion: 'Análisis de masa volumétrica',
          norma_referencia: 'NMX-C-073',
          fecha_programada: new Date().toISOString().split('T')[0],
          estado: 'pendiente'
        }
      ];

      const { data: estudiosCreados, error: estudiosError } = await supabase
        .from('estudios_seleccionados')
        .insert(estudiosData)
        .select();

      if (estudiosError) throw estudiosError;

      testResults[2] = { 
        test: 'Crear estudios seleccionados', 
        status: 'success', 
        message: `${estudiosCreados.length} estudios seleccionados creados`,
        data: estudiosCreados
      };
      setResults([...testResults]);

      // Test 4: Simular guardado de datos de densidad
      testResults.push({ test: 'Guardar datos densidad', status: 'pending', message: 'Guardando...' });
      setResults([...testResults]);

      const densidadData = {
        masa_especifica: 2.65,
        masa_especifica_sss: 2.68,
        masa_especifica_seca: 2.62,
        absorcion_porcentaje: 1.5,
        updated_at: new Date().toISOString()
      };

      const { error: densidadError } = await supabase
        .from('caracterizacion')
        .update(densidadData)
        .eq('alta_estudio_id', altaEstudio.id);

      if (densidadError) throw densidadError;

      testResults[3] = { 
        test: 'Guardar datos densidad', 
        status: 'success', 
        message: 'Datos de densidad guardados correctamente',
        data: densidadData
      };
      setResults([...testResults]);

      // Test 5: Simular guardado de datos de masa volumétrico
      testResults.push({ test: 'Guardar datos masa volumétrico', status: 'pending', message: 'Guardando...' });
      setResults([...testResults]);

      const masaVolData = {
        masa_volumetrica_suelta: 1450.5,
        masa_volumetrica_compactada: 1620.8,
        updated_at: new Date().toISOString()
      };

      const { error: masaVolError } = await supabase
        .from('caracterizacion')
        .update(masaVolData)
        .eq('alta_estudio_id', altaEstudio.id);

      if (masaVolError) throw masaVolError;

      testResults[4] = { 
        test: 'Guardar datos masa volumétrico', 
        status: 'success', 
        message: 'Datos de masa volumétrico guardados correctamente',
        data: masaVolData
      };
      setResults([...testResults]);

      // Test 6: Simular guardado de granulometría
      testResults.push({ test: 'Guardar granulometría', status: 'pending', message: 'Guardando...' });
      setResults([...testResults]);

      const granulometriaData = [
        { no_malla: '3/4"', retenido: 0, porc_retenido: 0, porc_acumulado: 0, porc_pasa: 100, orden_malla: 1 },
        { no_malla: '1/2"', retenido: 125.5, porc_retenido: 12.55, porc_acumulado: 12.55, porc_pasa: 87.45, orden_malla: 2 },
        { no_malla: '3/8"', retenido: 230.2, porc_retenido: 23.02, porc_acumulado: 35.57, porc_pasa: 64.43, orden_malla: 3 },
        { no_malla: 'No. 4', retenido: 180.8, porc_retenido: 18.08, porc_acumulado: 53.65, porc_pasa: 46.35, orden_malla: 4 }
      ].map(item => ({
        ...item,
        alta_estudio_id: altaEstudio.id
      }));

      const { error: granError } = await supabase
        .from('granulometrias')
        .insert(granulometriaData);

      if (granError) throw granError;

      testResults[5] = { 
        test: 'Guardar granulometría', 
        status: 'success', 
        message: `${granulometriaData.length} registros granulométricos guardados`,
        data: granulometriaData
      };
      setResults([...testResults]);

      // Test 7: Verificar datos finales
      testResults.push({ test: 'Verificar datos finales', status: 'pending', message: 'Verificando...' });
      setResults([...testResults]);

      const { data: finalData, error: finalError } = await supabase
        .from('caracterizacion')
        .select('*')
        .eq('alta_estudio_id', altaEstudio.id)
        .single();

      if (finalError) throw finalError;

      const { data: granFinalData, error: granFinalError } = await supabase
        .from('granulometrias')
        .select('*')
        .eq('alta_estudio_id', altaEstudio.id);

      if (granFinalError) throw granFinalError;

      testResults[6] = { 
        test: 'Verificar datos finales', 
        status: 'success', 
        message: `Datos verificados: ${granFinalData.length} registros granulométricos`,
        data: { caracterizacion: finalData, granulometria: granFinalData }
      };
      setResults([...testResults]);

      toast.success('¡Todas las pruebas completadas exitosamente!');

    } catch (error) {
      console.error('Error en pruebas:', error);
      const lastIndex = testResults.length - 1;
      if (lastIndex >= 0) {
        testResults[lastIndex] = {
          ...testResults[lastIndex],
          status: 'error',
          message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
      }
      setResults([...testResults]);
      toast.error('Error en las pruebas');
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <TestTube className="h-5 w-5 text-blue-600 animate-pulse" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Éxito</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      case 'pending':
        return <Badge className="bg-blue-100 text-blue-800">Ejecutando</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Pruebas de Integración - Caracterización de Materiales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Ejecuta pruebas automáticas para validar la integración completa del sistema
              </p>
            </div>
            <Button
              onClick={runTests}
              disabled={testing}
              className="flex items-center gap-2"
            >
              {testing ? (
                <TestTube className="h-4 w-4 animate-pulse" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {testing ? 'Ejecutando...' : 'Ejecutar Pruebas'}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">Resultados de Pruebas:</h3>
              {results.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="font-medium">{result.test}</p>
                      <p className="text-sm text-gray-600">{result.message}</p>
                    </div>
                  </div>
                  {getStatusBadge(result.status)}
                </div>
              ))}
            </div>
          )}

          {results.length > 0 && results.every(r => r.status === 'success') && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>¡Todas las pruebas completadas exitosamente!</strong></p>
                  <p>El sistema de caracterización de materiales está funcionando correctamente:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>✅ Creación automática de registros en `caracterizacion`</li>
                    <li>✅ Guardado de datos de densidad en columnas específicas</li>
                    <li>✅ Guardado de datos de masa volumétrico</li>
                    <li>✅ Guardado de granulometría en tabla separada</li>
                    <li>✅ Integridad referencial entre tablas</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            Resumen de la Implementación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-900">Flujo de Datos:</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-600 mt-2">
                <li>Se crea un registro en `alta_estudio` con información general</li>
                <li>Automáticamente se crea un registro vinculado en `caracterizacion`</li>
                <li>Se crean registros en `estudios_seleccionados` para cada análisis</li>
                <li>Los formularios guardan datos en `caracterizacion` (excepto granulometría)</li>
                <li>La granulometría se guarda en tabla separada `granulometrias`</li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900">Mapeo de Formularios:</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-600 mt-2">
                <li><strong>Densidad:</strong> → `masa_especifica`, `masa_especifica_sss`, `absorcion_porcentaje`</li>
                <li><strong>Masa Volumétrico:</strong> → `masa_volumetrica_suelta`, `masa_volumetrica_compactada`</li>
                <li><strong>Pérdida por Lavado:</strong> → `perdida_lavado`, `perdida_lavado_porcentaje`</li>
                <li><strong>Absorción:</strong> → `absorcion`, `absorcion_porcentaje`</li>
                <li><strong>Granulometría:</strong> → tabla `granulometrias` (registros por malla)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
