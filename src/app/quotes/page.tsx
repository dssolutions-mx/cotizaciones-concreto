'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import QuoteBuilder from '@/components/prices/QuoteBuilder';
import DraftQuotesTab from '@/components/quotes/DraftQuotesTab';
import PendingApprovalTab from '@/components/quotes/PendingApprovalTab';
import ApprovedQuotesTab from '@/components/quotes/ApprovedQuotesTab';
import RoleGuard from '@/components/auth/RoleGuard';

// Define tab types
type TabId = 'draft' | 'pending' | 'approved' | 'create';

// Common props type that all components might receive
interface TabComponentProps {
  onDataSaved?: () => void;
}

interface TabDefinition {
  id: TabId;
  name: string;
  component: React.ComponentType<TabComponentProps>;
}

export default function QuotesPage() {
  const { profile, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('draft');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Role-based tabs configuration
  const getRoleTabs = (): TabDefinition[] => {
    // Initialize empty tabs array - will be populated based on role
    let roleTabs: TabDefinition[] = [];
    
    // SALES_AGENT can see draft quotes, approved quotes, and create quotes
    if (hasRole(['SALES_AGENT'])) {
      roleTabs = [
        { id: 'draft', name: 'Cotizaciones Borrador', component: DraftQuotesTab },
        { id: 'create', name: 'Crear Cotización', component: QuoteBuilder },
        { id: 'approved', name: 'Cotizaciones Aprobadas', component: ApprovedQuotesTab }
      ];
    }
    
    // PLANT_MANAGER and EXECUTIVE can see all tabs
    if (hasRole(['PLANT_MANAGER', 'EXECUTIVE'])) {
      roleTabs = [
        { id: 'draft', name: 'Cotizaciones Borrador', component: DraftQuotesTab },
        { id: 'create', name: 'Crear Cotización', component: QuoteBuilder },
        { id: 'pending', name: 'Pendientes de Aprobación', component: PendingApprovalTab },
        { id: 'approved', name: 'Cotizaciones Aprobadas', component: ApprovedQuotesTab }
      ];
    }
    
    // QUALITY_TEAM should not be able to access this page at all
    // This is enforced by the RoleGuard, but we'll return an empty array as a fallback
    
    return roleTabs;
  };

  // Get tabs based on user role
  const TABS = getRoleTabs();

  // If the active tab is not available for the current role, default to 'draft'
  useEffect(() => {
    if (TABS.length > 0 && !TABS.some(tab => tab.id === activeTab)) {
      setActiveTab(TABS[0].id);
    }
  }, [profile, TABS, activeTab]);

  const handleDataSaved = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const ActiveTabComponent = TABS.find(tab => tab.id === activeTab)?.component;

  // If no tabs are available for this role, this should never render due to RoleGuard
  if (!ActiveTabComponent) {
    return (
      <div className="container mx-auto p-4">
        <h2 className="text-xl font-bold text-red-500">No tienes permisos para acceder a esta página</h2>
      </div>
    );
  }

  return (
    // Wrap the entire page with RoleGuard to restrict access to appropriate roles
    <RoleGuard 
      allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE']}
      redirectTo="/access-denied"
    >
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Gestión de Cotizaciones</h1>

        {/* Only show tabs navigation if there are tabs available */}
        {TABS.length > 0 && (
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
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
        )}
        
        {/* Tab Content */}
        <ActiveTabComponent 
          key={`${activeTab}-${refreshTrigger}`} 
          onDataSaved={handleDataSaved} 
        />
      </div>
    </RoleGuard>
  );
} 