'use client';

import { useAuthBridge } from '@/adapters/auth-context-bridge';
import type { UserRole } from '@/store/auth/types';
import { ReactNode } from 'react';

interface RoleIndicatorProps {
  allowedRoles: UserRole | UserRole[];
  children?: ReactNode;
  tooltipText?: string;
  showIcon?: boolean;
  className?: string;
}

/**
 * A component that visually indicates whether a user has permission for an action.
 * 
 * @param allowedRoles - The role(s) that are allowed for this action
 * @param children - Optional content to display alongside the indicator
 * @param tooltipText - Text to display in the tooltip
 * @param showIcon - Whether to show the permission icon
 * @param className - Additional CSS classes
 */
export default function RoleIndicator({
  allowedRoles,
  children,
  tooltipText = '',
  showIcon = true,
  className = '',
}: RoleIndicatorProps) {
  const { hasRole, profile } = useAuthBridge();
  
  // Check if user has any of the allowed roles
  const hasPermission = hasRole(allowedRoles);

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
  
  // Generate tooltip text if not provided
  const generateTooltip = (): string => {
    if (tooltipText) return tooltipText;
    
    if (!profile) return 'Inicia sesión para ver permisos';
    
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const formattedRoles = rolesArray.map(formatRoleName).join(', ');
    
    return hasPermission
      ? `Tienes permiso para esta acción como ${formatRoleName(profile.role)}`
      : `Esta acción requiere uno de los siguientes roles: ${formattedRoles}`;
  };
  
  // Tooltip content
  const tooltip = generateTooltip();
  
  return (
    <div 
      className={`inline-flex items-center ${className}`}
      title={tooltip}
    >
      {children}
      
      {showIcon && (
        <span 
          className={`ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full ${
            hasPermission 
              ? 'bg-green-100 text-green-600' 
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {hasPermission ? (
            // Checkmark icon for permission
            <svg 
              className="w-3 h-3" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          ) : (
            // Lock icon for no permission
            <svg 
              className="w-3 h-3" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 15v2m0 0v2m0-2h2m-2 0H9" 
              />
            </svg>
          )}
        </span>
      )}
    </div>
  );
} 