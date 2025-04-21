'use client';

import React from 'react';
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
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import type { OrderWithClient } from '@/types/orders';

interface PendingCreditOrdersTableProps {
  orders: OrderWithClient[];
}

export function PendingCreditOrdersTable({ orders }: PendingCreditOrdersTableProps) {
  const router = useRouter();

  const handleViewDetails = (orderId: string) => {
    router.push(`/orders/${orderId}`);
  };

  if (orders.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-md">
        <p className="text-gray-500">No hay órdenes pendientes de aprobación de crédito.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[120px]"># Orden</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha Entrega</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="text-center">Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className="hover:bg-muted/30">
              <TableCell className="font-medium">{order.order_number}</TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{order.clients?.business_name || 'N/A'}</p>
                  {order.clients?.client_code && (
                    <p className="text-xs text-muted-foreground">Código: {order.clients.client_code}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div>
                  {order.delivery_date && (
                    <p>{format(new Date(order.delivery_date + 'T00:00:00'), 'PPP', { locale: es })}</p>
                  )}
                  {order.delivery_time && (
                    <p className="text-xs text-muted-foreground">
                      {order.delivery_time.substring(0, 5)} hrs
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(order.final_amount ?? order.preliminary_amount ?? 0)}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Pendiente
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleViewDetails(order.id)}
                >
                  Ver detalles
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 