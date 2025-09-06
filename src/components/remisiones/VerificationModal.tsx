'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '../ui/label';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/lib/utils/toast';
import { getRecipeMaterials } from '@/utils/recipeMaterialsCache';

// Material type mapping for display
const MATERIAL_TYPE_MAP: Record<string, string> = {
  'cement': 'CPC 40',
  'water': 'AGUA 1',
  'gravel': 'GRAVA BASALTO 20mm',
  'gravel40mm': 'GRAVA BASALTO 40mm',
  'volcanicSand': 'ARENA BLANCA',
  'basalticSand': 'ARENA TRITURADA',
  'additive1': '800 MX',
  'additive2': 'ADITIVO 2'
};

// Reverse mapping to convert display names back to DB types
const REVERSE_MATERIAL_TYPE_MAP: Record<string, string> = {};
Object.entries(MATERIAL_TYPE_MAP).forEach(([key, value]) => {
  REVERSE_MATERIAL_TYPE_MAP[value] = key;
});

interface Material {
  tipo: string;
  dosificadoReal: number;
  dosificadoTeorico: number;
}

interface ExtractedData {
  remisionNumber: string;
  fecha: string;
  hora: string;
  volumenFabricado: string;
  matricula: string;
  conductor: string;
  recipeCode: string;
  materiales: Material[];
}

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractedData: ExtractedData | null;
  orderId: string;
  onSuccess: () => void;
}

export default function VerificationModal({ 
  isOpen, 
  onClose, 
  extractedData, 
  orderId,
  onSuccess
}: VerificationModalProps) {
  const [formData, setFormData] = useState<ExtractedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [remisionNumber, setRemisionNumber] = useState('');
  const [recipeError, setRecipeError] = useState<string | null>(null);
  
  // Inicializar formData con la data extraída cuando cambia
  useEffect(() => {
    if (extractedData) {
      setFormData({
        ...extractedData,
        materiales: extractedData.materiales || [],
        remisionNumber: extractedData.remisionNumber || '',
        fecha: extractedData.fecha || '',
        hora: extractedData.hora || '',
        volumenFabricado: extractedData.volumenFabricado || '',
        matricula: extractedData.matricula || ''
      });
      
      // Set the separate remisionNumber state directly from extracted data
      setRemisionNumber(extractedData.remisionNumber || '');
    }
  }, [extractedData]);
  
  // Fetch recipe details when recipe code changes or volume changes
  useEffect(() => {
    if (!formData?.recipeCode) {
      return;
    }
    
    const fetchRecipeDetails = async () => {
      try {
        setRecipeLoading(true);
        setRecipeError(null);
        
        // First find the recipe ID
        const { data: recipeData, error: recipeError } = await supabase
          .from('recipes')
          .select('id')
          .eq('recipe_code', formData.recipeCode)
          .single();
        
        if (recipeError || !recipeData) {
          setRecipeError(`Receta "${formData.recipeCode}" no encontrada`);
          return;
        }
        
        // Validate that we have a valid recipe_id
        if (!recipeData?.id) {
          setRecipeError('Datos de receta inválidos');
          return;
        }
        
        // Get the current version of the recipe
        const { data: versionData, error: versionError } = await supabase
          .from('recipe_versions')
          .select('id')
          .eq('recipe_id', recipeData.id)
          .eq('is_current', true)
          .single();
        
        if (versionError || !versionData) {
          setRecipeError('No se encontró una versión activa de la receta');
          return;
        }
        
        // Get the materials for this version
        const { data: materialsData, error: materialsError } = await supabase
          .from('material_quantities')
          .select('material_type, quantity, unit')
          .eq('recipe_version_id', versionData.id);
        
        if (materialsError) {
          setRecipeError('Error al cargar los materiales de la receta');
          return;
        }
        
        // Parse the volume to a number
        const volume = parseFloat(formData.volumenFabricado.replace(',', '.')) || 0;
        
        // Check if we have any materials in the form data
        if (!formData.materiales || formData.materiales.length === 0) {
          // Create materials array from recipe data
          const newMateriales = materialsData.map(mat => ({
            tipo: MATERIAL_TYPE_MAP[mat.material_type] || mat.material_type,
            dosificadoReal: 0, // Start with 0 for real values
            dosificadoTeorico: mat.quantity * volume // Theoretical quantity per m³ * volume
          }));
          
          setFormData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              materiales: newMateriales
            };
          });
        } else {
          // Update the theoretical values of existing materials
          const updatedMateriales = [...formData.materiales];
          
          // Create a lookup object for material types
          const materialLookup: Record<string, number> = {};
          materialsData.forEach(mat => {
            const displayName = MATERIAL_TYPE_MAP[mat.material_type] || mat.material_type;
            materialLookup[displayName] = mat.quantity * volume;
          });
          
          // Update theoretical values for existing materials
          updatedMateriales.forEach(mat => {
            mat.dosificadoTeorico = materialLookup[mat.tipo] || 0;
          });
          
          setFormData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              materiales: updatedMateriales
            };
          });
        }
      } catch (error: any) {
        console.error('Error fetching recipe details:', error);
        setRecipeError(`Error: ${error.message}`);
      } finally {
        setRecipeLoading(false);
      }
    };
    
    fetchRecipeDetails();
  }, [formData?.recipeCode, formData?.volumenFabricado]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (!formData) return;
    
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Function to add a new material to the list
  const handleAddMaterial = () => {
    if (!formData) return;
    
    // Create a new material with default values
    const newMaterial: Material = {
      tipo: '',
      dosificadoReal: 0,
      dosificadoTeorico: 0
    };
    
    // Add to materiales array
    setFormData({
      ...formData,
      materiales: [...formData.materiales, newMaterial]
    });
  };
  
  // Function to remove a material from the list
  const handleRemoveMaterial = (index: number) => {
    if (!formData) return;
    
    const updatedMateriales = [...formData.materiales];
    updatedMateriales.splice(index, 1);
    
    setFormData({
      ...formData,
      materiales: updatedMateriales
    });
  };
  
  const handleMaterialChange = (index: number, field: 'tipo' | 'dosificadoReal', value: string) => {
    if (!formData) return;
    
    const updatedMateriales = [...formData.materiales];
    if (field === 'dosificadoReal') {
      updatedMateriales[index][field] = parseFloat(value) || 0;
    } else {
      updatedMateriales[index][field] = value;
    }
    
    setFormData({
      ...formData,
      materiales: updatedMateriales
    });
  };
  
  // Function to validate if the material is a known type
  const isValidMaterialType = (tipo: string): boolean => {
    // Check if it exists in our reverse mapping
    return Object.keys(MATERIAL_TYPE_MAP).includes(REVERSE_MATERIAL_TYPE_MAP[tipo]) ||
           Object.values(MATERIAL_TYPE_MAP).includes(tipo);
  };
  
  const handleSubmit = async () => {
    if (!formData || !orderId || !remisionNumber || !formData.recipeCode) {
        showError('Faltan datos necesarios (Número de Remisión o Código de Receta).');
        return;
    }
    
    // Validate materials
    const invalidMaterials = formData.materiales.filter(mat => !isValidMaterialType(mat.tipo) && mat.tipo.trim() !== '');
    if (invalidMaterials.length > 0) {
      showError(`Hay materiales con tipos no reconocidos: ${invalidMaterials.map(m => m.tipo).join(', ')}. 
      Use uno de los siguientes: ${Object.values(MATERIAL_TYPE_MAP).join(', ')}`);
      return;
    }
    
    try {
      setLoading(true);
      
      // 1. Find recipe_id based on recipeCode
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .select('id')
        .eq('recipe_code', formData.recipeCode)
        .single();

      if (recipeError || !recipeData) {
        throw new Error(`Código de receta "${formData.recipeCode}" no encontrado. Verifica el código o créalo si es necesario.`);
      }
      const recipeId = recipeData.id;

      // Formatear fecha para PostgreSQL (YYYY-MM-DD)
      const dateParts = formData.fecha.split('/');
      const formattedDate = dateParts.length === 3 
        ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
        : null;
      
      // Ensure hora is in HH:MM:SS format if needed, default to HH:MM if correct
      const formattedHora = formData.hora.includes(':') ? formData.hora.padEnd(8, ':00') : null;
      
      if (!formattedDate) {
        throw new Error('Formato de fecha inválido');
      }
      
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      // Create the payload with all required fields
      const remisionPayload = {
        order_id: orderId,
        remision_number: remisionNumber,
        fecha: formattedDate,
        hora_carga: formattedHora,
        volumen_fabricado: parseFloat(formData.volumenFabricado.replace(',', '.')) || 0,
        conductor: formData.conductor,
        unidad: formData.matricula,
        recipe_id: recipeId,
        created_by: userId,
        tipo_remision: 'CONCRETO',
        designacion_ehe: formData.recipeCode
      };
      
      // Log the exact payload that will be sent
      console.log('Inserting remision with payload:', JSON.stringify(remisionPayload));
      
      // Insertar remisión
      const { data: remision, error: remisionError } = await supabase
        .from('remisiones')
        .insert(remisionPayload)
        .select()
        .single();
      
      if (remisionError) {
        console.error('Error inserting remision:', remisionError);
        // Show more detailed error for debugging
        showError(`Error al guardar remisión: ${remisionError.message || 'Error desconocido'}`);
        throw remisionError;
      }
      
      // Insertar materiales
      if (formData.materiales && formData.materiales.length > 0) {
        // Filter out empty material types 
        const validMateriales = formData.materiales.filter(mat => mat.tipo.trim() !== '');
        
        // Get recipe materials with optimized caching (if recipe_id exists)
        let materialIdMap = new Map<string, string>();
        if (remision.recipe_id) {
          materialIdMap = await getRecipeMaterials(remision.recipe_id);
        }
        
        // Create materials data with material_id from recipe
        const materialesData = validMateriales.map(material => {
          // Try to find the material type code from reverse mapping, or use the display name if not found
          const materialTypeCode = REVERSE_MATERIAL_TYPE_MAP[material.tipo] || material.tipo;
          
          return {
            remision_id: remision.id,
            material_type: materialTypeCode, // Use the code for DB storage
            material_id: materialIdMap.get(materialTypeCode) || null, // Get material_id from recipe
            cantidad_real: material.dosificadoReal,
            cantidad_teorica: material.dosificadoTeorico,
            ajuste: 0 // PDF extractions don't have retrabajo/manual adjustments
          };
        });
        
        const { error: materialesError } = await supabase
          .from('remision_materiales')
          .insert(materialesData);
        
        if (materialesError) {
          console.error('Error inserting materials:', materialesError);
          throw materialesError;
        }
      }
      
      showSuccess('Remisión registrada correctamente');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error al guardar remisión:', error);
      showError(error.message || 'Error al registrar la remisión');
    } finally {
      setLoading(false);
    }
  };
  
  if (!formData) return null;
  
  // List of valid material names for dropdown suggestions
  const validMaterialNames = Object.values(MATERIAL_TYPE_MAP);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verificar datos extraídos de la remisión</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div>
            <Label htmlFor="remisionNumber">Número de Remisión</Label>
            <Input
              id="remisionNumber"
              value={remisionNumber}
              onChange={(e) => setRemisionNumber(e.target.value)}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              name="fecha"
              value={formData.fecha}
              onChange={handleInputChange}
              className="mt-1"
              placeholder="DD/MM/AAAA"
            />
          </div>
          
          <div>
            <Label htmlFor="hora">Hora</Label>
            <Input
              id="hora"
              name="hora"
              value={formData.hora}
              onChange={handleInputChange}
              className="mt-1"
              placeholder="HH:MM"
            />
          </div>
          
          <div>
            <Label htmlFor="volumenFabricado">Volumen Fabricado</Label>
            <Input
              id="volumenFabricado"
              name="volumenFabricado"
              value={formData.volumenFabricado}
              onChange={handleInputChange}
              className="mt-1"
              type="number"
              step="0.01"
            />
          </div>
          
          <div>
            <Label htmlFor="matricula">Unidad</Label>
            <Input
              id="matricula"
              name="matricula"
              value={formData.matricula}
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>
          
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
          
          <div>
            <Label htmlFor="recipeCode">Código de Receta</Label>
            <Input
              id="recipeCode"
              name="recipeCode"
              value={formData.recipeCode}
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>
        </div>
        
        {recipeLoading && (
          <div className="py-2 text-center">
            <span className="text-sm text-gray-500">Cargando información de la receta...</span>
          </div>
        )}
        
        {recipeError && (
          <div className="py-2 mb-2">
            <span className="text-sm text-red-500">{recipeError}</span>
          </div>
        )}
        
        <div className="py-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium">Materiales</h3>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleAddMaterial} 
              size="sm"
            >
              Agregar Material
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Dosificado Real</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Teórico</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Diferencia</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {formData.materiales.map((material, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2">
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        value={material.tipo}
                        onChange={(e) => handleMaterialChange(index, 'tipo', e.target.value)}
                      >
                        <option value="">Seleccionar material</option>
                        {validMaterialNames.map((matName) => (
                          <option key={matName} value={matName}>
                            {matName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={material.dosificadoReal}
                        onChange={(e) => handleMaterialChange(index, 'dosificadoReal', e.target.value)}
                        className="text-right"
                        step="0.01"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {material.dosificadoTeorico.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={
                        material.dosificadoReal > material.dosificadoTeorico 
                          ? 'text-red-500' 
                          : material.dosificadoReal < material.dosificadoTeorico 
                            ? 'text-yellow-500' 
                            : 'text-green-500'
                      }>
                        {(material.dosificadoReal - material.dosificadoTeorico).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button 
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleRemoveMaterial(index)}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
                {formData.materiales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-sm text-gray-500">
                      No hay materiales. Agrega materiales usando el botón de arriba o carga un código de receta válido.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <p>Los valores teóricos son calculados en base a la receta y el volumen fabricado ({formData.volumenFabricado} m³).</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="mr-2">
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            {loading ? 'Guardando...' : 'Guardar Remisión'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 