'use client';

import React, { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { Building2, MapPin } from 'lucide-react';
import { clientService } from '@/lib/supabase/clients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { CommercialWorkflowCallout } from '@/components/clients/CommercialWorkflowCallout';
import { MESSAGES } from '@/lib/commercial/workflow';
import { cn } from '@/lib/utils';

const LocationSearchBox = dynamic(() => import('@/components/maps/LocationSearchBox'), {
  ssr: false,
  loading: () => (
    <div className="flex h-11 items-center justify-center rounded-xl border border-dashed bg-muted/40 text-sm text-muted-foreground">
      Cargando buscador…
    </div>
  ),
});

const GoogleMapSelector = dynamic(() => import('@/components/maps/GoogleMapSelector'), { ssr: false });
const GoogleMapWrapper = dynamic(() => import('@/components/maps/GoogleMapWrapper'), { ssr: false });

export interface ConstructionSiteFormProps {
  clientId: string;
  isClientApproved?: boolean;
  onSiteCreated: (
    siteId: string,
    siteName: string,
    siteLocation?: string,
    siteLat?: number,
    siteLng?: number
  ) => void;
  onCancel: () => void;
  /** ID del formulario para botones externos (modal con DialogFooter). */
  formId?: string;
  /** Oculta acciones internas cuando el modal provee el pie. */
  hideFooter?: boolean;
  className?: string;
  onSubmittingChange?: (submitting: boolean) => void;
}

type SiteFormState = {
  name: string;
  location: string;
  access_restrictions: string;
  special_conditions: string;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
};

const emptySiteState = (): SiteFormState => ({
  name: '',
  location: '',
  access_restrictions: '',
  special_conditions: '',
  is_active: true,
  latitude: null,
  longitude: null,
});

function FormSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
          {title}
        </h3>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function ConstructionSiteForm({
  clientId,
  isClientApproved = true,
  onSiteCreated,
  onCancel,
  formId = 'construction-site-form',
  hideFooter = false,
  className,
  onSubmittingChange,
}: ConstructionSiteFormProps) {
  const [siteData, setSiteData] = useState<SiteFormState>(emptySiteState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    onSubmittingChange?.(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  React.useEffect(() => {
    setMapReady(true);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSiteData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLocationSelect = useCallback((lat: number, lng: number, address?: string) => {
    setSiteData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      ...(address ? { location: address } : {}),
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isClientApproved) {
      setError(MESSAGES.obraRequiresApprovedClient);
      return;
    }
    if (!siteData.name.trim()) {
      setError('El nombre de la obra es obligatorio.');
      return;
    }

    try {
      setIsSubmitting(true);
      const createdSite = await clientService.createSite(clientId, {
        name: siteData.name.trim(),
        location: siteData.location.trim() || undefined,
        access_restrictions: siteData.access_restrictions.trim() || undefined,
        special_conditions: siteData.special_conditions.trim() || undefined,
        is_active: siteData.is_active,
        latitude: siteData.latitude,
        longitude: siteData.longitude,
      });

      if (!createdSite?.id) {
        throw new Error('No se recibieron datos de la obra creada.');
      }

      toast.success(MESSAGES.sitePendingAfterCreate);
      onSiteCreated(
        createdSite.id,
        siteData.name.trim(),
        siteData.location.trim() || undefined,
        siteData.latitude ?? undefined,
        siteData.longitude ?? undefined
      );
      setSiteData(emptySiteState());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear la obra.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isClientApproved) {
    return (
      <CommercialWorkflowCallout title="Cliente sin autorizar" className={className}>
        {MESSAGES.obraRequiresApprovedClient}
      </CommercialWorkflowCallout>
    );
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      <CommercialWorkflowCallout variant="info" showGovernanceLink={false}>
        La obra quedará <strong>pendiente de autorización</strong> en Finanzas (pestaña Obras). Solo las obras
        aprobadas aparecen al cotizar.
      </CommercialWorkflowCallout>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormSection title="Datos de la obra" icon={Building2}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nombre de la obra *</Label>
            <Input
              id="name"
              name="name"
              value={siteData.name}
              onChange={handleChange}
              placeholder="Ej. Torre Centro — Fase 2"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="location">Dirección o referencia</Label>
            <Input
              id="location"
              name="location"
              value={siteData.location}
              onChange={handleChange}
              placeholder="Se completa al buscar en el mapa o puede editarse"
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Checkbox
              id="is_active"
              checked={siteData.is_active}
              onCheckedChange={(checked) =>
                setSiteData((prev) => ({ ...prev, is_active: checked === true }))
              }
            />
            <Label htmlFor="is_active" className="cursor-pointer font-normal">
              Obra activa
            </Label>
          </div>
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Detalles operativos" description="Opcional — restricciones de acceso o condiciones especiales.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="access_restrictions">Restricciones de acceso</Label>
            <Textarea
              id="access_restrictions"
              name="access_restrictions"
              value={siteData.access_restrictions}
              onChange={handleChange}
              rows={2}
              placeholder="Horarios, vialidad, permisos…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="special_conditions">Condiciones especiales</Label>
            <Textarea
              id="special_conditions"
              name="special_conditions"
              value={siteData.special_conditions}
              onChange={handleChange}
              rows={2}
              placeholder="Bombeo, pendiente, espesor…"
            />
          </div>
        </div>
      </FormSection>

      <Separator />

      <FormSection
        title="Ubicación en mapa"
        description="Busque la dirección o haga clic en el mapa para fijar coordenadas de entrega."
        icon={MapPin}
      >
        {mapReady ? <LocationSearchBox onSelectLocation={handleLocationSelect} /> : null}
        <div className="h-[220px] overflow-hidden rounded-xl border bg-muted/20 sm:h-[260px]">
          {mapReady ? (
            <GoogleMapWrapper>
              <GoogleMapSelector
                key={
                  siteData.latitude != null && siteData.longitude != null
                    ? `${siteData.latitude}-${siteData.longitude}`
                    : 'map-empty'
                }
                onSelectLocation={(lat, lng) => handleLocationSelect(lat, lng)}
                height="100%"
                initialPosition={
                  siteData.latitude != null && siteData.longitude != null
                    ? { lat: siteData.latitude, lng: siteData.longitude }
                    : null
                }
                readOnly={false}
              />
            </GoogleMapWrapper>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Cargando mapa…
            </div>
          )}
        </div>
        {siteData.latitude != null && siteData.longitude != null ? (
          <p className="text-xs text-muted-foreground">
            Coordenadas: {siteData.latitude.toFixed(6)}, {siteData.longitude.toFixed(6)}
          </p>
        ) : (
          <p className="text-xs text-amber-700">Sin coordenadas — recomendamos seleccionar ubicación en el mapa.</p>
        )}
      </FormSection>

      {!hideFooter ? (
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creando…' : 'Crear obra'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
