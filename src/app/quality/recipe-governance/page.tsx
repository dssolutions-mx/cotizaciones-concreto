'use client';

import React from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import RecipeVersionGovernance from '@/components/quality/RecipeVersionGovernance';

export default function RecipeGovernancePage() {
  const { currentPlant } = usePlantContext();
  const { profile } = useAuthBridge();

  // Check if user has access (QUALITY_TEAM and above)
  if (!profile || (profile.role !== 'QUALITY_TEAM' && profile.role !== 'EXECUTIVE' && profile.role !== 'ADMIN_OPERATIONS')) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800">Acceso Denegado</h2>
          <p className="text-red-600">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  if (!currentPlant) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-yellow-800">Planta No Seleccionada</h2>
          <p className="text-yellow-600">Por favor selecciona una planta para continuar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gobernanza de Versiones de Recetas</h1>
        <p className="text-gray-600 mt-2">
          Gestiona y monitorea las versiones de recetas por maestro para asegurar que todas las variantes usen sus últimas versiones en las cotizaciones.
        </p>
      </div>
      <RecipeVersionGovernance plantId={currentPlant.id} />
    </div>
  );
}
