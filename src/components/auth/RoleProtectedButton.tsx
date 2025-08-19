'use client';

import React, { ReactNode, ButtonHTMLAttributes, useEffect, useState, memo } from 'react';
import { useUnifiedAuthBridge } from '@/adapters/unified-auth-bridge';
import type { UserRole } from '@/store/auth/types';
import { renderTracker } from '@/lib/performance/renderTracker';

interface RoleProtectedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  allowedRoles: UserRole | UserRole[];
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
  showDisabled?: boolean;
  disabledMessage?: string;
}

/**
 * A button that only renders if the user has the required role(s).
 * If showDisabled is true, it will render a disabled button with a tooltip instead of hiding it.
 */
function RoleProtectedButton({
  allowedRoles,
  onClick,
  children,
  className = '',
  disabled = false,
  title = '',
  showDisabled = false,
  disabledMessage = 'No tienes permiso para realizar esta acción',
  ...props
}: RoleProtectedButtonProps) {
  const { hasRole, profile } = useUnifiedAuthBridge({ preferUnified: true });
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);
  
  // Track render performance
  useEffect(() => {
    if (mounted) {
      const finishRender = renderTracker.trackRender('RoleProtectedButton', 'role-check', undefined, {
        allowedRoles: Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles],
        userRole: profile?.role,
        hasPermission: hasRole(allowedRoles),
        showDisabled,
        disabled,
      });
      finishRender();
    }
  }, [allowedRoles, profile?.role, hasRole, showDisabled, disabled, mounted]);
  
  // Avoid hydration mismatches by not rendering until mounted on client
  if (!mounted) return null;
  
  const hasPermission = hasRole(allowedRoles);
  
  // If user doesn't have permission and we don't want to show disabled button, don't render
  if (!hasPermission && !showDisabled) {
    return null;
  }
  
  // If user doesn't have permission but we want to show disabled button
  if (!hasPermission && showDisabled) {
    return (
      <button
        disabled
        className={`opacity-50 cursor-not-allowed ${className}`}
        title={disabledMessage}
        {...props}
      >
        {children}
      </button>
    );
  }
  
  // User has permission
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      title={title}
      {...props}
    >
      {children}
    </button>
  );
}

// Memoize RoleProtectedButton to prevent unnecessary re-renders
// Only re-render when props actually change
export default memo(RoleProtectedButton, (prevProps, nextProps) => {
  // Compare allowedRoles (can be array or single value)
  const prevRoles = JSON.stringify(prevProps.allowedRoles);
  const nextRoles = JSON.stringify(nextProps.allowedRoles);
  
  return (
    prevRoles === nextRoles &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.children === nextProps.children &&
    prevProps.className === nextProps.className &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.title === nextProps.title &&
    prevProps.showDisabled === nextProps.showDisabled &&
    prevProps.disabledMessage === nextProps.disabledMessage
  );
}); 