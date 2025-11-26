'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Building2, 
  UserCog, 
  Plus, 
  ArrowRight,
  Activity,
  Shield
} from 'lucide-react';
import { AdminMetricCard } from './AdminMetricCard';
import { authService } from '@/lib/supabase/auth';
import { usePlantContext } from '@/contexts/PlantContext';
import { clientPortalAdminService } from '@/lib/supabase/clientPortalAdmin';
import { motion } from 'framer-motion';

interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalPlants: number;
  activePlants: number;
  totalBusinessUnits: number;
  activeBusinessUnits: number;
  portalUsers: number;
}

export function AdminDashboard() {
  const router = useRouter();
  let plantContext;
  try {
    plantContext = usePlantContext();
  } catch (err) {
    plantContext = null;
  }
  const availablePlants = plantContext?.availablePlants || [];
  const businessUnits = plantContext?.businessUnits || [];
  
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    totalPlants: 0,
    activePlants: 0,
    totalBusinessUnits: 0,
    activeBusinessUnits: 0,
    portalUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (Array.isArray(availablePlants) && Array.isArray(businessUnits)) {
      loadMetrics();
    }
  }, [availablePlants, businessUnits]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      
      // Load users
      const users = await authService.getAllUsers();
      const activeUsers = users?.filter(u => u.is_active !== false) || [];
      const inactiveUsers = users?.filter(u => u.is_active === false) || [];

      // Load portal users
      const portalUsers = await clientPortalAdminService.getAllPortalUsers();

      // Calculate plant metrics with null checks
      const plants = Array.isArray(availablePlants) ? availablePlants : [];
      const units = Array.isArray(businessUnits) ? businessUnits : [];
      const activePlants = plants.filter(p => p?.is_active) || [];
      const activeBusinessUnits = units.filter(bu => bu?.is_active) || [];

      setMetrics({
        totalUsers: users?.length || 0,
        activeUsers: activeUsers.length,
        inactiveUsers: inactiveUsers.length,
        totalPlants: plants.length || 0,
        activePlants: activePlants.length,
        totalBusinessUnits: units.length || 0,
        activeBusinessUnits: activeBusinessUnits.length,
        portalUsers: portalUsers?.length || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'Crear Usuario',
      description: 'Agregar nuevo usuario interno',
      icon: Plus,
      href: '/admin/users/create',
      color: 'blue' as const,
    },
    {
      title: 'Invitar Usuario',
      description: 'Enviar invitación por correo',
      icon: UserCog,
      href: '/admin/users/invite',
      color: 'green' as const,
    },
    {
      title: 'Gestionar Plantas',
      description: 'Ver y editar plantas',
      icon: Building2,
      href: '/admin/plants',
      color: 'orange' as const,
    },
    {
      title: 'Usuarios Portal',
      description: 'Gestionar usuarios del portal',
      icon: Shield,
      href: '/admin/client-portal-users',
      color: 'purple' as const,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Cargando métricas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AdminMetricCard
          title="Usuarios Totales"
          value={metrics.totalUsers}
          subtitle={`${metrics.activeUsers} activos, ${metrics.inactiveUsers} inactivos`}
          icon={Users}
          color="blue"
          delay={0}
          onClick={() => router.push('/admin/users')}
        />
        <AdminMetricCard
          title="Plantas"
          value={metrics.totalPlants}
          subtitle={`${metrics.activePlants} activas`}
          icon={Building2}
          color="green"
          delay={0.1}
          onClick={() => router.push('/admin/plants')}
        />
        <AdminMetricCard
          title="Unidades de Negocio"
          value={metrics.totalBusinessUnits}
          subtitle={`${metrics.activeBusinessUnits} activas`}
          icon={Building2}
          color="orange"
          delay={0.2}
          onClick={() => router.push('/admin/plants')}
        />
        <AdminMetricCard
          title="Usuarios Portal"
          value={metrics.portalUsers}
          subtitle="Usuarios externos"
          icon={Shield}
          color="purple"
          delay={0.3}
          onClick={() => router.push('/admin/client-portal-users')}
        />
      </div>

      {/* Quick Actions */}
      <div className="glass-base rounded-2xl p-6 border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-title-2 text-gray-900 mb-1">Acciones Rápidas</h2>
            <p className="text-body text-gray-600">Accesos directos a funciones comunes</p>
          </div>
          <Activity className="h-6 w-6 text-gray-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                onClick={() => router.push(action.href)}
                className="glass-interactive rounded-xl p-4 text-left border transition-all duration-200 hover:shadow-md hover:-translate-y-1"
              >
                <div className={`inline-flex p-2 rounded-lg mb-3 ${
                  action.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                  action.color === 'green' ? 'bg-green-50 text-green-600' :
                  action.color === 'orange' ? 'bg-orange-50 text-orange-600' :
                  'bg-purple-50 text-purple-600'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{action.title}</h3>
                <p className="text-sm text-gray-600">{action.description}</p>
                <ArrowRight className="h-4 w-4 text-gray-400 mt-2" />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

