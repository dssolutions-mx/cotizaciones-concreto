'use client';

import { UserRole } from '@/contexts/AuthContext';

interface AccessDeniedMessageProps {
  action: string;
  requiredRoles: UserRole[];
  className?: string;
}

/**
 * A component to display a message when a user doesn't have permission for an action.
 * @param action - The action the user is trying to perform (e.g., "editar recetas")
 * @param requiredRoles - The roles that have permission to perform this action
 * @param className - Additional CSS classes
 */
export default function AccessDeniedMessage({ 
  action, 
  requiredRoles,
  className = ''
}: AccessDeniedMessageProps) {
  // Format role names for display
  const formatRoleName = (role: UserRole): string => {
    switch (role) {
      case 'PLANT_MANAGER':
        return 'Gerente de Planta';
      case 'QUALITY_TEAM':
        return 'Equipo de Calidad';
      case 'SALES_AGENT':
        return 'Agente de Ventas';
      case 'EXECUTIVE':
        return 'Ejecutivo';
      default:
        return role;
    }
  };

  const formattedRoles = requiredRoles.map(formatRoleName);
  
  return (
    <div className={`p-6 bg-gray-50 rounded-lg text-center shadow-sm ${className}`}>
      <svg 
        className="w-12 h-12 text-gray-400 mx-auto mb-4" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-3V8m0 0V6m0 2h2M9 10h2" 
        />
      </svg>
      
      <h3 className="text-lg font-medium mb-2 text-gray-800">Acceso Restringido</h3>
      
      <p className="text-gray-600 mb-4">
        No tienes permiso para {action}.
      </p>
      
      {requiredRoles.length > 0 && (
        <div className="text-sm text-gray-500 bg-gray-100 p-3 rounded-md inline-block">
          Esta acción requiere uno de los siguientes roles: 
          <span className="font-medium"> {formattedRoles.join(', ')}</span>.
        </div>
      )}
    </div>
  );
} 