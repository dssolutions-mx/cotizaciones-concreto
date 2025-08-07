'use client';

import { ReactNode, useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import type { UserRole } from '@/store/auth/types';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole | UserRole[];
  redirectTo?: string;
  showMessage?: boolean;
}

export default function RoleGuard({ 
  children, 
  allowedRoles, 
  redirectTo = '/access-denied',
  showMessage = false
}: RoleGuardProps) {
  const { isLoading, profile, session } = useAuthBridge();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  
  // Set isClient to true on mount
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Check if the user has the required role
  const hasRequiredRole = useCallback(() => {
    if (!profile) return false;
    
    if (Array.isArray(allowedRoles)) {
      return allowedRoles.includes(profile.role);
    }
    
    return profile.role === allowedRoles;
  }, [profile, allowedRoles]);
  
  // Effect to redirect if not authorized
  useEffect(() => {
    // Skip this check during SSR
    if (!isClient) return;
    
    // Only check after loading is complete
    if (!isLoading) {
      // If not authenticated or doesn't have required role, redirect
      if (!session || !hasRequiredRole()) {
        router.push(redirectTo);
      }
    }
  }, [isLoading, session, hasRequiredRole, router, redirectTo, isClient]);
  
  // Don't render anything during SSR to prevent hydration mismatch
  if (!isClient) {
    return null;
  }
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }
  
  // Render children only if authenticated and has required role
  if (session && hasRequiredRole()) {
    return <>{children}</>;
  }
  
  // Render access denied message if set to show
  if (showMessage) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Acceso Denegado</h2>
        <p className="text-gray-600">No tienes los permisos necesarios para acceder a esta página.</p>
      </div>
    );
  }
  
  // Default: render nothing while redirect happens
  return null;
} 