'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { cn, formatTimestamp } from '@/lib/utils';
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

  // Precios unitarios
  const concreteUnitPrice = (order as any).concreteUnitPrice as number | undefined;
  const pumpUnitPrice = (order as any).pumpUnitPrice as number | undefined;
  const formattedConcretePU = typeof concreteUnitPrice === 'number' ? concreteUnitPrice.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : undefined;
  const formattedPumpPU = typeof pumpUnitPrice === 'number' ? pumpUnitPrice.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : undefined;

  // Extraer especificaciones del producto (tipos de producto de concreto)
  const productSpecs: string[] = Array.from(
    new Set(
      ((order as any).order_items || [])
        .filter((item: any) => {
          const productType = (item.product_type || '').toString();
          const isEmptyTruckCharge = item.has_empty_truck_charge ||
            productType === 'VACÍO DE OLLA' ||
            productType === 'EMPTY_TRUCK_CHARGE';
          const isPumpService = productType === 'SERVICIO DE BOMBEO' ||
            productType.toLowerCase().includes('bombeo') ||
            productType.toLowerCase().includes('pump');
          return !isEmptyTruckCharge && !isPumpService && productType.trim().length > 0;
        })
        .map((item: any) => (item.product_type || '').toString().trim())
    )
  );

  const rating = (order as any).site_access_rating as string | undefined;
  const isPastOrder = groupKey === 'pasado' || groupKey === 'anteayer' || groupKey === 'ayer';
  const requiresInvoice = order.requires_invoice;
  const concreteDelivered = Number(concreteVolumeDelivered) || 0;
  const pumpDelivered = Number(pumpVolumeDelivered) || 0;

  // Payment type indicator
  const getPaymentTypeIndicator = (requiresInvoice: boolean | undefined) => {
    if (requiresInvoice === true) {
      return 'bg-systemBlue/20 text-systemBlue border border-systemBlue/30';
    } else if (requiresInvoice === false) {
      return 'bg-systemGreen/20 text-systemGreen border border-systemGreen/30';
    }
    return 'bg-gray-500/20 text-gray-700 border border-gray-300/30';
  };

  function handleContextMenu(e: React.MouseEvent) {
    // Allow the default browser context menu to appear
    // This enables "Open in new tab" functionality
    // Don't prevent default here - let the browser handle it
  }

  function handleAuxClick(e: React.MouseEvent) {
    // Handle middle-click to open in new tab
    if (e.button === 1) { // Middle mouse button
      e.preventDefault();
      window.open(`/orders/${order.id}`, '_blank');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="mb-6 last:mb-0"
    >
      <a
        href={`/orders/${order.id}`}
        className="block"
        onClick={(e) => {
          // Allow default behavior for Ctrl/Cmd+click (opens in new tab)
          // Also allow Shift+click (opens in new window)
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            return; // Let browser handle it - will open in new tab/window
          }
          // Only prevent default for regular left-clicks to use router navigation
          e.preventDefault();
          onClick();
        }}
        onContextMenu={handleContextMenu}
        onAuxClick={handleAuxClick}
      >
        <GlassCard
          variant="interactive"
          hover
          className="p-5 cursor-pointer pb-6 border border-white/40 shadow-lg hover:shadow-xl transition-shadow"
        >
        <div className="flex flex-col md:flex-row gap-5">
          {/* Left Section - Main Info */}
          <div className="flex-1 space-y-3">
            {/* Header with Client Name and Order Number */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1.5 leading-tight">
                  {order.clients?.business_name || 'Cliente no disponible'}
                </h3>
                <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">#{order.order_number}</span>
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
                      className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold border border-gray-300 dark:border-gray-600"
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
                <span className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  getPaymentTypeIndicator(requiresInvoice)
                )}>
                  {requiresInvoice === true ? 'Fiscal' : requiresInvoice === false ? 'Efectivo' : 'No especificado'}
                </span>
              </div>
            </div>

            {/* Client Code */}
            <div className="text-sm">
              <span className="font-medium text-gray-600 dark:text-gray-400">Código:</span>{' '}
              <span className="text-gray-900 dark:text-gray-100 font-semibold">{order.clients?.client_code || 'N/A'}</span>
            </div>

            {/* Site access summary for Yellow/Red */}
            {(() => {
              const validations = (order as any).order_site_validations;
              const v = Array.isArray(validations) ? validations[0] : validations;
              if (!rating || rating === 'green' || !v) return null;
              const mapRoad: any = { paved: 'Pav.', gravel_good: 'Terr. buena', gravel_rough: 'Terr. mala' };
              const mapSlope: any = { none: 'sin pend.', moderate: 'pend. mod.', steep: 'pend. pron.' };
              const mapWeather: any = { dry: 'seco', light_rain: 'lluvia ligera', heavy_rain: 'lluvia fuerte' };
              const mapHist: any = { none: 'sin inc.', minor: 'inc. menores', major: 'inc. mayores' };
              return (
                <div className="mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
                    <span className={cn('inline-block w-2 h-2 rounded-full mr-2', getAccessDotClass(rating))}></span>
                    {rating === 'yellow' ? 'Acceso Amarillo' : 'Acceso Rojo'} • {mapRoad[v?.road_type] || '—'} • {mapSlope[v?.road_slope] || '—'} • {mapWeather[v?.recent_weather_impact] || '—'} • {mapHist[v?.route_incident_history] || '—'}
                  </span>
                </div>
              );
            })()}

            {/* Construction Site */}
            {order.construction_site && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">{order.construction_site}</span>
                </div>
                {((order as any).delivery_latitude && (order as any).delivery_longitude) && (
                  <>
                    <button
                      className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-systemBlue/10 text-systemBlue border border-systemBlue/30 hover:bg-systemBlue/20 transition-colors"
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
                      <MapPin className="h-3 w-3 mr-1" />
                      Ver mapa
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {(order as any).delivery_latitude}, {(order as any).delivery_longitude}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Delivery Time */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="font-medium text-gray-900 dark:text-gray-100">{formatTime(order.delivery_time)}</span>
              {isPastOrder && order.delivery_date && (
                <span className="text-sm text-red-600 dark:text-red-400">
                  • {formatDate(order.delivery_date)}
                </span>
              )}
            </div>

            {/* Creation Date */}
            {order.created_at && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Creado: {formatTimestamp(order.created_at, 'PPp')}</span>
              </div>
            )}

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
          <div className="flex flex-col md:items-end justify-between gap-4 md:w-64 mt-4 md:mt-0">
            {/* Volumes Display */}
            <div className="text-right w-full">
              <div className="text-2xl font-semibold mb-2 leading-tight">
                <span className={cn(
                  concreteDelivered > 0 ? 'text-systemGreen dark:text-systemGreen/90' : 'text-gray-900 dark:text-gray-100'
                )}>
                  {formattedConcrete}
                </span>
                {hasPumpService && formattedPump && (
                  <span className={cn(
                    'block mt-1 text-lg font-medium',
                    pumpDelivered > 0 ? 'text-systemGreen dark:text-systemGreen/90' : 'text-systemBlue dark:text-systemBlue/80'
                  )}>
                    Bombeo: {formattedPump}
                  </span>
                )}
              </div>
              
              {/* Product Specs */}
              {productSpecs.length > 0 && (
                <p className="text-xs text-gray-600 dark:text-gray-400 max-w-full text-right truncate mt-2 leading-relaxed" title={productSpecs.join(', ')}>
                  {productSpecs.join(', ')}
                </p>
              )}

              {/* Unit Prices - Only show if not dosificador */}
              {!isDosificador && (
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 flex flex-col items-end gap-1">
                  {formattedConcretePU && (
                    <div className="leading-relaxed">
                      <span className="text-gray-500 dark:text-gray-400">PU Concreto:</span>{' '}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{formattedConcretePU}</span>
                    </div>
                  )}
                  {hasPumpService && formattedPumpPU && (
                    <div className="leading-relaxed">
                      <span className="text-gray-500 dark:text-gray-400">PU Bombeo:</span>{' '}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{formattedPumpPU}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Delivery Status */}
              <div className="mt-3 text-xs">
                {hasDeliveredConcrete ? (
                  <span className="text-systemGreen dark:text-systemGreen/90 font-semibold">✓ Entregado</span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">Planificado</span>
                )}
              </div>
            </div>

            {/* Action Button - Apple HIG: minimum 44pt touch target */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="w-full md:w-auto inline-flex items-center justify-center px-5 py-3 rounded-xl font-semibold text-sm bg-systemBlue text-white hover:bg-systemBlue/90 shadow-md transition-all min-h-[44px] !opacity-100"
              style={{ backgroundColor: '#007AFF', color: 'white', opacity: 1 }}
            >
              Ver detalles
            </motion.button>
          </div>
        </div>
        </GlassCard>
      </a>
    </motion.div>
  );
};
