import { useState } from 'react';
import { priceService } from '@/lib/supabase/prices';

interface AdminCostFormData {
  costType: string;
  description: string;
  amount: number;
  effectiveDate: string;
}

const COST_TYPES = [
  { id: 'overhead', name: 'Gastos Generales' },
  { id: 'transport', name: 'Transporte' },
  { id: 'labor', name: 'Mano de Obra' },
  { id: 'maintenance', name: 'Mantenimiento' },
  { id: 'equipment', name: 'Equipo' },
  { id: 'other', name: 'Otros' }
];

interface AdminCostFormProps {
  onCostSaved?: () => void;
}

export const AdminCostForm = ({ onCostSaved }: AdminCostFormProps) => {
  const [formData, setFormData] = useState<AdminCostFormData>({
    costType: '',
    description: '',
    amount: 0,
    effectiveDate: new Date().toISOString().split('T')[0]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.costType) {
      setError('Selecciona un tipo de gasto');
      return;
    }

    if (!formData.description.trim()) {
      setError('Ingresa una descripción');
      return;
    }

    if (formData.amount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }

    try {
      setIsSubmitting(true);
      const { error: supabaseError } = await priceService.saveAdminCost(formData);
      
      if (supabaseError) throw supabaseError;

      setSuccess(true);
      setFormData({
        costType: '',
        description: '',
        amount: 0,
        effectiveDate: new Date().toISOString().split('T')[0]
      });

      onCostSaved?.();

      setTimeout(() => setSuccess(false), 3000);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar el gasto';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Registrar Gasto Administrativo</h3>
      
      {error && (
        <div className="mb-4 p-2 bg-red-50 border border-red-200 text-red-600 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-2 bg-green-50 border border-green-200 text-green-600 rounded">
          Gasto guardado exitosamente
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Tipo de Gasto</label>
          <select
            value={formData.costType}
            onChange={(e) => setFormData({...formData, costType: e.target.value})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-xs focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          >
            <option value="">Seleccionar tipo</option>
            {COST_TYPES.map(type => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Descripción</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-xs focus:border-green-500 focus:ring-green-500"
            rows={3}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Monto</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
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
          {isSubmitting ? 'Guardando...' : 'Guardar Gasto'}
        </button>
      </div>
    </form>
  );
}; 