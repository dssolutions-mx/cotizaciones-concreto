'use client';

import React, { ReactNode, ButtonHTMLAttributes, useEffect, useState, memo, useMemo } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { useUnifiedAuthBridge } from '@/adapters/unified-auth-bridge';
import type { UserRole } from '@/store/auth/types';
import { renderTracker } from '@/lib/performance/renderTracker';
import { debugRoleProtectedButtonRenders } from '@/utils/buttonDebugger';

interface RoleProtectedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  allowedRoles: UserRole | UserRole[];
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
  showDisabled?: boolean;
  disabledMessage?: string;
  asChild?: boolean;
}

/**
 * A button that only renders if the user has the required role(s).
 * If showDisabled is true, it will render a disabled button with a tooltip instead of hiding it.
 * Supports asChild to avoid nesting buttons (uses Radix Slot).
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
  asChild = false,
  ...props
}: RoleProtectedButtonProps) {
  const { hasRole, profile } = useUnifiedAuthBridge({ preferUnified: true });
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);
  
  // Debug renders if enabled
  if (typeof window !== 'undefined' && (window as any).__DEBUG_BUTTON_RENDERS__) {
    debugRoleProtectedButtonRenders({
      allowedRoles,
      children,
      className,
      disabled,
      title,
      showDisabled,
      disabledMessage,
      userRole: profile?.role,
    });
  }
  
  // Memoize permission check to prevent unnecessary recalculations
  const hasPermission = useMemo(() => {
    if (!mounted || !profile) return false;
    return hasRole(allowedRoles);
  }, [mounted, profile?.role, JSON.stringify(allowedRoles), hasRole]);
  
  // Track render performance (only when actually needed)
  useEffect(() => {
    if (mounted) {
      const finishRender = renderTracker.trackRender('RoleProtectedButton', 'permission-check', undefined, {
        allowedRoles: Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles],
        userRole: profile?.role,
        hasPermission,
        showDisabled,
        disabled,
        renderKey: `${profile?.role}-${JSON.stringify(allowedRoles)}-${disabled}-${showDisabled}`,
      });
      finishRender();
    }
  }, [hasPermission, disabled, showDisabled]); // Reduced dependencies
  
  // Avoid hydration mismatches by not rendering until mounted on client
  if (!mounted) return null;
  
  const Comp = asChild ? Slot : 'button';
  
  // If user doesn't have permission and we don't want to show disabled button, don't render
  if (!hasPermission && !showDisabled) {
    return null;
  }
  
  // If user doesn't have permission but we want to show disabled button
  if (!hasPermission && showDisabled) {
    return (
      <Comp
        disabled
        className={`opacity-50 cursor-not-allowed ${className}`}
        title={disabledMessage}
        aria-disabled="true"
        {...props}
      >
        {children}
      </Comp>
    );
  }
  
  // User has permission
  return (
    <Comp
      onClick={onClick}
      disabled={disabled}
      className={className}
      title={title}
      {...props}
    >
      {children}
    </Comp>
  );
}

// Create a cached version of the component to minimize re-renders
const MemoizedRoleProtectedButton = memo(RoleProtectedButton, (prevProps, nextProps) => {
  // Create a stable comparison key for each set of props
  const prevKey = `${JSON.stringify(prevProps.allowedRoles)}-${prevProps.disabled}-${prevProps.showDisabled}-${prevProps.asChild}-${typeof prevProps.children === 'string' ? prevProps.children : 'complex'}-${prevProps.className}`;
  const nextKey = `${JSON.stringify(nextProps.allowedRoles)}-${nextProps.disabled}-${nextProps.showDisabled}-${nextProps.asChild}-${typeof nextProps.children === 'string' ? nextProps.children : 'complex'}-${nextProps.className}`;
  
  // Log when comparison happens for debugging
  if (typeof window !== 'undefined' && (window as any).__DEBUG_BUTTON_RENDERS__) {
    if (prevKey !== nextKey) {
      console.log(`🔄 [RoleProtectedButton] Props changed: ${prevKey} → ${nextKey}`);
    } else {
      console.log(`⏭️  [RoleProtectedButton] Props identical, skipping render`);
    }
  }
  
  // Return true to SKIP re-render, false to allow re-render
  return prevKey === nextKey;
});

// Set display name for debugging
MemoizedRoleProtectedButton.displayName = 'RoleProtectedButton';

export default MemoizedRoleProtectedButton;
