'use client';

import React, { useEffect, useState } from 'react';
import { clientService } from '@/lib/supabase/clients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { authService } from '@/lib/supabase/auth';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { useDebounce } from '@/hooks/useDebounce';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LiveDuplicateSuggestions } from './LiveDuplicateSuggestions';
import { validateClientForm } from '@/lib/validation/clientValidation';
import { CommercialWorkflowCallout } from '@/components/clients/CommercialWorkflowCallout';
import { COMMERCIAL_WORKFLOW_STEPS, MESSAGES } from '@/lib/commercial/workflow';
import { cn } from '@/lib/utils';

export interface ClientCreatedPayload {
  clientId: string;
  clientName: string;
  pendingApproval: boolean;
}

interface ClientCreationFormProps {
  onClientCreated: (payload: ClientCreatedPayload) => void;
  onCancel: () => void;
  embedded?: boolean;
}

const CLIENT_TYPES = [
  { value: 'normal', label: 'Cliente normal' },
  { value: 'de_la_casa', label: 'Cliente de la casa' },
  { value: 'asignado', label: 'Cliente asignado' },
  { value: 'nuevo', label: 'Cliente nuevo' },
] as const;

const CREDIT_STATUSES = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'BLACKLISTED', label: 'Lista negra' },
] as const;

export default function ClientCreationForm({
  onClientCreated,
  onCancel,
  embedded = true,
}: ClientCreationFormProps) {
  const { profile } = useAuthBridge();
  const [formData, setFormData] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    client_code: '',
    address: '',
    requires_invoice: false,
    client_type: 'de_la_casa' as (typeof CLIENT_TYPES)[number]['value'],
    assigned_user_id: '' as string | null,
    credit_status: 'ACTIVE' as (typeof CREDIT_STATUSES)[number]['value'],
  });
  const [suggestedCashCode, setSuggestedCashCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [potentialDuplicates, setPotentialDuplicates] = useState<
    Array<{ id: string; business_name: string; client_code: string | null; match_reason: string }>
  >([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [liveDuplicates, setLiveDuplicates] = useState<
    Array<{ id: string; business_name: string; client_code: string | null; match_reason: string }>
  >([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const debouncedBusinessName = useDebounce(formData.business_name.trim(), 400);

  useEffect(() => {
    if (debouncedBusinessName.length < 3) {
      setLiveDuplicates([]);
      return;
    }
    let cancelled = false;
    setIsCheckingDuplicates(true);
    const codeForCheck = formData.requires_invoice
      ? formData.client_code.trim() || undefined
      : suggestedCashCode || undefined;
    clientService
      .findPotentialDuplicates(debouncedBusinessName, codeForCheck)
      .then((list) => {
        if (!cancelled) setLiveDuplicates(list || []);
      })
      .catch(() => {
        if (!cancelled) setLiveDuplicates([]);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingDuplicates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedBusinessName, formData.requires_invoice, formData.client_code, suggestedCashCode]);

  useEffect(() => {
    authService
      .getAllUsers()
      .then((data) => {
        const list = (data || []).map((u: { id: string; first_name?: string; last_name?: string; email?: string }) => ({
          id: u.id,
          name:
            u.first_name || u.last_name
              ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
              : u.email || 'Usuario',
        }));
        setUsers(list);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!formData.requires_invoice) {
      const fn = (profile as { first_name?: string } | null)?.first_name?.trim().slice(0, 1) || '';
      const ln = (profile as { last_name?: string } | null)?.last_name?.trim().slice(0, 1) || '';
      const initials = (fn + ln).toUpperCase() || 'XX';
      clientService.getNextCashOnlyClientCode(initials).then(setSuggestedCashCode).catch(() => setSuggestedCashCode('XX-001'));
    } else {
      setSuggestedCashCode(null);
    }
  }, [formData.requires_invoice, profile]);

  const doCreateClient = async () => {
    const clientCode = formData.requires_invoice
      ? formData.client_code.trim()
      : suggestedCashCode || formData.client_code || 'XX-001';
    const createdClient = await clientService.createClient({
      ...formData,
      client_code: clientCode,
      rfc: formData.requires_invoice ? formData.client_code.trim() : undefined,
      assigned_user_id: formData.assigned_user_id || null,
    });
    if (!createdClient?.id) {
      throw new Error('No se recibieron datos válidos del cliente creado');
    }
    toast.success(MESSAGES.clientCreatedPending);
    onClientCreated({
      clientId: createdClient.id,
      clientName: formData.business_name,
      pendingApproval: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateClientForm({
      business_name: formData.business_name,
      contact_name: formData.contact_name,
      phone: formData.phone,
      requires_invoice: formData.requires_invoice,
      client_code: formData.client_code,
    });
    const firstError = Object.values(validation)[0];
    if (firstError) {
      setError(firstError);
      return;
    }
    setError(null);
    try {
      const codeForDupCheck = formData.requires_invoice
        ? formData.client_code.trim()
        : suggestedCashCode || formData.client_code || undefined;
      const duplicates = await clientService.findPotentialDuplicates(
        formData.business_name,
        codeForDupCheck
      );
      if (duplicates.length > 0) {
        setPotentialDuplicates(duplicates);
        setShowDuplicateDialog(true);
        return;
      }
      setIsSubmitting(true);
      await doCreateClient();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCreateDespiteDuplicates = async () => {
    setShowDuplicateDialog(false);
    try {
      setIsSubmitting(true);
      await doCreateClient();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('space-y-5', !embedded && 'rounded-lg bg-card p-6 shadow-sm')}>
      <CommercialWorkflowCallout variant="info" showGovernanceLink={false}>
        <p className="mb-1 text-xs">{COMMERCIAL_WORKFLOW_STEPS}</p>
        <p className="text-xs">
          Al guardar, el cliente queda <strong>pendiente de autorización</strong> y no podrá usarse en cotizaciones
          hasta que Finanzas lo apruebe.
        </p>
      </CommercialWorkflowCallout>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="business_name">Nombre del negocio *</Label>
            <Input
              id="business_name"
              name="business_name"
              value={formData.business_name}
              onChange={(e) => setFormData((p) => ({ ...p, business_name: e.target.value }))}
              required
              autoFocus
            />
            {debouncedBusinessName.length >= 3 ? (
              <LiveDuplicateSuggestions isChecking={isCheckingDuplicates} duplicates={liveDuplicates} />
            ) : null}
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Checkbox
              id="requires_invoice"
              checked={formData.requires_invoice}
              onCheckedChange={(checked) =>
                setFormData((p) => ({
                  ...p,
                  requires_invoice: checked === true,
                  ...(checked === true ? {} : { client_code: '' }),
                }))
              }
            />
            <Label htmlFor="requires_invoice" className="cursor-pointer font-normal">
              Requiere factura (RFC obligatorio)
            </Label>
          </div>

          {formData.requires_invoice ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="client_code">RFC / código de cliente *</Label>
              <Input
                id="client_code"
                name="client_code"
                value={formData.client_code}
                onChange={(e) => setFormData((p) => ({ ...p, client_code: e.target.value }))}
                placeholder="Ej. XAXX010101000"
                required
              />
            </div>
          ) : (
            <div className="space-y-1 sm:col-span-2">
              <Label>Código de cliente (efectivo)</Label>
              <p className="text-sm text-muted-foreground">
                {suggestedCashCode ? (
                  <>
                    Código asignado: <span className="font-semibold text-foreground">{suggestedCashCode}</span>
                  </>
                ) : (
                  'Generando código…'
                )}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Tipo de cliente</Label>
            <Select
              value={formData.client_type}
              onValueChange={(v) =>
                setFormData((p) => ({ ...p, client_type: v as typeof formData.client_type }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Estado de crédito</Label>
            <Select
              value={formData.credit_status}
              onValueChange={(v) =>
                setFormData((p) => ({ ...p, credit_status: v as typeof formData.credit_status }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREDIT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Usuario asignado</Label>
            <Select
              value={formData.assigned_user_id || '__none__'}
              onValueChange={(v) =>
                setFormData((p) => ({
                  ...p,
                  assigned_user_id: v === '__none__' ? '' : v,
                  client_type: v !== '__none__' ? 'asignado' : p.client_type,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin asignar</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_name">Nombre de contacto *</Label>
            <Input
              id="contact_name"
              name="contact_name"
              value={formData.contact_name}
              onChange={(e) => setFormData((p) => ({ ...p, contact_name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono *</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              placeholder="55 1234 5678"
              required
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Dirección</Label>
            <Textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
              rows={2}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creando…' : 'Crear cliente'}
          </Button>
        </div>
      </form>

      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Posible duplicado?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Se encontraron clientes similares. Revise antes de continuar.</p>
                <ul className="space-y-1">
                  {potentialDuplicates.map((d) => (
                    <li key={d.id} className="flex justify-between gap-4">
                      <span>{d.business_name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {d.client_code || '—'} · {d.match_reason}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCreateDespiteDuplicates}>
              Sí, crear de todos modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
