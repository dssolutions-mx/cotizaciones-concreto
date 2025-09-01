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
      
      showSuccess('Remisión registrada correctamente');
      
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
      
      {/* Submit Button - Restored original */}
      <div className="flex justify-end pt-4 border-t mt-4">
        <Button
          type="submit"
          disabled={loading || loadingRecipes}
          className="bg-green-600 text-white hover:bg-green-700"
        >
          {loading ? 'Guardando...' : 'Guardar Remisión'}
        </Button>
      </div>
    </form>
  );
} 