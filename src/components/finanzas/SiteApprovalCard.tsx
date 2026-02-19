'use client';

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, MapPin, ExternalLink } from 'lucide-react';
import { generateGoogleMapsUrl } from '@/components/orders/ScheduleOrderForm';

interface PendingSite {
  id: string;
  name: string;
  location: string | null;
  client_id: string;
  created_at: string;
  clients?: { business_name: string } | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_km?: number | null;
  distance_plant_name?: string | null;
}

interface SiteApprovalCardProps {
  site: PendingSite;
  onApprove: () => void;
  onReject: () => void;
  isActing: boolean;
}

export function SiteApprovalCard({ site, onApprove, onReject, isActing }: SiteApprovalCardProps) {
  const createdDate = new Date(site.created_at).toLocaleDateString('es-MX', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const clientName = (site.clients as { business_name?: string } | null)?.business_name ?? 'Cliente';
  const hasCoordinates = site.latitude != null && site.longitude != null;
  const mapUrl = hasCoordinates ? generateGoogleMapsUrl(String(site.latitude), String(site.longitude)) : null;

  return (
    <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-400">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-lg text-slate-900 truncate">
              {site.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {clientName} • Creado el {createdDate}
            </p>
          </div>
          <Badge className="shrink-0 bg-blue-100 text-blue-800 border-blue-200">
            Obra pendiente
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {site.location && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{site.location}</span>
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-slate-600">
            {site.distance_km != null
              ? `${site.distance_km} km${site.distance_plant_name ? ` a ${site.distance_plant_name}` : ''}`
              : '—'}
          </span>
          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver en mapa
            </a>
          )}
        </div>
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
