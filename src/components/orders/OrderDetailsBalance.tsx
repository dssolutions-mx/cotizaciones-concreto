import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client'; // Adjusted path
import ClientBalanceSummary from '../clients/ClientBalanceSummary'; // Import Phase 1 component
import PaymentHistoryList from '../clients/PaymentHistoryList'; // Import Phase 1 component

const PANEL_CLASS = 'rounded-lg border border-stone-200 bg-white p-4 md:p-6';

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
  effective_for_balance: boolean | null;
  remision_count: number;
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
          effective_for_balance,
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

      const { count, error: remisionesError } = await supabase
        .from('remisiones')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', orderId);

      if (!error && !remisionesError && data) {
        setOrderData({
          ...(data as Omit<OrderData, 'remision_count'>),
          remision_count: count ?? 0
        });
      } else {
        console.error("Error loading order data:", error || remisionesError);
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

  const hasDeliveries = (orderData.remision_count ?? 0) > 0 || orderData.effective_for_balance === true;
  const preliminaryAmount = orderData.preliminary_amount ?? 0;
  const finalAmount = orderData.final_amount ?? 0;
  const invoiceAmount = orderData.invoice_amount ?? 0;
  const previousBalance = orderData.previous_client_balance ?? 0;
  
  // Calculate VAT information
  const vatRate = orderData.plant?.business_unit?.vat_rate ?? 0.16; // Default to 16%
  const vatPercentage = (vatRate * 100).toFixed(1);
  const vatAmount = orderData.requires_invoice && hasDeliveries ? invoiceAmount - finalAmount : 0;

  const plantCard = orderData.plant ? (
    orderData.requires_invoice ? (
      <div className={`${PANEL_CLASS} border-blue-200`}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-stone-600">Planta:</span>
          <span className="font-medium text-blue-700">{orderData.plant.name}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-stone-600">Tipo de Orden:</span>
          <span className="font-medium text-green-600">FISCAL (con factura)</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-stone-600">Tasa de IVA:</span>
          <span className="font-medium text-blue-700">{vatPercentage}%</span>
        </div>
      </div>
    ) : (
      <div className={PANEL_CLASS}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-stone-600">Planta:</span>
          <span className="font-medium text-stone-800">{orderData.plant.name}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-stone-600">Tipo de Orden:</span>
          <span className="font-medium text-stone-600">EFECTIVO (sin factura)</span>
        </div>
      </div>
    )
  ) : null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">Información de Monto y Balance</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plantCard}

        <div className={`${PANEL_CLASS} ${plantCard ? '' : 'md:col-span-2'}`}>
          <p className="text-sm font-medium text-stone-700 mb-3">Balance del Cliente</p>
          <div className="flex justify-between mb-1">
            <span className="text-sm text-stone-600">Balance Previo:</span>
            <span className={`font-medium ${previousBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ${previousBalance.toLocaleString('es-MX', {minimumFractionDigits: 2})}
            </span>
          </div>

          {hasDeliveries ? (
            <div className="flex justify-between">
              <span className="text-sm text-stone-600">Impacto Real en Balance:</span>
              <span className={`font-medium ${(previousBalance + (orderData.requires_invoice ? invoiceAmount : finalAmount)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${(previousBalance + (orderData.requires_invoice ? invoiceAmount : finalAmount)).toLocaleString('es-MX', {minimumFractionDigits: 2})}
              </span>
            </div>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-sm text-stone-600">Balance Proyectado (Preliminar):</span>
                <span className={`font-medium ${(previousBalance + (orderData.requires_invoice ? preliminaryAmount * (1 + vatRate) : preliminaryAmount)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${(previousBalance + (orderData.requires_invoice ? preliminaryAmount * (1 + vatRate) : preliminaryAmount)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs mt-2">
                El impacto real en el balance se calculará al registrar remisiones.
              </div>
            </>
          )}
        </div>
      </div>

      <div className={PANEL_CLASS}>
        <div className="space-y-2">
          <div className="flex justify-between py-2 border-b border-stone-200">
            <span className="text-stone-600">Monto Preliminar:</span>
            <span className="font-medium text-stone-900">
              ${preliminaryAmount.toLocaleString('es-MX', {minimumFractionDigits: 2})}
            </span>
          </div>

          {hasDeliveries && (
            <div className="flex justify-between py-2 border-b border-stone-200">
              <span className="text-stone-600">Monto Final (real):</span>
              <span className="font-medium text-stone-900">
                ${finalAmount.toLocaleString('es-MX', {minimumFractionDigits: 2})}
              </span>
            </div>
          )}

          {orderData.requires_invoice && hasDeliveries && (
            <>
              <div className="flex justify-between py-2 border-b border-stone-200">
                <span className="text-stone-600">IVA ({vatPercentage}%):</span>
                <span className="font-medium text-blue-600">
                  ${vatAmount.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-stone-200">
                <span className="text-stone-600">Monto con IVA:</span>
                <span className="font-medium text-stone-900">
                  ${invoiceAmount.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                </span>
              </div>
            </>
          )}

          {orderData.requires_invoice && !hasDeliveries && (
            <div className="flex justify-between py-2 border-b border-stone-200">
              <span className="text-stone-600">Monto con IVA ({vatPercentage}%):</span>
              <span className="font-medium text-stone-900">
                ${(preliminaryAmount * (1 + vatRate)).toLocaleString('es-MX', {minimumFractionDigits: 2})}
              </span>
            </div>
          )}

          {hasDeliveries && preliminaryAmount !== finalAmount && (
            <div className="flex justify-between py-2 border-b border-stone-200">
              <span className="text-stone-600">Diferencia:</span>
              <span className={`font-medium ${ finalAmount > preliminaryAmount ? 'text-red-600' : 'text-green-600' }`}>
                ${Math.abs(finalAmount - preliminaryAmount).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                {finalAmount > preliminaryAmount ? ' (adicional)' : ' (menor)'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!hideBalanceSummary && (
          <ClientBalanceSummary clientId={clientId} />
        )}
        <div className={hideBalanceSummary ? 'md:col-span-2' : undefined}>
          <PaymentHistoryList 
            clientId={clientId} 
            constructionSite={constructionSite}
            limit={5}
          />
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsBalance;
