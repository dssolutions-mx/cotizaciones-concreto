/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';

interface Price {
  id: string;
  materialType: string;
  pricePerUnit: number;
  effectiveDate: string;
  unit: string;
}

export const PriceList = () => {
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Cargar precios desde Supabase
    setLoading(false);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">Precios Actuales</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Material
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Precio por Unidad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unidad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha Efectiva
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center">
                  Cargando precios...
                </td>
              </tr>
            ) : prices.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center">
                  No hay precios registrados
                </td>
              </tr>
            ) : (
              prices.map((price) => (
                <tr key={price.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{price.materialType}</td>
                  <td className="px-6 py-4 whitespace-nowrap">$ {price.pricePerUnit.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{price.unit}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(price.effectiveDate).toLocaleDateString()}
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