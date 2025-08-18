'use client';

import React, { ReactNode, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  FileText, 
  TrendingUp, 
  Users, 
  Beaker, 
  Clock, 
  Bell, 
  ExternalLink,
  DollarSign,
  AlertTriangle,
  Calendar,
  Award,
  BarChart3
} from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';

// Componentes
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

// Add SWR for data fetching with caching
import useSWR from 'swr';

// Interface definitions
interface ChartData {
  name: string;
  value: number;
}

interface Notification {
  id: string | number;
  text: string;
  time: string;
  isNew: boolean;
}

interface ActivityItem {
  id: string | number;
  text: string;
  user: string;
  time: string;
}

interface PendingQuote {
  id: string | number;
  client: string;
  date: string;
  amount: string;
  status: string;
  constructionSite: string;
}

// Enhanced dashboard metrics interface
interface DashboardData {
  metrics: {
    // Core metrics (removed activeRecipes and quality metrics)
    monthlyQuotes: number;
    monthlySales: number;
    activeClients: number;
    
    // Growth metrics
    quoteGrowth: number;
    salesGrowth: number;
    clientGrowth: number;
    
    // Financial metrics
    totalOutstandingBalance: number;
    monthlyRevenue: number;
    pendingCreditOrders: number;
    
    // Operational metrics
    pendingQuotes: number;
    todayOrders: number;
  };
  newNotificationsCount: number;
  lastUpdated: string;
}

// Create a simple fetcher function for SWR
const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }
  return response.json();
};

// Define component prop types
interface MetricsCardProps {
  title: string;
  value: number | string;
  growth?: number;
  icon: ReactNode;
  isLoading: boolean;
  suffix?: string;
  colorScheme?: 'green' | 'blue' | 'yellow' | 'red' | 'purple';
}

// Define component prop types
interface ChartProps {
  isLoading: boolean;
}

// Separate dashboard into smaller components for better performance
const MetricsCard = ({ title, value, growth, icon, isLoading, suffix = '', colorScheme = 'green' }: MetricsCardProps) => {
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { 
        type: 'spring',
        stiffness: 100
      } 
    }
  };

  const colorClasses = {
    green: 'border-green-500 bg-green-50',
    blue: 'border-blue-500 bg-blue-50',
    yellow: 'border-yellow-500 bg-yellow-50',
    red: 'border-red-500 bg-red-50',
    purple: 'border-purple-500 bg-purple-50'
  };

  if (isLoading) {
    return (
      <motion.div 
        className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${colorClasses[colorScheme]}`}
        variants={itemVariants}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </motion.div>
    );
  }

  // Format value for display
  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;
    if (suffix === '$') {
      return `$${val.toLocaleString('es-MX')}`;
    }
    return val.toLocaleString('es-MX');
  };

  return (
    <motion.div 
      className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${colorClasses[colorScheme]} @container`}
      variants={itemVariants}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-500 text-sm @lg:text-base">{title}</p>
          <h3 className="text-2xl font-bold text-gray-800 mt-1 @lg:text-3xl">
            {formatValue(value)}{suffix !== '$' ? suffix : ''}
          </h3>
          {growth !== undefined && (
            <p className={`${growth >= 0 ? 'text-green-500' : 'text-red-500'} text-sm font-medium mt-2 @lg:text-base`}>
              <span>
                {growth >= 0 ? '↑' : '↓'} {Math.abs(growth)}%
              </span> 
              <span className="text-gray-400 ml-1">vs mes anterior</span>
            </p>
          )}
        </div>
        <div className="bg-gray-100 p-3 rounded-full">
          {icon}
        </div>
      </div>
    </motion.div>
  );
};

// Create a separate async API route for dashboard data
// This will allow us to fetch everything in parallel and cache it
const useDashboardData = () => {
  const { currentPlant } = usePlantContext();
  
  const { data, error, isLoading } = useSWR(
    currentPlant?.id ? `/api/dashboard?plant_id=${currentPlant.id}` : '/api/dashboard', 
    fetcher, 
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 1000 * 60 * 5, // Cache for 5 minutes
    }
  );

  return {
    dashboardData: data as DashboardData | undefined,
    isLoading,
    isError: error
  };
};

// Create individual data hooks for each section to allow lazy loading
const useQuotesData = () => {
  const { currentPlant } = usePlantContext();
  
  const { data, error, isLoading } = useSWR(
    currentPlant?.id ? `/api/dashboard/quotes?plant_id=${currentPlant.id}` : '/api/dashboard/quotes', 
    fetcher, 
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 1000 * 60 * 10, // Cache for 10 minutes
    }
  );

  return {
    quotesData: data?.quotesData || [],
    pendingQuotes: data?.pendingQuotes || [],
    isLoading,
    isError: error
  };
};

const useSalesData = () => {
  const { currentPlant } = usePlantContext();
  
  const { data, error, isLoading } = useSWR(
    currentPlant?.id ? `/api/dashboard/sales?plant_id=${currentPlant.id}` : '/api/dashboard/sales', 
    fetcher, 
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 1000 * 60 * 10, // Cache for 10 minutes
    }
  );

  return {
    salesData: data?.salesData || [],
    isLoading,
    isError: error
  };
};

const useRecipeData = () => {
  const { currentPlant } = usePlantContext();
  
  const { data, error, isLoading } = useSWR(
    currentPlant?.id ? `/api/dashboard/recipes?plant_id=${currentPlant.id}` : '/api/dashboard/recipes', 
    fetcher, 
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 1000 * 60 * 10, // Cache for 10 minutes
    }
  );

  return {
    recipeData: data?.recipeData || [],
    isLoading,
    isError: error
  };
};

const useActivityData = () => {
  const { currentPlant } = usePlantContext();
  
  const { data, error, isLoading } = useSWR(
    currentPlant?.id ? `/api/dashboard/activity?plant_id=${currentPlant.id}` : '/api/dashboard/activity', 
    fetcher, 
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 1000 * 60 * 3, // Cache for 3 minutes
    }
  );

  return {
    recentActivity: data?.recentActivity || [],
    notifications: data?.notifications || [],
    isLoading,
    isError: error
  };
};

// Lazy-loaded components
const SalesChart = ({ isLoading }: ChartProps) => {
  const { salesData, isError } = useSalesData();
  
  if (isLoading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse w-full h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }
  
  if (isError) {
    return <div className="text-red-500">Error al cargar datos de ventas</div>;
  }
  
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={salesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#22c55e" 
            strokeWidth={2} 
            activeDot={{ r: 8 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const QuotesChart = ({ isLoading }: ChartProps) => {
  const { quotesData, isError } = useQuotesData();
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse w-full h-48 bg-gray-200 rounded-full"></div>
        </div>
        <div className="flex flex-col justify-center">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (isError) {
    return <div className="text-red-500">Error al cargar datos de cotizaciones</div>;
  }
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={quotesData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {quotesData.map((entry: ChartData, index: number) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? '#f59e0b' : index === 1 ? '#22c55e' : '#ef4444'} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col justify-center">
        {quotesData.map((item: ChartData, index: number) => (
          <div key={index} className="flex items-center mb-2">
            <div 
              className="w-4 h-4 mr-2" 
              style={{ 
                backgroundColor: index === 0 
                  ? '#f59e0b' 
                  : index === 1 
                  ? '#22c55e' 
                  : '#ef4444' 
              }}
            ></div>
            <span className="text-sm text-gray-700">{item.name}: <strong>{item.value}</strong></span>
          </div>
        ))}
        <Link href="/quotes" className="mt-4 text-green-600 hover:text-green-800 text-sm font-medium flex items-center">
          Ver todas las cotizaciones <ExternalLink className="h-4 w-4 ml-1" />
        </Link>
      </div>
    </div>
  );
};

const RecipeChart = ({ isLoading }: ChartProps) => {
  const { recipeData, isError } = useRecipeData();
  
  if (isLoading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse w-full h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }
  
  if (isError) {
    return <div className="text-red-500">Error al cargar datos de recetas</div>;
  }
  
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={recipeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#22c55e">
            {recipeData.map((entry: ChartData, index: number) => (
              <Cell 
                key={`cell-${index}`} 
                fill={['#22c55e', '#15803d', '#166534', '#14532d', '#052e16'][index % 5]} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const ActivityList = ({ isLoading }: ChartProps) => {
  const { recentActivity, isError } = useActivityData();
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((index) => (
          <div key={index} className="animate-pulse flex items-start">
            <div className="bg-gray-200 p-2 rounded-full mr-3 h-9 w-9"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (isError) {
    return <div className="text-red-500">Error al cargar actividad reciente</div>;
  }
  
  return (
    <div className="space-y-4">
      {recentActivity.map((activity: ActivityItem) => (
        <div key={activity.id} className="flex items-start">
          <div className="bg-green-100 p-2 rounded-full mr-3">
            <Clock className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-gray-800 font-medium">{activity.text}</p>
            <div className="flex justify-between mt-1">
              <p className="text-sm text-gray-500">{activity.user}</p>
              <p className="text-sm text-gray-500">Hace {activity.time}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const NotificationList = ({ isLoading }: ChartProps) => {
  const { notifications, isError } = useActivityData();
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((index) => (
          <div key={index} className="animate-pulse flex items-start p-3 rounded-lg">
            <div className="bg-gray-200 p-2 rounded-full mr-3 h-9 w-9"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (isError) {
    return <div className="text-red-500">Error al cargar notificaciones</div>;
  }
  
  return (
    <div className="space-y-4">
      {notifications.map((notification: Notification) => (
        <div key={notification.id} className={`flex items-start p-3 rounded-lg ${notification.isNew ? 'bg-green-50' : ''}`}>
          <div className={`p-2 rounded-full mr-3 ${notification.isNew ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Bell className={`h-5 w-5 ${notification.isNew ? 'text-green-600' : 'text-gray-500'}`} />
          </div>
          <div className="flex-1">
            <p className={`${notification.isNew ? 'text-green-900 font-medium' : 'text-gray-800'}`}>{notification.text}</p>
            <p className="text-sm text-gray-500 mt-1">Hace {notification.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const PendingQuotesList = ({ isLoading }: ChartProps) => {
  const { pendingQuotes, isError } = useQuotesData();
  
  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Obra</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[1, 2, 3].map((index) => (
              <tr key={index} className="animate-pulse">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="h-4 bg-gray-200 rounded w-8 ml-auto"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  
  if (isError) {
    return <div className="text-red-500">Error al cargar cotizaciones pendientes</div>;
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Obra</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {pendingQuotes.length > 0 ? (
            pendingQuotes.map((quote: PendingQuote) => (
              <tr key={quote.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{quote.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{quote.client}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{quote.date}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{quote.amount}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{quote.constructionSite}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    {quote.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link href={`/quotes/${quote.id}`} className="text-green-600 hover:text-green-900 flex items-center justify-end">
                    Ver <ExternalLink className="h-4 w-4 ml-1" />
                  </Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                No hay cotizaciones pendientes
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// Create a DashboardContent component to be wrapped in Suspense
function DashboardContent() {
  const { profile } = useAuthBridge();
  
  // Restrict access for QUALITY_TEAM users
  if (profile?.role === 'QUALITY_TEAM') {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          
          <p className="text-lg mb-4 text-yellow-700">
            No tienes permiso para acceder al dashboard principal.
          </p>
          
          <div className="bg-white p-4 rounded-lg border border-yellow-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">¿Por qué?</h3>
            <p className="text-gray-600">
              Los usuarios del equipo de calidad tienen acceso exclusivo al módulo de calidad.
            </p>
          </div>
          
          <div className="flex gap-2">
            <Link 
              href="/quality"
              className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <Beaker className="h-4 w-4 mr-2" />
              Ir al Módulo de Calidad
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  const { dashboardData, isLoading: isLoadingDashboard, isError } = useDashboardData();
  const { quotesData, pendingQuotes, isLoading: isLoadingQuotes } = useQuotesData();
  const { salesData, isLoading: isLoadingSales } = useSalesData();
  const { recipeData, isLoading: isLoadingRecipes } = useRecipeData();
  const { recentActivity, notifications, isLoading: isLoadingActivity } = useActivityData();

  // Add dosificador quick access component
  const DosificadorQuickAccess = () => {
    if (profile?.role === 'DOSIFICADOR') {
      return (
        <div className="col-span-full mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-blue-800 mb-4">Acceso Rápido para Dosificadores</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link 
                href="/orders" 
                className="flex items-center gap-2 p-4 bg-white rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <Clock className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Ver Pedidos del Día</span>
              </Link>
              <Link 
                href="/orders?tab=calendar" 
                className="flex items-center gap-2 p-4 bg-white rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <Clock className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Calendario de Pedidos</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Enhanced metrics array with financial and operational data
  const metrics = [
    // First row - Core business metrics
    {
      title: "Cotizaciones del Mes",
      value: dashboardData?.metrics?.monthlyQuotes || 0,
      growth: dashboardData?.metrics?.quoteGrowth || 0,
      icon: <FileText className="h-6 w-6 text-green-500" />,
      colorScheme: 'green' as const,
      suffix: ''
    },
    {
      title: "Venta Mensual (m³)",
      value: dashboardData?.metrics?.monthlySales || 0,
      growth: dashboardData?.metrics?.salesGrowth || 0,
      icon: <TrendingUp className="h-6 w-6 text-green-500" />,
      colorScheme: 'green' as const,
      suffix: ' m³'
    },
    {
      title: "Clientes Activos",
      value: dashboardData?.metrics?.activeClients || 0,
      growth: dashboardData?.metrics?.clientGrowth || 0,
      icon: <Users className="h-6 w-6 text-blue-500" />,
      suffix: '',
      colorScheme: 'blue' as const
    },
    
    // Second row - Financial and operational metrics
    {
      title: "Ingresos del Mes",
      value: dashboardData?.metrics?.monthlyRevenue || 0,
      growth: undefined,
      icon: <DollarSign className="h-6 w-6 text-green-500" />,
      suffix: '$',
      colorScheme: 'green' as const
    },
    {
      title: "Créditos Pendientes",
      value: dashboardData?.metrics?.pendingCreditOrders || 0,
      growth: undefined,
      icon: <AlertTriangle className="h-6 w-6 text-yellow-500" />,
      suffix: '',
      colorScheme: 'yellow' as const
    },
    {
      title: "Pedidos Hoy",
      value: dashboardData?.metrics?.todayOrders || 0,
      growth: undefined,
      icon: <Calendar className="h-6 w-6 text-blue-500" />,
      suffix: '',
      colorScheme: 'blue' as const
    }
  ];

  // Animations for container
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.05 // Reduce staggering for faster appearance 
      } 
    }
  };

  // Error handling
  if (isError && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error al cargar el dashboard</div>
          <button 
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
            onClick={() => window.location.reload()}
          >
            Intentar nuevamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8 relative">
        <div className="flex items-center mb-4">
          <div className="mr-3">
            <Image
              src="/images/dcconcretos/favicon.svg"
              alt="DC Concretos"
              width={40}
              height={40}
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h1>
            <p className="text-gray-600">Bienvenido al panel de control de DC Concretos</p>
            {dashboardData?.lastUpdated && (
              <p className="text-xs text-gray-400 mt-1">
                Última actualización: {new Date(dashboardData.lastUpdated).toLocaleString('es-MX')}
              </p>
            )}
          </div>
        </div>
      </div>

      <DosificadorQuickAccess />

      {/* Main Metrics Grid - Updated to show 6 key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {metrics.map((metric, index) => (
          <MetricsCard
            key={index}
            title={metric.title}
            value={metric.value}
            growth={metric.growth}
            icon={metric.icon}
            isLoading={isLoadingDashboard}
            suffix={metric.suffix}
            colorScheme={metric.colorScheme}
          />
        ))}
      </div>

      {/* Charts section with progressive loading */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Gráfica de ventas mensuales */}
        <motion.div 
          className="bg-white rounded-lg shadow-md p-6 @container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4 @lg:text-xl">Ventas Mensuales de Concreto (m³)</h2>
          <SalesChart isLoading={isLoadingSales} />
        </motion.div>

        {/* Gráfica de estado de cotizaciones */}
        <motion.div 
          className="bg-white rounded-lg shadow-md p-6 @container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4 @lg:text-xl">Estado de Cotizaciones</h2>
          <QuotesChart isLoading={isLoadingQuotes} />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Gráfica de tipo de concreto */}
        <motion.div 
          className="bg-white rounded-lg shadow-md p-6 @container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4 @lg:text-xl">Distribución por Tipo de Concreto</h2>
          <RecipeChart isLoading={isLoadingRecipes} />
        </motion.div>

        {/* Actividad reciente */}
        <motion.div 
          className="bg-white rounded-lg shadow-md p-6 @container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800 @lg:text-xl">Actividad Reciente</h2>
            <Link href="/activity" className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center">
              Ver Todo <ExternalLink className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <ActivityList isLoading={isLoadingActivity} />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notificaciones */}
        <motion.div 
          className="bg-white rounded-lg shadow-md p-6 @container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800 @lg:text-xl">Notificaciones</h2>
            {!isLoadingDashboard && (
              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                {dashboardData?.newNotificationsCount || 0} nuevas
              </span>
            )}
          </div>
          <NotificationList isLoading={isLoadingActivity} />
          <button className="mt-4 w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors">
            Ver todas las notificaciones
          </button>
        </motion.div>

        {/* Cotizaciones pendientes */}
        <motion.div 
          className="bg-white rounded-lg shadow-md p-6 lg:col-span-2 @container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800 @lg:text-xl">Cotizaciones Pendientes</h2>
            <Link href="/quotes" className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center">
              Ver Todas <ExternalLink className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <PendingQuotesList isLoading={isLoadingQuotes} />
        </motion.div>
      </div>
    </div>
  );
}

// Main dashboard page with Suspense boundary
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
    </div>}>
      <DashboardContent />
    </Suspense>
  );
} 