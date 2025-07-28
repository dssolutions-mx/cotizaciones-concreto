'use client';

import React, { useState } from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { Building2, MapPin, Users, Info, HelpCircle } from 'lucide-react';

interface PlantAssignmentDisplayProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export default function PlantAssignmentDisplay({ 
  className = '', 
  showDetails = true, 
  compact = false 
}: PlantAssignmentDisplayProps) {
  const { userAccess, isGlobalAdmin, currentPlant, businessUnits, isLoading } = usePlantContext();
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-24"></div>
      </div>
    );
  }

  // Don't show for global admins as they can switch freely
  if (isGlobalAdmin) {
    return null;
  }

  // Only show for users with specific assignments
  if (!userAccess || (!userAccess.plantId && !userAccess.businessUnitId)) {
    return (
      <div className={`text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 ${className}`}>
        <div className="flex items-center gap-1">
          <Info className="h-3 w-3" />
          <span>Sin asignación</span>
          {showDetails && (
            <button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className="ml-1 text-yellow-700 hover:text-yellow-800"
              title="Ver información de depuración"
            >
              <HelpCircle className="h-3 w-3" />
            </button>
          )}
        </div>
        {showDebugInfo && (
          <div className="mt-2 p-2 bg-yellow-100 border-t border-yellow-300 text-xs">
            <div><strong>Debug Info:</strong></div>
            <div>userAccess: {userAccess ? 'exists' : 'null'}</div>
            <div>plantId: {userAccess?.plantId || 'null'}</div>
            <div>businessUnitId: {userAccess?.businessUnitId || 'null'}</div>
            <div>accessLevel: {userAccess?.accessLevel || 'null'}</div>
          </div>
        )}
      </div>
    );
  }

  const assignedBusinessUnit = businessUnits.find(bu => bu.id === userAccess.businessUnitId);
  const assignedPlant = currentPlant;

  if (compact) {
    return (
      <div className={`text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1 ${className}`}>
        <div className="flex items-center gap-1">
          {userAccess.accessLevel === 'PLANT' ? (
            <>
              <Building2 className="h-3 w-3 text-blue-600" />
              <span className="font-medium">{assignedPlant?.name || 'Planta desconocida'}</span>
            </>
          ) : (
            <>
              <Users className="h-3 w-3 text-green-600" />
              <span className="font-medium">{assignedBusinessUnit?.name || 'Unidad desconocida'}</span>
            </>
          )}
          <button
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className="ml-1 text-gray-500 hover:text-gray-700"
            title="Ver información detallada"
          >
            <HelpCircle className="h-3 w-3" />
          </button>
        </div>
        
        {/* Debug popup for compact mode */}
        {showDebugInfo && (
          <div className="absolute z-10 mt-1 p-3 bg-white border border-gray-300 rounded-lg shadow-lg max-w-xs">
            <div className="text-xs space-y-1">
              <div className="font-semibold text-gray-900 border-b pb-1">Información de Depuración</div>
              <div><strong>Nivel de acceso:</strong> {userAccess.accessLevel}</div>
              <div><strong>Plant ID:</strong> {userAccess.plantId || 'N/A'}</div>
              <div><strong>Business Unit ID:</strong> {userAccess.businessUnitId || 'N/A'}</div>
              <div><strong>Planta actual:</strong> {assignedPlant?.name || 'N/A'}</div>
              <div><strong>Unidad actual:</strong> {assignedBusinessUnit?.name || 'N/A'}</div>
              <button
                onClick={() => setShowDebugInfo(false)}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-1">
          <Info className="h-4 w-4 text-blue-600" />
          Tu Asignación
        </h4>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            userAccess.accessLevel === 'PLANT' 
              ? 'bg-blue-100 text-blue-800' 
              : 'bg-green-100 text-green-800'
          }`}>
            {userAccess.accessLevel === 'PLANT' ? 'Planta' : 'Unidad de Negocio'}
          </span>
          <button
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className="text-gray-400 hover:text-gray-600"
            title="Ver información de depuración"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {/* Business Unit Information */}
        {assignedBusinessUnit && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-green-600 flex-shrink-0" />
            <div>
              <div className="font-medium text-gray-900">{assignedBusinessUnit.name}</div>
              <div className="text-xs text-gray-500">Código: {assignedBusinessUnit.code}</div>
              {showDetails && assignedBusinessUnit.description && (
                <div className="text-xs text-gray-500 mt-1">{assignedBusinessUnit.description}</div>
              )}
            </div>
          </div>
        )}

        {/* Plant Information */}
        {assignedPlant && (
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <div>
              <div className="font-medium text-gray-900">{assignedPlant.name}</div>
              <div className="text-xs text-gray-500">Código: {assignedPlant.code}</div>
              {showDetails && assignedPlant.location && (
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                  <MapPin className="h-3 w-3" />
                  <span>{assignedPlant.location}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Access Level Information */}
        {showDetails && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              <strong>Nivel de acceso:</strong>{' '}
              {userAccess.accessLevel === 'PLANT' 
                ? 'Limitado a esta planta específica' 
                : 'Acceso a todas las plantas de esta unidad de negocio'
              }
            </div>
          </div>
        )}
      </div>

      {/* Debug Information */}
      {showDebugInfo && (
        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded text-xs">
          <div className="font-semibold text-gray-900 mb-2">Información de Depuración</div>
          <div className="space-y-1 text-gray-700">
            <div><strong>Access Level:</strong> {userAccess.accessLevel}</div>
            <div><strong>Plant ID:</strong> {userAccess.plantId || 'null'}</div>
            <div><strong>Business Unit ID:</strong> {userAccess.businessUnitId || 'null'}</div>
            <div><strong>Current Plant ID:</strong> {currentPlant?.id || 'null'}</div>
            <div><strong>Is Global Admin:</strong> {isGlobalAdmin ? 'true' : 'false'}</div>
            <div><strong>Available Plants:</strong> {businessUnits.length} business units loaded</div>
          </div>
        </div>
      )}

      {/* Troubleshooting Information */}
      {showDetails && (!assignedPlant || !assignedBusinessUnit) && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <div className="flex items-start gap-1">
            <Info className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-yellow-800">
              <div className="font-medium">Información incompleta</div>
              <div className="mt-1">
                {!assignedBusinessUnit && 'Falta asignación de unidad de negocio. '}
                {!assignedPlant && 'Falta asignación de planta. '}
                Contacta al administrador si tienes problemas de acceso.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 