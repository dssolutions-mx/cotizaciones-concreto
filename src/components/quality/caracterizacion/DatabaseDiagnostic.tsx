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
  Info
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
        norma_referencia: 'ASTM C136',
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
    </div>
  );
}
