import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client'; // Adjusted path
import ClientBalanceSummary from '../clients/ClientBalanceSummary'; // Import Phase 1 component
import PaymentHistoryList from '../clients/PaymentHistoryList'; // Import Phase 1 component

interface OrderDetailsBalanceProps {
  orderId: string;
  clientId: string;
  constructionSite: string;
  /** When true, omit ClientBalanceSummary (shown elsewhere at top) */
  hideBalanceSummary?: boolean;
}

// Define a basic type for the order data needed
interface OrderData {
  preliminary_amount: number | null;
  final_amount: number | null;
  invoice_amount: number | null;
  previous_client_balance: number | null;
  requires_invoice: boolean;
  plant?: {
    id: string;
    name: string;
    code: string;
    business_unit: {
      id: string;
      name: string;
      code: string;
      vat_rate: number;
    };
  };
}

const OrderDetailsBalance: React.FC<OrderDetailsBalanceProps> = ({ 
  orderId, 
  clientId, 
  constructionSite,
  hideBalanceSummary = false 
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
          requires_invoice,
          plant:plant_id(
            id,
            name,
            code,
            business_unit:business_unit_id(
              id,
              name,
              code,
              vat_rate
            )
          )
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
      <div className="flex justify-center py-6">
        <div className="animate-spin h-8 w-8 border-2 border-systemBlue border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="text-center text-red-600 dark:text-red-400 py-6">
        Error al cargar datos de la orden
      </div>
    );
  }

  const hasDeliveries = orderData.final_amount !== null;
  const preliminaryAmount = orderData.preliminary_amount ?? 0;
  const finalAmount = orderData.final_amount ?? 0;
  const invoiceAmount = orderData.invoice_amount ?? 0;
  const previousBalance = orderData.previous_client_balance ?? 0;
  
  // Calculate VAT information
  const vatRate = orderData.plant?.business_unit?.vat_rate ?? 0.16; // Default to 16%
  const vatPercentage = (vatRate * 100).toFixed(1);
  const vatAmount = orderData.requires_invoice && hasDeliveries ? invoiceAmount - finalAmount : 0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Información de Monto y Balance</h3>

      {/* Plant and VAT Rate Info - Only show when invoice is required */}
      {orderData.plant && orderData.requires_invoice && (
        <div className="glass-thin rounded-xl p-4 border border-blue-200/50 dark:border-blue-400/30">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Planta:</span>
            <span className="font-medium text-blue-700 dark:text-blue-400">{orderData.plant.name}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-600 dark:text-gray-400">Tipo de Orden:</span>
            <span className="font-medium text-green-600">FISCAL (con factura)</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-600 dark:text-gray-400">Tasa de IVA:</span>
            <span className="font-medium text-blue-700 dark:text-blue-400">{vatPercentage}%</span>
          </div>
        </div>
      )}

      {/* Show when order is NOT fiscal */}
      {orderData.plant && !orderData.requires_invoice && (
        <div className="glass-thin rounded-xl p-4 border border-gray-200/50 dark:border-gray-500/30">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Planta:</span>
            <span className="font-medium text-gray-700 dark:text-gray-200">{orderData.plant.name}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-600 dark:text-gray-400">Tipo de Orden:</span>
            <span className="font-medium text-gray-600 dark:text-gray-400">EFECTIVO (sin factura)</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
          <span className="text-gray-600 dark:text-gray-400">Monto Preliminar:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            ${preliminaryAmount.toLocaleString('es-MX', {minimumFractionDigits: 2})}
          </span>
        </div>

        {hasDeliveries && (
          <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
            <span className="text-gray-600 dark:text-gray-400">Monto Final (real):</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              ${finalAmount.toLocaleString('es-MX', {minimumFractionDigits: 2})}
            </span>
          </div>
        )}

        {/* VAT Information - Only show for fiscal orders */}
        {orderData.requires_invoice && hasDeliveries && (
          <>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
              <span className="text-gray-600 dark:text-gray-400">IVA ({vatPercentage}%):</span>
              <span className="font-medium text-blue-600">
                ${vatAmount.toLocaleString('es-MX', {minimumFractionDigits: 2})}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
              <span className="text-gray-600 dark:text-gray-400">Monto con IVA:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                ${invoiceAmount.toLocaleString('es-MX', {minimumFractionDigits: 2})}
              </span>
            </div>
          </>
        )}

        {/* Projected VAT for preliminary fiscal orders */}
        {orderData.requires_invoice && !hasDeliveries && (
          <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
            <span className="text-gray-600 dark:text-gray-400">Monto con IVA ({vatPercentage}%):</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              ${(preliminaryAmount * (1 + vatRate)).toLocaleString('es-MX', {minimumFractionDigits: 2})}
            </span>
          </div>
        )}

        {hasDeliveries && preliminaryAmount !== finalAmount && (
          <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-600">
            <span className="text-gray-600 dark:text-gray-400">Diferencia:</span>
            <span className={`font-medium ${ finalAmount > preliminaryAmount ? 'text-red-600' : 'text-green-600' }`}>
              ${Math.abs(finalAmount - preliminaryAmount).toLocaleString('es-MX', {minimumFractionDigits: 2})}
              {finalAmount > preliminaryAmount ? ' (adicional)' : ' (menor)'}
            </span>
          </div>
        )}

        <div className="glass-thin rounded-xl p-4 mt-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Balance del Cliente</p>
          <div className="flex justify-between mb-1">
            <span className="text-sm text-gray-600 dark:text-gray-400">Balance Previo:</span>
            <span className={`font-medium ${previousBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ${previousBalance.toLocaleString('es-MX', {minimumFractionDigits: 2})}
            </span>
          </div>

          {hasDeliveries ? (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Impacto Real en Balance:</span>
              {/* Use invoiceAmount if requires_invoice, otherwise use finalAmount for projection */}
              <span className={`font-medium ${(previousBalance + (orderData.requires_invoice ? invoiceAmount : finalAmount)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${(previousBalance + (orderData.requires_invoice ? invoiceAmount : finalAmount)).toLocaleString('es-MX', {minimumFractionDigits: 2})}
              </span>
            </div>
          ) : (
            <>
              {/* Show preliminary projected balance */}
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Balance Proyectado (Preliminar):</span>
                <span className={`font-medium ${(previousBalance + (orderData.requires_invoice ? preliminaryAmount * (1 + vatRate) : preliminaryAmount)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${(previousBalance + (orderData.requires_invoice ? preliminaryAmount * (1 + vatRate) : preliminaryAmount)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="glass-thin rounded-lg p-3 border border-amber-200/50 dark:border-amber-400/30 text-amber-800 dark:text-amber-200 text-xs mt-2">
                El impacto real en el balance se calculará al registrar remisiones.
              </div>
            </>
          )}
        </div>
      </div>

      {/* Display client balance summary (omit when shown at top in OrderDetails) */}
      {!hideBalanceSummary && <ClientBalanceSummary clientId={clientId} />}

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