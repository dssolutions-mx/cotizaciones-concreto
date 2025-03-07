'use client';

import { ReactNode } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';

interface RoleProtectedButtonProps {
  allowedRoles: UserRole | UserRole[];
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
  showDisabled?: boolean;
  disabledMessage?: string;
  [key: string]: any;
}

/**
 * A button that only renders if the user has the required role(s).
 * If showDisabled is true, it will render a disabled button with a tooltip instead of hiding it.
 */
export default function RoleProtectedButton({
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
  const { hasRole } = useAuth();
  
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