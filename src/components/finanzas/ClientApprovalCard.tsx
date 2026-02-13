'use client';

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, FileText } from 'lucide-react';

interface PendingClient {
  id: string;
  business_name: string;
  client_code: string | null;
  rfc: string | null;
  created_at: string;
}

interface ClientApprovalCardProps {
  client: PendingClient;
  onApprove: () => void;
  onReject: () => void;
  isActing: boolean;
}

export function ClientApprovalCard({ client, onApprove, onReject, isActing }: ClientApprovalCardProps) {
  const createdDate = new Date(client.created_at).toLocaleDateString('es-MX', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card className="hover:shadow-md transition-shadow border-l-4 border-l-amber-400">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-lg text-slate-900 truncate">
              {client.business_name || 'Sin nombre'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Creado el {createdDate}
            </p>
          </div>
          <Badge className="shrink-0 bg-amber-100 text-amber-800 border-amber-200">
            Pendiente de aprobación
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {(client.client_code || client.rfc) && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="font-mono truncate">
              {client.client_code || client.rfc || '—'}
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2 pt-0">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          onClick={onReject}
          disabled={isActing}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Rechazar
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-green-600 hover:bg-green-700"
          onClick={onApprove}
          disabled={isActing}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Aprobar
        </Button>
      </CardFooter>
    </Card>
  );
}
