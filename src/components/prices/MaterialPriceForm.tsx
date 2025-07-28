import { useState } from 'react';
import { priceService } from '@/lib/supabase/prices';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuth } from '@/contexts/AuthContext';
import EnhancedPlantSelector from '@/components/plants/EnhancedPlantSelector';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';

interface MaterialPriceFormData {
  materialType: string;
  pricePerUnit: number;
  effectiveDate: string;
}

const MATERIAL_TYPES = [
  { id: 'cement', name: 'Cemento', unit: 'kg' },
  { id: 'water', name: 'Agua', unit: 'L' },
  { id: 'gravel', name: 'Grava 20mm', unit: 'kg' },
  { id: 'gravel40mm', name: 'Grava 40mm', unit: 'kg' },
  { id: 'volcanicSand', name: 'Arena Volcánica', unit: 'kg' },
  { id: 'basalticSand', name: 'Arena Basáltica', unit: 'kg' },
  { id: 'additive1', name: 'Aditivo 1', unit: 'L' },
  { id: 'additive2', name: 'Aditivo 2', unit: 'L' }
];

interface MaterialPriceFormProps {
  onPriceSaved?: () => void;
}

export const MaterialPriceForm = ({ onPriceSaved }: MaterialPriceFormProps) => {
  const { userAccess, isGlobalAdmin, currentPlant } = usePlantContext();
  const { profile } = useAuth();
  
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
    materialType: '',
    pricePerUnit: 0,
    effectiveDate: new Date().toISOString().split('T')[0]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.materialType) {
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
        ...formData,
        plant_id: selectedPlantId,
        created_by: profile?.id
      };
      
      const { error: supabaseError } = await priceService.saveMaterialPrice(materialPriceData);
      
      if (supabaseError) throw supabaseError;

      setSuccess(true);
      setFormData({
        materialType: '',
        pricePerUnit: 0,
        effectiveDate: new Date().toISOString().split('T')[0]
      });

      onPriceSaved?.();

      setTimeout(() => setSuccess(false), 3000);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar el precio';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMaterial = MATERIAL_TYPES.find(m => m.id === formData.materialType);

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

      <form onSubmit={handleSubmit} className="space-y-4">
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

        {/* Material Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Material *
          </label>
          <select
            value={formData.materialType}
            onChange={(e) => setFormData(prev => ({ ...prev, materialType: e.target.value }))}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Seleccionar material</option>
            {MATERIAL_TYPES.map(material => (
              <option key={material.id} value={material.id}>
                {material.name} ({material.unit})
              </option>
            ))}
          </select>
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Precio por {selectedMaterial?.unit || 'unidad'} *
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.pricePerUnit}
            onChange={(e) => setFormData(prev => ({ ...prev, pricePerUnit: parseFloat(e.target.value) || 0 }))}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="0.00"
          />
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