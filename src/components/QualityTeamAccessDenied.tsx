import React from 'react';
import { AlertCircle } from 'lucide-react';

export function QualityTeamAccessDenied() {
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="h-8 w-8 text-yellow-600" />
          <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
        </div>
        
        <p className="text-lg mb-4 text-yellow-700">
          Como miembro del equipo de calidad, no tienes acceso al historial de precios.
        </p>
        
        <div className="bg-white p-4 rounded-lg border border-yellow-200 mb-4">
          <h3 className="font-medium text-gray-800 mb-2">¿Por qué?</h3>
          <p className="text-gray-600">
            Esta restricción se ha implementado para mantener la separación de 
            responsabilidades y prevenir posibles conflictos de interés. El equipo de 
            calidad está a cargo de definir las recetas y características técnicas del 
            producto, mientras que el historial de precios está relacionado con aspectos 
            comerciales.
          </p>
        </div>
        
        <p className="text-sm text-gray-500">
          Si necesitas acceso a esta información para un propósito específico, por favor 
          contacta al administrador del sistema o a un miembro del equipo ejecutivo.
        </p>
      </div>
    </div>
  );
} 