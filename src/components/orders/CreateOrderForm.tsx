'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, format } from 'date-fns';
import orderService from '@/services/orderService';

interface CreateOrderFormProps {
  quoteId: string;
  clientId: string;
  totalAmount: number;
  onSuccess?: () => void;
}

export default function CreateOrderForm({ quoteId, clientId, totalAmount, onSuccess }: CreateOrderFormProps) {
  const router = useRouter();
  const tomorrow = addDays(new Date(), 1);
  
  const [deliveryDate, setDeliveryDate] = useState<string>(format(tomorrow, 'yyyy-MM-dd'));
  const [deliveryTime, setDeliveryTime] = useState<string>('10:00');
  const [requiresInvoice, setRequiresInvoice] = useState<boolean>(false);
  const [specialRequirements, setSpecialRequirements] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Si no hay una cotización seleccionada, mostrar un mensaje
  if (!quoteId || !clientId) {
    return (
      <div className="bg-white rounded-lg border shadow-xs p-6 text-center">
        <h2 className="text-xl font-semibold mb-4">Crear Orden</h2>
        <div className="py-8">
          <p className="text-gray-600 mb-4">
            Para crear una orden, primero debe seleccionar una cotización.
          </p>
          <button
            onClick={() => router.push('/quotes')}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            Ir a Cotizaciones
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      const orderData = {
        quote_id: quoteId,
        client_id: clientId,
        construction_site: 'Cliente Directo',
        construction_site_id: undefined, // No hay sitio de construcción específico
        delivery_date: deliveryDate,
        delivery_time: deliveryTime,
        requires_invoice: requiresInvoice,
        special_requirements: specialRequirements || null,
        total_amount: totalAmount,
        order_status: 'created',
        credit_status: 'pending'
      };
      
      await orderService.createOrder(orderData);
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/orders');
      }
    } catch (err) {
      console.error('Error creating order:', err);
      setError('Error al crear la orden. Por favor, intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border shadow-xs p-6">
      <h2 className="text-xl font-semibold mb-4">Crear Orden</h2>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-md mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="deliveryDate" className="block text-sm font-medium mb-1">
            Fecha de Entrega
          </label>
          <input
            id="deliveryDate"
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            min={format(tomorrow, 'yyyy-MM-dd')}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        
        <div>
          <label htmlFor="deliveryTime" className="block text-sm font-medium mb-1">
            Hora de Entrega
          </label>
          <input
            id="deliveryTime"
            type="time"
            value={deliveryTime}
            onChange={(e) => setDeliveryTime(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        
        <div className="flex items-center">
          <input
            id="requiresInvoice"
            type="checkbox"
            checked={requiresInvoice}
            onChange={(e) => setRequiresInvoice(e.target.checked)}
            className="h-4 w-4 text-green-600 rounded border-gray-300"
          />
          <label htmlFor="requiresInvoice" className="ml-2 block text-sm">
            Requiere Factura
          </label>
        </div>
        
        <div>
          <label htmlFor="specialRequirements" className="block text-sm font-medium mb-1">
            Requisitos Especiales (opcional)
          </label>
          <textarea
            id="specialRequirements"
            value={specialRequirements}
            onChange={(e) => setSpecialRequirements(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="Ingrese cualquier requisito especial para esta orden..."
          />
        </div>
        
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creando orden...' : 'Crear Orden'}
          </button>
        </div>
      </form>
    </div>
  );
} 