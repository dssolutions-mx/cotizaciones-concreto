'use client';

import { useState } from 'react';
import { MaterialPriceForm } from '@/components/prices/MaterialPriceForm';
import { MaterialPriceList } from '@/components/prices/MaterialPriceList';
import { AdminCostForm } from '@/components/prices/AdminCostForm';
import { AdminCostList } from '@/components/prices/AdminCostList';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import AccessDeniedMessage from '@/components/ui/AccessDeniedMessage';

// Define role-based access permissions
const TABS = [
  { id: 'materials', name: 'Precios de Materiales' },
  { id: 'admin', name: 'Gastos Administrativos' }
] as const;

type TabId = typeof TABS[number]['id'];

export default function PricesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('materials');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasRole, profile } = useAuthBridge();

  // Block QUALITY_TEAM from accessing prices page
  if (profile?.role === 'QUALITY_TEAM') {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AccessDeniedMessage 
              action="acceder a la gestión de precios" 
              requiredRoles={['PLANT_MANAGER', 'EXECUTIVE', 'SALES_AGENT']}
            />
          </div>
        </div>
      </div>
    );
  }

  // Define which roles can edit which tabs
  const canEditMaterialPrices = hasRole(['QUALITY_TEAM', 'EXECUTIVE']);
  const canEditAdminCosts = hasRole(['PLANT_MANAGER', 'EXECUTIVE']);

  const handleDataSaved = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Gestión de Precios</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Tab Content with Role-Based Protection */}
      {activeTab === 'materials' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Material Price Form - only QUALITY_TEAM and EXECUTIVE can edit */}
          <RoleProtectedSection
            allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
            action="editar precios de materiales"
            fallback={
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium mb-2">Vista de Solo Lectura</h3>
                <p className="text-gray-600 mb-4">
                  No tienes permiso para editar precios de materiales. Puedes ver los precios actuales en la lista.
                </p>
                <AccessDeniedMessage 
                  action="editar precios de materiales" 
                  requiredRoles={['QUALITY_TEAM', 'EXECUTIVE']} 
                />
              </div>
            }
          >
            <MaterialPriceForm onPriceSaved={handleDataSaved} />
          </RoleProtectedSection>
          <div>
            {/* MaterialPriceList is visible to everyone */}
            <MaterialPriceList 
              key={`materials-${refreshTrigger}`} 
              hasEditPermission={canEditMaterialPrices}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Admin Cost Form - only PLANT_MANAGER and EXECUTIVE can edit */}
          <RoleProtectedSection
            allowedRoles={['PLANT_MANAGER', 'EXECUTIVE']}
            action="editar gastos administrativos"
            fallback={
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium mb-2">Vista de Solo Lectura</h3>
                <p className="text-gray-600 mb-4">
                  No tienes permiso para editar gastos administrativos. Puedes ver los gastos actuales en la lista.
                </p>
                <AccessDeniedMessage 
                  action="editar gastos administrativos" 
                  requiredRoles={['PLANT_MANAGER', 'EXECUTIVE']} 
                />
              </div>
            }
          >
            <AdminCostForm onCostSaved={handleDataSaved} />
          </RoleProtectedSection>
          <div>
            {/* AdminCostList is visible to everyone */}
            <AdminCostList 
              key={`admin-${refreshTrigger}`} 
              hasEditPermission={canEditAdminCosts}
            />
          </div>
        </div>
      )}
    </div>
  );
} 