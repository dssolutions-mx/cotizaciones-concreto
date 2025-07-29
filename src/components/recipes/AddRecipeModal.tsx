/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Search, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlantContext } from '@/contexts/PlantContext';
import EnhancedPlantSelector from '@/components/plants/EnhancedPlantSelector';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';
import { recipeService } from '@/lib/supabase/recipes';
import { Material, NewRecipeData, RecipeSpecification, MaterialSelection, ReferenceMaterialSelection } from '@/types/recipes';

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { profile } = useAuth();
  const { userAccess, isGlobalAdmin, currentPlant } = usePlantContext();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialSelection[]>([]);
  const [showMaterialSelector, setShowMaterialSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Plant selection state for recipe creation
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(() => {
    return plantAwareDataService.getDefaultPlantForCreation({
      userAccess,
      isGlobalAdmin,
      currentPlantId: currentPlant?.id || null
    });
  });
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<string | null>(
    currentPlant?.business_unit_id || null
  );

  const [formData, setFormData] = useState({
    recipeCode: '',
    newSystemCode: '',
    recipeType: 'FC' as 'FC' | 'MR',
    strengthFc: '',
    ageDays: '28',
    placementType: 'D',
    maxAggregateSize: '',
    slump: '',
    applicationType: 'standard' as const,
    hasWaterproofing: false,
    performanceGrade: 'standard' as const,
    notes: '',
  });

  // Reference materials state
  const [referenceMaterials, setReferenceMaterials] = useState<{
    water?: number;
  }>({});

  // Load materials when plant changes
  useEffect(() => {
    if (selectedPlantId) {
      loadMaterials();
    }
  }, [selectedPlantId]);

  const loadMaterials = async () => {
    try {
      const materialsData = await recipeService.getMaterials(selectedPlantId || undefined);
      setMaterials(materialsData);
    } catch (error) {
      console.error('Error loading materials:', error);
      setError('Error al cargar los materiales');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate plant selection
    if (!selectedPlantId) {
      setError('Debes seleccionar una planta para crear la receta');
      return;
    }

    // Validate materials selection
    if (selectedMaterials.length === 0) {
      setError('Debes seleccionar al menos un material para la receta');
      return;
    }

    // Validate user can create in selected plant
    if (!plantAwareDataService.canCreateInPlant(selectedPlantId, {
      userAccess,
      isGlobalAdmin,
      currentPlantId: currentPlant?.id || null
    })) {
      setError('No tienes permisos para crear recetas en la planta seleccionada');
      return;
    }

    setIsSubmitting(true);

    try {
      const specification: RecipeSpecification = {
        strength_fc: parseFloat(formData.strengthFc),
        age_days: parseInt(formData.ageDays),
        placement_type: formData.placementType,
        max_aggregate_size: parseFloat(formData.maxAggregateSize),
        slump: parseFloat(formData.slump),
        application_type: formData.applicationType,
        has_waterproofing: formData.hasWaterproofing,
        performance_grade: formData.performanceGrade,
        recipe_type: formData.recipeType
      };

      // Prepare reference materials
      const refMaterials: ReferenceMaterialSelection[] = [];
      if (referenceMaterials.water && referenceMaterials.water > 0) {
        refMaterials.push({
          material_type: 'water',
          sss_value: referenceMaterials.water
        });
      }

      const recipeData: NewRecipeData = {
        recipe_code: formData.recipeCode,
        new_system_code: formData.newSystemCode || undefined,
        specification,
        materials: selectedMaterials,
        reference_materials: refMaterials.length > 0 ? refMaterials : undefined,
        notes: formData.notes || undefined,
        plant_id: selectedPlantId
      };

      await recipeService.createRecipeWithSpecifications(recipeData);

      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        recipeCode: '',
        newSystemCode: '',
        recipeType: 'FC',
        strengthFc: '',
        ageDays: '28',
        placementType: 'D',
        maxAggregateSize: '',
        slump: '',
        applicationType: 'standard',
        hasWaterproofing: false,
        performanceGrade: 'standard',
        notes: '',
      });
      setSelectedMaterials([]);
      setReferenceMaterials({});
      
    } catch (err: any) {
      setError(err.message || 'Error al crear la receta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const addMaterial = (material: Material) => {
    const existingIndex = selectedMaterials.findIndex(m => m.material_id === material.id);
    
    if (existingIndex >= 0) {
      // Update existing material quantity
      const updated = [...selectedMaterials];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + 1
      };
      setSelectedMaterials(updated);
    } else {
      // Add new material
      setSelectedMaterials(prev => [...prev, {
        material_id: material.id,
        quantity: 1,
        unit: material.unit_of_measure
      }]);
    }
  };

  const updateMaterialQuantity = (materialId: string, quantity: number) => {
    setSelectedMaterials(prev => 
      prev.map(m => 
        m.material_id === materialId 
          ? { ...m, quantity: Math.max(0, quantity) }
          : m
      ).filter(m => m.quantity > 0)
    );
  };

  const removeMaterial = (materialId: string) => {
    setSelectedMaterials(prev => prev.filter(m => m.material_id !== materialId));
  };

  const filteredMaterials = materials.filter(material =>
    material.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.material_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getMaterialName = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    return material?.material_name || 'Material desconocido';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Crear Nueva Receta con Especificaciones</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plant Selection */}
          <div>
            <EnhancedPlantSelector
              mode="CREATE"
              selectedPlantId={selectedPlantId}
              selectedBusinessUnitId={selectedBusinessUnitId}
              onPlantChange={setSelectedPlantId}
              onBusinessUnitChange={setSelectedBusinessUnitId}
              required
              showLabel
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recipe Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código de Receta *
              </label>
              <input
                type="text"
                name="recipeCode"
                value={formData.recipeCode}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej: FC-25-28-D-20-10"
              />
            </div>

            {/* New System Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código Nuevo Sistema
              </label>
              <input
                type="text"
                name="newSystemCode"
                value={formData.newSystemCode}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Código del nuevo sistema"
              />
            </div>

            {/* Recipe Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Receta *
              </label>
              <select
                name="recipeType"
                value={formData.recipeType}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="FC">Receta de Concreto (FC)</option>
                <option value="MR">Receta de Mortero (MR)</option>
              </select>
            </div>

            {/* Strength */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resistencia f'c (Kg/cm2) *
              </label>
              <input
                type="number"
                name="strengthFc"
                value={formData.strengthFc}
                onChange={handleInputChange}
                required
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="25"
              />
            </div>

            {/* Age Days */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Edad (días) *
              </label>
              <input
                type="number"
                name="ageDays"
                value={formData.ageDays}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Placement Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Colocación *
              </label>
              <select
                name="placementType"
                value={formData.placementType}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="D">Directa</option>
                <option value="B">Bombeado</option>
              </select>
            </div>

            {/* Max Aggregate Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tamaño Máximo de Agregado (mm) *
              </label>
              <input
                type="number"
                name="maxAggregateSize"
                value={formData.maxAggregateSize}
                onChange={handleInputChange}
                required
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="20"
              />
            </div>

            {/* Slump */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Revenimiento (cm) *
              </label>
              <input
                type="number"
                name="slump"
                value={formData.slump}
                onChange={handleInputChange}
                required
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="10"
              />
            </div>

            {/* Application Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Aplicación *
              </label>
              <select
                name="applicationType"
                value={formData.applicationType}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="standard">Estándar</option>
                <option value="pavimento">Pavimento</option>
                <option value="relleno_fluido">Relleno Fluido</option>
                <option value="mortero">Mortero</option>
              </select>
            </div>

            {/* Performance Grade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grado de Rendimiento *
              </label>
              <select
                name="performanceGrade"
                value={formData.performanceGrade}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="standard">Estándar</option>
                <option value="high_performance">Alto Rendimiento</option>
                <option value="rapid">Rápido</option>
              </select>
            </div>

            {/* Has Waterproofing */}
            <div className="flex items-center">
              <input
                type="checkbox"
                name="hasWaterproofing"
                checked={formData.hasWaterproofing}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Incluye Impermeabilización
              </label>
            </div>
          </div>

          {/* Material Selection */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Materiales</h3>
              <button
                type="button"
                onClick={() => setShowMaterialSelector(!showMaterialSelector)}
                className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600"
              >
                {showMaterialSelector ? <EyeOff size={16} /> : <Eye size={16} />}
                {showMaterialSelector ? 'Ocultar Selector' : 'Mostrar Selector'}
              </button>
            </div>

            {/* Selected Materials */}
            {selectedMaterials.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Materiales Seleccionados:</h4>
                <div className="space-y-2">
                  {selectedMaterials.map((material) => (
                    <div key={material.material_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="flex-1">{getMaterialName(material.material_id)}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={material.quantity}
                          onChange={(e) => updateMaterialQuantity(material.material_id, parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          min="0"
                          step="0.01"
                        />
                        <span className="text-sm text-gray-600">{material.unit}</span>
                        <button
                          type="button"
                          onClick={() => removeMaterial(material.material_id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Material Selector */}
            {showMaterialSelector && (
              <div className="border rounded-lg p-4">
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Buscar materiales..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                  {filteredMaterials.map((material) => (
                    <div
                      key={material.id}
                      className="p-2 border rounded cursor-pointer hover:bg-blue-50"
                      onClick={() => addMaterial(material)}
                    >
                      <div className="font-medium text-sm">{material.material_name}</div>
                      <div className="text-xs text-gray-600">
                        {material.category} • {material.unit_of_measure}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reference Materials */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Materiales de Referencia (SSS)</h3>
            </div>

            <div className="border rounded-lg p-4">
              <div className="space-y-4">
                {/* Water SSS */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Agua SSS (kg/m³)
                  </label>
                  <input
                    type="number"
                    value={referenceMaterials.water || ''}
                    onChange={(e) => setReferenceMaterials(prev => ({
                      ...prev,
                      water: e.target.value ? parseFloat(e.target.value) : undefined
                    }))}
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ej: 180.5"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor de saturación superficial seca para agua
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas / Observaciones
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Notas adicionales sobre la receta..."
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-gray-300 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedPlantId || selectedMaterials.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creando...' : 'Crear Receta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 