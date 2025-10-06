'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Container } from '@/components/ui/Container';
import { OrderCard } from '@/components/ui/OrderCard';
import { FilterChip } from '@/components/ui/FilterChip';
import { Input } from '@/components/ui/input';
import { Card as BaseCard } from '@/components/ui/Card';

interface Order {
  id: string;
  order_number: string;
  construction_site: string;
  delivery_date: string;
  order_status: string;
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
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

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

        const response = await fetch(`/api/client-portal/orders?${params}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch orders');
        }

        setOrders(result.orders || []);
        setFilteredOrders(result.orders || []);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [activeFilter, searchQuery]);

  // The filtering is now handled by the API, so we just use the orders data directly
  useEffect(() => {
    // No additional filtering needed since API handles it
    setFilteredOrders(orders);
  }, [orders]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-primary">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-label-tertiary border-t-transparent rounded-full"
        />
      </div>
    );
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

          {/* Filter Chips */}
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
        </motion.div>

        {/* Orders Grid */}
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
          ) : (
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