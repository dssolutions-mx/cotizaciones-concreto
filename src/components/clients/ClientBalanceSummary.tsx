import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Define interfaces for the balance data
interface ClientBalance {
  client_id: string;
  construction_site: string | null;
  current_balance: number;
  last_updated: string | null;
}

interface BalanceState {
  general: ClientBalance | null;
  sites: ClientBalance[];
}

const fetchClientBalances = async (clientId: string) => {
  try {
    // Fetch balances directly from client_balances table (original working approach)
    const { data, error } = await supabase
      .from('client_balances')
      .select('*')
      .eq('client_id', clientId)
      .order('construction_site', { ascending: true, nullsFirst: true });

    if (error) {
      console.error('Error fetching client balances:', error);
      return { generalBalance: null, siteBalances: [], error };
    }

    // Separate general and site balances
    const generalBalance = data?.find((b: ClientBalance) => b.construction_site === null) || null;
    const siteBalances = data?.filter((b: ClientBalance) => b.construction_site !== null) || [];

    return { generalBalance, siteBalances, error: null };
  } catch (err) {
    console.error('Exception in fetchClientBalances:', err);
    return { 
      generalBalance: null, 
      siteBalances: [], 
      error: { message: 'Error de conexión al obtener balances' }
    };
  }
};

const recalculateClientBalance = async (clientId: string, constructionSite?: string) => {
  try {
    // Use the existing production function
    const { error } = await supabase.rpc('update_client_balance', {
      p_client_id: clientId,
      p_site_name: constructionSite || null
    });

    if (error) {
      console.error('Error recalculating balance:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception in recalculateClientBalance:', err);
    return false;
  }
};

const ClientBalanceSummary: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [balances, setBalances] = useState<BalanceState>({ general: null, sites: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [lastRecalculation, setLastRecalculation] = useState<Date | null>(null);

  const loadBalances = async () => {
    setLoading(true);
    setError(null);
    
    const { generalBalance, siteBalances, error: fetchError } = await fetchClientBalances(clientId);
    
    if (fetchError) {
      setError(fetchError.message || 'Error al cargar los balances');
    } else {
      setBalances({
        general: generalBalance,
        sites: siteBalances
      });
    }
    setLoading(false);
  };

  const handleRecalculateBalance = async () => {
    setRecalculating(true);
    setError(null);
    
    try {
      // Recalculate general balance
      await recalculateClientBalance(clientId);
      
      // Recalculate site balances
      for (const site of balances.sites) {
        if (site.construction_site) {
          await recalculateClientBalance(clientId, site.construction_site);
        }
      }
      
      setLastRecalculation(new Date());
      
      // Reload balances to show updated data
      await loadBalances();
    } catch (err) {
      setError('Error al recalcular balances');
      console.error('Error in handleRecalculateBalance:', err);
    } finally {
      setRecalculating(false);
    }
  };

  useEffect(() => {
    loadBalances();
  }, [clientId]);

  // Determine el color basado en el monto del balance
  const getBalanceColor = (amount: number) => {
    if (amount <= 0) return 'text-green-600';
    if (amount > 50000) return 'text-red-600';
    return 'text-yellow-600';
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('es-MX', { 
      style: 'currency', 
      currency: 'MXN',
      minimumFractionDigits: 2 
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Balance del Cliente</CardTitle>
            <CardDescription>
              Resumen de saldos total y por obra.
              {lastRecalculation && (
                <span className="block text-xs text-green-600 mt-1">
                  <CheckCircle className="inline w-3 h-3 mr-1" />
                  Recalculado {formatDistanceToNow(lastRecalculation, { addSuffix: true, locale: es })}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadBalances}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculateBalance}
              disabled={recalculating || loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
              Recalcular
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-6 w-6 border-2 border-gray-500 rounded-full border-t-transparent"></div>
          </div>
        ) : (
          <>
            {balances.general ? (
              <div className="mb-4 p-4 bg-gray-50 rounded-md">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Balance General</h3>
                  <span className={`text-lg font-bold ${getBalanceColor(balances.general.current_balance)}`}>
                    {formatCurrency(balances.general.current_balance)}
                  </span>
                </div>
                {balances.general.last_updated && (
                  <p className="text-sm text-gray-600">
                    Última actualización: {formatDistanceToNow(new Date(balances.general.last_updated), { addSuffix: true, locale: es })}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-yellow-800">No se encontró balance general para este cliente.</p>
              </div>
            )}

            {balances.sites.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Balances por Obra</h3>
                <div className="space-y-2">
                  {balances.sites.map((siteBalance) => (
                    <div key={siteBalance.construction_site} className="p-3 bg-white border rounded-md">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">
                          {siteBalance.construction_site || 'Sin especificar'}
                        </span>
                        <span className={`font-bold ${getBalanceColor(siteBalance.current_balance)}`}>
                          {formatCurrency(siteBalance.current_balance)}
                        </span>
                      </div>
                      {siteBalance.last_updated && (
                        <p className="text-xs text-gray-500 mt-1">
                          Actualizado: {formatDistanceToNow(new Date(siteBalance.last_updated), { addSuffix: true, locale: es })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!balances.general && balances.sites.length === 0 && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-center">
                <p className="text-gray-600">No se encontraron balances para este cliente.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRecalculateBalance}
                  disabled={recalculating}
                  className="mt-2"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
                  Calcular Balance
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientBalanceSummary; 