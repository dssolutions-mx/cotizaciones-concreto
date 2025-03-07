import { useState, useEffect } from 'react';
import { priceService } from '@/lib/supabase/prices';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';

const COST_TYPES = [
  { id: 'overhead', name: 'Gastos Generales' },
  { id: 'transport', name: 'Transporte' },
  { id: 'labor', name: 'Mano de Obra' },
  { id: 'maintenance', name: 'Mantenimiento' },
  { id: 'equipment', name: 'Equipo' },
  { id: 'other', name: 'Otros' }
];

interface AdminCost {
  id: string;
  cost_type: string;
  description: string;
  amount: number;
  effective_date: string;
}

interface AdminCostListProps {
  hasEditPermission?: boolean;
}

export const AdminCostList = ({ hasEditPermission = false }: AdminCostListProps) => {
  const [costs, setCosts] = useState<AdminCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: supabaseError } = await priceService.getCurrentAdminCosts();
      
      if (supabaseError) throw supabaseError;
      
      // Filter to keep only the latest cost per type
      const latestCostsMap = (data || []).reduce((acc, current) => {
        const existing = acc[current.cost_type + '-' + current.description];
        if (!existing || new Date(current.effective_date) > new Date(existing.effective_date)) {
          acc[current.cost_type + '-' + current.description] = current;
        }
        return acc;
      }, {} as Record<string, AdminCost>);

      setCosts(Object.values(latestCostsMap));
    } catch (err: any) {
      setError(err.message || 'Error al cargar los costos administrativos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCosts();
  }, []);

  const getCostTypeName = (costType: string) => {
    const cost = COST_TYPES.find(c => c.id === costType);
    return cost ? cost.name : costType;
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="border-b border-gray-200 px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Gastos Administrativos Actuales</h3>
        <p className="mt-1 text-sm text-gray-500">
          Listado de los gastos administrativos vigentes.
        </p>
      </div>
      
      {loading ? (
        <div className="p-4 text-center">Cargando gastos administrativos...</div>
      ) : error ? (
        <div className="p-4 text-red-500">{error}</div>
      ) : costs.length === 0 ? (
        <div className="p-4 text-center text-gray-500">No hay gastos administrativos registrados.</div>
      ) : (
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4">
            {costs.map((cost) => (
              <div key={cost.id} className="border rounded p-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{getCostTypeName(cost.cost_type)}</h4>
                    <p className="text-sm">{cost.description}</p>
                    <p className="text-sm text-gray-500">
                      Vigente desde: {new Date(cost.effective_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-semibold">
                      ${cost.amount.toFixed(2)}
                    </span>
                  </div>
                </div>
                {hasEditPermission && (
                  <div className="mt-2 flex justify-end">
                    <RoleProtectedButton
                      allowedRoles={['PLANT_MANAGER', 'EXECUTIVE']}
                      onClick={() => {
                        // Implement edit functionality here
                        alert('Función para editar gasto administrativo próximamente');
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Editar Gasto
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