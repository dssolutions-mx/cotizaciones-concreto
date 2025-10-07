'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Info,
  FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface TableInfo {
  name: string;
  exists: boolean;
  error?: string;
  rowCount?: number;
}

export default function DatabaseDiagnostic() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [updatingNormas, setUpdatingNormas] = useState(false);
  const [normasUpdateResult, setNormasUpdateResult] = useState<{
    success: boolean;
    totalUpdated: number;
    details: string[];
  } | null>(null);

  const checkTables = async () => {
    setLoading(true);
    const tablesToCheck = ['alta_estudio', 'estudios_seleccionados'];
    const results: TableInfo[] = [];

    for (const tableName of tablesToCheck) {
      try {
        // Verificar si la tabla existe intentando hacer una consulta
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (error) {
          results.push({
            name: tableName,
            exists: false,
            error: error.message
          });
        } else {
          results.push({
            name: tableName,
            exists: true,
            rowCount: count || 0
          });
        }
      } catch (err) {
        results.push({
          name: tableName,
          exists: false,
          error: err instanceof Error ? err.message : 'Error desconocido'
        });
      }
    }

    setTables(results);
    setLastCheck(new Date());
    setLoading(false);
  };

  useEffect(() => {
    checkTables();
  }, []);

  const createTestRecord = async () => {
    try {
      const testData = {
        planta: 'P001 - Planta Test',
        tipo_material: 'Arena' as const,
        nombre_material: 'Arena de Prueba',
        mina_procedencia: 'Mina Test',
        ubicacion: 'Ubicación Test',
        tecnico: 'Técnico Test',
        id_muestra: `TEST-${Date.now()}`,
        tipo_estudio: ['Caracterización interna'],
        fecha_muestreo: new Date().toISOString().split('T')[0],
        fecha_elaboracion: new Date().toISOString().split('T')[0]
      };

      const { data, error } = await supabase
        .from('alta_estudio')
        .insert([testData])
        .select()
        .single();

      if (error) throw error;

      // Crear un estudio seleccionado de prueba
      const estudioData = {
        alta_estudio_id: data.id,
        tipo_estudio: 'Caracterización interna',
        nombre_estudio: 'Análisis Granulométrico',
        descripcion: 'Prueba de análisis granulométrico',
        norma_referencia: 'NMX-C-077',
        fecha_programada: new Date().toISOString().split('T')[0],
        estado: 'pendiente'
      };

      const { error: estudiosError } = await supabase
        .from('estudios_seleccionados')
        .insert([estudioData]);

      if (estudiosError) throw estudiosError;

      toast.success('Registro de prueba creado exitosamente');
      checkTables(); // Refrescar el diagnóstico
    } catch (error) {
      console.error('Error creating test record:', error);
      toast.error(`Error al crear registro de prueba: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  const updateNormasToNMX = async () => {
    setUpdatingNormas(true);
    setNormasUpdateResult(null);

    try {
      const normaMappings = [
        { nombre_estudio: 'Análisis Granulométrico', nuevaNorma: 'NMX-C-077' },
        { nombre_estudio: 'Densidad', nuevaNorma: 'NMX-C-164 / NMX-C-165' },
        { nombre_estudio: 'Masa Volumétrico', nuevaNorma: 'NMX-C-073' },
        { nombre_estudio: 'Pérdida por Lavado', nuevaNorma: 'NMX-C-084' },
        { nombre_estudio: 'Absorción', nuevaNorma: 'NMX-C-164 / NMX-C-165' }
      ];

      let totalActualizados = 0;
      const detalles: string[] = [];

      for (const mapping of normaMappings) {
        // Obtener registros que necesitan actualización
        const { data: registrosAntiguos, error: fetchError } = await supabase
          .from('estudios_seleccionados')
          .select('id, norma_referencia')
          .eq('nombre_estudio', mapping.nombre_estudio)
          .neq('norma_referencia', mapping.nuevaNorma);

        if (fetchError) {
          detalles.push(`❌ Error en ${mapping.nombre_estudio}: ${fetchError.message}`);
          continue;
        }

        if (!registrosAntiguos || registrosAntiguos.length === 0) {
          detalles.push(`✅ ${mapping.nombre_estudio}: Ya actualizado`);
          continue;
        }

        // Actualizar registros
        const { error: updateError } = await supabase
          .from('estudios_seleccionados')
          .update({ 
            norma_referencia: mapping.nuevaNorma,
            updated_at: new Date().toISOString()
          })
          .eq('nombre_estudio', mapping.nombre_estudio)
          .neq('norma_referencia', mapping.nuevaNorma);

        if (updateError) {
          detalles.push(`❌ Error actualizando ${mapping.nombre_estudio}: ${updateError.message}`);
          continue;
        }

        totalActualizados += registrosAntiguos.length;
        detalles.push(`✅ ${mapping.nombre_estudio}: ${registrosAntiguos.length} registros actualizados`);
      }

      setNormasUpdateResult({
        success: true,
        totalUpdated: totalActualizados,
        details: detalles
      });

      if (totalActualizados > 0) {
        toast.success(`Se actualizaron ${totalActualizados} registros a normativas NMX`);
      } else {
        toast.info('Todos los registros ya están actualizados a normativas NMX');
      }
    } catch (error: any) {
      console.error('Error updating normas:', error);
      setNormasUpdateResult({
        success: false,
        totalUpdated: 0,
        details: [`Error: ${error.message || 'Error desconocido'}`]
      });
      toast.error('Error al actualizar las normativas');
    } finally {
      setUpdatingNormas(false);
    }
  };

  const getStatusIcon = (table: TableInfo) => {
    if (table.exists) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    } else {
      return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getStatusBadge = (table: TableInfo) => {
    if (table.exists) {
      return <Badge className="bg-green-100 text-green-800">Existe</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">No existe</Badge>;
    }
  };

  const allTablesExist = tables.every(t => t.exists);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Diagnóstico de Base de Datos - Caracterización de Materiales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Estado de las tablas requeridas para el módulo de caracterización
              </p>
              {lastCheck && (
                <p className="text-xs text-gray-500">
                  Última verificación: {lastCheck.toLocaleString('es-MX')}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkTables}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Verificar
            </Button>
          </div>

          <div className="space-y-3">
            {tables.map((table) => (
              <div key={table.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(table)}
                  <div>
                    <p className="font-medium">{table.name}</p>
                    {table.exists && table.rowCount !== undefined && (
                      <p className="text-sm text-gray-500">
                        {table.rowCount} registros
                      </p>
                    )}
                    {table.error && (
                      <p className="text-sm text-red-600">
                        Error: {table.error}
                      </p>
                    )}
                  </div>
                </div>
                {getStatusBadge(table)}
              </div>
            ))}
          </div>

          {!allTablesExist && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Las tablas requeridas no existen.</strong></p>
                  <p>Para solucionar este problema:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Ve al SQL Editor de Supabase</li>
                    <li>Ejecuta el script <code>create_caracterizacion_tables.sql</code></li>
                    <li>Verifica que las tablas se crearon correctamente</li>
                    <li>Haz clic en "Verificar" para confirmar</li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {allTablesExist && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>¡Todas las tablas existen correctamente!</strong></p>
                  <p>El módulo de caracterización de materiales está listo para usar.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={createTestRecord}
                    className="mt-2"
                  >
                    Crear Registro de Prueba
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            Información Técnica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Tabla: alta_estudio</p>
              <p className="text-gray-600">Almacena la información principal de cada estudio de caracterización de materiales.</p>
            </div>
            <div>
              <p className="font-medium">Tabla: estudios_seleccionados</p>
              <p className="text-gray-600">Contiene los análisis específicos programados para cada estudio (granulometría, densidad, etc.).</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-blue-900">Script SQL:</p>
              <p className="text-blue-700 text-xs">
                El archivo <code>create_caracterizacion_tables.sql</code> contiene todas las instrucciones necesarias 
                para crear las tablas, índices, triggers y políticas de seguridad.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#069e2d]" />
            Actualizar Normativas a NMX
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Actualiza todas las normativas ASTM existentes en los estudios a sus equivalentes NMX (Normas Mexicanas).
            </p>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Importante:</strong> Esta acción actualizará todos los registros existentes en la base de datos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="default"
              className="bg-[#069e2d] hover:bg-[#069e2d]/90"
              onClick={updateNormasToNMX}
              disabled={updatingNormas}
            >
              {updatingNormas ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Actualizando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Actualizar Normativas
                </>
              )}
            </Button>
          </div>

          {normasUpdateResult && (
            <Alert className={normasUpdateResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">
                    {normasUpdateResult.success ? '✅ Actualización Completada' : '❌ Error en la Actualización'}
                  </p>
                  {normasUpdateResult.totalUpdated > 0 && (
                    <p className="text-sm">
                      <strong>Total actualizado:</strong> {normasUpdateResult.totalUpdated} registros
                    </p>
                  )}
                  <div className="text-sm space-y-1">
                    {normasUpdateResult.details.map((detalle, index) => (
                      <p key={index}>{detalle}</p>
                    ))}
                  </div>
                  {normasUpdateResult.success && normasUpdateResult.totalUpdated > 0 && (
                    <p className="text-sm text-green-700 mt-2">
                      💡 Recarga la página para ver los cambios reflejados en las tarjetas.
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-2">
            <p className="font-medium text-gray-900">Cambios que se aplicarán:</p>
            <ul className="space-y-1 text-gray-700">
              <li>• Análisis Granulométrico: <code className="text-xs bg-white px-1 py-0.5 rounded">NMX-C-077</code></li>
              <li>• Densidad: <code className="text-xs bg-white px-1 py-0.5 rounded">NMX-C-164 / NMX-C-165</code></li>
              <li>• Masa Volumétrico: <code className="text-xs bg-white px-1 py-0.5 rounded">NMX-C-073</code></li>
              <li>• Pérdida por Lavado: <code className="text-xs bg-white px-1 py-0.5 rounded">NMX-C-084</code></li>
              <li>• Absorción: <code className="text-xs bg-white px-1 py-0.5 rounded">NMX-C-164 / NMX-C-165</code></li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
