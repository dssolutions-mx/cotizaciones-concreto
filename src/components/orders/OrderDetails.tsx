'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import orderService from '@/services/orderService';
import { OrderWithDetails, OrderStatus, CreditStatus } from '@/types/order';
import { useRouter } from 'next/navigation';

// Define una interfaz para editar la orden
interface EditableOrderData {
  delivery_date?: string;
  delivery_time?: string;
  requires_invoice?: boolean;
  special_requirements?: string | null;
  products?: Array<{
    id: string;
    volume: number;
    pump_volume?: number | null;
  }>;
}

interface OrderDetailsProps {
  orderId: string;
}

export default function OrderDetails({ orderId }: OrderDetailsProps) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedOrder, setEditedOrder] = useState<EditableOrderData | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  const loadOrderDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await orderService.getOrderById(orderId);
      setOrder(data);
      setEditedOrder(null);
    } catch (err) {
      console.error('Error loading order details:', err);
      setError('Error al cargar los detalles de la orden. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrderDetails();
  }, [loadOrderDetails]);

  function formatDate(dateString: string) {
    return format(new Date(dateString), 'PP', { locale: es });
  }

  function formatTime(timeString: string) {
    return timeString.substring(0, 5);
  }

  function getOrderStatusColor(status: OrderStatus) {
    switch (status) {
      case 'created':
        return 'bg-blue-500 text-white';
      case 'validated':
        return 'bg-green-500 text-white';
      case 'scheduled':
        return 'bg-purple-500 text-white';
      case 'completed':
        return 'bg-green-700 text-white';
      case 'cancelled':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  function translateOrderStatus(status: OrderStatus) {
    switch (status) {
      case 'created':
        return 'Creada';
      case 'validated':
        return 'Validada';
      case 'scheduled':
        return 'Programada';
      case 'completed':
        return 'Completada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  }

  function getCreditStatusColor(status: CreditStatus) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500 text-white';
      case 'approved':
        return 'bg-green-500 text-white';
      case 'rejected':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  function translateCreditStatus(status: CreditStatus) {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobado';
      case 'rejected':
        return 'Rechazado';
      default:
        return status;
    }
  }

  function handleEditClick() {
    if (!order) return;
    
    setIsEditing(true);
    setEditedOrder({
      delivery_date: order.delivery_date,
      delivery_time: order.delivery_time,
      requires_invoice: order.requires_invoice,
      special_requirements: order.special_requirements || null,
      products: order.products.map(product => ({
        id: product.id,
        volume: product.volume,
        pump_volume: product.pump_volume
      }))
    });
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditedOrder(null);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!editedOrder) return;
    
    const { name, value } = e.target;
    setEditedOrder({
      ...editedOrder,
      [name]: value
    });
  }

  function handleProductVolumeChange(id: string, newVolume: number) {
    if (!editedOrder || !editedOrder.products) return;
    
    const updatedProducts = editedOrder.products.map(product => {
      if (product.id === id) {
        return { ...product, volume: newVolume };
      }
      return product;
    });
    
    setEditedOrder({
      ...editedOrder,
      products: updatedProducts
    });
  }

  function handlePumpVolumeChange(id: string, newVolume: number) {
    if (!editedOrder || !editedOrder.products) return;
    
    const updatedProducts = editedOrder.products.map(product => {
      if (product.id === id) {
        return { ...product, pump_volume: newVolume };
      }
      return product;
    });
    
    setEditedOrder({
      ...editedOrder,
      products: updatedProducts
    });
  }

  async function handleSaveChanges() {
    if (!editedOrder || !order) return;
    
    try {
      setIsSaving(true);
      
      // Actualizar la información general de la orden
      const orderUpdate = {
        delivery_date: editedOrder.delivery_date,
        delivery_time: editedOrder.delivery_time,
        requires_invoice: editedOrder.requires_invoice,
        special_requirements: editedOrder.special_requirements
      };
      
      await orderService.updateOrder(orderId, orderUpdate);
      
      // Actualizar los productos si han cambiado
      if (editedOrder.products && editedOrder.products.length > 0) {
        const updates = editedOrder.products.map(product => {
          const originalProduct = order.products.find(p => p.id === product.id);
          
          // Solo actualizar si los valores han cambiado
          if (originalProduct && 
              (originalProduct.volume !== product.volume || 
               originalProduct.pump_volume !== product.pump_volume)) {
            return orderService.updateOrderItem(product.id, {
              volume: product.volume,
              pump_volume: product.pump_volume,
              // Recalcular el precio total basado en el precio unitario
              total_price: originalProduct.unit_price * product.volume
            });
          }
          return Promise.resolve();
        });
        
        await Promise.all(updates);
      }
      
      // Reload order details after saving
      await loadOrderDetails();
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving order changes:', err);
      setError('Error al guardar los cambios. Por favor, intente nuevamente.');
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center p-4">Cargando detalles de la orden...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (!order) {
    return <div className="text-center p-4">No se encontró la orden solicitada.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/orders')}
            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded flex items-center gap-1"
            title="Volver a la lista"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            <span>Volver</span>
          </button>
          <h2 className="text-2xl font-bold">Detalles de Orden: {order.order_number}</h2>
        </div>
        {!isEditing ? (
          <button 
            onClick={handleEditClick}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Editar Orden
          </button>
        ) : (
          <div className="space-x-2">
            <button 
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-300"
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            <button 
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="border rounded-lg shadow-sm bg-white flex-1">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Información del Cliente</h3>
          </div>
          <div className="p-6">
            <p className="font-medium text-lg">{order.client.business_name}</p>
            <p className="text-sm text-gray-600">Código: {order.client.client_code}</p>
            <p className="text-sm">Email: {order.client.email}</p>
            <p className="text-sm">Teléfono: {order.client.phone}</p>
          </div>
        </div>

        <div className="border rounded-lg shadow-sm bg-white flex-1">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Detalles de la Orden</h3>
          </div>
          <div className="p-6">
            <div className="flex justify-between mb-2">
              <p className="text-sm font-medium">Estado:</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getOrderStatusColor(order.order_status as OrderStatus)}`}>
                {translateOrderStatus(order.order_status as OrderStatus)}
              </span>
            </div>
            <div className="flex justify-between mb-2">
              <p className="text-sm font-medium">Crédito:</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getCreditStatusColor(order.credit_status as CreditStatus)}`}>
                {translateCreditStatus(order.credit_status as CreditStatus)}
              </span>
            </div>
            
            {isEditing ? (
              <>
                <div className="mb-2">
                  <label className="block text-sm font-medium mb-1">Fecha de entrega:</label>
                  <input 
                    type="date"
                    name="delivery_date"
                    value={editedOrder?.delivery_date || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium mb-1">Hora de entrega:</label>
                  <input 
                    type="time"
                    name="delivery_time"
                    value={editedOrder?.delivery_time?.substring(0, 5) || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div className="mb-2">
                  <label className="flex items-center text-sm font-medium">
                    <input 
                      type="checkbox"
                      name="requires_invoice"
                      checked={editedOrder?.requires_invoice || false}
                      onChange={(e) => setEditedOrder({
                        ...editedOrder,
                        requires_invoice: e.target.checked
                      })}
                      className="mr-2"
                    />
                    Requiere factura
                  </label>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm">Entrega: {formatDate(order.delivery_date)} a las {formatTime(order.delivery_time)}</p>
                <p className="text-sm">Requiere factura: {order.requires_invoice ? 'Sí' : 'No'}</p>
              </>
            )}
            
            {order.total_amount && (
              <p className="text-lg font-bold mt-2">
                Total: ${order.total_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
        </div>
      </div>

      {(order.special_requirements || isEditing) && (
        <div className="border rounded-lg shadow-sm bg-white">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Requisitos Especiales</h3>
          </div>
          <div className="p-6">
            {isEditing ? (
              <textarea 
                name="special_requirements"
                value={editedOrder?.special_requirements || ''}
                onChange={handleInputChange}
                placeholder="Ingrese requisitos especiales"
                className="w-full px-3 py-2 border rounded min-h-[100px]"
              />
            ) : (
              <p>{order.special_requirements}</p>
            )}
          </div>
        </div>
      )}

      <div className="border rounded-lg shadow-sm bg-white">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Productos</h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium">Producto</th>
                  <th className="px-4 py-2 text-left font-medium">Descripción</th>
                  <th className="px-4 py-2 text-right font-medium">Cantidad</th>
                  <th className="px-4 py-2 text-right font-medium">Precio Unitario</th>
                  <th className="px-4 py-2 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.products && order.products.map((product) => (
                  <React.Fragment key={product.id}>
                    <tr className="border-b">
                      <td className="px-4 py-2 font-medium">{product.product_type || 'N/A'}</td>
                      <td className="px-4 py-2">{product.description || 'Sin descripción'}</td>
                      <td className="px-4 py-2 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            value={editedOrder?.products?.find(p => p.id === product.id)?.volume || product.volume}
                            onChange={(e) => handleProductVolumeChange(product.id, Number(e.target.value))}
                            className="w-20 px-2 py-1 border rounded text-right"
                          />
                        ) : (
                          product.volume
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        ${product.unit_price && product.unit_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {isEditing ? (
                          `$${((editedOrder?.products?.find(p => p.id === product.id)?.volume || product.volume) * product.unit_price).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                        ) : (
                          `$${product.total_price && product.total_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                        )}
                      </td>
                    </tr>
                    {product.has_pump_service && product.pump_price && (
                      <tr className="border-b bg-gray-50">
                        <td className="px-4 py-2 font-medium pl-8">Servicio de Bombeo</td>
                        <td className="px-4 py-2">Bombeo para {product.product_type}</td>
                        <td className="px-4 py-2 text-right">
                          {isEditing && product.pump_volume !== null ? (
                            <input
                              type="number"
                              min="1"
                              value={editedOrder?.products?.find(p => p.id === product.id)?.pump_volume || product.pump_volume || 0}
                              onChange={(e) => handlePumpVolumeChange(product.id, Number(e.target.value))}
                              className="w-20 px-2 py-1 border rounded text-right"
                            />
                          ) : (
                            product.pump_volume
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          ${product.pump_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {isEditing && product.pump_volume !== null ? (
                            `$${((editedOrder?.products?.find(p => p.id === product.id)?.pump_volume || product.pump_volume || 0) * product.pump_price).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                          ) : (
                            `$${(product.pump_price * (product.pump_volume || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 