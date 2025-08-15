/**
 * MATERIAL DEBUGGER COMPONENT
 * 
 * Step-by-step debugging and validation of material detection from Arkik Excel
 * Based on arkik-processor-implementation.md requirements
 */

import React, { useState, useCallback } from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { ArkikRawParser } from '@/services/arkikRawParser';
import { supabase } from '@/lib/supabase/client';
import { Upload, CheckCircle, AlertTriangle, XCircle, Search, Database, MapPin, Wrench } from 'lucide-react';

interface MaterialColumn {
  arkikCode: string;
  teorica: { index: number; header: string };
  real: { index: number; header: string };
}

interface MaterialMapping {
  arkikCode: string;
  materialId?: string;
  materialName?: string;
  materialCode?: string;
  isMapped: boolean;
  category?: string;
  unit?: string;
}

interface DetectionResult {
  detectedColumns: MaterialColumn[];
  materialMappings: MaterialMapping[];
  unmappedCodes: string[];
  errors: string[];
  sampleData: any[];
}

export default function MaterialDebugger() {
  const { currentPlant } = usePlantContext();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [step, setStep] = useState<'upload' | 'detect' | 'map' | 'validate'>('upload');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !currentPlant) return;
    
    setFile(selectedFile);
    setLoading(true);
    
    try {
      console.log('[MaterialDebugger] Starting material detection...');
      
      // Parse Excel to detect material columns
      const parser = new ArkikRawParser();
      const { data, errors } = await parser.parseFile(selectedFile);
      
      console.log(`[MaterialDebugger] Parsed ${data.length} rows`);
      
      // Extract material codes from first few rows
      const detectedCodes = new Set<string>();
      data.slice(0, 10).forEach(row => {
        Object.keys(row.materials || {}).forEach(code => {
          if (code && code.trim()) {
            detectedCodes.add(code.trim().toUpperCase());
          }
        });
      });
      
      console.log(`[MaterialDebugger] Detected material codes:`, Array.from(detectedCodes));
      
      // Query existing material mappings for this plant
      const { data: existingMappings, error: mappingError } = await supabase
        .from('arkik_material_mapping')
        .select('arkik_code, material_id, materials:material_id(id, material_code, material_name, category, unit_of_measure)')
        .eq('plant_id', currentPlant.id);
      
      if (mappingError) {
        console.warn('[MaterialDebugger] No arkik_material_mapping table or error:', mappingError.message);
      }
      
      // Query all materials for this plant
      const { data: allMaterials, error: materialsError } = await supabase
        .from('materials')
        .select('id, material_code, material_name, category, unit_of_measure')
        .eq('plant_id', currentPlant.id)
        .eq('is_active', true);
      
      if (materialsError) {
        console.error('[MaterialDebugger] Error loading materials:', materialsError.message);
      }
      
      // Build material mappings
      const materialMappings: MaterialMapping[] = Array.from(detectedCodes).map(arkikCode => {
        const existing = existingMappings?.find(m => m.arkik_code === arkikCode);
        
        if (existing && existing.materials) {
          const material = existing.materials as any;
          return {
            arkikCode,
            materialId: material.id,
            materialName: material.material_name,
            materialCode: material.material_code,
            category: material.category,
            unit: material.unit_of_measure,
            isMapped: true
          };
        }
        
        return {
          arkikCode,
          isMapped: false
        };
      });
      
      const unmappedCodes = materialMappings.filter(m => !m.isMapped).map(m => m.arkikCode);
      
      setResult({
        detectedColumns: [], // Will be populated in next iteration
        materialMappings,
        unmappedCodes,
        errors: errors.map(e => e.message),
        sampleData: data.slice(0, 5)
      });
      
      setStep('detect');
      
    } catch (error: any) {
      console.error('[MaterialDebugger] Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const createMaterialMapping = async (arkikCode: string, materialId: string) => {
    if (!currentPlant) return;
    
    try {
      const { error } = await supabase
        .from('arkik_material_mapping')
        .upsert({
          plant_id: currentPlant.id,
          arkik_code: arkikCode,
          material_id: materialId
        });
      
      if (error) throw error;
      
      // Refresh mappings
      console.log(`[MaterialDebugger] Created mapping: ${arkikCode} -> ${materialId}`);
      
    } catch (error: any) {
      console.error('[MaterialDebugger] Error creating mapping:', error);
      alert(`Error creating mapping: ${error.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wrench className="h-6 w-6 text-blue-600" />
          Debug de Materiales Arkik
        </h1>
        <p className="mt-2 text-gray-600">
          Detección paso a paso de materiales desde Excel Arkik
        </p>
        {currentPlant && (
          <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
            <MapPin className="h-4 w-4" />
            Planta: {currentPlant.plant_name}
          </div>
        )}
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          {[
            { key: 'upload', label: 'Subir Excel', icon: Upload },
            { key: 'detect', label: 'Detectar Materiales', icon: Search },
            { key: 'map', label: 'Mapear Códigos', icon: Database },
            { key: 'validate', label: 'Validar', icon: CheckCircle }
          ].map((s, idx) => {
            const Icon = s.icon;
            const isActive = step === s.key;
            const isCompleted = ['upload', 'detect', 'map', 'validate'].indexOf(step) > idx;
            
            return (
              <div
                key={s.key}
                className={`flex items-center ${
                  isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <div className={`
                  rounded-full h-10 w-10 flex items-center justify-center
                  ${isActive ? 'bg-blue-100' : isCompleted ? 'bg-green-100' : 'bg-gray-100'}
                `}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="ml-2 text-sm font-medium">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Paso 1: Subir Archivo Excel Arkik</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12">
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileUpload}
              className="hidden"
              id="material-file-upload"
              disabled={loading}
            />
            <label
              htmlFor="material-file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <Upload className="h-12 w-12 text-gray-400" />
              <span className="mt-2 text-sm text-gray-600">
                {loading ? 'Procesando...' : 'Click para seleccionar archivo Excel de Arkik'}
              </span>
              {file && (
                <span className="mt-1 text-xs text-blue-600">{file.name}</span>
              )}
            </label>
          </div>
        </div>
      )}

      {/* Step 2: Detection Results */}
      {step === 'detect' && result && (
        <div className="space-y-6">
          {/* Detection Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Paso 2: Materiales Detectados</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{result.materialMappings.length}</div>
                <div className="text-sm text-blue-800">Códigos Detectados</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {result.materialMappings.filter(m => m.isMapped).length}
                </div>
                <div className="text-sm text-green-800">Ya Mapeados</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-amber-600">{result.unmappedCodes.length}</div>
                <div className="text-sm text-amber-800">Sin Mapear</div>
              </div>
            </div>
            
            {/* Material Mappings Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Código Arkik
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Material DB
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Categoría
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Unidad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {result.materialMappings.map((mapping, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                        {mapping.arkikCode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {mapping.isMapped ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Mapeado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Sin Mapear
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {mapping.isMapped ? (
                          <div>
                            <div className="font-medium">{mapping.materialName}</div>
                            <div className="text-gray-500 text-xs">{mapping.materialCode}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {mapping.category || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {mapping.unit || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {!mapping.isMapped && (
                          <button
                            onClick={() => {/* TODO: Open mapping modal */}}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Mapear
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Sample Data Preview */}
            <div className="mt-6">
              <h3 className="text-md font-semibold mb-3">Muestra de Datos Detectados</h3>
              <div className="bg-gray-50 p-4 rounded overflow-x-auto">
                <pre className="text-xs">
                  {JSON.stringify(result.sampleData.slice(0, 2).map(row => ({
                    remision: row.remision,
                    materials: row.materials
                  })), null, 2)}
                </pre>
              </div>
            </div>

            {/* Continue Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep('map')}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                disabled={result.unmappedCodes.length > 0}
              >
                {result.unmappedCodes.length > 0 ? 
                  `Faltan ${result.unmappedCodes.length} mapeos` : 
                  'Continuar a Validación'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Mapping */}
      {step === 'map' && result && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Paso 3: Configurar Mapeos</h2>
          <p className="text-gray-600 mb-4">
            Todos los códigos Arkik deben estar mapeados a materiales de la base de datos.
          </p>
          
          {result.unmappedCodes.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ¡Todos los materiales están mapeados!
              </h3>
              <button
                onClick={() => setStep('validate')}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
              >
                Proceder a Validación
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-amber-800">
                      Materiales sin mapear detectados
                    </h3>
                    <div className="mt-2 text-sm text-amber-700">
                      Se necesita crear mapeos para: {result.unmappedCodes.join(', ')}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-center py-4">
                <button
                  onClick={() => {
                    // TODO: Implement material mapping flow
                    alert('Funcionalidad de mapeo en desarrollo');
                  }}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                >
                  Configurar Mapeos Faltantes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Validation */}
      {step === 'validate' && result && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Paso 4: Validación Final</h2>
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Sistema de materiales configurado correctamente
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    Todos los códigos Arkik detectados tienen mapeos válidos en la base de datos.
                    El procesador principal puede proceder con confianza.
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => {
                  setStep('upload');
                  setResult(null);
                  setFile(null);
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Probar Otro Archivo
              </button>
              
              <button
                onClick={() => {
                  // Navigate to main processor
                  window.location.href = '/arkik';
                }}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
              >
                Ir al Procesador Principal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
