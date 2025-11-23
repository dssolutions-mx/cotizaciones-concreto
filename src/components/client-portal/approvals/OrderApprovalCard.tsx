/**
 * OrderApprovalCard Component
 *
 * Displays a pending order with approve/reject actions.
 * Clear visual hierarchy, easy-to-scan information.
 */

'use client';

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Calendar, Clock, DollarSign, Package, User } from 'lucide-react';
import { PendingOrder } from '@/lib/client-portal/approvalService';

interface OrderApprovalCardProps {
  order: PendingOrder;
  onApprove: () => void;
  onReject: () => void;
}

export function OrderApprovalCard({ order, onApprove, onReject }: OrderApprovalCardProps) {
  const deliveryDate = new Date(order.delivery_date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const createdDate = new Date(order.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg text-gray-900">
              Order {order.order_number}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Created by {order.created_by_name} on {createdDate}
            </p>
          </div>
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Delivery Info */}
        <div className="flex items-center text-sm">
          <Calendar className="h-4 w-4 text-gray-500 mr-2" />
          <span className="text-gray-700">
            Delivery: {deliveryDate} at {order.delivery_time || 'TBD'}
          </span>
        </div>

        {/* Amount */}
        <div className="flex items-center text-sm">
          <DollarSign className="h-4 w-4 text-gray-500 mr-2" />
          <span className="text-gray-700">
            Amount: {formatCurrency(order.preliminary_amount || 0)}
          </span>
        </div>

        {/* Volume */}
        <div className="flex items-center text-sm">
          <Package className="h-4 w-4 text-gray-500 mr-2" />
          <span className="text-gray-700">
            Total Volume: {order.total_volume.toFixed(2)} m³
          </span>
        </div>

        {/* Products Summary */}
        {order.product_summary && order.product_summary.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-600 mb-2">Products:</p>
            <ul className="space-y-1">
              {order.product_summary.map((product, idx) => (
                <li key={idx} className="text-sm text-gray-700">
                  • {product.product_name} - {product.volume.toFixed(2)} m³
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Special Requirements */}
        {order.special_requirements && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-600 mb-1">Special Requirements:</p>
            <p className="text-sm text-gray-700 line-clamp-2">
              {order.special_requirements}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2 pt-4">
        <Button
          variant="outline"
          className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={onReject}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Reject
        </Button>
        <Button
          variant="default"
          className="flex-1 bg-green-600 hover:bg-green-700"
          onClick={onApprove}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Approve
        </Button>
      </CardFooter>
    </Card>
  );
}
