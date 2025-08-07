import React, { useState } from 'react';
import { supabase } from '../../lib/supabase/client'; // Adjusted path
import { useAuthBridge } from '@/adapters/auth-context-bridge'; // Import bridge

interface RemisionProductoAdicionalFormProps {
  remisionId: string;
  onSuccess?: () => void;
}

const RemisionProductoAdicionalForm: React.FC<RemisionProductoAdicionalFormProps> = ({ 
  remisionId, 
  onSuccess 
}) => {
  const [formData, setFormData] = useState({
    descripcion: '',
    cantidad: '',
    precio_unitario: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const { profile } = useAuthBridge();

  // Verificar permisos
  const canAddProducts = profile?.role === 'DOSIFICADOR' || 
                         profile?.role === 'PLANT_MANAGER' || 
                         profile?.role === 'EXECUTIVE';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canAddProducts) {
      alert('No tienes permisos para agregar productos adicionales');
      return;
    }

    const cantidad = parseFloat(formData.cantidad);
    const precio = parseFloat(formData.precio_unitario);

    if (!formData.descripcion) {
      alert('Por favor, ingresa la descripción del producto');
      return;
    }

    if (isNaN(cantidad) || cantidad <= 0) {
      alert('Por favor, ingresa una cantidad válida');
      return;
    }

    if (isNaN(precio) || precio <= 0) {
      alert('Por favor, ingresa un precio válido');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('remision_productos_adicionales')
        .insert({
          remision_id: remisionId,
          descripcion: formData.descripcion,
          cantidad: cantidad,
          precio_unitario: precio
        });

      if (error) throw error;

      // Limpiar formulario
      setFormData({
        descripcion: '',
        cantidad: '',
        precio_unitario: ''
      });

      if (onSuccess) onSuccess();

      alert('Producto adicional registrado exitosamente');

    } catch (error: any) {
      console.error('Error registrando producto adicional:', error);
      alert(`Error al registrar producto adicional: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canAddProducts) {
    return null; // Do not render the form if user lacks permissions
  }

  return (
    <div className="mt-6">
      <h3 className="font-medium text-gray-800 mb-3">Agregar Producto Adicional</h3>

      <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción*
          </label>
          <input
            type="text"
            name="descripcion"
            value={formData.descripcion}
            onChange={handleInputChange}
            required
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Fibra, Impermeabilizante, etc."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad*
            </label>
            <input
              type="number"
              name="cantidad"
              value={formData.cantidad}
              onChange={handleInputChange}
              required
              min="0.01"
              step="0.01"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio Unitario*
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
              <input
                type="number"
                name="precio_unitario"
                value={formData.precio_unitario}
                onChange={handleInputChange}
                required
                min="0.01"
                step="0.01"
                className="pl-8 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {submitting ? 'Agregando...' : 'Agregar Producto Adicional'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RemisionProductoAdicionalForm; 