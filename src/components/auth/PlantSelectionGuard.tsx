'use client';

import React from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { AlertCircle, Building2, Users } from 'lucide-react';

interface PlantSelectionGuardProps {
  children: React.ReactNode;
  feature?: string;
}

export default function PlantSelectionGuard({ children, feature = "esta función" }: PlantSelectionGuardProps) {
  const { userAccess, isGlobalAdmin, availablePlants, businessUnits, isLoading } = usePlantContext();

  // Show loading while plant context is loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Global admins always have access
  if (isGlobalAdmin) {
    return <>{children}</>;
  }

  // Users with plant or business unit access have access
  if (userAccess && (userAccess.plantId || userAccess.businessUnitId)) {
    return <>{children}</>;
  }

  // Unassigned users - show access denied with helpful information
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-6">
          <AlertCircle className="h-8 w-8 text-yellow-600" />
        </div>
        
        <h1 className="text-xl font-semibold text-gray-900 mb-4">
          Acceso Restringido
        </h1>
        
        <p className="text-gray-600 mb-6">
          Para acceder a {feature}, necesitas estar asignado a una planta o unidad de negocio.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Building2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <h3 className="text-sm font-medium text-blue-900 mb-1">
                ¿Qué necesitas hacer?
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Contacta a tu administrador para que te asigne a una planta</li>
                <li>• Verifica que tu perfil esté completo</li>
                <li>• Asegúrate de tener los permisos necesarios</li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Show available plants and business units for admin reference */}
        {(availablePlants.length > 0 || businessUnits.length > 0) && (
          <div className="text-left">
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Información del Sistema:
            </h4>
            
            {businessUnits.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-600 mb-1">Unidades de Negocio disponibles:</p>
                <div className="text-xs text-gray-500">
                  {businessUnits.map(bu => bu.name).join(', ')}
                </div>
              </div>
            )}
            
            {availablePlants.length > 0 && (
              <div>
                <p className="text-xs text-gray-600 mb-1">Plantas disponibles:</p>
                <div className="text-xs text-gray-500">
                  {availablePlants.map(p => p.name).join(', ')}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Actualizar Página
          </button>
        </div>
      </div>
    </div>
  );
} 