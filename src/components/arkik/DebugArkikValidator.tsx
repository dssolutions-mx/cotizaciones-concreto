'use client';

import React, { useState } from 'react';
import { DebugArkikValidator } from '@/services/debugArkikValidator';
import { ArkikRawParser } from '@/services/arkikRawParser';
import type { StagingRemision, ValidationError } from '@/types/arkik';
import { usePlantContext } from '@/contexts/PlantContext';
import { FileSpreadsheet, PlayCircle, AlertTriangle } from 'lucide-react';

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
                {sampleData.slice(0, 10).map((row, idx) => (
                  <div key={idx} className="mb-2 p-2 border-b">
                    <div><strong>Row {idx + 1}:</strong></div>
                    <div>Remisión: {row.remision_number}</div>
                    <div>Product Description: "{row.product_description}"</div>
                    <div>Recipe Code: "{row.recipe_code}"</div>
                    <div>Cliente Name: "{row.cliente_name}"</div>
                    <div>Cliente Code: "{row.cliente_codigo}" (IGNORED)</div>
                    <div>Obra: "{row.obra_name}"</div>
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

          {/* Validated Rows */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Validated Rows</h3>
            <div className="space-y-3">
              {result.validated.map((row, idx) => (
                <div key={idx} className="p-4 border rounded bg-gray-50">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div><strong>Remisión:</strong> {row.remision_number}</div>
                      <div><strong>Status:</strong> <span className={`px-2 py-1 rounded text-xs ${
                        row.validation_status === 'valid' ? 'bg-green-100 text-green-800' :
                        row.validation_status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>{row.validation_status}</span></div>
                      <div><strong>Recipe ID:</strong> {row.recipe_id || 'Not found'}</div>
                    </div>
                    <div>
                      <div><strong>Client ID:</strong> {row.client_id || 'Not assigned'}</div>
                      <div><strong>Price:</strong> ${row.unit_price?.toLocaleString() || 'N/A'}</div>
                      <div><strong>Price Source:</strong> {row.price_source || 'N/A'}</div>
                    </div>
                  </div>
                  {row.validation_errors && row.validation_errors.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="text-xs font-medium text-yellow-800">Validation Issues:</div>
                      {row.validation_errors.map((error, errorIdx) => (
                        <div key={errorIdx} className="text-xs text-yellow-700">
                          • {error.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
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
