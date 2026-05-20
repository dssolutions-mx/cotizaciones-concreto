'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import ConstructionSiteForm from '@/components/clients/ConstructionSiteForm';
import { CommercialWorkflowCallout } from '@/components/clients/CommercialWorkflowCallout';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MESSAGES } from '@/lib/commercial/workflow';

interface ClientDetailNewSitePanelProps {
  clientId: string;
  isClientApproved: boolean;
  onSiteAdded: () => void;
  /** Ocultar mientras se edita otra obra en la misma vista */
  hidden?: boolean;
}

/**
 * Alta de obra en detalle de cliente. Solo se ofrece si el cliente ya está autorizado.
 */
export function ClientDetailNewSitePanel({
  clientId,
  isClientApproved,
  onSiteAdded,
  hidden = false,
}: ClientDetailNewSitePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [formKey, setFormKey] = useState(0);

  if (hidden) {
    return null;
  }

  if (!isClientApproved) {
    return (
      <CommercialWorkflowCallout className="mt-6" title="Obras no disponibles hasta autorizar el cliente">
        <p>{MESSAGES.clientPendingShort}</p>
        <p className="mt-2">
          Cuando Finanzas apruebe al cliente, podrá registrar obras aquí con búsqueda de ubicación y mapa.
        </p>
      </CommercialWorkflowCallout>
    );
  }

  if (!expanded) {
    return (
      <div className="mt-6">
        <RoleProtectedButton
          allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR']}
          onClick={() => {
            setFormKey((k) => k + 1);
            setExpanded(true);
          }}
          asChild
        >
          <Button type="button" variant="secondary" className="gap-2">
            <Plus className="h-4 w-4" />
            Agregar nueva obra
          </Button>
        </RoleProtectedButton>
      </div>
    );
  }

  return (
    <Card className="mt-6 border border-dashed shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">Nueva obra</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            La obra quedará pendiente de autorización en Finanzas (pestaña Obras).
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setExpanded(false)}
          aria-label="Cerrar formulario de nueva obra"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <ConstructionSiteForm
          key={formKey}
          clientId={clientId}
          isClientApproved
          formId={`client-detail-new-site-${clientId}`}
          onCancel={() => setExpanded(false)}
          onSiteCreated={() => {
            onSiteAdded();
            setExpanded(false);
          }}
        />
      </CardContent>
    </Card>
  );
}
