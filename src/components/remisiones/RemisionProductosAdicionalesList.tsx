import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client'; // Adjusted path
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

interface RemisionProductosAdicionalesListProps {
  remisionId: string;
  onProductDelete?: () => void;
}

// Define a type for the additional product data
interface ProductoAdicional {
  id: string;
  remision_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  created_at: string;
}

const RemisionProductosAdicionalesList: React.FC<RemisionProductosAdicionalesListProps> = ({ 
  remisionId, 
  onProductDelete 
}) => {
  const [productos, setProductos] = useState<ProductoAdicional[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  // Verificar permisos para eliminar productos
  const canDeleteProducts = profile?.role === 'PLANT_MANAGER' || profile?.role === 'EXECUTIVE';

  useEffect(() => {
    const loadProductos = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('remision_productos_adicionales')
        .select('*')
        .eq('remision_id', remisionId)
        .order('created_at', { ascending: false });

      if (!error) {
        setProductos((data as ProductoAdicional[]) || []);
      } else {
        console.error("Error loading additional products:", error);
      }

      setLoading(false);
    };

    loadProductos();

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel('productos_adicionales_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'remision_productos_adicionales',
          filter: `remision_id=eq.${remisionId}`,
        },
        (payload) => {
          console.log('Change received!', payload);
          // Re-fetch data when a change occurs
          loadProductos(); 
        }
      )
      .subscribe();

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [remisionId]);

  const handleDelete = async (id: string) => {
    if (!canDeleteProducts) {
      alert('No tienes permisos para eliminar productos adicionales');
      return;
    }

    if (!confirm('¿Estás seguro de eliminar este producto adicional?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('remision_productos_adicionales')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update list immediately for better UX (optional, as real-time should catch it)
      // setProductos(prev => prev.filter(p => p.id !== id)); 

      if (onProductDelete) onProductDelete();
      
      // No need for alert, real-time will update the list

    } catch (error: any) {
      console.error('Error eliminando producto adicional:', error);
      alert(`Error al eliminar producto adicional: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin h-5 w-5 border-2 border-gray-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  if (productos.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No hay productos adicionales registrados
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="font-medium text-gray-800 mb-3">Productos Adicionales</h3>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unitario</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              {canDeleteProducts && (
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {productos.map((producto) => (
              <tr key={producto.id}>
                <td className="px-4 py-2 whitespace-nowrap">
                  {producto.descripcion}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-right">
                  {producto.cantidad.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-right">
                  ${producto.precio_unitario.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-right font-medium">
                  ${(producto.cantidad * producto.precio_unitario).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                </td>
                {canDeleteProducts && (
                  <td className="px-4 py-2 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleDelete(producto.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Eliminar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RemisionProductosAdicionalesList; 