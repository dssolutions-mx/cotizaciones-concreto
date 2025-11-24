/**
 * OrderStatusBadge Component
 *
 * Displays order status with appropriate color coding.
 * Includes client approval status.
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

type ClientApprovalStatus = 'not_required' | 'pending_client' | 'approved_by_client' | 'rejected_by_client';

interface OrderStatusBadgeProps {
  status: ClientApprovalStatus;
  /**
   * Optional variant for different contexts
   */
  variant?: 'default' | 'outline';
}

export function OrderStatusBadge({ status, variant = 'default' }: OrderStatusBadgeProps) {
  const statusConfig = {
    not_required: {
      label: 'Activo',
      className: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: CheckCircle,
    },
    pending_client: {
      label: 'Pendiente de Aprobación',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: Clock,
    },
    approved_by_client: {
      label: 'Aprobado',
      className: 'bg-green-100 text-green-800 border-green-300',
      icon: CheckCircle,
    },
    rejected_by_client: {
      label: 'Rechazado',
      className: 'bg-red-100 text-red-800 border-red-300',
      icon: XCircle,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={variant}
      className={config.className}
    >
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}
