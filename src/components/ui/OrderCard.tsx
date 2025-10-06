'use client';

import { motion } from 'framer-motion';
import { MapPin, Calendar, Package, ChevronRight } from 'lucide-react';
import { Badge } from './badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderCardProps {
  order: {
    id: string;
    order_number: string;
    construction_site: string;
    delivery_date: string;
    order_status: string;
    elemento?: string;
    total_volume?: number;
  };
  onClick: () => void;
}

const statusConfig: Record<string, { variant: any; label: string }> = {
  created: { variant: 'neutral', label: 'Creado' },
  approved: { variant: 'success', label: 'Aprobado' },
  in_progress: { variant: 'primary', label: 'En Progreso' },
  completed: { variant: 'success', label: 'Completado' },
  cancelled: { variant: 'error', label: 'Cancelado' }
};

export function OrderCard({ order, onClick }: OrderCardProps) {
  const config = statusConfig[order.order_status] || statusConfig.created;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="glass-thick rounded-3xl p-6 cursor-pointer hover:glass-interactive transition-all duration-300 relative overflow-hidden group"
    >
      {/* Gradient Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-title-3 font-bold text-gray-900 mb-1">
              Pedido #{order.order_number}
            </h3>
            <Badge variant={config.variant} size="sm">
              {config.label}
            </Badge>
          </div>
          <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
        </div>

        {/* Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-callout text-gray-600">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="truncate">{order.construction_site}</span>
          </div>
          
          <div className="flex items-center gap-2 text-callout text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>
              {format(new Date(order.delivery_date), "d 'de' MMMM, yyyy", { locale: es })}
            </span>
          </div>

          {order.elemento && (
            <div className="flex items-center gap-2 text-callout text-gray-600">
              <Package className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-blue-600">
                {order.elemento}
              </span>
            </div>
          )}

          {order.total_volume && (
            <div className="flex items-center gap-2 text-callout text-gray-600">
              <Package className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-blue-600">
                {order.total_volume} m³
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
