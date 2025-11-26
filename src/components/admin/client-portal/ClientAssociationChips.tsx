'use client';

import React from 'react';
import { Building2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ClientAssociation {
  id: string;
  client_id: string;
  client_name: string;
  client_code?: string;
  role_within_client: 'executive' | 'user';
  is_active: boolean;
}

interface ClientAssociationChipsProps {
  associations: ClientAssociation[];
  onRemove?: (associationId: string) => void;
}

export function ClientAssociationChips({ associations, onRemove }: ClientAssociationChipsProps) {
  if (!associations || associations.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic py-2">
        Sin clientes asociados
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {associations.map((assoc) => (
        <Badge
          key={assoc.id}
          variant="outline"
          className="flex items-center gap-1 px-2 py-1"
        >
          <Building2 className="h-3 w-3" />
          <span className="text-xs">{assoc.client_name}</span>
          {assoc.client_code && (
            <span className="text-xs text-gray-500">({assoc.client_code})</span>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(assoc.id)}
              className="ml-1 hover:text-red-600 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
    </div>
  );
}

