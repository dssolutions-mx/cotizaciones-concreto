'use client';

import React, { useState } from 'react';
import { DebugArkikValidator } from '@/services/debugArkikValidator';
import { ArkikRawParser } from '@/services/arkikRawParser';
import type { StagingRemision, ValidationError } from '@/types/arkik';
import { usePlantContext } from '@/contexts/PlantContext';
import { FileSpreadsheet, PlayCircle, AlertTriangle } from 'lucide-react';

// Helper functions for date formatting without timezone conversion
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatLocalTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

type DebugResult = {
  validated: StagingRemision[];
  errors: ValidationError[];
  debugLogs: string[];
};

export default function DebugArkikRunner() {
  const { currentPlant } = usePlantContext();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [sampleData, setSampleData] = useState<StagingRemision[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setLoading(true);
    
    try {
      console.log('[Debug] Parsing Excel file...');
      const parser = new ArkikRawParser();
      const { data, errors } = await parser.parseFile(selectedFile);
      
      // Convert to staging format (process ALL rows)
      const stagingRows = data.map((row, index) => convertToStagingRemision(row, index + 1));
      setSampleData(stagingRows);
      
      console.log('[Debug] Parsed data:', stagingRows);
      console.log('[Debug] Parse errors:', errors);
    } catch (error: any) {
      console.error('[Debug] Parse error:', error);
      alert(`Error parsing file: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runValidation = async () => {
    if (!currentPlant || sampleData.length === 0) {
      alert('Please select a plant and upload a file first');
      return;
    }

    setLoading(true);
    try {
      console.log('[Debug] Starting validation with plant:', currentPlant.id);
      
      const validator = new DebugArkikValidator(currentPlant.id);
      const validationResult = await validator.validateBatch(sampleData);
      
      setResult(validationResult);
      console.log('[Debug] Validation complete:', validationResult);
    } catch (error: any) {
      console.error('[Debug] Validation error:', error);
      alert(`Validation error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">🔧 Debug Arkik Validator</h1>
        <p className="text-gray-600 mb-6">
          Simple step-by-step validator for debugging the core logic.
          Strategy: Recipe → Unified Pricing → Client/Site Auto-Detection
        </p>
        
        <div className="space-y-4">
          {/* Plant Info */}
          <div className="p-4 bg-blue-50 rounded border">
            <h3 className="font-semibold text-blue-900">Current Plant</h3>
            <p className="text-blue-700">
              {currentPlant ? `${currentPlant.name} (ID: ${currentPlant.id})` : 'No plant selected'}
            </p>
          </div>

          {/* File Upload */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 border rounded cursor-pointer hover:bg-gray-50">
              <FileSpreadsheet className="h-4 w-4" />
              <span>Select Excel File</span>
              <input
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            
            {file && (
              <div className="text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>

          {/* Sample Data Preview */}
          {sampleData.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Sample Data (Preview)</h3>
              <div className="overflow-auto max-h-40 text-xs border rounded p-2 bg-gray-50">
                {sampleData.slice(0, 3).map((row, idx) => (
                  <div key={idx} className="mb-2 p-2 border-b">
                    <div><strong>Row {idx + 1}:</strong></div>
                    <div>Remisión: {row.remision_number}</div>
                    <div>Product Description: "{row.product_description}"</div>
                    <div>Recipe Code: "{row.recipe_code}"</div>
                    <div>Cliente Name: "{row.cliente_name}"</div>
                    <div>Cliente Code: "{row.cliente_codigo}" (IGNORED)</div>
                    <div>Obra: "{row.obra_name}"</div>
                    <div className="mt-1 p-1 bg-blue-50 rounded">
                      <strong>Materials Teórica:</strong> {Object.keys(row.materials_teorico || {}).length > 0 ? (
                        <div className="text-xs">
                          {Object.entries(row.materials_teorico || {}).map(([code, qty]) => (
                            <div key={code} className="flex justify-between">
                              <span>{code}:</span>
                              <span className="font-mono">{qty?.toFixed(2) || '0.00'}</span>
                            </div>
                          ))}
                        </div>
                      ) : 'No data'}
                    </div>
                    <div className="mt-1 p-1 bg-green-50 rounded">
                      <strong>Materials Real:</strong> {Object.keys(row.materials_real || {}).length > 0 ? (
                        <div className="text-xs">
                          {Object.entries(row.materials_real || {}).map(([code, qty]) => (
                            <div key={code} className="flex justify-between">
                              <span>{code}:</span>
                              <span className="font-mono">{qty?.toFixed(2) || '0.00'}</span>
                            </div>
                          ))}
                        </div>
                      ) : 'No data'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Run Validation */}
          <button
            onClick={runValidation}
            disabled={loading || !currentPlant || sampleData.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
          >
            <PlayCircle className="h-4 w-4" />
            {loading ? 'Validating...' : 'Run Debug Validation'}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Validation Results</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-green-50 rounded border">
                <div className="text-2xl font-bold text-green-600">{result.validated.length}</div>
                <div className="text-green-700">Processed</div>
              </div>
              <div className="p-4 bg-red-50 rounded border">
                <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
                <div className="text-red-700">Errors</div>
              </div>
              <div className="p-4 bg-blue-50 rounded border">
                <div className="text-2xl font-bold text-blue-600">{result.debugLogs.length}</div>
                <div className="text-blue-700">Debug Lines</div>
              </div>
            </div>
          </div>

          {/* Materials Detection Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Materials Detection</h3>
            {(() => {
              // Extract unique material codes from the validated data
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
                  
                  {materialCodeArray.length > 0 ? (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Códigos Detectados:</h4>
                      <div className="flex flex-wrap gap-2">
                        {materialCodeArray.map(code => (
                          <span key={code} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {code}
                          </span>
                        ))}
                      </div>
                      
                      {/* Material Quantities Summary */}
                      <div className="mt-4 bg-gray-50 rounded p-4">
                        <h5 className="font-medium text-gray-800 mb-3">📊 Resumen de Cantidades Extraídas:</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h6 className="text-sm font-medium text-blue-700 mb-2">Teórica (kg/m³):</h6>
                            <div className="space-y-1 text-xs">
                              {(() => {
                                const teoricoSummary = new Map<string, number>();
                                result.validated.forEach(row => {
                                  Object.entries(row.materials_teorico || {}).forEach(([code, qty]) => {
                                    if (qty && qty > 0) {
                                      teoricoSummary.set(code, (teoricoSummary.get(code) || 0) + qty);
                                    }
                                  });
                                });
                                return Array.from(teoricoSummary.entries()).map(([code, total]) => (
                                  <div key={code} className="flex justify-between">
                                    <span>{code}:</span>
                                    <span className="font-mono font-medium">{total.toFixed(2)}</span>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                          <div>
                            <h6 className="text-sm font-medium text-green-700 mb-2">Real (kg/m³):</h6>
                            <div className="space-y-1 text-xs">
                              {(() => {
                                const realSummary = new Map<string, number>();
                                result.validated.forEach(row => {
                                  Object.entries(row.materials_real || {}).forEach(([code, qty]) => {
                                    if (qty && qty > 0) {
                                      realSummary.set(code, (realSummary.get(code) || 0) + qty);
                                    }
                                  });
                                });
                                return Array.from(realSummary.entries()).map(([code, total]) => (
                                  <div key={code} className="flex justify-between">
                                    <span>{code}:</span>
                                    <span className="font-mono font-medium">{total.toFixed(2)}</span>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Material Mapping Status */}
                      {materialErrors.length > 0 && (
                        <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-4">
                          <h5 className="font-medium text-amber-800 mb-2">⚠️ Materiales sin Mapear:</h5>
                          <div className="text-sm text-amber-700">
                            {materialErrors.map((error, idx) => (
                              <div key={idx}>• {error.message}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded p-4">
                      <div className="flex">
                        <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">❌ No se Detectaron Materiales</h3>
                          <div className="mt-2 text-sm text-red-700">
                            El parser no pudo detectar códigos de materiales en el archivo Excel. 
                            Esto puede indicar un problema con el formato del archivo o la estructura de columnas.
                            <br />
                            <strong>Verificar:</strong> Que la fila 6 contenga códigos de materiales y la fila 7 las medidas (Teórica, Real).
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Validated Rows Table */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Validated Rows</h3>
            <div className="overflow-auto">
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-50">
                  <tr className="text-left align-bottom">
                    <th className="p-2">Remisión</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Receta (Arkik)</th>
                    <th className="p-2">Cliente Detectado</th>
                    <th className="p-2">Obra Detectada</th>
                    <th className="p-2">Precio</th>
                    <th className="p-2">Fuente</th>
                    <th className="p-2">Tipo Remisión</th>
                    <th className="p-2">Designación EHE</th>
                    <th className="p-2">Materiales</th>
                    <th className="p-2">Cantidades T/R</th>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Hora</th>
                    <th className="p-2">Volumen</th>
                    <th className="p-2">Unidad</th>
                    <th className="p-2">Chofer</th>
                    <th className="p-2">Punto Entrega</th>
                    <th className="p-2">Comentarios</th>
                    <th className="p-2">Client ID</th>
                    <th className="p-2">Recipe ID</th>
                    <th className="p-2">Site ID</th>
                    <th className="p-2">Incidencias</th>
                  </tr>
                </thead>
                <tbody>
                  {result.validated.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 font-medium">{row.remision_number}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          row.validation_status === 'valid' ? 'bg-green-100 text-green-800' :
                          row.validation_status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>{row.validation_status}</span>
                      </td>
                      <td className="p-2">
                        <div className="font-mono text-xs">
                          {(row.prod_tecnico as any) || ''}
                        </div>
                        <div className="text-xs text-gray-500 truncate" title={row.product_description as any}>
                          {row.product_description as any}
                        </div>
                      </td>
                      <td className="p-2">
                        {(row as any).resolved_client_name ?? ''}
                      </td>
                      <td className="p-2">
                        {(row as any).resolved_site_name ?? ''}
                      </td>
                      <td className="p-2">
                        {row.unit_price != null ? `$${Number(row.unit_price).toLocaleString('es-MX')}` : 'N/A'}
                      </td>
                      <td className="p-2">{row.price_source}</td>
                      <td className="p-2">CONCRETO</td>
                      <td className="p-2 max-w-[220px] truncate" title={row.product_description as any}>{row.product_description as any}</td>
                      <td className="p-2 text-xs max-w-[220px] truncate" title={Object.keys(row.materials_teorico || {}).map(code => `${code}: T${row.materials_teorico[code] ?? 0}/R${row.materials_real[code] ?? 0}`).join(', ')}>
                        {Object.keys(row.materials_teorico || {}).length} mat.
                      </td>
                      <td className="p-2 text-xs max-w-[200px]">
                        {Object.keys(row.materials_teorico || {}).length > 0 ? (
                          <div className="space-y-1">
                            {Object.keys(row.materials_teorico || {}).slice(0, 3).map(code => (
                              <div key={code} className="flex justify-between text-xs">
                                <span className="font-mono">{code}:</span>
                                <span className="font-mono">
                                  <span className="text-blue-600">T:{row.materials_teorico[code]?.toFixed(1) || '0.0'}</span>
                                  <span className="mx-1">/</span>
                                  <span className="text-green-600">R:{row.materials_real[code]?.toFixed(1) || '0.0'}</span>
                                </span>
                              </div>
                            ))}
                            {Object.keys(row.materials_teorico || {}).length > 3 && (
                              <div className="text-gray-500 text-xs">+{Object.keys(row.materials_teorico || {}).length - 3} más...</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-2">{formatLocalDate(row.fecha)}</td>
                      <td className="p-2">{(() => { const t = row.hora_carga instanceof Date ? row.hora_carga : new Date(row.hora_carga as any); return formatLocalTime(t); })()}</td>
                      <td className="p-2 text-right">{Number(row.volumen_fabricado).toFixed(2)}</td>
                      <td className="p-2">{(row as any).placas || ''}</td>
                      <td className="p-2">{(row as any).conductor || (row as any).chofer || ''}</td>
                      <td className="p-2">{row.punto_entrega || ''}</td>
                      <td className="p-2 max-w-[220px] truncate" title={row.comentarios_externos}>{row.comentarios_externos || ''}</td>
                      <td className="p-2">{row.client_id || ''}</td>
                      <td className="p-2">{row.recipe_id || ''}</td>
                      <td className="p-2">{row.construction_site_id || ''}</td>
                      <td className="p-2 text-xs">
                        {(row.validation_errors || []).length > 0 ? (
                          <div className="text-amber-700">
                            {(row.validation_errors || []).length} incidencia(s)
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Debug Logs */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-600" />
              Debug Logs
            </h3>
            <div className="bg-black text-green-400 p-4 rounded font-mono text-sm overflow-auto max-h-96">
              {result.debugLogs.map((log, idx) => (
                <div key={idx} className="mb-1">{log}</div>
              ))}
            </div>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 text-red-600">Validation Errors</h3>
              <div className="space-y-2">
                {result.errors.map((error, idx) => (
                  <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded">
                    <div className="font-medium text-red-800">Row {error.row_number}: {error.error_type}</div>
                    <div className="text-red-700">{error.message}</div>
                    {error.field_value && (
                      <div className="text-sm text-red-600">Value: "{error.field_value}"</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function convertToStagingRemision(row: any, rowNumber: number): StagingRemision {
  const materials_teorico: Record<string, number> = {};
  const materials_real: Record<string, number> = {};
  
  Object.entries(row.materials || {}).forEach(([code, values]: any) => {
    materials_teorico[code] = values?.teorica || 0;
    materials_real[code] = values?.real || 0;
  });

  return {
    id: crypto.randomUUID(),
    session_id: 'debug-session',
    row_number: rowNumber,
    orden_original: row.orden || undefined,
    fecha: new Date(row.fecha),
    hora_carga: new Date(row.hora_carga),
    remision_number: String(row.remision),
    estatus: String(row.estatus || ''),
    volumen_fabricado: Number(row.volumen || 0),
    cliente_codigo: String(row.cliente_codigo || ''),
    cliente_name: String(row.cliente_nombre || ''),
    rfc: String(row.rfc || ''),
    obra_name: String(row.obra || ''),
    punto_entrega: String(row.punto_entrega || ''),
    comentarios_externos: String(row.comentarios_externos || ''),
    comentarios_internos: String(row.comentarios_internos || ''),
    prod_comercial: String(row.prod_comercial || ''),
    prod_tecnico: String(row.prod_tecnico || ''),
    product_description: String(row.product_description || ''),
    recipe_code: String(row.prod_tecnico || ''),
    camion: String(row.camion || ''),
    placas: String(row.placas || ''),
    conductor: String(row.chofer || ''),
    bombeable: String(row.bombeable || '').toLowerCase().includes('si'),
    elementos: String(row.elementos || ''),
    suggested_order_group: '',
    materials_teorico,
    materials_real,
    validation_status: 'pending',
    validation_errors: [],
  } as StagingRemision;
}
