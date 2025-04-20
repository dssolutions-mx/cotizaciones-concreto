'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import type { OrderWithClient } from '@/types/orders';
import { CreditStatus } from '@/types/orders';
import { orderService } from '@/lib/supabase/orders';

interface PendingCreditOrdersTableProps {
  orders?: OrderWithClient[];
}

export function PendingCreditOrdersTable({ orders: initialOrders }: PendingCreditOrdersTableProps) {
  const [orders, setOrders] = useState<OrderWithClient[]>(initialOrders || []);
  const [isLoading, setIsLoading] = useState(!initialOrders);
  const [error, setError] = useState<string | null>(null);

  // Fetch orders if not provided
  useEffect(() => {
    if (!initialOrders) {
      const fetchOrders = async () => {
        setIsLoading(true);
        try {
          const { data, error } = await orderService.getOrders({ creditStatus: 'PENDING' });
          if (error) throw new Error(error);
          setOrders(data as OrderWithClient[]);
        } catch (err) {
          console.error('Error fetching pending credit orders:', err);
          setError('No se pudieron cargar las órdenes pendientes de crédito.');
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchOrders();
    }
  }, [initialOrders]);

  if (isLoading) {
    return <p className="text-center text-gray-500">Cargando órdenes pendientes...</p>;
  }

  if (error) {
    return <p className="text-center text-red-500">{error}</p>;
  }

  if (!orders || orders.length === 0) {
    return <p className="text-center text-gray-500">No hay órdenes pendientes de aprobación.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead># Orden</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Fecha Entrega</TableHead>
          <TableHead className="text-right">Monto Total</TableHead>
          <TableHead>Estado Crédito</TableHead>
          {/* Add Actions header later if needed */}
          {/* <TableHead className="text-right">Acciones</TableHead> */}
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">{order.order_number}</TableCell>
            <TableCell>{order.clients?.business_name || 'N/A'}</TableCell>
            <TableCell>
              {order.delivery_date ? format(new Date(order.delivery_date + 'T00:00:00'), 'PPP', { locale: es }) : 'N/A'}
            </TableCell>
            <TableCell className="text-right">{formatCurrency(order.final_amount ?? order.preliminary_amount ?? 0)}</TableCell>
            <TableCell>
              <Badge variant={order.credit_status === CreditStatus.PENDING ? 'destructive' : 'outline'}>
                {order.credit_status}
              </Badge>
            </TableCell>
            {/* Add Actions cell later if needed */}
            {/* <TableCell className="text-right">...Actions...</TableCell> */}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 