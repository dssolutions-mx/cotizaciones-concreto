'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';
import type { PendingClient } from '@/hooks/useApprovalTasks';

interface ClientApprovalRowProps {
  client: PendingClient;
  onApprove: () => void;
  onReject: () => void;
  isActing: boolean;
}

export function ClientApprovalRow({ client, onApprove, onReject, isActing }: ClientApprovalRowProps) {
  const createdDate = new Date(client.created_at).toLocaleDateString('es-MX', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/50 transition-colors gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-callout text-gray-900 truncate font-medium">
          {client.business_name || 'Sin nombre'}
        </p>
        <p className="text-footnote text-muted-foreground">
          {client.client_code || client.rfc || '—'} • Creado el {createdDate}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 h-8"
          onClick={onReject}
          disabled={isActing}
        >
          <XCircle className="h-3.5 w-3.5 mr-1.5" />
          Rechazar
        </Button>
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 h-8"
          onClick={onApprove}
          disabled={isActing}
        >
          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
          Aprobar
        </Button>
      </div>
    </div>
  );
}
