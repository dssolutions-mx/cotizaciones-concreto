'use client';

import React, { useState, useMemo } from 'react';
import { Upload, AlertTriangle, CheckCircle, Clock, Zap, Eye, EyeOff, Download } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import { DebugArkikValidator } from '@/services/debugArkikValidator';
import { ArkikRawParser } from '@/services/arkikRawParser';
import type { StagingRemision } from '@/types/arkik';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ArkikProcessor() {
  const { currentPlant } = usePlantContext();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    validated: StagingRemision[];
    errors: any[];
    debugLogs: string[];
    processingTime: number;
    totalRows: number;
    successRate: number;
  } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFile(file);
      setResult(null);
    }
  };

  const processFile = async () => {
    if (!file || !currentPlant) return;

    setLoading(true);
    const startTime = Date.now();

    try {
      // First parse the file
      const parser = new ArkikRawParser();
      const { data: rawData, errors: parseErrors } = await parser.parseFile(file);
      
      // Convert to StagingRemision format
      const stagingRows = rawData.map((row, index) => ({
        id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        row_number: index + 1,
        fecha: new Date(row.fecha),
        hora_carga: new Date(row.hora_carga),
        remision_number: String(row.remision),
        cliente_name: String(row.cliente_nombre || ''),
        cliente_codigo: String(row.cliente_codigo || ''),
        obra_name: String(row.obra || ''),
        volumen_fabricado: Number(row.volumen || 0),
        conductor: String(row.chofer || ''),
        placas: String(row.placas || ''),
        product_description: String(row.product_description || ''),
        recipe_code: String(row.prod_tecnico || ''),
        materials_teorico: Object.fromEntries(
          Object.entries(row.materials || {}).map(([code, values]: [string, any]) => [
            code, 
            values?.teorica || 0
          ])
        ),
        materials_real: Object.fromEntries(
          Object.entries(row.materials || {}).map(([code, values]: [string, any]) => [
            code, 
            values?.real || 0
          ])
        ),
        validation_status: 'pending' as const,
        validation_errors: [],
        client_id: undefined,
        construction_site_id: undefined,
        recipe_id: undefined,
        unit_price: undefined,
        price_source: undefined,
        suggested_client_id: undefined,
        suggested_site_name: undefined,
        comentarios_externos: String(row.comentarios_externos || ''),
        comentarios_internos: String(row.comentarios_internos || ''),
        punto_entrega: String(row.punto_entrega || ''),
        prod_comercial: String(row.prod_comercial || ''),
        prod_tecnico: String(row.prod_tecnico || ''),
        bombeable: false,
        camion: String(row.camion || ''),
        elementos: String(row.elementos || ''),
        orden_original: undefined,
        estatus: String(row.estatus || ''),
        rfc: String(row.rfc || ''),
        suggested_order_group: '',
        materials_retrabajo: {},
        materials_manual: {},
      } as unknown as StagingRemision));

      // Then validate the parsed data
      const validator = new DebugArkikValidator(currentPlant.id);
      const { validated, errors, debugLogs } = await validator.validateBatch(stagingRows);

      const processingTime = Date.now() - startTime;
      const totalRows = validated.length;
      const successRate = totalRows > 0 ? ((totalRows - errors.length) / totalRows) * 100 : 0;

      setResult({
        validated,
        errors: [...parseErrors, ...errors],
        debugLogs,
        processingTime,
        totalRows,
        successRate
      });

      console.log(`[ArkikProcessor] Processing completed in ${processingTime}ms`);
      console.log(`[ArkikProcessor] Success rate: ${successRate.toFixed(1)}%`);
    } catch (error) {
      console.error('[ArkikProcessor] Processing error:', error);
      setResult({
        validated: [],
        errors: [{ message: String(error) }],
        debugLogs: [`Error: ${error}`],
        processingTime: 0,
        totalRows: 0,
        successRate: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRowSelection = (rowId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  const toggleRowExpansion = (rowId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  const getValidationIcon = (status: StagingRemision['validation_status']) => {
    switch (status) {
      case 'valid': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getValidationStatusText = (status: StagingRemision['validation_status']) => {
    switch (status) {
      case 'valid': return 'Válida';
      case 'warning': return 'Aviso';
      case 'error': return 'Error';
      default: return 'Pendiente';
    }
  };

  const getPriceSourceIcon = (source?: string) => {
    switch (source) {
      case 'client_site': return <Badge variant="default" className="bg-green-100 text-green-800">Cliente-Obra</Badge>;
      case 'client': return <Badge variant="default" className="bg-blue-100 text-blue-800">Cliente</Badge>;
      case 'plant': return <Badge variant="default" className="bg-gray-100 text-gray-800">Planta</Badge>;
      case 'quotes': return <Badge variant="default" className="bg-purple-100 text-purple-800">Cotización</Badge>;
      default: return <Badge variant="outline">Sin precio</Badge>;
    }
  };

  const visibleRows = useMemo(() => {
    if (!result?.validated) return [];
    if (!showOnlyIssues) return result.validated;
    return result.validated.filter(row => 
      row.validation_status !== 'valid' || (row.validation_errors?.length || 0) > 0
    );
  }, [result?.validated, showOnlyIssues]);

  const summaryStats = useMemo(() => {
    if (!result?.validated) return null;
    
    const total = result.validated.length;
    const valid = result.validated.filter(r => r.validation_status === 'valid').length;
    const warning = result.validated.filter(r => r.validation_status === 'warning').length;
    const error = result.validated.filter(r => r.validation_status === 'error').length;
    const withPrices = result.validated.filter(r => r.unit_price != null).length;
    const avgPrice = result.validated.filter(r => r.unit_price != null)
      .reduce((sum, r) => sum + (r.unit_price || 0), 0) / (withPrices || 1);
    
    return { total, valid, warning, error, withPrices, avgPrice };
  }, [result?.validated]);

  if (!currentPlant) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Planta no seleccionada</h3>
          <p className="text-gray-600">Selecciona una planta para procesar archivos Arkik</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Procesador Arkik</h1>
        <p className="text-gray-600">Procesa archivos Excel de producción de concreto</p>
        <div className="mt-2">
          <Badge variant="outline" className="text-sm">
            Planta: {currentPlant.name}
          </Badge>
        </div>
      </div>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Cargar Archivo
          </CardTitle>
          <CardDescription>
            Selecciona un archivo Excel (.xlsx) o CSV para procesar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="flex-1"
              disabled={loading}
            />
            <Button
              onClick={processFile}
              disabled={!file || loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Zap className="h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Procesar
                </>
              )}
            </Button>
          </div>
          
          {file && (
            <div className="text-sm text-gray-600">
              Archivo seleccionado: <span className="font-medium">{file.name}</span>
              <span className="ml-2 text-gray-500">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen del Procesamiento</CardTitle>
              <CardDescription>
                {result.totalRows} remisiones procesadas en {result.processingTime}ms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summaryStats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{summaryStats.valid}</div>
                    <div className="text-sm text-green-700">Válidas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600">{summaryStats.warning}</div>
                    <div className="text-sm text-amber-700">Avisos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{summaryStats.error}</div>
                    <div className="text-sm text-red-700">Errores</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{summaryStats.withPrices}</div>
                    <div className="text-sm text-blue-700">Con Precio</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      ${summaryStats.avgPrice.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-sm text-gray-700">Precio Prom.</div>
                  </div>
                </div>
              )}
              
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Tasa de éxito</span>
                  <span>{result.successRate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${result.successRate}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Materials Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Materiales</CardTitle>
              <CardDescription>
                Cantidades extraídas y mapeadas del archivo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const allMaterialCodes = new Set<string>();
                const rowsWithMaterials = result.validated.filter(row => {
                  const codes = Object.keys(row.materials_teorico || {});
                  codes.forEach(code => allMaterialCodes.add(code));
                  return codes.length > 0;
                });
                
                const materialCodeArray = Array.from(allMaterialCodes);
                const materialErrors = result.errors.filter(e => e.field_name === 'materials');
                
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{materialCodeArray.length}</div>
                        <div className="text-sm text-purple-800">Códigos Detectados</div>
                      </div>
                      <div className="bg-indigo-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-indigo-600">{rowsWithMaterials.length}</div>
                        <div className="text-sm text-indigo-800">Filas con Materiales</div>
                      </div>
                      <div className="bg-amber-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-amber-600">{materialErrors.length}</div>
                        <div className="text-sm text-amber-800">Errores de Materiales</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-gray-600">
                          {materialCodeArray.length > 0 ? '✅' : '❌'}
                        </div>
                        <div className="text-sm text-gray-800">Estado Detección</div>
                      </div>
                    </div>
                    
                    {materialCodeArray.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Códigos Detectados:</h4>
                        <div className="flex flex-wrap gap-2">
                          {materialCodeArray.map(code => (
                            <Badge key={code} variant="secondary" className="text-xs">
                              {code}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={showOnlyIssues} 
                  onChange={e => setShowOnlyIssues(e.target.checked)} 
                />
                Mostrar sólo incidencias
              </label>
              <span className="text-gray-500">
                Mostrando: {visibleRows.length} de {result.totalRows}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
                className="flex items-center gap-2"
              >
                {showDebug ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showDebug ? 'Ocultar Debug' : 'Ver Debug'}
              </Button>
            </div>
          </div>

          {/* Debug Logs */}
          {showDebug && (
            <Card>
              <CardHeader>
                <CardTitle>Logs de Debug</CardTitle>
                <CardDescription>
                  Información detallada del procesamiento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-black text-green-400 p-4 rounded font-mono text-sm overflow-auto max-h-96">
                  {result.debugLogs.map((log, idx) => (
                    <div key={idx} className="mb-1">{log}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>Remisiones Procesadas</CardTitle>
              <CardDescription>
                Detalle de cada remisión con su estado de validación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left">
                      <th className="p-2 w-8"></th>
                      <th className="p-2">Estado</th>
                      <th className="p-2">Remisión</th>
                      <th className="p-2">Fecha</th>
                      <th className="p-2">Cliente</th>
                      <th className="p-2">Obra</th>
                      <th className="p-2">Precio</th>
                      <th className="p-2">Receta</th>
                      <th className="p-2">Volumen</th>
                      <th className="p-2">Materiales</th>
                      <th className="p-2">Detalles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map(row => (
                      <React.Fragment key={row.id}>
                        <tr className="border-t hover:bg-gray-50">
                          <td className="p-2">
                            <input 
                              type="checkbox" 
                              checked={selectedRows.has(row.id)} 
                              onChange={e => toggleRowSelection(row.id)} 
                            />
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              {getValidationIcon(row.validation_status)}
                              <span className="text-xs">
                                {getValidationStatusText(row.validation_status)}
                              </span>
                            </div>
                          </td>
                          <td className="p-2 font-medium">{row.remision_number}</td>
                          <td className="p-2">
                            <div>{row.fecha.toISOString().split('T')[0]}</div>
                            <div className="text-xs text-gray-500">
                              {row.hora_carga instanceof Date 
                                ? row.hora_carga.toISOString().split('T')[1]?.split('.')[0] || ''
                                : new Date(row.hora_carga as any).toISOString().split('T')[1]?.split('.')[0] || ''
                              }
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="max-w-[150px]">
                              <div className="font-medium text-xs">
                                {row.suggested_client_id ? '✓ Auto-detectado' : row.cliente_name}
                              </div>
                              <div className="text-xs text-gray-600 truncate">
                                {row.cliente_name}
                              </div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="max-w-[150px]">
                              <div className="font-medium text-xs">
                                {row.suggested_site_name || row.obra_name}
                              </div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              {getPriceSourceIcon(row.price_source)}
                              {row.unit_price != null ? (
                                <span className="text-xs font-mono">
                                  ${Number(row.unit_price).toLocaleString('es-MX')}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">Sin precio</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="max-w-[150px]">
                              <div className="text-xs font-mono truncate" title={row.product_description}>
                                {row.product_description}
                              </div>
                              {row.recipe_id && (
                                <div className="text-xs text-green-600">✓ Vinculada</div>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-center">{row.volumen_fabricado}</td>
                          <td className="p-2">
                            <div className="text-xs">
                              {Object.keys(row.materials_teorico || {}).length} mat.
                            </div>
                          </td>
                          <td className="p-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => toggleRowExpansion(row.id)}
                              className="flex items-center gap-1"
                            >
                              {expandedRows.has(row.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              {expandedRows.has(row.id) ? 'Ocultar' : 'Ver'}
                            </Button>
                          </td>
                        </tr>

                        {/* Expanded Details Row */}
                        {expandedRows.has(row.id) && (
                          <tr className="border-t bg-gray-50">
                            <td colSpan={11} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                {/* Validation Results */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-blue-900">Resultado de Validación</h4>
                                  <div>
                                    <span className="font-medium">Cliente ID:</span> {row.client_id || 'No asignado'}
                                  </div>
                                  <div>
                                    <span className="font-medium">Obra ID:</span> {row.construction_site_id || 'No asignada'}
                                  </div>
                                  <div>
                                    <span className="font-medium">Receta ID:</span> {row.recipe_id || 'No encontrada'}
                                  </div>
                                  <div>
                                    <span className="font-medium">Fuente de precio:</span> {row.price_source || 'N/A'}
                                  </div>
                                </div>

                                {/* Original Data */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-gray-900">Datos Originales</h4>
                                  <div>
                                    <span className="font-medium">Cliente:</span> {row.cliente_name}
                                  </div>
                                  <div>
                                    <span className="font-medium">Código:</span> {row.cliente_codigo}
                                  </div>
                                  <div>
                                    <span className="font-medium">Obra:</span> {row.obra_name}
                                  </div>
                                  <div>
                                    <span className="font-medium">Conductor:</span> {row.conductor}
                                  </div>
                                </div>

                                {/* Materials Detail */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-green-900">Materiales</h4>
                                  <div className="max-h-32 overflow-auto space-y-1">
                                    {Object.keys(row.materials_teorico || {}).length > 0 ? (
                                      Object.keys(row.materials_teorico || {}).map(code => (
                                        <div key={code} className="text-xs p-2 bg-green-50 border border-green-200 rounded">
                                          <div className="font-medium text-green-800">{code}</div>
                                          <div className="text-green-700">
                                            T: {row.materials_teorico[code]?.toFixed(2) || '0.00'} | 
                                            R: {row.materials_real[code]?.toFixed(2) || '0.00'}
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-gray-500">Sin materiales</div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Validation Issues */}
                              {(row.validation_errors || []).length > 0 && (
                                <div className="mt-4 pt-3 border-t">
                                  <h4 className="font-semibold text-sm mb-2 text-amber-900">
                                    Incidencias ({(row.validation_errors || []).length})
                                  </h4>
                                  <div className="space-y-2">
                                    {(row.validation_errors || []).map((error, idx) => (
                                      <div key={idx} className="text-xs p-2 bg-amber-50 border border-amber-200 rounded">
                                        <div className="font-medium text-amber-800">{error.error_type}</div>
                                        <div className="text-amber-700">{error.message}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Errors */}
          {result.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Errores de Validación</CardTitle>
                <CardDescription>
                  {result.errors.length} errores encontrados durante el procesamiento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.errors.map((error, idx) => (
                    <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded">
                      <div className="font-medium text-red-800">
                        Fila {error.row_number}: {error.error_type}
                      </div>
                      <div className="text-red-700">{error.message}</div>
                      {error.field_value && (
                        <div className="text-sm text-red-600">
                          Valor: "{error.field_value}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selection Actions */}
          {selectedRows.size > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-900">
                    {selectedRows.size} remisiones seleccionadas
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedRows(new Set())}
                    >
                      Limpiar selección
                    </Button>
                    <Button size="sm" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Exportar Seleccionadas
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}



