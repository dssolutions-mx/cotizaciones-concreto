'use client';

import { ReactNode } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import AccessDeniedMessage from '@/components/ui/AccessDeniedMessage';

interface RoleProtectedSectionProps {
  allowedRoles: UserRole | UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
  action?: string;
  className?: string;
}

/**
 * A component that only renders its children if the user has the required role(s).
 * Otherwise, it renders a fallback or an AccessDeniedMessage.
 * 
 * @param allowedRoles - The role(s) that are allowed to view this section
 * @param children - The content to display if the user has permission
 * @param fallback - Optional custom fallback content to display if the user doesn't have permission
 * @param action - Description of the action being protected (for the AccessDeniedMessage)
 * @param className - Additional CSS classes
 */
export default function RoleProtectedSection({
  allowedRoles,
  children,
  fallback,
  action = 'acceder a esta sección',
  className = '',
}: RoleProtectedSectionProps) {
  const { hasRole } = useAuth();
  
  // Check if user has any of the allowed roles
  const hasPermission = hasRole(allowedRoles);
  
  // If user has permission, render the children
  if (hasPermission) {
    return <div className={className}>{children}</div>;
  }
  
  // If a custom fallback is provided, render it
  if (fallback) {
    return <>{fallback}</>;
  }
  
  // Convert allowedRoles to array if it's not already
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  // Default fallback is the AccessDeniedMessage
  return (
    <AccessDeniedMessage 
      action={action} 
      requiredRoles={rolesArray} 
      className={className}
    />
  );
} 