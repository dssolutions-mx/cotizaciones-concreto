'use client';

import { useEffect, useMemo, useState } from 'react';
import { priceService } from '@/lib/supabase/prices';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import EnhancedPlantSelector from '@/components/plants/EnhancedPlantSelector';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';
import { recipeService } from '@/lib/supabase/recipes';
import type { Material as RecipeMaterial } from '@/types/recipes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MaterialPriceFormData {
  // Store the material ID for selection
  materialId: string;
  pricePerUnit: number;
  effectiveDate: string;
}

interface MaterialPriceFormProps {
  onPriceSaved?: () => void;
}

export const MaterialPriceForm = ({ onPriceSaved }: MaterialPriceFormProps) => {
  const { userAccess, isGlobalAdmin, currentPlant } = usePlantContext();
  const { profile } = useAuthBridge();
  
  // Plant selection state for material price creation
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

  const [formData, setFormData] = useState<MaterialPriceFormData>({
    materialId: '',
    pricePerUnit: 0,
    effectiveDate: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [materials, setMaterials] = useState<RecipeMaterial[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  // Local state to track raw price input string while typing
  const [priceInput, setPriceInput] = useState<string>("");

  // Set effective date after component mounts to prevent hydration mismatch
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      effectiveDate: new Date().toISOString().split('T')[0]
    }));
  }, []);

  // Load available materials for the selected plant
  useEffect(() => {
    const fetchMaterials = async () => {
      if (!selectedPlantId) {
        setMaterials([]);
        return;
      }
      try {
        setLoadingMaterials(true);
        const list = await recipeService.getMaterials(selectedPlantId);
        setMaterials(list);
      } catch (e) {
        console.error('Error loading materials for plant', e);
        setMaterials([]);
      } finally {
        setLoadingMaterials(false);
      }
    };
    fetchMaterials();
  }, [selectedPlantId]);

  // Selected material from list (derived from formData.materialId which stores the material ID)
  const selectedMaterial: RecipeMaterial | undefined = useMemo(
    () => materials.find(m => m.id === formData.materialId),
    [materials, formData.materialId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.materialId) {
      setError('Selecciona un material');
      return;
    }

    if (formData.pricePerUnit <= 0) {
      setError('El precio debe ser mayor a 0');
      return;
    }

    // Validate plant selection
    if (!selectedPlantId) {
      setError('Debes seleccionar una planta para crear el precio del material');
      return;
    }

    // Validate material selection
    if (!selectedMaterial?.id) {
      setError('Debes seleccionar un material válido');
      return;
    }

    // Validate user profile
    if (!profile?.id) {
      setError('No se pudo obtener la información del usuario');
      return;
    }

    // Validate user can create in selected plant
    if (!plantAwareDataService.canCreateInPlant(selectedPlantId, {
      userAccess,
      isGlobalAdmin,
      currentPlantId: currentPlant?.id || null
    })) {
      setError('No tienes permisos para crear precios de materiales en la planta seleccionada');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Create material price with plant assignment
      const materialPriceData = {
        materialType: selectedMaterial?.material_code || 'MATERIAL',
        material_id: selectedMaterial?.id,
        pricePerUnit: formData.pricePerUnit,
        effectiveDate: formData.effectiveDate,
        plant_id: selectedPlantId,
        created_by: profile?.id
      } as const;
      
      console.log('Sending material price data:', materialPriceData);
      console.log('Selected material:', selectedMaterial);
      console.log('Selected plant ID:', selectedPlantId);
      console.log('Profile ID:', profile?.id);
      console.log('Form data:', formData);
      console.log('Material ID from form:', formData.materialId);
      console.log('Material ID from selected material:', selectedMaterial?.id);
      
      const { error: supabaseError } = await priceService.saveMaterialPrice(materialPriceData);
      
      if (supabaseError) throw supabaseError;

      setSuccess(true);
      setFormData({
        materialId: '',
        pricePerUnit: 0,
        effectiveDate: ''
      });
      setPriceInput("");

      // Reset effective date after form reset
      setTimeout(() => {
        setFormData(prev => ({
          ...prev,
          effectiveDate: new Date().toISOString().split('T')[0]
        }));
      }, 100);

      onPriceSaved?.();

      setTimeout(() => setSuccess(false), 3000);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar el precio';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">Nuevo Precio de Material</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          Precio guardado exitosamente
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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

        {/* Material selection (plant-aware) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Material *
          </label>
          <Select
            value={formData.materialId}
            onValueChange={(value) => setFormData(prev => ({ ...prev, materialId: value }))}
            disabled={!selectedPlantId || loadingMaterials}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={selectedPlantId ? (loadingMaterials ? 'Cargando materiales...' : 'Seleccionar material') : 'Selecciona una planta primero'} />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {materials.map((material) => (
                <SelectItem key={material.id} value={material.id}>
                  <div className="flex flex-col text-left">
                    <span className="font-medium">{material.material_code} — {material.material_name}</span>
                    <span className="text-xs text-muted-foreground">{material.unit_of_measure}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Precio por {selectedMaterial?.unit_of_measure || 'unidad'} *
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={priceInput !== "" ? priceInput : (formData.pricePerUnit === 0 ? '' : formData.pricePerUnit.toString())}
            onChange={(e) => {
              const rawValue = e.target.value;
              // Allow empty string, single dot, or valid decimal numbers up to 5 decimal places
              if (rawValue === '' || rawValue === '.' || /^\d*\.?\d{0,5}$/.test(rawValue)) {
                setPriceInput(rawValue);
              }
            }}
            onBlur={(e) => {
              const rawValue = e.target.value;
              const numValue = rawValue === '' || rawValue === '.' 
                ? 0 
                : parseFloat(rawValue) || 0;
              setFormData(prev => ({ 
                ...prev, 
                pricePerUnit: numValue 
              }));
              setPriceInput(numValue === 0 ? '' : numValue.toString());
            }}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="0.00000"
          />
          <p className="mt-1 text-xs text-gray-500">
            Puedes ingresar hasta 5 decimales para mayor precisión (ej: 4.12567)
          </p>
        </div>

        {/* Effective Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha Efectiva *
          </label>
          <input
            type="date"
            value={formData.effectiveDate}
            onChange={(e) => setFormData(prev => ({ ...prev, effectiveDate: e.target.value }))}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !selectedPlantId}
          className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Precio'}
        </button>
      </form>
    </div>
  );
}; 