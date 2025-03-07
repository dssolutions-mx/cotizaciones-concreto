'use client';

import { ReactNode, useEffect, useMemo, useCallback } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole | UserRole[];
  fallback?: ReactNode;
  redirectTo?: string;
}

export default function RoleGuard({
  children,
  allowedRoles,
  fallback,
  redirectTo = '/access-denied',
}: RoleGuardProps) {
  const { loading, userProfile, isAuthenticated } = useAuth();
  const router = useRouter();

  // Memoize the role check to prevent unnecessary re-renders
  const hasAccess = useMemo(() => {
    if (!userProfile) return false;
    
    if (Array.isArray(allowedRoles)) {
      return allowedRoles.includes(userProfile.role);
    }
    
    return userProfile.role === allowedRoles;
  }, [userProfile, allowedRoles]);

  // Memoize the redirect logic
  const handleRedirect = useCallback(() => {
    // Only redirect if not already on the redirect page
    if (redirectTo && !window.location.pathname.includes(redirectTo)) {
      router.push(redirectTo);
    }
  }, [redirectTo, router]);

  // Handle access and redirection
  useEffect(() => {
    // Only proceed if authentication check is complete
    if (loading) return;

    // If not authenticated or no access, redirect
    if (!isAuthenticated || !hasAccess) {
      handleRedirect();
    }
  }, [loading, isAuthenticated, hasAccess, handleRedirect]);

  // If still loading, show loading indicator
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // If user doesn't have required role
  if (!hasAccess) {
    // Show fallback component if provided
    if (fallback) {
      return <>{fallback}</>;
    }

    // Default fallback
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
        <p className="text-gray-600">
          No tienes permisos para acceder a esta sección.
        </p>
      </div>
    );
  }

  // User has the required role, render children
  return <>{children}</>;
} 