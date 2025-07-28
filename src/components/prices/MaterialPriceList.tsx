import { useState, useEffect } from 'react';
import { priceService } from '@/lib/supabase/prices';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import { usePlantAwareMaterialPrices } from '@/hooks/usePlantAwareMaterialPrices';

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

interface MaterialPrice {
  id: string;
  material_type: string;
  price_per_unit: number;
  effective_date: string;
}

interface MaterialPriceListProps {
  hasEditPermission?: boolean;
}

export const MaterialPriceList = ({ hasEditPermission = false }: MaterialPriceListProps) => {
  // Use plant-aware material prices hook
  const { materialPrices: prices, isLoading: loading, error, refetch: loadPrices } = usePlantAwareMaterialPrices({
    autoRefresh: true
  });

  const getMaterialName = (materialType: string) => {
    const material = MATERIAL_TYPES.find(m => m.id === materialType);
    return material ? material.name : materialType;
  };

  const getMaterialUnit = (materialType: string) => {
    const material = MATERIAL_TYPES.find(m => m.id === materialType);
    return material ? material.unit : '';
  };

  return (
    <div className="bg-white shadow-sm rounded-lg">
      <div className="border-b border-gray-200 px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Precios de Materiales Actuales</h3>
        <p className="mt-1 text-sm text-gray-500">
          Listado de los precios vigentes para los materiales de construcción.
        </p>
      </div>
      {loading ? (
        <div className="p-4 text-center">Cargando precios...</div>
      ) : error ? (
        <div className="p-4 text-red-500">{error}</div>
      ) : prices.length === 0 ? (
        <div className="p-4 text-center text-gray-500">No hay precios registrados.</div>
      ) : (
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4">
            {prices.map((price) => (
              <div key={price.id} className="border rounded p-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{getMaterialName(price.material_type)}</h4>
                    <p className="text-sm text-gray-500">
                      Vigente desde: {new Date(price.effective_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-semibold">
                      ${price.price_per_unit.toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">
                      por {getMaterialUnit(price.material_type)}
                    </span>
                  </div>
                </div>
                {hasEditPermission && (
                  <div className="mt-2 flex justify-end">
                    <RoleProtectedButton
                      allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
                      onClick={() => {
                        // Implement edit functionality here
                        alert('Función para editar precio de material próximamente');
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Editar Precio
                    </RoleProtectedButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 