import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client'; // Adjusted path
import ClientBalanceSummary from '../clients/ClientBalanceSummary'; // Import Phase 1 component
import PaymentHistoryList from '../clients/PaymentHistoryList'; // Import Phase 1 component

interface OrderDetailsBalanceProps {
  orderId: string;
  clientId: string;
  constructionSite: string;
}

// Define a basic type for the order data needed
interface OrderData {
  id: string;
  preliminary_amount: number | null;
  final_amount: number | null;
  invoice_amount: number | null;
  previous_client_balance: number | null;
  requires_invoice: boolean;
}

const OrderDetailsBalance: React.FC<OrderDetailsBalanceProps> = ({ 
  orderId, 
  clientId, 
  constructionSite 
}) => {
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrderData = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          preliminary_amount,
          final_amount,
          invoice_amount,
          previous_client_balance,
          requires_invoice
        `)
        .eq('id', orderId)
        .single();

      if (!error) {
        setOrderData(data as OrderData);
      } else {
        console.error("Error loading order data:", error);
      }

      setLoading(false);
    };

    loadOrderData();
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin h-5 w-5 border-2 border-gray-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="text-center text-red-500 py-4">
        Error al cargar datos de la orden
      </div>
    );
  }

  const hasDeliveries = orderData.final_amount !== null;
  const preliminaryAmount = orderData.preliminary_amount ?? 0;
  const finalAmount = orderData.final_amount ?? 0;
  const invoiceAmount = orderData.invoice_amount ?? 0;
  const previousBalance = orderData.previous_client_balance ?? 0;

  return (
    <div className="border rounded-lg p-4 bg-white">
      <h3 className="font-medium text-gray-800 mb-3">Información de Monto y Balance</h3>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between py-1 border-b">
          <span className="text-gray-600">Monto Preliminar:</span>
          <span className="font-medium">
            ${preliminaryAmount.toLocaleString('es-MX', {minimumFractionDigits: 2})}
          </span>
        </div>

        {hasDeliveries && (
          <div className="flex justify-between py-1 border-b">
            <span className="text-gray-600">Monto Final (real):</span>
            <span className="font-medium">
              ${finalAmount.toLocaleString('es-MX', {minimumFractionDigits: 2})}
            </span>
          </div>
        )}

        {orderData.requires_invoice && (
          <div className="flex justify-between py-1 border-b">
            <span className="text-gray-600">Monto con IVA:</span>
            <span className="font-medium">
              ${invoiceAmount.toLocaleString('es-MX', {minimumFractionDigits: 2})}
            </span>
          </div>
        )}

        {hasDeliveries && preliminaryAmount !== finalAmount && (
          <div className="flex justify-between py-1 border-b">
            <span className="text-gray-600">Diferencia:</span>
            <span className={`font-medium ${ finalAmount > preliminaryAmount ? 'text-red-600' : 'text-green-600' }`}>
              ${Math.abs(finalAmount - preliminaryAmount).toLocaleString('es-MX', {minimumFractionDigits: 2})}
              {finalAmount > preliminaryAmount ? ' (adicional)' : ' (menor)'}
            </span>
          </div>
        )}

        <div className="bg-gray-50 p-3 rounded-md mt-3">
          <p className="text-sm font-medium text-gray-700 mb-2">Balance del Cliente</p>
          <div className="flex justify-between mb-1">
            <span className="text-sm text-gray-600">Balance Previo:</span>
            <span className={`font-medium ${previousBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ${previousBalance.toLocaleString('es-MX', {minimumFractionDigits: 2})}
            </span>
          </div>

          {hasDeliveries ? (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Impacto Real en Balance:</span>
              {/* Use invoiceAmount if requires_invoice, otherwise use finalAmount for projection */}
              <span className={`font-medium ${(previousBalance + (orderData.requires_invoice ? invoiceAmount : finalAmount)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${(previousBalance + (orderData.requires_invoice ? invoiceAmount : finalAmount)).toLocaleString('es-MX', {minimumFractionDigits: 2})}
              </span>
            </div>
          ) : (
            <>
              {/* Show preliminary projected balance */}
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Balance Proyectado (Preliminar):</span>
                <span className={`font-medium ${(previousBalance + (orderData.requires_invoice ? preliminaryAmount * 1.16 : preliminaryAmount)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${(previousBalance + (orderData.requires_invoice ? preliminaryAmount * 1.16 : preliminaryAmount)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-yellow-50 p-2 rounded text-xs text-yellow-700 mt-2">
                El impacto real en el balance se calculará al registrar remisiones.
              </div>
            </>
          )}
        </div>
      </div>

      {/* Display client balance summary */}
      <ClientBalanceSummary clientId={clientId} />

      <div className="mt-4">
        {/* Display recent payment history for the specific site */}
        <PaymentHistoryList 
          clientId={clientId} 
          constructionSite={constructionSite}
          limit={5} // Show recent 5 payments for this site
        />
      </div>
    </div>
  );
};

export default OrderDetailsBalance; 