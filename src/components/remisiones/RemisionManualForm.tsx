'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '../ui/label';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/lib/utils/toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RemisionProductosAdicionalesList from './RemisionProductosAdicionalesList';
import RemisionProductoAdicionalForm from './RemisionProductoAdicionalForm';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { getRecipeMaterials } from '@/utils/recipeMaterialsCache';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { FileText, RefreshCw } from 'lucide-react';
import SimpleFileUpload from '@/components/inventory/SimpleFileUpload';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { RemisionDocument, RemisionPendingFile } from '@/types/remisiones';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  REMISION_DOCUMENT_MAX_MB,
  messageForRemisionDocumentUploadFailure,
} from '@/lib/constants/remisionDocumentsUpload';

// Define Recipe type inline if import is problematic
interface Recipe {
  id: string;
  recipe_code: string;
  // description: string; // Removed as it doesn't exist in the table
}

interface RemisionManualFormProps {
  orderId: string;
  onSuccess: () => void;
  allowedRecipeIds: string[];
}

interface ManualMaterial {
  id: string; // For unique key prop
  material_type: string;
  cantidad_real: number;
  cantidad_teorica?: number; // Will be fetched later
}

// Material name mapping - same as used in RecipeDetailsModal
const MATERIAL_NAMES: Record<string, string> = {
  'cement': 'Cemento',
  'water': 'Agua',
  'gravel': 'Grava 20mm',
  'gravel40mm': 'Grava 40mm',
  'volcanicSand': 'Arena Volcánica',
  'basalticSand': 'Arena Basáltica',
  'additive1': 'Aditivo 1',
  'additive2': 'Aditivo 2'
};

export default function RemisionManualForm({ orderId, onSuccess, allowedRecipeIds }: RemisionManualFormProps) {
  const { profile } = useAuthBridge();
  const [tipoRemision, setTipoRemision] = useState<'CONCRETO' | 'BOMBEO'>('BOMBEO');
  const [formData, setFormData] = useState({
    remisionNumber: '',
    fecha: new Date().toISOString().split('T')[0],
    horaCarga: new Date().toTimeString().split(' ')[0].substring(0, 5), // HH:MM format
    volumen: '',
    conductor: '',
    unidad: '',
    recipeId: '',
  });
  const [manualMaterials, setManualMaterials] = useState<ManualMaterial[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  
  // Evidence state
  const [pendingFiles, setPendingFiles] = useState<RemisionPendingFile[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<RemisionDocument[]>([]);
  const [evidenceRetryRemisionId, setEvidenceRetryRemisionId] = useState<string | null>(null);
  const { getSignedUrl, isLoading: urlLoading } = useSignedUrls('remision-documents', 3600);

  // Log para depuración cuando el componente se monte
  useEffect(() => {
    console.log('RemisionManualForm montado con allowedRecipeIds:', allowedRecipeIds);
    
    // Cleanup al desmontar
    return () => {
      console.log('RemisionManualForm desmontado');
    };
  }, [allowedRecipeIds]);

  // Fetch recipes - now filtered
  useEffect(() => {
    const fetchRecipes = async () => {
      if (!allowedRecipeIds || allowedRecipeIds.length === 0) {
        setRecipes([]); // No allowed recipes for this order
        setLoadingRecipes(false); // Ensure loading is stopped
        console.log('No hay recetas permitidas para esta orden');
        return;
      }

      console.log('RemisionManualForm - Recipe IDs permitidos exactos:', JSON.stringify(allowedRecipeIds));
      setLoadingRecipes(true);

      // Saltamos el caché y siempre recargamos para asegurar tener los datos frescos
      try {
        console.log('RemisionManualForm - Fetching recipes from Supabase...');
        const { data, error } = await supabase
          .from('recipes')
          .select('id, recipe_code')
          .in('id', allowedRecipeIds) // Filter by allowed IDs
          .order('recipe_code');

        if (error) throw error;
        
        const fetchedRecipes = data || [];
        console.log('RemisionManualForm - Recetas obtenidas:', JSON.stringify(fetchedRecipes));
        setRecipes(fetchedRecipes);
      } catch (error: any) {
        showError('Error al cargar las recetas permitidas: ' + error.message);
        console.error('Error al cargar recetas:', error);
        setRecipes([]); // Set to empty on error
      } finally {
        setLoadingRecipes(false);
      }
    };
    
    // Ejecutar inmediatamente al montar
    fetchRecipes();
    
    // Y también cada 5 segundos para asegurar actualizaciones sin sobrecargar
    const intervalId = setInterval(() => {
      console.log('Refrescando recetas automáticamente...');
      fetchRecipes();
    }, 5000);
    
    // Limpiar intervalo al desmontar
    return () => clearInterval(intervalId);
  }, [allowedRecipeIds]);

  // Fetch theoretical materials when recipe changes for CONCRETO type
  const fetchTheoreticalMaterials = useCallback(async (selectedRecipeId: string) => {
    if (!selectedRecipeId || tipoRemision !== 'CONCRETO') {
      setManualMaterials([]); // Clear materials if not CONCRETO or no recipe
      return;
    }

    // Validate that we have a valid recipe_id
    if (!selectedRecipeId) {
      console.warn('No selectedRecipeId provided');
      setManualMaterials([]);
      return;
    }

    try {
      // Find the latest version of the selected recipe
      const { data: versionData, error: versionError } = await supabase
        .from('recipe_versions')
        .select('id')
        .eq('recipe_id', selectedRecipeId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      if (versionError || !versionData) {
        console.warn('No active version found for recipe:', selectedRecipeId);
        setManualMaterials([]); // Clear materials if no version
        return;
      }

      const recipeVersionId = versionData.id;

      // Fetch material quantities for that version
      const { data: materialsData, error: materialsError } = await supabase
        .from('material_quantities')
        .select('material_type, quantity')
        .eq('recipe_version_id', recipeVersionId);

      if (materialsError) throw materialsError;

      // Get current volume
      const volume = parseFloat(formData.volumen) || 0;

      // Set initial state for manual materials based on theoretical ones
      const initialMaterials: ManualMaterial[] = (materialsData || []).map((mat, index) => ({
        id: `mat-${index}-${Date.now()}`, // Unique ID
        material_type: mat.material_type,
        cantidad_real: volume > 0 ? mat.quantity * volume : 0, // Prepopulate with theoretical total
        cantidad_teorica: mat.quantity,
      }));
      setManualMaterials(initialMaterials);

    } catch (error: any) {
      showError('Error al cargar materiales teóricos: ' + error.message);
      setManualMaterials([]);
    }
  }, [tipoRemision, formData.volumen]); // Added formData.volumen to dependency array

  // Effect to fetch materials when recipeId changes
  useEffect(() => {
    if (formData.recipeId) {
      fetchTheoreticalMaterials(formData.recipeId);
    }
  }, [formData.recipeId, fetchTheoreticalMaterials]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRecipeChange = (value: string) => {
    setFormData(prev => ({ ...prev, recipeId: value }));
  };

  const handleMaterialChange = (index: number, field: keyof ManualMaterial, value: string | number) => {
    setManualMaterials(prev =>
      prev.map((mat, i) =>
        i === index ? { ...mat, [field]: field === 'cantidad_real' ? Number(value) : value } : mat
      )
    );
  };

  // Evidence handling functions
  const handleFileUpload = (files: FileList) => {
    const newFiles: RemisionPendingFile[] = Array.from(files).map(file => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending' as const,
      isCameraCapture: false
    }));
    setPendingFiles(prev => [...prev, ...newFiles]);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  type EvidenceUploadBatchResult = {
    allSucceeded: boolean;
    attempted: number;
    successCount: number;
    failCount: number;
    errors: string[];
  };

  const uploadDocuments = async (remisionId: string): Promise<EvidenceUploadBatchResult> => {
    const initial = [...pendingFiles];
    const attempted = initial.filter((f) => f.status !== 'uploaded').length;
    if (attempted === 0) {
      return { allSucceeded: true, attempted: 0, successCount: 0, failCount: 0, errors: [] };
    }

    const next: RemisionPendingFile[] = initial.map((f) => ({ ...f }));
    let batchOk = 0;
    let batchFail = 0;

    for (let i = 0; i < next.length; i++) {
      if (next[i].status === 'uploaded') continue;

      setPendingFiles((prev) =>
        prev.map((file, index) => (index === i ? { ...file, status: 'uploading' } : file))
      );

      try {
        const formData = new FormData();
        formData.append('remision_id', remisionId);
        formData.append('document_type', 'delivery_evidence');
        formData.append('document_category', 'pumping_remision');
        formData.append('file', next[i].file);

        const response = await fetch('/api/remisiones/documents', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          let message = messageForRemisionDocumentUploadFailure(response.status);
          if (response.status !== 413) {
            try {
              const errorData = await response.json();
              message = messageForRemisionDocumentUploadFailure(
                response.status,
                errorData.error as string | undefined
              );
            } catch {
              /* ignore */
            }
          }
          next[i] = { ...next[i], status: 'error', error: message };
          batchFail++;
          setPendingFiles((prev) =>
            prev.map((file, index) => (index === i ? { ...next[i] } : file))
          );
          continue;
        }

        const result = await response.json();
        next[i] = {
          ...next[i],
          status: 'uploaded',
          documentId: result.data.id,
        };
        batchOk++;
        setPendingFiles((prev) =>
          prev.map((file, index) => (index === i ? { ...next[i] } : file))
        );
      } catch (error) {
        console.error('Error uploading document:', error);
        const message = error instanceof Error ? error.message : 'Error de conexión';
        next[i] = { ...next[i], status: 'error', error: message };
        batchFail++;
        setPendingFiles((prev) =>
          prev.map((file, index) => (index === i ? { ...next[i] } : file))
        );
      }
    }

    const errors: string[] = [];
    for (let i = 0; i < initial.length; i++) {
      if (initial[i].status === 'uploaded') continue;
      if (next[i].status === 'error' && next[i].error) errors.push(next[i].error);
    }

    return {
      allSucceeded: batchFail === 0,
      attempted,
      successCount: batchOk,
      failCount: batchFail,
      errors,
    };
  };

  const handleRetryEvidenceUpload = async () => {
    if (!evidenceRetryRemisionId) return;
    try {
      setLoading(true);
      const r = await uploadDocuments(evidenceRetryRemisionId);
      if (r.attempted > 0 && r.failCount > 0) {
        showError(r.errors[0] ?? `No se pudieron subir ${r.failCount} archivo(s).`);
        return;
      }
      showSuccess(
        r.successCount > 0
          ? `${r.successCount} archivo(s) de evidencia guardado(s) correctamente.`
          : 'Evidencia actualizada correctamente.'
      );
      setEvidenceRetryRemisionId(null);
      setFormData({
        remisionNumber: '',
        fecha: new Date().toISOString().split('T')[0],
        horaCarga: new Date().toTimeString().split(' ')[0].substring(0, 5),
        volumen: '',
        conductor: '',
        unidad: '',
        recipeId: '',
      });
      setManualMaterials([]);
      setPendingFiles([]);
      setExistingDocuments([]);
      setTipoRemision('BOMBEO');
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (doc: RemisionDocument) => {
    try {
      const signedUrl = await getSignedUrl(doc.file_path);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      } else {
        showError('No se pudo generar el enlace para ver el documento');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      showError('Error al abrir el documento');
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/remisiones/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar documento');
      }

      setExistingDocuments(prev => prev.filter(doc => doc.id !== documentId));
      showSuccess('Documento eliminado correctamente');
    } catch (error) {
      console.error('Error deleting document:', error);
      showError(error instanceof Error ? error.message : 'Error al eliminar documento');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.remisionNumber || !formData.fecha || !formData.horaCarga || !formData.volumen) {
      showError('Por favor, completa los campos obligatorios (Nº Remisión, Fecha, Hora de Carga, Volumen)');
      return;
    }
    if (tipoRemision === 'CONCRETO' && !formData.recipeId) {
      showError('Debes seleccionar una receta para remisiones de concreto');
      return;
    }

    try {
      setLoading(true);
      
      const volumen = parseFloat(formData.volumen) || 0;
      
      // Prepare the base payload for the remision
      const remisionPayload: any = {
        order_id: orderId,
        remision_number: formData.remisionNumber,
        fecha: formData.fecha,
        hora_carga: formData.horaCarga + ':00', // Add seconds to match database format
        volumen_fabricado: volumen,
        conductor: formData.conductor || null,
        unidad: formData.unidad || null,
        recipe_id: tipoRemision === 'CONCRETO' ? formData.recipeId : null,
        tipo_remision: tipoRemision,
        designacion_ehe: tipoRemision === 'CONCRETO' ? await getRecipeCode(formData.recipeId) : null,
      };

      // Add created_by if user is available
      if (profile?.id) {
        remisionPayload.created_by = profile.id;
      }
      
      // 1. Insert the main remision record
      const { data: remisionData, error: remisionError } = await supabase
        .from('remisiones')
        .insert(remisionPayload) // Use the constructed payload
        .select('id')
        .single();

      if (remisionError) throw remisionError;
      const newRemisionId = remisionData.id;

      // 2. Insert materials if it's a CONCRETO remision and materials exist
      if (tipoRemision === 'CONCRETO' && manualMaterials.length > 0) {
        // Get recipe materials with optimized caching
        const materialIdMap = await getRecipeMaterials(formData.recipeId);

        // Prepare materials with material_id from recipe
        const materialsToInsert = manualMaterials.map(mat => ({
          remision_id: newRemisionId,
          material_type: mat.material_type,
          material_id: materialIdMap.get(mat.material_type) || null, // Get material_id from recipe
          cantidad_real: mat.cantidad_real,
          cantidad_teorica: (mat.cantidad_teorica || 0) * volumen, // Multiply by volume
          ajuste: 0 // Manual entries don't have retrabajo/manual adjustments
        }));

        const { error: materialsError } = await supabase
          .from('remision_materiales')
          .insert(materialsToInsert);

        if (materialsError) {
          // Attempt to clean up the created remision if materials fail
          await supabase.from('remisiones').delete().eq('id', newRemisionId);
          throw new Error('Error al guardar materiales: ' + materialsError.message);
        }
      }

      let evidenceUpload: EvidenceUploadBatchResult | null = null;
      if (tipoRemision === 'BOMBEO') {
        evidenceUpload = await uploadDocuments(newRemisionId);
        if (evidenceUpload.attempted > 0 && evidenceUpload.failCount > 0) {
          setEvidenceRetryRemisionId(newRemisionId);
          showError(
            evidenceUpload.errors[0] ??
              `No se pudieron subir ${evidenceUpload.failCount} archivo(s). La remisión ya fue registrada. Use «Reintentar evidencia» o corrija los archivos.`
          );
          return;
        }
      }

      setEvidenceRetryRemisionId(null);

      if (tipoRemision === 'BOMBEO' && evidenceUpload && evidenceUpload.successCount > 0) {
        showSuccess(
          `Remisión registrada correctamente. ${evidenceUpload.successCount} archivo(s) de evidencia guardado(s).`
        );
      } else {
        showSuccess('Remisión registrada correctamente.');
      }

      // Resetear formulario (Restored)
      setFormData({
        remisionNumber: '',
        fecha: new Date().toISOString().split('T')[0],
        horaCarga: new Date().toTimeString().split(' ')[0].substring(0, 5), // Reset to current time
        volumen: '',
        conductor: '',
        unidad: '',
        recipeId: '',
      });
      setManualMaterials([]); // Reset materials
      setPendingFiles([]); // Reset pending files
      setExistingDocuments([]); // Reset existing documents
      setTipoRemision('BOMBEO'); // Reset type to default

      onSuccess(); // Callback to refresh list or navigate
    } catch (error: any) {
      console.error('Error al guardar remisión manual:', error);
      showError(error.message || 'Error al registrar la remisión');
    } finally {
      setLoading(false);
    }
  };

  const getRecipeCode = async (recipeId: string): Promise<string | null> => {
    if (!recipeId) return null;
    
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('recipe_code')
        .eq('id', recipeId)
        .single();
        
      if (error || !data) return null;
      return data.recipe_code;
    } catch {
      return null;
    }
  };

  // Update the effect to recalculate theoretical values when volume changes
  useEffect(() => {
    if (formData.volumen && formData.recipeId && tipoRemision === 'CONCRETO') {
      // Update theoretical totals when volume changes
      const volume = parseFloat(formData.volumen) || 0;
      
      setManualMaterials(prev => 
        prev.map(mat => ({
          ...mat,
          // The base theoretical value stays the same (per m³), 
          // but we update both the total theoretical amount and real amount
          cantidad_teorica_total: (mat.cantidad_teorica || 0) * volume,
          cantidad_real: (mat.cantidad_teorica || 0) * volume, // Update real amount to match theoretical total
        }))
      );
    }
  }, [formData.volumen]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tipo Remision Radio Group */}
      <div className="mb-4">
        <Label className="mb-2 block">Tipo de Remisión</Label>
        <div className="flex space-x-4">
          <div className="flex items-center space-x-2">
            <input
              type="radio" 
              id="bombeo"
              checked={tipoRemision === 'BOMBEO'}
              onChange={() => {
                setTipoRemision('BOMBEO');
                setFormData(prev => ({ ...prev, recipeId: '' })); // Clear recipe if switching to bombeo
                setManualMaterials([]); // Clear materials
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="bombeo">Bombeo</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="radio" 
              id="concreto"
              checked={tipoRemision === 'CONCRETO'}
              onChange={() => setTipoRemision('CONCRETO')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="concreto">Concreto</Label>
          </div>
        </div>
      </div>
      
      {/* Basic Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Remision Number */}
        <div>
          <Label htmlFor="remisionNumber">Número de Remisión *</Label>
          <Input
            id="remisionNumber"
            name="remisionNumber"
            value={formData.remisionNumber}
            onChange={handleInputChange}
            required
            className="mt-1"
          />
        </div>
        
        {/* Fecha */}
        <div>
          <Label htmlFor="fecha">Fecha *</Label>
          <Input
            id="fecha"
            name="fecha"
            type="date"
            value={formData.fecha}
            onChange={handleInputChange}
            required
            className="mt-1"
          />
        </div>
        
        {/* Hora de Carga */}
        <div>
          <Label htmlFor="horaCarga">Hora de Carga *</Label>
          <Input
            id="horaCarga"
            name="horaCarga"
            type="time"
            value={formData.horaCarga}
            onChange={handleInputChange}
            required
            className="mt-1"
          />
        </div>
        
        {/* Volumen */}
        <div>
          <Label htmlFor="volumen">Volumen (m³) *</Label>
          <Input
            id="volumen"
            name="volumen"
            type="number"
            step="0.01"
            min="0"
            value={formData.volumen}
            onChange={handleInputChange}
            required
            className="mt-1"
          />
        </div>

        {/* Recipe Select (Conditional) */}
        {tipoRemision === 'CONCRETO' && (
          <div>
            <Label htmlFor="recipeId">Receta *</Label>
            <Select 
              value={formData.recipeId}
              onValueChange={handleRecipeChange}
              disabled={loadingRecipes}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={loadingRecipes ? "Cargando recetas..." : "Seleccione una receta"} />
              </SelectTrigger>
              <SelectContent>
                {recipes.map((recipe) => (
                  <SelectItem key={recipe.id} value={recipe.id}>
                    {recipe.recipe_code} {/* Display only code */}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Conductor */}
        <div>
          <Label htmlFor="conductor">Conductor</Label>
          <Input
            id="conductor"
            name="conductor"
            value={formData.conductor}
            onChange={handleInputChange}
            className="mt-1"
          />
        </div>
        
        {/* Unidad (Matricula) */}
        <div>
          <Label htmlFor="unidad">Unidad (Matrícula)</Label>
          <Input
            id="unidad"
            name="unidad" // Changed name
            value={formData.unidad} // Changed value source
            onChange={handleInputChange}
            className="mt-1"
          />
        </div>
      </div>

      {/* Materials Section (Conditional) */}
      {tipoRemision === 'CONCRETO' && manualMaterials.length > 0 && (
        <div className="space-y-4 pt-4 border-t mt-4">
          <h3 className="text-lg font-medium">Materiales</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Material</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">Teórico por m³</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">Teórico Total</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">Real Dosificado (kg) *</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {manualMaterials.map((material, index) => (
                  <tr key={material.id}>
                    <td className="px-3 py-2">{MATERIAL_NAMES[material.material_type] || material.material_type}</td>
                    <td className="px-3 py-2 text-right">{material.cantidad_teorica?.toFixed(2) ?? '-'}</td>
                    <td className="px-3 py-2 text-right">
                      {formData.volumen 
                        ? ((material.cantidad_teorica || 0) * parseFloat(formData.volumen)).toFixed(2) 
                        : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={material.cantidad_real}
                        onChange={(e) => handleMaterialChange(index, 'cantidad_real', e.target.value)}
                        className="text-right w-24 ml-auto"
                        required
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">* Ingrese la cantidad total real dosificada para el volumen de esta remisión ({formData.volumen} m³).</p>
        </div>
      )}

      {/* Evidence Section (only for BOMBEO type) */}
      {tipoRemision === 'BOMBEO' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Evidencia de la Remisión
            </CardTitle>
            <CardDescription>
              Adjunte documentos de evidencia de la entrega del servicio de bombeo (opcional). Hasta{' '}
              {REMISION_DOCUMENT_MAX_MB}MB por archivo (PDF o imagen).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SimpleFileUpload
              onFileSelect={handleFileUpload}
              acceptedTypes={['image/*', 'application/pdf']}
              multiple
              maxSize={REMISION_DOCUMENT_MAX_MB}
              uploading={loading}
              disabled={loading}
            />

            {pendingFiles.length > 0 && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-gray-600">
                  Archivos pendientes de subir:
                </p>
                {pendingFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between text-xs p-2 bg-yellow-50 rounded border border-yellow-200">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-gray-700 truncate">{file.name}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        file.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        file.status === 'uploading' ? 'bg-blue-100 text-blue-700' :
                        file.status === 'uploaded' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {file.status === 'pending' ? 'Pendiente' :
                         file.status === 'uploading' ? 'Subiendo...' :
                         file.status === 'uploaded' ? 'Subido' :
                         'Error'}
                      </span>
                      {file.error && (
                        <span className="text-xs text-red-600 truncate" title={file.error}>
                          {file.error}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingFile(index)}
                      className="text-red-500 hover:text-red-700 text-xs"
                      title="Eliminar archivo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {existingDocuments.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600">
                  Documentos subidos:
                </p>
                {existingDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between text-xs p-2 bg-green-50 rounded border border-green-200">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-gray-700 truncate">{doc.original_name}</span>
                      <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                        Subido
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(doc.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewDocument(doc)}
                        disabled={urlLoading(doc.file_path)}
                        className="text-blue-600 hover:text-blue-800 text-xs disabled:opacity-50"
                        title="Ver documento (genera enlace seguro)"
                      >
                        {urlLoading(doc.file_path) ? 'Cargando...' : 'Ver'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDocument(doc.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                        title="Eliminar documento"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {evidenceRetryRemisionId && (
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>No se guardó toda la evidencia</AlertTitle>
                <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    La remisión ya está registrada. Corrija los archivos con error y pulse reintentar.
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={handleRetryEvidenceUpload}
                    disabled={loading}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reintentar evidencia
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Submit Button */}
      <div className="flex justify-end pt-4 border-t mt-4">
        <button
          type="submit"
          disabled={loading || loadingRecipes || !!evidenceRetryRemisionId}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ border: '0' }}
          title={
            evidenceRetryRemisionId
              ? 'Resuelva la evidencia pendiente antes de registrar otra remisión'
              : undefined
          }
        >
          {loading ? 'Guardando...' : 'Guardar Remisión'}
        </button>
      </div>
    </form>
  );
} 