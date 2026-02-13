'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { OrderWithClient, OrderStatus, CreditStatus } from '@/types/orders';
import { useRouter } from 'next/navigation';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import { OrderCard2 } from './OrderCard2';
import { cn, formatTimestamp } from '@/lib/utils';
import Link from 'next/link';

type DeliveredFilter = 'all' | 'delivered' | 'pending';

interface OrdersListProps {
  filterStatus?: string;
  onOrderClick?: (orderId: string) => void;
  onCreateOrder?: (quoteId: string) => void;
  maxItems?: number;
  statusFilter?: OrderStatus;
  creditStatusFilter?: CreditStatus;
  clientFilter?: string;
}

interface GroupedOrders {
  [key: string]: {
    date: string;
    formattedDate: string;
    orders: OrderWithClient[];
    isExpanded?: boolean;
    priority?: number;
  };
}

// Helper functions for status and formatting
function getStatusColor(status: string) {
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

function getCreditStatusColor(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800 border-2 border-amber-500 font-bold';
    case 'approved':
      return 'bg-green-100 text-green-800 border-2 border-green-600 font-bold';
    case 'rejected':
    case 'rejected_by_validator':
      return 'bg-red-100 text-red-800 border-2 border-red-600 font-bold';
    default:
      return 'bg-gray-100 text-gray-800 border-2 border-gray-400';
  }
}

function getSiteAccessBadgeClass(rating?: string | null) {
  if (!rating) return 'bg-gray-100 text-gray-600 border border-gray-300';
  switch (rating) {
    case 'green':
      return 'bg-green-100 text-green-800 border border-green-500';
    case 'yellow':
      return 'bg-amber-100 text-amber-800 border border-amber-500';
    case 'red':
      return 'bg-red-100 text-red-800 border border-red-500';
    default:
      return 'bg-gray-100 text-gray-600 border border-gray-300';
  }
}

function getSiteAccessLabel(rating?: string | null) {
  if (!rating) return 'Acceso N/D';
  switch (rating) {
    case 'green':
      return 'Acceso Verde';
    case 'yellow':
      return 'Acceso Amarillo';
    case 'red':
      return 'Acceso Rojo';
    default:
      return `Acceso ${rating}`;
  }
}

function getPaymentTypeIndicator(requiresInvoice: boolean | undefined) {
  if (requiresInvoice === true) {
    return 'bg-indigo-100 text-indigo-800 border border-indigo-300';
  } else if (requiresInvoice === false) {
    return 'bg-green-100 text-green-800 border border-green-300';
  }
  return 'bg-gray-100 text-gray-800 border border-gray-300';
}

function getAccessDotClass(rating?: string | null) {
  if (!rating) return 'bg-gray-300';
  switch (rating) {
    case 'green':
      return 'bg-green-500';
    case 'yellow':
      return 'bg-yellow-500';
    case 'red':
      return 'bg-red-500';
    default:
      return 'bg-gray-300';
  }
}

function translateStatus(status: string) {
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

function translateCreditStatus(status: string) {
  switch (status) {
    case 'pending':
      return 'Crédito Pendiente';
    case 'approved':
      return 'Crédito Aprobado';
    case 'rejected':
      return 'Crédito Rechazado';
    case 'rejected_by_validator':
      return 'Rechazado por Validador';
    default:
      return status;
  }
}

function formatTime(timeString: string) {
  return timeString ? timeString.substring(0, 5) : '';
}

function formatDate(dateString: string) {
  if (!dateString) return '';
  // Asegurarnos de que estamos trabajando con una fecha válida
  // El formato YYYY-MM-DD que viene de la base de datos
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Los meses en JS van de 0-11
  const day = parseInt(parts[2], 10);
  
  const date = new Date(year, month, day);
  // Usar el formato local español para la fecha: DD/MM/YYYY
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

// Legacy OrderCard - kept for backward compatibility but will be replaced
function OrderCard({ order, onClick, groupKey, isDosificador }: { order: OrderWithClient; onClick: () => void; groupKey: string; isDosificador?: boolean }) {
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

  // Determinar los volúmenes y estado de entrega
  const concreteVolumeDelivered = (order as any).concreteVolumeDelivered as number | undefined;
  const concreteVolumePlanned = (order as any).concreteVolumePlanned as number | undefined;
  const pumpVolumeDelivered = (order as any).pumpVolumeDelivered as number | undefined;
  const pumpVolumePlanned = (order as any).pumpVolumePlanned as number | undefined;
  const hasPumpService = !!(order as any).hasPumpService;
  const hasDeliveredConcrete = !!(order as any).hasDeliveredConcrete;
  const concreteDelivered = Number((order as any).concreteVolumeDelivered) || 0;
  const pumpDelivered = Number((order as any).pumpVolumeDelivered) || 0;

  // Elegir volumen a mostrar (priorizar entregado, si no mostrar planificado)
  const displayConcrete = typeof concreteVolumeDelivered === 'number' ? concreteVolumeDelivered : concreteVolumePlanned;
  const displayPump = typeof pumpVolumeDelivered === 'number' ? pumpVolumeDelivered : pumpVolumePlanned;

  // Formatear volúmenes a m³
  const formattedConcrete = typeof displayConcrete === 'number'
    ? `${displayConcrete.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³`
    : 'N/A';
  const formattedPump = typeof displayPump === 'number'
    ? `${displayPump.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³`
    : undefined;

  // Precios unitarios
  const concreteUnitPrice = (order as any).concreteUnitPrice as number | undefined;
  const pumpUnitPrice = (order as any).pumpUnitPrice as number | undefined;
  const formattedConcretePU = typeof concreteUnitPrice === 'number' ? concreteUnitPrice.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : undefined;
  const formattedPumpPU = typeof pumpUnitPrice === 'number' ? pumpUnitPrice.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : undefined;

  // Iniciales del creador
  const creator = (order as any).creator as { first_name?: string | null; last_name?: string | null; email?: string | null } | undefined;
  const creatorFirst = (creator?.first_name || '').trim();
  const creatorLast = (creator?.last_name || '').trim();
  const creatorEmail = (creator?.email || '').trim();
  const initials = (creatorFirst || creatorLast)
    ? `${creatorFirst.charAt(0)}${creatorLast.charAt(0)}`.toUpperCase()
    : (creatorEmail ? creatorEmail.charAt(0).toUpperCase() : '');

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
          const isAdditionalProduct = productType.startsWith('PRODUCTO ADICIONAL:');
          return !isEmptyTruckCharge && !isPumpService && !isAdditionalProduct && productType.trim().length > 0;
        })
        .map((item: any) => (item.product_type || '').toString().trim())
    )
  );

  const isPastOrder = groupKey === 'pasado' || groupKey === 'anteayer' || groupKey === 'ayer';
  const requiresInvoice = order.requires_invoice;

  return (
    <a
      href={`/orders/${order.id}`}
      className="block p-4 hover:bg-gray-50 transition duration-150 cursor-pointer"
      onClick={(e) => {
        // Allow default behavior for Ctrl/Cmd+click (opens in new tab)
        // Also allow Shift+click (opens in new window) and middle-click
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
      <div className="flex flex-col md:flex-row justify-between">
        <div className="flex-1">
          <div className="flex items-center">
            <h3 className="font-semibold text-lg">
              {order.clients?.business_name || 'Cliente no disponible'}
            </h3>
            <span className="ml-2 text-sm text-gray-500">#{order.order_number}</span>
            {initials && (
              <span className="ml-3 inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold" title="Creador del pedido">
                {initials}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-1 mb-1">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(order.order_status)}`}>
              {translateStatus(order.order_status)}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${getCreditStatusColor(order.credit_status)}`}>
              {translateCreditStatus(order.credit_status)}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getSiteAccessBadgeClass((order as any).site_access_rating)}`}>
              {getSiteAccessLabel((order as any).site_access_rating)}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getPaymentTypeIndicator(requiresInvoice)}`}>
              {requiresInvoice === true ? 'Fiscal' : requiresInvoice === false ? 'Efectivo' : 'No especificado'}
            </span>
          </div>
          {/* Site access summary for Yellow/Red */}
          {(() => {
            const rating = (order as any).site_access_rating as string | undefined;
            // Handle both array and object formats for order_site_validations
            const validations = (order as any).order_site_validations;
            const v = Array.isArray(validations) ? validations[0] : validations;
            if (!rating || rating === 'green' || !v) return null;
            const mapRoad: any = { paved: 'Pav.', gravel_good: 'Terr. buena', gravel_rough: 'Terr. mala' };
            const mapSlope: any = { none: 'sin pend.', moderate: 'pend. mod.', steep: 'pend. pron.' };
            const mapWeather: any = { dry: 'seco', light_rain: 'lluvia ligera', heavy_rain: 'lluvia fuerte' };
            const mapHist: any = { none: 'sin inc.', minor: 'inc. menores', major: 'inc. mayores' };
            return (
              <div className="mb-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-800 border border-amber-200">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getAccessDotClass(rating)}`}></span>
                  {rating === 'yellow' ? 'Acceso Amarillo' : 'Acceso Rojo'} • {mapRoad[v?.road_type] || '—'} • {mapSlope[v?.road_slope] || '—'} • {mapWeather[v?.recent_weather_impact] || '—'} • {mapHist[v?.route_incident_history] || '—'}
                </span>
              </div>
            );
          })()}
          {order.construction_site && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Obra:</span> {order.construction_site}
              {((order as any).delivery_latitude && (order as any).delivery_longitude) && (
                <>
                  <button
                    className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                    title="Abrir ubicación en Google Maps"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open((order as any).delivery_google_maps_url || `https://www.google.com/maps?q=${(order as any).delivery_latitude},${(order as any).delivery_longitude}`, '_blank');
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    Ver mapa
                  </button>
                  <span className="ml-2 text-xs text-gray-500">
                    {(order as any).delivery_latitude}, {(order as any).delivery_longitude}
                  </span>
                </>
              )}
            </p>
          )}
          <p className="text-sm text-gray-700">
            <span className="font-medium">Código:</span> {order.clients?.client_code || 'N/A'}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Entrega:</span> {formatTime(order.delivery_time)}
          </p>
          {isPastOrder && order.delivery_date && (
            <p className="text-sm text-red-600 mt-1">
              <span className="font-medium">Fecha programada:</span> {formatDate(order.delivery_date)}
            </p>
          )}
          {order.created_at && (
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-medium">Creado:</span> {formatTimestamp(order.created_at, 'PPp')}
            </p>
          )}
        </div>
        <div className="flex flex-col md:items-end mt-2 md:mt-0 space-y-2">
          <div className="flex flex-col items-end">
            <p className="text-lg font-bold">
              <span className={`${concreteDelivered > 0 ? 'text-green-700' : 'text-gray-900'}`}>{formattedConcrete}</span>
              {hasPumpService && formattedPump ? (
                <span className={`ml-2 ${pumpDelivered > 0 ? 'text-green-700' : 'text-gray-700'}`}>Bombeo: {formattedPump}</span>
              ) : null}
            </p>
            {productSpecs.length > 0 && (
              <p className="text-xs text-gray-600 max-w-[260px] text-right truncate" title={productSpecs.join(', ')}>
                {productSpecs.join(', ')}
              </p>
            )}
            {(!isDosificador) && (
              <div className="mt-1 text-xs text-gray-600 flex flex-col items-end">
                {formattedConcretePU && (
                  <div>PU Concreto: <span className="font-medium">{formattedConcretePU}</span></div>
                )}
                {hasPumpService && formattedPumpPU && (
                  <div>PU Bombeo: <span className="font-medium">{formattedPumpPU}</span></div>
                )}
              </div>
            )}
            {hasDeliveredConcrete ? (
              <p className="text-xs text-green-600 font-medium">Entregado</p>
            ) : (
              <p className="text-xs text-gray-500">Planificado</p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="inline-flex items-center justify-center rounded-md border border-input px-3 h-9 text-sm font-medium bg-background hover:bg-accent hover:text-accent-foreground shadow-xs hover:shadow-sm transition-all"
          >
            Ver detalles
          </button>
        </div>
      </div>
    </a>
  );
}

export default function OrdersList({ 
  filterStatus, 
  onOrderClick, 
  onCreateOrder,
  maxItems,
  statusFilter,
  creditStatusFilter,
  clientFilter
}: OrdersListProps) {
  // Estados para los filtros
  const [searchQuery, setSearchQuery] = useState(clientFilter || '');
  const [deliveredFilter, setDeliveredFilter] = useState<DeliveredFilter>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  
  const router = useRouter();
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();
  
  // Check if user is a dosificador
  const isDosificador = profile?.role === 'DOSIFICADOR';

  // Simple state for orders
  const [orders, setOrders] = useState<OrderWithClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para los datos filtrados y agrupados
  const [filteredOrders, setFilteredOrders] = useState<OrderWithClient[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrders>({});
  
  // Pagination state for dosificadores
  const [dosificadorOffset, setDosificadorOffset] = useState(0);
  const [dosificadorHasMore, setDosificadorHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Simple function to load orders
  const loadOrders = useCallback(async () => {
    if (!currentPlant?.id) return;
    
    setLoading(true);
    setError(null);

    try {
      if (isDosificador) {
        const { getOrdersForDosificador } = await import('@/lib/supabase/orders');
        // Reset pagination state on initial load
        setDosificadorOffset(0);
        const result = await getOrdersForDosificador(100, 0);
        const data = result.data;
        setDosificadorHasMore(result.hasMore);

        // Transform DOSIFICADOR data structure to match OrderWithClient
        const transformedData = (data || []).map((order: any) => ({
          ...order,
          site_access_rating: order.site_access_rating,
          order_site_validations: order.order_site_validations,
          // Ensure products field exists for compatibility
          products: order.order_items || []
        }));

        const { supabase } = await import('@/lib/supabase/client');

        // Compute volumes/prices consistently for DOSIFICADOR
        const processedDataBase = (transformedData || []).map((order: any) => {
          const orderItems = order.order_items || [];
          let concreteVolumePlanned = 0;
          let concreteVolumeDelivered = 0;
          let pumpVolumePlanned = 0;
          let pumpVolumeDelivered = 0;
          let hasPumpService = false;
          let hasDeliveredConcrete = false;
          let concreteUnitPrice: number | undefined = undefined;
          let pumpUnitPrice: number | undefined = undefined;

          if (orderItems.length > 0) {
            orderItems.forEach((item: any) => {
              const productType = (item.product_type || '').toString();
              const volume = Number(item.volume) || 0;
              const pumpVolumeItem = Number(item.pump_volume) || 0;
              const pumpDelivered = Number(item.pump_volume_delivered) || 0;
              const concreteDelivered = Number(item.concrete_volume_delivered) || 0;
              const unitPrice = item.unit_price != null ? Number(item.unit_price) : undefined;
              const pumpPrice = item.pump_price != null ? Number(item.pump_price) : undefined;

              const isEmptyTruckCharge = item.has_empty_truck_charge ||
                productType === 'VACÍO DE OLLA' ||
                productType === 'EMPTY_TRUCK_CHARGE';
              const isPumpService = productType === 'SERVICIO DE BOMBEO' ||
                productType.toLowerCase().includes('bombeo') ||
                productType.toLowerCase().includes('pump');
              const isAdditionalProduct = productType?.startsWith('PRODUCTO ADICIONAL:');

              if (!isEmptyTruckCharge && !isPumpService && !isAdditionalProduct) {
                concreteVolumePlanned += volume;
                if (concreteDelivered > 0) {
                  concreteVolumeDelivered += concreteDelivered;
                }
                if (concreteUnitPrice === undefined && unitPrice != null && unitPrice > 0) {
                  concreteUnitPrice = unitPrice;
                }
              }

              if (item.has_pump_service || isPumpService) {
                if (pumpVolumeItem > 0) {
                  pumpVolumePlanned += pumpVolumeItem;
                } else if (isPumpService && volume > 0) {
                  pumpVolumePlanned += volume;
                }
                hasPumpService = true;
                if (pumpDelivered > 0) {
                  pumpVolumeDelivered += pumpDelivered;
                }
                // For pump service, prioritize pump_price field specifically
                // Only use unit_price as fallback if pump_price is explicitly null/undefined
                if (pumpUnitPrice === undefined) {
                  if (pumpPrice != null && pumpPrice > 0) {
                    pumpUnitPrice = pumpPrice;
                  } else if (isPumpService && unitPrice != null && unitPrice > 0) {
                    // Only fallback to unit_price for standalone pump service items
                    pumpUnitPrice = unitPrice;
                  }
                }
              }
            });
          }

          hasDeliveredConcrete = (concreteVolumeDelivered > 0) || (pumpVolumeDelivered > 0);

          return {
            ...order,
            concreteVolumePlanned: concreteVolumePlanned > 0 ? concreteVolumePlanned : undefined,
            concreteVolumeDelivered: concreteVolumeDelivered > 0 ? concreteVolumeDelivered : undefined,
            pumpVolumePlanned: pumpVolumePlanned > 0 ? pumpVolumePlanned : undefined,
            pumpVolumeDelivered: pumpVolumeDelivered > 0 ? pumpVolumeDelivered : undefined,
            concreteUnitPrice,
            pumpUnitPrice,
            hasPumpService,
            hasDeliveredConcrete
          };
        });

        // Attach creator profiles for initials
        let processedData = processedDataBase;
        try {
          const creatorIds = Array.from(new Set((transformedData || []).map((o: any) => o.created_by).filter(Boolean)));
          if (creatorIds.length > 0) {
            const { data: creators } = await supabase
              .from('user_profiles')
              .select('id, first_name, last_name, email')
              .in('id', creatorIds);
            const map = new Map<string, any>();
            (creators || []).forEach((u: any) => map.set(u.id, u));
            processedData = processedDataBase.map((o: any) => ({
              ...o,
              creator: o.created_by ? map.get(o.created_by) : undefined
            }));
          }
        } catch (_e) {}

        setOrders(processedData);
      } else {
        const { supabase } = await import('@/lib/supabase/client');
        let query = supabase
          .from('orders')
          .select(`
            id,
            order_number,
            quote_id,
            requires_invoice,
            delivery_date,
            delivery_time,
            construction_site,
            delivery_latitude,
            delivery_longitude,
            delivery_google_maps_url,
            special_requirements,
            preliminary_amount,
            final_amount,
            site_access_rating,
            created_by,
            credit_status,
            order_status,
            created_at,
            clients (
              id,
              business_name,
              client_code,
              contact_name,
              phone
            ),
            order_site_validations (
              road_type,
              road_slope,
              recent_weather_impact,
              route_incident_history
            ),
            order_items (
              id,
              product_type,
              volume,
              concrete_volume_delivered,
              has_pump_service,
              pump_volume,
              pump_volume_delivered,
              has_empty_truck_charge,
              empty_truck_volume,
              unit_price,
              pump_price,
              master_recipe_id,
              recipe_id,
              master_recipes:master_recipe_id(
                master_code
              ),
              recipes:recipe_id(
                recipe_code
              )
            )
          `)
          .eq('plant_id', currentPlant.id);

        // Apply status filters
        if (statusFilter || filterStatus) {
          query = query.eq('order_status', statusFilter || filterStatus);
        }
        
        if (creditStatusFilter) {
          query = query.eq('credit_status', creditStatusFilter);
        }

        // Apply limit if provided
        if (maxItems) {
          query = query.limit(maxItems);
        }

        // Sort by created_at in descending order
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;
        
        if (error) throw error;
        
        // Process the data to calculate volumes using the correct logic
        const processedDataBase = (data || []).map(order => {
          const orderItems = order.order_items || [];
          let concreteVolumePlanned = 0;
          let concreteVolumeDelivered = 0;
          let pumpVolumePlanned = 0;
          let pumpVolumeDelivered = 0;
          let hasPumpService = false;
          let hasDeliveredConcrete = false;
          let concreteUnitPrice: number | undefined = undefined;
          let pumpUnitPrice: number | undefined = undefined;

          // Only calculate volumes if there are items
          if (orderItems.length > 0) {
            orderItems.forEach((item: any) => {
              const productType = (item.product_type || '').toString();
              const volume = Number(item.volume) || 0;
              const pumpVolumeItem = Number(item.pump_volume) || 0;
              const pumpDelivered = Number(item.pump_volume_delivered) || 0;
              const concreteDelivered = Number(item.concrete_volume_delivered) || 0;
              const unitPrice = item.unit_price != null ? Number(item.unit_price) : undefined;
              const pumpPrice = item.pump_price != null ? Number(item.pump_price) : undefined;

              // Determine if this item is an empty truck charge
              const isEmptyTruckCharge = item.has_empty_truck_charge ||
                                        productType === 'VACÍO DE OLLA' ||
                                        productType === 'EMPTY_TRUCK_CHARGE';

              // Determine if this item is a pump service
              const isPumpService = productType === 'SERVICIO DE BOMBEO' ||
                                   productType.toLowerCase().includes('bombeo') ||
                                   productType.toLowerCase().includes('pump');

              // Calculate concrete volume (exclude empty truck charges and pump services)
              if (!isEmptyTruckCharge && !isPumpService) {
                concreteVolumePlanned += volume;
                // Sum delivered concrete volume
                if (concreteDelivered > 0) {
                  concreteVolumeDelivered += concreteDelivered;
                }
                // Capture first valid concrete unit price
                if (concreteUnitPrice === undefined && unitPrice != null && unitPrice > 0) {
                  concreteUnitPrice = unitPrice;
                }
              }

              // Calculate pump volume
              if (item.has_pump_service || isPumpService) {
                if (pumpVolumeItem > 0) {
                  pumpVolumePlanned += pumpVolumeItem;
                } else if (isPumpService && volume > 0) {
                  pumpVolumePlanned += volume;
                }
                hasPumpService = true;
                // Sum delivered pump volume from pump_volume_delivered
                if (pumpDelivered > 0) {
                  pumpVolumeDelivered += pumpDelivered;
                }
                // For pump service, prioritize pump_price field specifically
                // Only use unit_price as fallback if pump_price is explicitly null/undefined
                if (pumpUnitPrice === undefined) {
                  if (pumpPrice != null && pumpPrice > 0) {
                    pumpUnitPrice = pumpPrice;
                  } else if (isPumpService && unitPrice != null && unitPrice > 0) {
                    // Only fallback to unit_price for standalone pump service items
                    pumpUnitPrice = unitPrice;
                  }
                }
              }
            });
          }

          // Determine delivered based on summed delivered volumes
          hasDeliveredConcrete = (concreteVolumeDelivered > 0) || (pumpVolumeDelivered > 0);

          return {
            ...order,
            concreteVolumePlanned: concreteVolumePlanned > 0 ? concreteVolumePlanned : undefined,
            concreteVolumeDelivered: concreteVolumeDelivered > 0 ? concreteVolumeDelivered : undefined,
            pumpVolumePlanned: pumpVolumePlanned > 0 ? pumpVolumePlanned : undefined,
            pumpVolumeDelivered: pumpVolumeDelivered > 0 ? pumpVolumeDelivered : undefined,
            concreteUnitPrice,
            pumpUnitPrice,
            hasPumpService,
            hasDeliveredConcrete
          };
        });

        // Attach creator profiles (fetch separately due to missing FK relationship)
        let processedData = processedDataBase;
        try {
          const creatorIds = Array.from(new Set((data || []).map((o: any) => o.created_by).filter(Boolean)));
          if (creatorIds.length > 0) {
            const { data: creators } = await supabase
              .from('user_profiles')
              .select('id, first_name, last_name, email')
              .in('id', creatorIds);
            const map = new Map<string, any>();
            (creators || []).forEach((u: any) => map.set(u.id, u));
            processedData = processedDataBase.map((o: any) => ({
              ...o,
              creator: o.created_by ? map.get(o.created_by) : undefined
            }));
          }
        } catch (_e) {
          // If fetching profiles fails, continue without creator info
        }

        setOrders(processedData);
      }
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Error al cargar los pedidos. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [currentPlant?.id, isDosificador, statusFilter, filterStatus, creditStatusFilter, maxItems]);

  // Function to load more orders for dosificadores
  const loadMoreOrders = useCallback(async () => {
    if (!isDosificador || !dosificadorHasMore || loadingMore) return;
    
    setLoadingMore(true);
    setError(null);

    try {
      const { getOrdersForDosificador } = await import('@/lib/supabase/orders');
      const nextOffset = dosificadorOffset + 100;
      const result = await getOrdersForDosificador(100, nextOffset);
      const data = result.data;
      setDosificadorHasMore(result.hasMore);
      setDosificadorOffset(nextOffset);

      // Transform DOSIFICADOR data structure to match OrderWithClient
      const transformedData = (data || []).map((order: any) => ({
        ...order,
        site_access_rating: order.site_access_rating,
        order_site_validations: order.order_site_validations,
        products: order.order_items || []
      }));

      const { supabase } = await import('@/lib/supabase/client');

      // Compute volumes/prices consistently for DOSIFICADOR
      const processedDataBase = (transformedData || []).map((order: any) => {
        const orderItems = order.order_items || [];
        let concreteVolumePlanned = 0;
        let concreteVolumeDelivered = 0;
        let pumpVolumePlanned = 0;
        let pumpVolumeDelivered = 0;
        let hasPumpService = false;
        let hasDeliveredConcrete = false;
        let concreteUnitPrice: number | undefined = undefined;
        let pumpUnitPrice: number | undefined = undefined;

        if (orderItems.length > 0) {
          orderItems.forEach((item: any) => {
            const productType = (item.product_type || '').toString();
            const volume = Number(item.volume) || 0;
            const pumpVolumeItem = Number(item.pump_volume) || 0;
            const pumpDelivered = Number(item.pump_volume_delivered) || 0;
            const concreteDelivered = Number(item.concrete_volume_delivered) || 0;
            const unitPrice = item.unit_price != null ? Number(item.unit_price) : undefined;
            const pumpPrice = item.pump_price != null ? Number(item.pump_price) : undefined;

              const isEmptyTruckCharge = item.has_empty_truck_charge ||
                productType === 'VACÍO DE OLLA' ||
                productType === 'EMPTY_TRUCK_CHARGE';
              const isPumpService = productType === 'SERVICIO DE BOMBEO' ||
                productType.toLowerCase().includes('bombeo') ||
                productType.toLowerCase().includes('pump');
              const isAdditionalProduct = productType?.startsWith('PRODUCTO ADICIONAL:');

              if (!isEmptyTruckCharge && !isPumpService && !isAdditionalProduct) {
              concreteVolumePlanned += volume;
              if (concreteDelivered > 0) {
                concreteVolumeDelivered += concreteDelivered;
              }
              if (concreteUnitPrice === undefined && unitPrice != null && unitPrice > 0) {
                concreteUnitPrice = unitPrice;
              }
            }

            if (item.has_pump_service || isPumpService) {
              if (pumpVolumeItem > 0) {
                pumpVolumePlanned += pumpVolumeItem;
              } else if (isPumpService && volume > 0) {
                pumpVolumePlanned += volume;
              }
              hasPumpService = true;
              if (pumpDelivered > 0) {
                pumpVolumeDelivered += pumpDelivered;
              }
              // For pump service, prioritize pump_price field specifically
              // Only use unit_price as fallback if pump_price is explicitly null/undefined
              if (pumpUnitPrice === undefined) {
                if (pumpPrice != null && pumpPrice > 0) {
                  pumpUnitPrice = pumpPrice;
                } else if (isPumpService && unitPrice != null && unitPrice > 0) {
                  // Only fallback to unit_price for standalone pump service items
                  pumpUnitPrice = unitPrice;
                }
              }
            }
          });
        }

        hasDeliveredConcrete = (concreteVolumeDelivered > 0) || (pumpVolumeDelivered > 0);

        return {
          ...order,
          concreteVolumePlanned: concreteVolumePlanned > 0 ? concreteVolumePlanned : undefined,
          concreteVolumeDelivered: concreteVolumeDelivered > 0 ? concreteVolumeDelivered : undefined,
          pumpVolumePlanned: pumpVolumePlanned > 0 ? pumpVolumePlanned : undefined,
          pumpVolumeDelivered: pumpVolumeDelivered > 0 ? pumpVolumeDelivered : undefined,
          concreteUnitPrice,
          pumpUnitPrice,
          hasPumpService,
          hasDeliveredConcrete
        };
      });

      // Attach creator profiles for initials
      let processedData = processedDataBase;
      try {
        const creatorIds = Array.from(new Set((transformedData || []).map((o: any) => o.created_by).filter(Boolean)));
        if (creatorIds.length > 0) {
          const { data: creators } = await supabase
            .from('user_profiles')
            .select('id, first_name, last_name, email')
            .in('id', creatorIds);
          const map = new Map<string, any>();
          (creators || []).forEach((u: any) => map.set(u.id, u));
          processedData = processedDataBase.map((o: any) => ({
            ...o,
            creator: o.created_by ? map.get(o.created_by) : undefined
          }));
        }
      } catch (_e) {}

      // Append new orders to existing ones
      setOrders(prevOrders => [...prevOrders, ...processedData]);
    } catch (err) {
      console.error('Error loading more orders:', err);
      setError('Error al cargar más pedidos. Por favor, intente nuevamente.');
    } finally {
      setLoadingMore(false);
    }
  }, [isDosificador, dosificadorOffset, dosificadorHasMore, loadingMore]);

  // Load orders when component mounts or when dependencies change
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Extract unique creators from orders
  const availableCreators = useMemo(() => {
    const creatorMap = new Map<string, { id: string; name: string; email: string }>();
    
    orders.forEach(order => {
      // Check both created_by (ID) and creator (profile object)
      const creatorId = (order as any).created_by;
      const creator = (order as any).creator;
      
      if (creatorId) {
        // If we have creator profile, use it; otherwise use created_by ID
        if (creator && creator.id) {
          const firstName = (creator.first_name || '').trim();
          const lastName = (creator.last_name || '').trim();
          const email = (creator.email || '').trim();
          const name = `${firstName} ${lastName}`.trim() || email || 'Usuario sin nombre';
          
          if (!creatorMap.has(creator.id)) {
            creatorMap.set(creator.id, {
              id: creator.id,
              name,
              email
            });
          }
        } else if (!creatorMap.has(creatorId)) {
          // Fallback: use ID if profile not available
          creatorMap.set(creatorId, {
            id: creatorId,
            name: `Usuario ${creatorId.substring(0, 8)}`,
            email: ''
          });
        }
      }
    });
    
    return Array.from(creatorMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  // Función para aplicar filtros a los datos
  const applyFilters = useCallback(() => {
    if (orders.length === 0) return;
    
    let result = [...orders];
    
    // Búsqueda unificada (combina búsqueda global y búsqueda por cliente)
    if (searchQuery) {
      const searchTerm = (searchQuery || '').toLowerCase();
      result = result.filter(order => {
        // Buscar en número de orden
        if ((order.order_number || '').toLowerCase().includes(searchTerm)) return true;
        
        // Buscar en nombre y código de cliente
        const clientName = (order.clients?.business_name || '').toLowerCase();
        const clientCode = (order.clients?.client_code || '').toLowerCase();
        if (clientName.includes(searchTerm) || clientCode.includes(searchTerm)) return true;
        
        // Buscar en sitio de construcción
        if ((order.construction_site || '').toLowerCase().includes(searchTerm)) return true;
        
        // Buscar en estado de orden
        const orderStatus = (translateStatus(order.order_status) || '').toLowerCase();
        if (orderStatus.includes(searchTerm)) return true;
        
        // Buscar en estado de crédito
        const creditStatus = (translateCreditStatus(order.credit_status) || '').toLowerCase();
        if (creditStatus.includes(searchTerm)) return true;
        
        // Buscar en fecha de entrega
        const deliveryDate = (formatDate(order.delivery_date) || '').toLowerCase();
        if (deliveryDate.includes(searchTerm)) return true;
        
        // Buscar en hora de entrega
        if ((order.delivery_time || '').toLowerCase().includes(searchTerm)) return true;
        
        // Buscar en requisitos especiales
        if ((order.special_requirements || '').toLowerCase().includes(searchTerm)) return true;
        
        return false;
      });
    }
    
    // Filtrar por creador
    if (creatorFilter !== 'all') {
      result = result.filter(order => {
        const creatorId = (order as any).created_by;
        const creator = (order as any).creator;
        // Match by created_by ID (primary) or creator.id (if available)
        return creatorId === creatorFilter || (creator && creator.id === creatorFilter);
      });
    }
    
    // Filtrar por estado de entrega
    if (deliveredFilter !== 'all') {
      result = result.filter(order => {
        const isDelivered = !!(order as any).hasDeliveredConcrete;
        if (deliveredFilter === 'delivered') return isDelivered;
        if (deliveredFilter === 'pending') return !isDelivered;
        return true;
      });
    }
    
    setFilteredOrders(result);
  }, [orders, searchQuery, deliveredFilter, creatorFilter]);

  // Función para agrupar las órdenes por fecha
  const groupOrdersByDate = useCallback(() => {
    if (filteredOrders.length === 0) {
      setGroupedOrders({});
      return;
    }
    
    // Preparar fechas de referencia
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Objeto para agrupar las órdenes
    const grouped: GroupedOrders = {};
    
    // Grupos prioritarios
    const priorityGroups = {
      'mañana': {
        date: 'mañana',
        formattedDate: 'Mañana',
        orders: [] as OrderWithClient[],
        isExpanded: true,
        priority: 1
      },
      'hoy': {
        date: 'hoy',
        formattedDate: 'Hoy',
        orders: [] as OrderWithClient[],
        isExpanded: true,
        priority: 2
      },
      'ayer': {
        date: 'ayer',
        formattedDate: 'Ayer',
        orders: [] as OrderWithClient[],
        isExpanded: true,
        priority: 3
      },
      'anteayer': {
        date: 'anteayer',
        formattedDate: 'Anteayer',
        orders: [] as OrderWithClient[],
        isExpanded: true,
        priority: 4
      }
    };

    // Clasificar cada orden en su grupo correspondiente
    filteredOrders.forEach(order => {
      if (!order.delivery_date) return;
      
      // Convertir formato YYYY-MM-DD a un objeto Date de manera segura
      const parts = order.delivery_date.split('-');
      if (parts.length !== 3) return; // Si no tiene el formato esperado, saltar
      
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Los meses en JS van de 0-11
      const day = parseInt(parts[2], 10);
      
      const orderDate = new Date(year, month, day);
      orderDate.setHours(0, 0, 0, 0);
      
      // Determinar a qué grupo pertenece
      if (orderDate.getTime() === yesterday.getTime()) {
        priorityGroups['ayer'].orders.push(order);
      } else if (orderDate.getTime() === dayBeforeYesterday.getTime()) {
        priorityGroups['anteayer'].orders.push(order);
      } else if (orderDate.getTime() === today.getTime()) {
        priorityGroups['hoy'].orders.push(order);
      } else if (orderDate.getTime() === tomorrow.getTime()) {
        priorityGroups['mañana'].orders.push(order);
      } else {
        // Agrupar por fecha específica para el resto de órdenes
        const dateKey = format(orderDate, 'yyyy-MM-dd');
        const formattedDateString = format(orderDate, 'EEEE d MMMM', { locale: es });
        const capitalizedDate = formattedDateString.charAt(0).toUpperCase() + formattedDateString.slice(1);
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = {
            date: dateKey,
            formattedDate: capitalizedDate,
            orders: [],
            isExpanded: false
          };
        }
        
        grouped[dateKey].orders.push(order);
      }
    });
    
    // Ordenar órdenes dentro de cada grupo por hora de entrega
    Object.values(priorityGroups).forEach(group => {
      group.orders.sort((a, b) => {
        if (!a.delivery_time || !b.delivery_time) return 0;
        return a.delivery_time.localeCompare(b.delivery_time);
      });
    });
    
    // Ordenar órdenes dentro de los grupos específicos por día
    Object.values(grouped).forEach(group => {
      group.orders.sort((a, b) => {
        if (!a.delivery_time || !b.delivery_time) return 0;
        return a.delivery_time.localeCompare(b.delivery_time);
      });
    });
    
    // Agregar solo los grupos prioritarios que tienen órdenes
    Object.entries(priorityGroups).forEach(([key, group]) => {
      if (group.orders.length > 0) {
        grouped[key] = group;
      }
    });
    
    // Ordenar el objeto agrupado según prioridad
    const orderedGroups = Object.entries(grouped)
      .sort(([keyA, groupA], [keyB, groupB]) => {
        // Primero por prioridad (si existe)
        if (groupA.priority && groupB.priority) {
          return groupA.priority - groupB.priority;
        }
        if (groupA.priority) return -1;
        if (groupB.priority) return 1;
        
        // Luego por fecha para los grupos no prioritarios (orden descendente - más reciente primero)
        return keyB.localeCompare(keyA);
      })
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as GroupedOrders);
    
    setGroupedOrders(orderedGroups);
  }, [filteredOrders]);
  
  // Aplicar filtros cuando cambia cualquier filtro o los datos
  useEffect(() => {
    applyFilters();
  }, [applyFilters, orders, searchQuery, deliveredFilter, creatorFilter]);
  
  // Agrupar los datos cuando cambian los datos filtrados
  useEffect(() => {
    groupOrdersByDate();
  }, [groupOrdersByDate, filteredOrders]);

  // Actualizar el filtro de cliente cuando cambia el prop
  useEffect(() => {
    if (clientFilter !== undefined) {
      setSearchQuery(clientFilter);
    }
  }, [clientFilter]);

  // Handlers de eventos
  function handleOrderClick(id: string) {
    if (onOrderClick) {
      onOrderClick(id);
    } else {
      router.push(`/orders/${id}`);
    }
  }

  function handleCreateOrderClick() {
    if (onCreateOrder) {
      onCreateOrder('');
    }
  }

  function toggleGroupExpand(groupKey: string) {
    setGroupedOrders(prev => {
      const updated = { ...prev };
      if (updated[groupKey]) {
        updated[groupKey] = {
          ...updated[groupKey],
          isExpanded: !updated[groupKey].isExpanded
        };
      }
      return updated;
    });
  }

  function handleSearchQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchQuery(e.target.value);
  }

  function handleSearchQuerySubmit(e: React.FormEvent) {
    e.preventDefault();
    // Los filtros se aplican automáticamente
  }

  function handleDeliveredFilterChange(value: DeliveredFilter) {
    setDeliveredFilter(value);
  }

  // Indicador de carga
  if (loading && orders.length === 0) {
    return <div className="flex justify-center p-4">Cargando órdenes...</div>;
  }

  // Special message for DOSIFICADOR role
  const DosificadorInfo = () => {
    if (isDosificador) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-blue-800">Bienvenido, Dosificador</h3>
          <p className="text-blue-600">
            Aquí puedes ver los pedidos programados. Utiliza las pestañas para cambiar entre vista de lista y calendario.
          </p>
        </div>
      );
    }
    return null;
  };

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Add DOSIFICADOR info message */}
      <DosificadorInfo />
      
      {/* Loading indicator for refresh */}
      {loading && orders.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-center">
          <svg className="animate-spin h-4 w-4 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-blue-700 text-sm">Actualizando órdenes...</span>
        </div>
      )}
      
      {/* Filtros */}
      <div className="bg-white rounded-lg overflow-hidden shadow-sm p-4 border border-gray-200">
        {/* Búsqueda unificada */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Buscar órdenes:</h3>
          <form onSubmit={handleSearchQuerySubmit} className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[300px]">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchQueryChange}
                placeholder="Buscar por número de orden, cliente, sitio, estado, fecha, hora..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Buscar
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Limpiar
              </button>
            )}
          </form>
        </div>

        {/* Filtros específicos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Filtrar por creador:</h3>
            <select
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">Todos los creadores</option>
              {availableCreators.map(creator => (
                <option key={creator.id} value={creator.id}>
                  {creator.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Filtrar por entrega:</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleDeliveredFilterChange('all')}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  deliveredFilter === 'all' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                    : 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => handleDeliveredFilterChange('delivered')}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  deliveredFilter === 'delivered' 
                    ? 'bg-green-100 text-green-800 border border-green-300' 
                    : 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                Entregados
              </button>
              <button
                type="button"
                onClick={() => handleDeliveredFilterChange('pending')}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  deliveredFilter === 'pending' 
                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
                    : 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                Pendientes
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Contador de resultados con información de filtro */}
      {!loading && (
        <div className="text-sm text-gray-600 px-1">
          {filteredOrders.length} {filteredOrders.length === 1 ? 'orden' : 'órdenes'} {
            deliveredFilter === 'delivered' 
              ? 'entregadas' 
              : deliveredFilter === 'pending' 
                ? 'pendientes de entrega' 
                : ''
          } {
            creatorFilter !== 'all' 
              ? `creadas por ${availableCreators.find(c => c.id === creatorFilter)?.name || 'usuario seleccionado'}` 
              : ''
          } {searchQuery ? `que coinciden con "${searchQuery}"` : ''}
        </div>
      )}
      
      {filteredOrders.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-gray-400 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No se encontraron pedidos</h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchQuery ? 
              `No hay pedidos que coincidan con "${searchQuery}".` :
              creatorFilter !== 'all' ?
                `No hay pedidos creados por ${availableCreators.find(c => c.id === creatorFilter)?.name || 'el usuario seleccionado'}.` :
              deliveredFilter !== 'all' ? 
                deliveredFilter === 'delivered' ? 
                  'No hay pedidos entregados' : 
                  'No hay pedidos pendientes de entrega' :
                filterStatus ? 
                  `No hay pedidos con el estado "${filterStatus}".` :
                  'No hay pedidos disponibles en este momento.'
            }
          </p>
          {!isDosificador && onCreateOrder && (
            <button
              onClick={handleCreateOrderClick}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Crear Pedido
            </button>
          )}
        </div>
      ) : (
        <>
          {Object.keys(groupedOrders).map(groupKey => {
            const group = groupedOrders[groupKey];
            const isPriorityGroup = ['mañana', 'hoy', 'ayer', 'anteayer'].includes(groupKey);
            const headerClass = isPriorityGroup 
              ? "bg-gray-50 px-4 py-3 border-b border-gray-200 font-bold text-lg" 
              : "bg-gray-50 px-4 py-3 border-b border-gray-200";
              
            return (
              <motion.div
                key={groupKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-thick rounded-2xl overflow-hidden shadow-lg mb-6"
              >
                <motion.div
                  className={cn(
                    'glass-thin rounded-t-2xl px-6 py-4 flex justify-between items-center cursor-pointer',
                    isPriorityGroup && 'bg-systemBlue/20'
                  )}
                  onClick={() => toggleGroupExpand(groupKey)}
                  whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                >
                  <h3 className={cn(
                    'font-bold text-gray-900 dark:text-gray-100',
                    isPriorityGroup ? 'text-xl uppercase tracking-wide' : 'text-lg'
                  )}>
                    {group.formattedDate}
                    <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({group.orders.length})
                    </span>
                  </h3>
                  <motion.button
                    className="focus:outline-none"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {group.isExpanded ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </motion.button>
                </motion.div>
                <AnimatePresence>
                  {group.isExpanded && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6 p-4"
                    >
                      {group.orders.map((order) => (
                        <OrderCard2
                          key={`orders-list-${order.id}`}
                          order={order}
                          onClick={() => handleOrderClick(order.id)}
                          groupKey={groupKey}
                          isDosificador={isDosificador}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          
          {/* Load more button for dosificadores */}
          {isDosificador && dosificadorHasMore && (
            <div className="text-center mt-6">
              <button
                onClick={loadMoreOrders}
                disabled={loadingMore}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loadingMore ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cargando...
                  </>
                ) : (
                  <>
                    Cargar más pedidos
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          )}
          
          {maxItems && filteredOrders.length >= maxItems && (
            <div className="text-center mt-4">
              <Link href="/orders">
                <span className="inline-flex items-center text-blue-600 hover:text-blue-800 cursor-pointer">
                  Ver todos los pedidos
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
} 