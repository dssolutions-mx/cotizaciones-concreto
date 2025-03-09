/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { priceService } from '@/lib/supabase/prices';

interface ProductPrice {
  id: string;
  code: string;
  description: string;
  fc_mr_value: number;
  type: 'FC' | 'MR';
  age_days: number;
  placement_type: 'D' | 'B';  // Directo o Bombeado
  max_aggregate_size: number;
  slump: number;
  base_price: number;
  recipe_id: string;
  is_active: boolean;
  effective_date: string;
  recipe?: {
    id: string;
    recipe_code: string;
  };
}

export const ProductPriceList = () => {
  const [products, setProducts] = useState<ProductPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: supabaseError } = await priceService.getActiveProducts();
      
      if (supabaseError) throw supabaseError;
      
      // Define a type for the raw data from the database
      interface RawProductData {
        id: string;
        code: string;
        description: string;
        fc_mr_value: number;
        type: 'FC' | 'MR';
        age_days: number;
        placement_type: 'D' | 'B';
        max_aggregate_size: number;
        slump: number;
        base_price: number;
        recipe: {
          id: string;
          recipe_code: string;
        }[];
      }
      
      // Map the data to match the ProductPrice type
      const mappedProducts: ProductPrice[] = (data || []).map((item: RawProductData) => ({
        id: item.id,
        code: item.code,
        description: item.description,
        fc_mr_value: item.fc_mr_value,
        type: item.type,
        age_days: item.age_days,
        placement_type: item.placement_type,
        max_aggregate_size: item.max_aggregate_size,
        slump: item.slump,
        base_price: item.base_price,
        recipe_id: item.recipe?.[0]?.id || '',
        is_active: true,
        effective_date: new Date().toISOString(),
        recipe: item.recipe?.[0] ? {
          id: item.recipe[0].id,
          recipe_code: item.recipe[0].recipe_code
        } : undefined
      }));
      
      setProducts(mappedProducts);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los precios de productos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const getPlacementTypeName = (type: 'D' | 'B') => {
    return type === 'D' ? 'Directo' : 'Bombeado';
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">Lista de Precios de Productos</h3>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200 text-red-600">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Código
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descripción
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resistencia
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Edad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Colocación
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                TMA
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rev.
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Precio Base
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-4 text-center">
                  Cargando productos...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-4 text-center">
                  No hay productos registrados
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.code}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 line-clamp-2">
                      {product.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.fc_mr_value}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.age_days} días
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getPlacementTypeName(product.placement_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.max_aggregate_size}&quot;
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.slump} cm
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    $ {product.base_price.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 