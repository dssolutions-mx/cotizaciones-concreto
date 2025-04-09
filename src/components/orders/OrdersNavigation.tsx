'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  ListBulletIcon,
  MixerHorizontalIcon,
} from '@radix-ui/react-icons';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Define Tab types for better management
type OrderTab = 'list' | 'calendar' | 'credit' | 'rejected';

// Mock function to get counts (replace with actual data fetching)
// TODO: Replace with actual data fetching logic
const getPendingValidationCount = () => 3; // Example count

export default function OrdersNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Default to 'list' if no tab param or invalid value
  const currentTab = (searchParams.get('tab') as OrderTab) || 'list';
  const estadoFilter = searchParams.get('estado') || 'todos';
  const creditoFilter = searchParams.get('credito') || 'todos';

  const navigate = (tab: OrderTab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    // Preserve existing filters when changing tabs
    params.set('estado', estadoFilter);
    params.set('credito', creditoFilter);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleFilterChange = (type: 'estado' | 'credito', value: string) => {
    const params = new URLSearchParams(searchParams);
    // Ensure the current tab is preserved when changing filters
    params.set('tab', currentTab);
    params.set(type, value);
    // Reset the other filter if needed, or keep it - depends on desired UX
    // Example: Keep other filter when one changes
    if (type === 'estado') params.set('credito', creditoFilter);
    else params.set('estado', estadoFilter);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Example statuses and credit statuses (replace with actual data sources)
  // TODO: Fetch or define these centrally
  const statuses = ['todos', 'creada', 'aprobada', 'en_validacion', 'rechazada'];
  const creditStatuses = ['todos', 'aprobado', 'pendiente', 'rechazado'];

  const pendingValidationCount = getPendingValidationCount(); // Fetch or calculate count

  const tabs: { id: OrderTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'list', label: 'Listado', icon: ListBulletIcon },
    { id: 'calendar', label: 'Calendario', icon: CalendarIcon },
    { id: 'credit', label: 'Validación', icon: CheckCircledIcon, badge: pendingValidationCount },
    { id: 'rejected', label: 'Rechazadas', icon: CrossCircledIcon },
  ];

  // Helper to format display values for filters
  const formatDisplayValue = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
              className={cn(
                currentTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200',
                'group inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2'
              )}
              aria-current={currentTab === tab.id ? 'page' : undefined}
            >
              <tab.icon
                className={cn(
                  currentTab === tab.id ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400',
                  'h-5 w-5'
                )}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.substring(0, 4)}</span>
              {tab.id === 'credit' && tab.badge !== undefined && tab.badge > 0 && (
                 <span className={cn(
                   'ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                   currentTab === tab.id
                     ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                     : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                 )}>
                   {tab.badge}
                 </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters - Only show when 'list' tab is active */}
      {currentTab === 'list' && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex shrink-0 items-center text-sm font-medium text-gray-700 dark:text-gray-300">
             <MixerHorizontalIcon className="mr-2 h-5 w-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
             Filtros:
           </div>
          {/* Estado Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button variant="outline" size="sm" className="flex items-center gap-1.5 whitespace-nowrap">
                  Estado: {formatDisplayValue(statuses.find(s => s === estadoFilter) || 'Todos')}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-50"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {statuses.map((status) => (
                <DropdownMenuItem
                   key={status}
                   onSelect={() => handleFilterChange('estado', status)}
                   className={cn(estadoFilter === status && 'bg-accent text-accent-foreground', 'cursor-pointer')}
                 >
                  {formatDisplayValue(status)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Crédito Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button variant="outline" size="sm" className="flex items-center gap-1.5 whitespace-nowrap">
                 Crédito: {formatDisplayValue(creditStatuses.find(c => c === creditoFilter) || 'Todos')}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-50"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
               {creditStatuses.map((status) => (
                 <DropdownMenuItem
                   key={status}
                   onSelect={() => handleFilterChange('credito', status)}
                   className={cn(creditoFilter === status && 'bg-accent text-accent-foreground', 'cursor-pointer')}
                  >
                   {formatDisplayValue(status)}
                 </DropdownMenuItem>
               ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters Button */}
           {(estadoFilter !== 'todos' || creditoFilter !== 'todos') && (
             <Button
               variant="ghost"
               size="sm"
               onClick={() => {
                 const params = new URLSearchParams(searchParams);
                 params.set('tab', currentTab);
                 params.set('estado', 'todos');
                 params.set('credito', 'todos');
                 router.push(`${pathname}?${params.toString()}`);
               }}
               className="text-muted-foreground hover:text-foreground"
             >
               Limpiar Filtros
             </Button>
           )}
        </div>
      )}
    </div>
  );
} 