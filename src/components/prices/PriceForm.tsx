/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { priceService } from '@/lib/supabase/prices';

interface PriceFormData {
  materialType: string;
  pricePerUnit: number;
  effectiveDate: string;
  unit: string;
}

const MATERIAL_TYPES = [
  { id: 'cement', name: 'Cemento', unit: 'kg' },
  { id: 'water', name: 'Agua', unit: 'L' },
  { id: 'gravel', name: 'Grava', unit: 'kg' },
  { id: 'volcanicSand', name: 'Arena Volcánica', unit: 'kg' },
  { id: 'basalticSand', name: 'Arena Basáltica', unit: 'kg' },
  { id: 'additive1', name: 'Aditivo 1', unit: 'L' },
  { id: 'additive2', name: 'Aditivo 2', unit: 'L' }
];

interface PriceFormProps {
  onPriceSaved?: () => void;
}

export const PriceForm = ({ onPriceSaved }: PriceFormProps) => {
  const [formData, setFormData] = useState<PriceFormData>({
    materialType: '',
    pricePerUnit: 0,
    effectiveDate: new Date().toISOString().split('T')[0],
    unit: ''
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

    try {
      setIsSubmitting(true);
      const { error } = await priceService.saveMaterialPrice(formData);
      
      if (error) throw error;

      setSuccess(true);
      setFormData({
        materialType: '',
        pricePerUnit: 0,
        effectiveDate: new Date().toISOString().split('T')[0],
        unit: ''
      });

      onPriceSaved?.();

      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(false), 3000);

    } catch (err: any) {
      setError(err.message || 'Error al guardar el precio');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Registrar Nuevo Precio</h3>
      
      {error && (
        <div className="mb-4 p-2 bg-red-50 border border-red-200 text-red-600 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-2 bg-green-50 border border-green-200 text-green-600 rounded">
          Precio guardado exitosamente
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Material</label>
          <select
            value={formData.materialType}
            onChange={(e) => {
              const material = MATERIAL_TYPES.find(m => m.id === e.target.value);
              setFormData({
                ...formData,
                materialType: e.target.value,
                unit: material?.unit || ''
              });
            }}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-xs focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          >
            <option value="">Seleccionar material</option>
            {MATERIAL_TYPES.map(material => (
              <option key={material.id} value={material.id}>
                {material.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Precio por {formData.unit || 'unidad'}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.pricePerUnit}
            onChange={(e) => setFormData({...formData, pricePerUnit: parseFloat(e.target.value)})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-xs focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha efectiva</label>
          <input
            type="date"
            value={formData.effectiveDate}
            onChange={(e) => setFormData({...formData, effectiveDate: e.target.value})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-xs focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Precio'}
        </button>
      </div>
    </form>
  );
}; 