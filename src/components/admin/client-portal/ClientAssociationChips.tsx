'use client';

import React from 'react';
import { Building2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ClientAssociationChip {
  id: string;
  client_id: string;
  client_name: string;
  client_code?: string;
  role_within_client: 'executive' | 'user';
  is_active: boolean;
  /** null / undefined / empty = todas las obras */
  allowed_construction_site_ids?: string[] | null;
}

interface ClientAssociationChipsProps {
  associations: ClientAssociationChip[];
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
          className="flex flex-col items-start gap-0.5 px-2 py-1.5 max-w-[220px]"
        >
          <div className="flex items-center gap-1 w-full min-w-0">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="text-xs truncate">{assoc.client_name}</span>
            {assoc.client_code && (
              <span className="text-xs text-gray-500 shrink-0">({assoc.client_code})</span>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(assoc.id)}
                className="ml-auto shrink-0 hover:text-red-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <span className="text-[10px] leading-tight text-gray-500 pl-4 truncate w-full">
            {assoc.allowed_construction_site_ids?.length
              ? `${assoc.allowed_construction_site_ids.length} obra(s)`
              : 'Todas las obras'}
          </span>
        </Badge>
      ))}
    </div>
  );
}

