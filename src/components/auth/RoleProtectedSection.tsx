'use client';

import React, { ReactNode, memo } from 'react';
import { useUnifiedAuthBridge } from '@/adapters/unified-auth-bridge';
import type { UserRole } from '@/store/auth/types';
import AccessDeniedMessage from '@/components/ui/AccessDeniedMessage';
import { renderTracker } from '@/lib/performance/renderTracker';

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
function RoleProtectedSection({
  allowedRoles,
  children,
  fallback,
  action = 'acceder a esta sección',
  className = '',
}: RoleProtectedSectionProps) {
  const { hasRole, profile, isInitialized } = useUnifiedAuthBridge({ preferUnified: true });
  const [isClientReady, setIsClientReady] = React.useState(false);
  
  // Track render performance
  React.useEffect(() => {
    const finishRender = renderTracker.trackRender('RoleProtectedSection', 'role-check', undefined, {
      allowedRoles: Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles],
      userRole: profile?.role,
      hasPermission: hasRole(allowedRoles),
    });
    finishRender();
  }, [allowedRoles, profile?.role, hasRole]);
  
  // Prevent hydration mismatch by waiting for client-side auth state
  React.useEffect(() => {
    setIsClientReady(true);
  }, []);
  
  // Always render children initially to prevent hydration mismatch
  // Then conditionally show/hide based on permissions after client is ready
  if (!isClientReady || !isInitialized) {
    // Return children wrapped in the expected structure to prevent hydration mismatch
    return <div className={className}>{children}</div>;
  }
  
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

// Memoize RoleProtectedSection to prevent unnecessary re-renders
// Only re-render when allowedRoles, children, fallback, action, or className change
export default memo(RoleProtectedSection, (prevProps, nextProps) => {
  // Compare allowedRoles (can be array or single value)
  const prevRoles = JSON.stringify(prevProps.allowedRoles);
  const nextRoles = JSON.stringify(nextProps.allowedRoles);
  
  return (
    prevRoles === nextRoles &&
    prevProps.children === nextProps.children &&
    prevProps.fallback === nextProps.fallback &&
    prevProps.action === nextProps.action &&
    prevProps.className === nextProps.className
  );
}); 