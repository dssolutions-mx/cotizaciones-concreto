'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { UserRoleBadge } from '@/components/client-portal/shared/UserRoleBadge';
import { Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ClientAssociation } from '@/lib/supabase/clientPortalAdmin';

interface ClientAssociationsListProps {
  associations: ClientAssociation[];
  onRemove?: (clientId: string) => void;
  showActions?: boolean;
}

export function ClientAssociationsList({
  associations,
  onRemove,
  showActions = false,
}: ClientAssociationsListProps) {
  if (!associations || associations.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2">
        Sin asociaciones de clientes
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {associations.map((assoc) => (
        <div
          key={assoc.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
        >
          <div className="flex items-center gap-3 flex-1">
            <Building2 className="h-4 w-4 text-gray-500" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-900">
                  {assoc.client_name}
                </span>
                <span className="text-xs text-gray-500">
                  ({assoc.client_code})
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <UserRoleBadge role={assoc.role_within_client} />
                {!assoc.is_active && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                    Inactivo
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {showActions && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(assoc.client_id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

