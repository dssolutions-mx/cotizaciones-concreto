'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { cn } from '@/lib/utils';
import { OrderWithClient } from '@/types/orders';
import { MapPin, Clock } from 'lucide-react';

interface OrderCard2Props {
  order: OrderWithClient;
  onClick: () => void;
  groupKey: string;
  isDosificador?: boolean;
}

function formatTime(timeString: string | null | undefined) {
  return timeString ? timeString.substring(0, 5) : '';
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateString;
  
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return dateString;
  
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function getAccessDotClass(rating?: string | null) {
  if (!rating) return 'bg-gray-300';
  switch (rating) {
    case 'green':
      return 'bg-green-500 shadow-lg shadow-green-500/50';
    case 'yellow':
      return 'bg-yellow-500 shadow-lg shadow-yellow-500/50';
    case 'red':
      return 'bg-red-500 shadow-lg shadow-red-500/50';
    default:
      return 'bg-gray-300';
  }
}

export const OrderCard2: React.FC<OrderCard2Props> = ({
  order,
  onClick,
  groupKey,
  isDosificador
}) => {
  if (!order) return null;

  // Extract volumes
  const concreteVolumeDelivered = (order as any).concreteVolumeDelivered as number | undefined;
  const concreteVolumePlanned = (order as any).concreteVolumePlanned as number | undefined;
  const pumpVolumeDelivered = (order as any).pumpVolumeDelivered as number | undefined;
  const pumpVolumePlanned = (order as any).pumpVolumePlanned as number | undefined;
  const hasPumpService = !!(order as any).hasPumpService;
  const hasDeliveredConcrete = !!(order as any).hasDeliveredConcrete;

  const displayConcrete = typeof concreteVolumeDelivered === 'number' && concreteVolumeDelivered > 0 
    ? concreteVolumeDelivered 
    : (typeof concreteVolumePlanned === 'number' && concreteVolumePlanned > 0 ? concreteVolumePlanned : undefined);
  const displayPump = typeof pumpVolumeDelivered === 'number' && pumpVolumeDelivered > 0
    ? pumpVolumeDelivered
    : (typeof pumpVolumePlanned === 'number' && pumpVolumePlanned > 0 ? pumpVolumePlanned : undefined);

  const formattedConcrete = displayConcrete
    ? `${displayConcrete.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³`
    : 'N/A';
  const formattedPump = displayPump
    ? `${displayPump.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³`
    : undefined;

  // Creator initials
  const creator = (order as any).creator as { first_name?: string | null; last_name?: string | null; email?: string | null } | undefined;
  const creatorFirst = (creator?.first_name || '').trim();
  const creatorLast = (creator?.last_name || '').trim();
  const creatorEmail = (creator?.email || '').trim();
  const initials = (creatorFirst || creatorLast)
    ? `${creatorFirst.charAt(0)}${creatorLast.charAt(0)}`.toUpperCase()
    : (creatorEmail ? creatorEmail.charAt(0).toUpperCase() : '');

  const rating = (order as any).site_access_rating as string | undefined;
  const isPastOrder = groupKey === 'pasado' || groupKey === 'anteayer' || groupKey === 'ayer';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="mb-4 last:mb-0"
    >
      <GlassCard
        variant="interactive"
        hover
        onClick={onClick}
        className="p-6 cursor-pointer"
      >
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Section - Main Info */}
          <div className="flex-1 space-y-4">
            {/* Header with Client Name and Order Number */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {order.clients?.business_name || 'Cliente no disponible'}
                </h3>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <span>#{order.order_number}</span>
                  {rating && (
                    <span
                      className={cn(
                        'inline-block w-3 h-3 rounded-full',
                        getAccessDotClass(rating)
                      )}
                      title={`Acceso: ${rating.toUpperCase()}`}
                    />
                  )}
                  {initials && (
                    <span
                      className="inline-flex items-center justify-center h-6 w-6 rounded-full glass-thin text-gray-700 dark:text-gray-300 text-xs font-semibold"
                      title="Creador del pedido"
                    >
                      {initials}
                    </span>
                  )}
                </div>
              </div>

              {/* Status Pills */}
              <div className="flex flex-col gap-2 items-end">
                {order.order_status && (
                  <StatusPill
                    status={order.order_status}
                    variant="glow"
                    size="sm"
                  />
                )}
                {order.credit_status && (
                  <StatusPill
                    status={order.credit_status}
                    variant="glow"
                    size="sm"
                  />
                )}
              </div>
            </div>

            {/* Construction Site */}
            {order.construction_site && (
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{order.construction_site}</span>
                {((order as any).delivery_latitude && (order as any).delivery_longitude) && (
                  <button
                    className="ml-2 inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium glass-interactive border border-blue-200 text-blue-700 hover:bg-blue-50"
                    title="Abrir ubicación en Google Maps"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(
                        (order as any).delivery_google_maps_url ||
                        `https://www.google.com/maps?q=${(order as any).delivery_latitude},${(order as any).delivery_longitude}`,
                        '_blank'
                      );
                    }}
                  >
                    Ver mapa
                  </button>
                )}
              </div>
            )}

            {/* Delivery Time */}
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{formatTime(order.delivery_time)}</span>
              {isPastOrder && order.delivery_date && (
                <span className="text-sm text-red-600 dark:text-red-400">
                  • {formatDate(order.delivery_date)}
                </span>
              )}
            </div>

            {/* Progress Bars */}
            {displayConcrete && (
              <div className="space-y-3">
                <div>
                  <ProgressBar
                    value={typeof concreteVolumeDelivered === 'number' ? concreteVolumeDelivered : 0}
                    max={typeof concreteVolumePlanned === 'number' && concreteVolumePlanned > 0 ? concreteVolumePlanned : (displayConcrete || 100)}
                    label="Concreto"
                    showValue
                    color={hasDeliveredConcrete ? 'green' : 'blue'}
                    size="md"
                  />
                </div>
                {hasPumpService && displayPump && (
                  <div>
                    <ProgressBar
                      value={typeof pumpVolumeDelivered === 'number' ? pumpVolumeDelivered : 0}
                      max={typeof pumpVolumePlanned === 'number' && pumpVolumePlanned > 0 ? pumpVolumePlanned : (displayPump || 100)}
                      label="Bombeo"
                      showValue
                      color={typeof pumpVolumeDelivered === 'number' && pumpVolumeDelivered > 0 ? 'green' : 'blue'}
                      size="md"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Section - Volumes and Actions */}
          <div className="flex flex-col md:items-end justify-between gap-4 md:w-64">
            {/* Volumes Display */}
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                {formattedConcrete}
              </div>
              {hasPumpService && formattedPump && (
                <div className="text-lg font-semibold text-systemBlue dark:text-systemBlue/80">
                  Bombeo: {formattedPump}
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {hasDeliveredConcrete ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">✓ Entregado</span>
                ) : (
                  <span>Planificado</span>
                )}
              </div>
            </div>

            {/* Action Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="glass-interactive px-4 py-2 rounded-xl font-semibold text-sm text-gray-900 dark:text-gray-100 border border-white/30 shadow-md"
            >
              Ver detalles
            </motion.button>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};
