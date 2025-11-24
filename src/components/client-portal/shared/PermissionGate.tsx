/**
 * PermissionGate Component
 *
 * Conditionally renders children based on user permissions.
 * Follows Apple HIG principles of clear feedback and user control.
 */

'use client';

import React from 'react';
import { useUserPermissions } from '@/hooks/client-portal/useUserPermissions';
import { PermissionKey } from '@/lib/client-portal/permissionTemplates';
import { Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PermissionGateProps {
  /**
   * The permission key required to view the content
   */
  requires: PermissionKey;

  /**
   * Content to render when permission is granted
   */
  children: React.ReactNode;

  /**
   * Optional fallback to render when permission is denied
   * If not provided, nothing will be rendered
   */
  fallback?: React.ReactNode;

  /**
   * Whether to show a message when permission is denied
   * Default: false
   */
  showMessage?: boolean;

  /**
   * Custom message to show when permission is denied
   */
  deniedMessage?: string;
}

export function PermissionGate({
  requires,
  children,
  fallback,
  showMessage = false,
  deniedMessage,
}: PermissionGateProps) {
  const { hasPermission, isLoading } = useUserPermissions();

  // Show nothing while loading
  if (isLoading) {
    return null;
  }

  const hasRequiredPermission = hasPermission(requires);

  // If user has permission, render children
  if (hasRequiredPermission) {
    return <>{children}</>;
  }

  // If fallback provided, render it
  if (fallback) {
    return <>{fallback}</>;
  }

  // If showMessage is true, show a denied message
  if (showMessage) {
    return (
      <Alert className="border-amber-200 bg-amber-50">
        <Lock className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          {deniedMessage ||
            'You do not have permission to access this feature. Contact your organization administrator for access.'}
        </AlertDescription>
      </Alert>
    );
  }

  // Otherwise, render nothing
  return null;
}

/**
 * PermissionButton - A button that's disabled when user lacks permission
 */
interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  requires: PermissionKey;
  children: React.ReactNode;
  showTooltip?: boolean;
}

export function PermissionButton({
  requires,
  children,
  showTooltip = true,
  ...buttonProps
}: PermissionButtonProps) {
  const { hasPermission, isLoading } = useUserPermissions();

  const hasRequiredPermission = hasPermission(requires);

  return (
    <button
      {...buttonProps}
      disabled={isLoading || !hasRequiredPermission || buttonProps.disabled}
      title={
        showTooltip && !hasRequiredPermission
          ? 'You do not have permission for this action'
          : buttonProps.title
      }
    >
      {children}
    </button>
  );
}
