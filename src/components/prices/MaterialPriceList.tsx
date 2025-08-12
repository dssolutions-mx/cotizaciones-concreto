import { useEffect, useMemo, useState } from 'react';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import { usePlantAwareMaterialPrices } from '@/hooks/usePlantAwareMaterialPrices';
import { recipeService } from '@/lib/supabase/recipes';
import type { Material as RecipeMaterial } from '@/types/recipes';

// We now resolve names primarily through materials table via material_id

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

  // Load all materials for mapping (ideally by plant, but prices may span plants via access; keep broad for now)
  const [materials, setMaterials] = useState<RecipeMaterial[]>([]);
  useEffect(() => {
    const fetchAllActiveMaterials = async () => {
      try {
        // recipeService.getMaterials optionally accepts plantId; here we fetch across all (undefined)
        const list = await recipeService.getMaterials();
        setMaterials(list || []);
      } catch (e) {
        console.error('Error loading materials for price list', e);
        setMaterials([]);
      }
    };
    fetchAllActiveMaterials();
  }, []);

  const materialById = useMemo(() => {
    const map = new Map<string, RecipeMaterial>();
    materials.forEach(m => map.set(m.id, m));
    return map;
  }, [materials]);

  // Resolve display values preferring material_id mapping; fallback to legacy material_type string
  const getDisplay = (price: MaterialPrice & { material_id?: string }) => {
    if (price && (price as any).material_id) {
      const m = materialById.get((price as any).material_id!);
      if (m) {
        return {
          title: `${m.material_code} — ${m.material_name}`,
          unit: m.unit_of_measure
        };
      }
    }
    // Fallback to legacy mapping
    const legacyType = price.material_type;
    return {
      title: legacyType,
      unit: ''
    };
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
            {prices.map((price) => {
              const display = getDisplay(price as any);
              return (
              <div key={price.id} className="border rounded p-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{display.title}</h4>
                    <p className="text-sm text-gray-500">
                      Vigente desde: {new Date(price.effective_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-semibold">
                      ${price.price_per_unit.toFixed(2)}
                    </span>
                    {display.unit && (
                      <span className="text-sm text-gray-500 ml-1">
                        por {display.unit}
                      </span>
                    )}
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
            );})}
          </div>
        </div>
      )}
    </div>
  );
}; 