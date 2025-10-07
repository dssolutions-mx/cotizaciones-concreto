'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, Package, MapPin, Calendar as CalendarIcon, Layers } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { OrderCard } from '@/components/ui/OrderCard';
import { FilterChip } from '@/components/ui/FilterChip';
import { Input } from '@/components/ui/input';
import { Card as BaseCard } from '@/components/ui/Card';
import ClientPortalLoader from '@/components/client-portal/ClientPortalLoader';
import DateRangeFilter from '@/components/client-portal/DateRangeFilter';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface Order {
  id: string;
  order_number: string;
  construction_site: string;
  delivery_date: string;
  order_status: string;
  elemento?: string;
  total_volume?: number;
}

const statusFilters = [
  { key: 'all', label: 'Todos' },
  { key: 'approved', label: 'Aprobados' },
  { key: 'in_progress', label: 'En Progreso' },
  { key: 'completed', label: 'Completados' }
];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [groupBySite, setGroupBySite] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date())
  });

  // Helper to format date without timezone conversion
  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    async function fetchOrders() {
      try {
        const params = new URLSearchParams();
        if (activeFilter !== 'all') {
          params.set('status', activeFilter);
        }
        if (searchQuery) {
          params.set('search', searchQuery);
        }
        params.set('from', formatDateForAPI(dateRange.from));
        params.set('to', formatDateForAPI(dateRange.to));

        const response = await fetch(`/api/client-portal/orders?${params}`);
        const result = await response.json();

        if (!response.ok) {
          console.error('Orders API error:', result);
          throw new Error(result.error || 'Failed to fetch orders');
        }

        console.log('Orders data received:', result);

        setOrders(result.orders || []);
        setFilteredOrders(result.orders || []);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [activeFilter, searchQuery, dateRange]);

  // Group orders by construction site if needed
  const groupedOrders = groupBySite
    ? orders.reduce((acc, order) => {
        const site = order.construction_site || 'Sin Obra';
        if (!acc[site]) {
          acc[site] = [];
        }
        acc[site].push(order);
        return acc;
      }, {} as Record<string, Order[]>)
    : null;

  useEffect(() => {
    setFilteredOrders(orders);
  }, [orders]);

  if (loading) {
    return <ClientPortalLoader message="Cargando pedidos..." />;
  }

  return (
    <div className="min-h-screen bg-background-primary">
      <Container maxWidth="2xl" className="py-8">
        {/* Header - iOS 26 Typography */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl glass-thick flex items-center justify-center border border-white/30">
              <Package className="w-6 h-6 text-label-primary" />
            </div>
            <div>
              <h1 className="text-large-title font-bold text-label-primary">
                Mis Pedidos
              </h1>
              <p className="text-body text-label-secondary">
                {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Search and Filters - Refined Glass Effects */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 space-y-6"
        >
          {/* Search Bar */}
          <div className="glass-base rounded-3xl p-6">
            <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-label-tertiary" />
              <Input
                type="text"
                placeholder="Buscar por número de pedido u obra..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-14 w-full text-body placeholder:text-label-tertiary"
              />
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Status Filter Chips */}
            <div className="flex items-center gap-4 overflow-x-auto pb-2">
              <SlidersHorizontal className="w-5 h-5 text-label-tertiary flex-shrink-0" />
              {statusFilters.map((filter) => (
                <FilterChip
                  key={filter.key}
                  label={filter.label}
                  active={activeFilter === filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                />
              ))}
            </div>

            {/* Additional Filters */}
            <div className="flex items-center gap-3">
              {/* Date Filter Button */}
              <button
                onClick={() => setShowDateFilter(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl glass-thin hover:glass-interactive text-callout text-label-secondary hover:text-label-primary transition-all"
              >
                <CalendarIcon className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {format(dateRange.from, 'dd MMM', { locale: es })} - {format(dateRange.to, 'dd MMM', { locale: es })}
                </span>
              </button>

              {/* Group by Site Toggle */}
              <button
                onClick={() => setGroupBySite(!groupBySite)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-callout font-medium transition-all ${
                  groupBySite
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'glass-thin text-label-secondary hover:glass-interactive hover:text-label-primary'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">Agrupar</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Date Range Filter Modal */}
        <AnimatePresence>
          {showDateFilter && (
            <DateRangeFilter
              dateRange={dateRange}
              onApply={(newRange) => {
                setDateRange(newRange);
                setShowDateFilter(false);
              }}
              onCancel={() => setShowDateFilter(false)}
            />
          )}
        </AnimatePresence>

        {/* Orders Display - Grid or Grouped */}
        <AnimatePresence mode="wait">
          {filteredOrders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-16"
            >
              <div className="glass-base rounded-3xl p-12">
                <Package className="w-16 h-16 text-label-tertiary mx-auto mb-6" />
                <h3 className="text-title-2 font-bold text-label-primary mb-3">
                  No se encontraron pedidos
                </h3>
                <p className="text-body text-label-secondary">
                  {searchQuery || activeFilter !== 'all'
                    ? 'Intenta ajustar los filtros de búsqueda'
                    : 'Aún no tienes pedidos registrados'}
                </p>
              </div>
            </motion.div>
          ) : groupBySite && groupedOrders ? (
            /* Grouped by Construction Site */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {Object.entries(groupedOrders).map(([site, siteOrders], groupIndex) => (
                <motion.div
                  key={site}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIndex * 0.1 }}
                  className="space-y-4"
                >
                  {/* Site Header */}
                  <div className="flex items-center gap-3 px-2">
                    <div className="p-2 rounded-xl glass-thin">
                      <MapPin className="w-5 h-5 text-systemBlue" />
                    </div>
                    <div>
                      <h3 className="text-title-3 font-bold text-label-primary">
                        {site}
                      </h3>
                      <p className="text-footnote text-label-secondary">
                        {siteOrders.length} pedido{siteOrders.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Site Orders Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-4">
                    {siteOrders.map((order, index) => (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <OrderCard
                          order={order}
                          onClick={() => router.push(`/client-portal/orders/${order.id}`)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            /* Standard Grid View */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {filteredOrders.map((order, index) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <OrderCard
                    order={order}
                    onClick={() => router.push(`/client-portal/orders/${order.id}`)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </div>
  );
}