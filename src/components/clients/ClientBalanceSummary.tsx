import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client'; // Corrected path
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Define a basic type for the balance data
interface ClientBalance {
  id: string;
  client_id: string;
  construction_site: string | null;
  current_balance: number;
  last_updated: string;
}

const fetchClientBalances = async (clientId: string) => {
  const { data, error } = await supabase
    .from('client_balances')
    .select('*')
    .eq('client_id', clientId);

  // Processar y separar balances generales vs. específicos por obra
  const generalBalance = data?.find((b: ClientBalance) => b.construction_site === null);
  const siteBalances = data?.filter((b: ClientBalance) => b.construction_site !== null);

  return { generalBalance, siteBalances, error };
};

const ClientBalanceSummary: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [balances, setBalances] = useState<any>({ general: null, sites: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBalances = async () => {
      setLoading(true);
      const { generalBalance, siteBalances, error } = await fetchClientBalances(clientId);
      if (!error) {
        setBalances({
          general: generalBalance,
          sites: siteBalances || []
        });
      }
      setLoading(false);
    };

    loadBalances();
  }, [clientId]);

  // Determine el color basado en el monto del balance
  const getBalanceColor = (amount: number) => {
    if (amount <= 0) return 'text-green-600';
    if (amount > 50000) return 'text-red-600';
    return 'text-yellow-600';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Balance del Cliente</CardTitle>
        <CardDescription>Resumen de saldos total y por obra.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-6 w-6 border-2 border-gray-500 rounded-full border-t-transparent"></div>
          </div>
        ) : (
          <>
            {balances.general ? (
              <div className="mb-4 p-3 bg-gray-50 rounded-md">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">Balance Total:</span>
                  <span className={`font-semibold text-lg ${getBalanceColor(balances.general.current_balance)}`}>
                    ${balances.general.current_balance.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                  </span>
                </div>
                <div className="text-xs text-gray-500 text-right">
                  Actualizado {formatDistanceToNow(new Date(balances.general.last_updated), { addSuffix: true, locale: es })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No se encontró balance general.</p>
            )}

            {balances.sites.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Balances Por Obra:</h4>
                <div className="space-y-2">
                  {balances.sites.map((site: ClientBalance) => (
                    <div key={site.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-600">{site.construction_site}</span>
                      <span className={`text-sm font-medium ${getBalanceColor(site.current_balance)}`}>
                        ${site.current_balance.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}; 

export default ClientBalanceSummary; 