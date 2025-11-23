/**
 * UserRoleBadge Component
 *
 * Displays a badge indicating user's role within the client organization.
 * Follows Apple HIG color system for clear visual hierarchy.
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Crown, User } from 'lucide-react';

interface UserRoleBadgeProps {
  role: 'executive' | 'user';
  /**
   * Optional variant for different contexts
   */
  variant?: 'default' | 'outline';
}

export function UserRoleBadge({ role, variant = 'default' }: UserRoleBadgeProps) {
  if (role === 'executive') {
    return (
      <Badge
        variant={variant}
        className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
      >
        <Crown className="h-3 w-3 mr-1" />
        Executive
      </Badge>
    );
  }

  return (
    <Badge
      variant={variant}
      className="bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200"
    >
      <User className="h-3 w-3 mr-1" />
      User
    </Badge>
  );
}
