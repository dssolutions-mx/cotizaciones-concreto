import { useState, useEffect } from 'react';
import { priceService } from '@/lib/supabase/prices';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  onRefresh?: () => void;
}

export const AdminCostList = ({ hasEditPermission = false, onRefresh }: AdminCostListProps) => {
  const [costs, setCosts] = useState<AdminCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    } catch (err: unknown) {
      console.error('Error loading administrative costs:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar los costos administrativos';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCosts();
  }, []);

  const handleDelete = async (costId: string, costDescription: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el gasto "${costDescription}"?\n\nEsta acción marcará el gasto como inactivo.`)) {
      return;
    }

    try {
      setDeletingId(costId);
      const { error: deleteError } = await priceService.deleteAdminCost(costId);
      
      if (deleteError) throw deleteError;

      // Reload costs after deletion
      await loadCosts();
      
      // Notify parent component to refresh
      onRefresh?.();
    } catch (err: unknown) {
      console.error('Error deleting administrative cost:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar el gasto';
      alert(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const getCostTypeName = (costType: string) => {
    const cost = COST_TYPES.find(c => c.id === costType);
    return cost ? cost.name : costType;
  };

  return (
    <div className="bg-white shadow-sm rounded-lg">
      <div className="border-b border-gray-200 px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">Gastos Administrativos Actuales</h3>
            <p className="mt-1 text-sm text-gray-500">
              Listado de los gastos administrativos vigentes por m³.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadCosts}
            disabled={loading}
          >
            {loading ? 'Cargando...' : 'Actualizar'}
          </Button>
        </div>
      </div>
      
      {loading ? (
        <div className="p-4 text-center">Cargando gastos administrativos...</div>
      ) : error ? (
        <div className="p-4 text-red-500">{error}</div>
      ) : costs.length === 0 ? (
        <div className="p-4 text-center text-gray-500">
          <p className="mb-2">No hay gastos administrativos registrados.</p>
          <p className="text-sm">Agrega un nuevo gasto usando el formulario.</p>
        </div>
      ) : (
        <div className="px-4 py-5 sm:p-6">
          <div className="space-y-3">
            {costs.map((cost) => (
              <div 
                key={cost.id} 
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getCostTypeName(cost.cost_type)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">{cost.description}</p>
                    <p className="text-xs text-gray-500">
                      Vigente desde: {new Date(cost.effective_date).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Costo por m³</div>
                      <div className="text-xl font-semibold text-gray-900">
                        ${cost.amount.toFixed(2)}
                      </div>
                    </div>
                    {hasEditPermission && (
                      <RoleProtectedButton
                        allowedRoles={['PLANT_MANAGER', 'EXECUTIVE']}
                        onClick={() => handleDelete(cost.id, cost.description)}
                        disabled={deletingId === cost.id}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Eliminar gasto administrativo"
                      >
                        {deletingId === cost.id ? (
                          <span className="text-xs">Eliminando...</span>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </RoleProtectedButton>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {costs.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total Gastos Administrativos por m³:</span>
                <span className="text-lg font-bold text-gray-900">
                  ${costs.reduce((sum, cost) => sum + cost.amount, 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 