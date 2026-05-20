'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientService } from '@/lib/supabase/clients';
import { authService } from '@/lib/supabase/auth';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { useDebounce } from '@/hooks/useDebounce';
import { validateClientForm } from '@/lib/validation/clientValidation';
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
import { LiveDuplicateSuggestions } from '@/components/clients/LiveDuplicateSuggestions';
import { CommercialWorkflowCallout } from '@/components/clients/CommercialWorkflowCallout';
import { COMMERCIAL_WORKFLOW_STEPS, MESSAGES } from '@/lib/commercial/workflow';
import { toast } from 'sonner';
import CommercialWorkspaceLayout from '@/components/commercial/CommercialWorkspaceLayout';
import CommercialStickyActionBar from '@/components/commercial/CommercialStickyActionBar';
import {
  commercialHubOutlineNeutralClass,
  commercialHubPrimaryButtonClass,
  commercialPanelClass,
  commercialSectionTitleClass,
} from '@/components/commercial/commercialHubUi';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


export default function NewClientPage() {
  const router = useRouter();
  const { profile } = useAuthBridge();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [potentialDuplicates, setPotentialDuplicates] = useState<Array<{ id: string; business_name: string; client_code: string | null; match_reason: string }>>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [suggestedCashCode, setSuggestedCashCode] = useState<string | null>(null);
  const [liveDuplicates, setLiveDuplicates] = useState<Array<{ id: string; business_name: string; client_code: string | null; match_reason: string }>>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);

  const [formData, setFormData] = useState({
    business_name: '',
    client_code: '', // RFC when requires_invoice
    requires_invoice: false,
    address: '',
    contact_name: '',
    email: '',
    phone: '',
    credit_status: 'ACTIVE' as const,
    client_type: 'de_la_casa' as 'normal' | 'de_la_casa' | 'asignado' | 'nuevo',
    assigned_user_id: '' as string | null,
  });

  const debouncedBusinessName = useDebounce(formData.business_name.trim(), 400);

  // Live fuzzy match mientras escribe
  useEffect(() => {
    if (debouncedBusinessName.length < 3) {
      setLiveDuplicates([]);
      return;
    }
    let cancelled = false;
    setIsCheckingDuplicates(true);
    const codeForCheck = formData.requires_invoice
      ? formData.client_code.trim() || undefined
      : (suggestedCashCode || undefined);
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
    return () => { cancelled = true; };
  }, [debouncedBusinessName, formData.requires_invoice, formData.client_code, suggestedCashCode]);


  function getCreatorInitials(): string {
    const fn = (profile as { first_name?: string } | null)?.first_name?.trim().slice(0, 1) || '';
    const ln = (profile as { last_name?: string } | null)?.last_name?.trim().slice(0, 1) || '';
    return (fn + ln).toUpperCase() || 'XX';
  }

  useEffect(() => {
    if (!formData.requires_invoice) {
      const initials = getCreatorInitials();
      clientService.getNextCashOnlyClientCode(initials).then(setSuggestedCashCode).catch(() => setSuggestedCashCode('XX-001'));
    } else {
      setSuggestedCashCode(null);
    }
  }, [formData.requires_invoice, profile]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await authService.getAllUsers();
        const list = (data || []).map((u: any) => ({
          id: u.id,
          name: (u.first_name || u.last_name) ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : (u.email || 'Usuario')
        }));
        setUsers(list);
      } catch {
        // no-op: assignment remains optional
      }
    };
    loadUsers();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      setFormData((prev) => ({
        ...prev,
        [name]: checkbox.checked
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value
      }));
    }
  };


  const doCreateClient = async () => {
    const clientCode = formData.requires_invoice
      ? formData.client_code.trim()
      : (suggestedCashCode || 'XX-001');
    const clientPayload = {
      ...formData,
      client_code: clientCode,
      rfc: formData.requires_invoice ? formData.client_code.trim() : undefined,
      assigned_user_id: formData.assigned_user_id || null,
    };
    await clientService.createClient(clientPayload);
    toast.success(MESSAGES.clientCreatedPending);
    router.push('/clients');
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

    try {
      const codeForDupCheck = formData.requires_invoice
        ? formData.client_code.trim()
        : (suggestedCashCode || undefined);
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear el cliente';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCreateDespiteDuplicates = async () => {
    setShowDuplicateDialog(false);
    try {
      setIsSubmitting(true);
      await doCreateClient();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear el cliente';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CommercialWorkspaceLayout
      title="Crear Nuevo Cliente"
      subtitle={`Registra un cliente. ${COMMERCIAL_WORKFLOW_STEPS}`}
      breadcrumb={
        <Link href="/clients" className="text-sm text-sky-700 hover:text-sky-800 font-medium">
          ← Volver a clientes
        </Link>
      }
    >
      
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 mb-4">
          {error}
        </div>
      )}
      
      <form id="new-client-form" onSubmit={handleSubmit} className="space-y-5 pb-28">
        <section className={cn(commercialPanelClass)}>
          <h2 className={cn(commercialSectionTitleClass, 'mb-4')}>Información del Cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Datos básicos */}
            <div className="mb-4">
              <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de Empresa *
              </label>
              <input
                type="text"
                id="business_name"
                name="business_name"
                value={formData.business_name}
                onChange={handleChange}
                className="min-h-11 border-stone-200"
                required
              />
              {debouncedBusinessName.length >= 3 && (
                <div className="mt-2.5">
                  <LiveDuplicateSuggestions
                    isChecking={isCheckingDuplicates}
                    duplicates={liveDuplicates}
                  />
                </div>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requiere Factura
              </label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requires_invoice"
                  name="requires_invoice"
                  checked={formData.requires_invoice}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData(prev => ({
                      ...prev,
                      requires_invoice: checked,
                      ...(checked ? {} : { client_code: '' }),
                    }));
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="requires_invoice" className="ml-2 text-sm text-gray-700">
                  Sí, requiere factura
                </label>
              </div>
            </div>
            
            {formData.requires_invoice ? (
              <div className="mb-4">
                <label htmlFor="client_code" className="block text-sm font-medium text-gray-700 mb-1">
                  RFC / Código de cliente *
                </label>
                <input
                  type="text"
                  id="client_code"
                  name="client_code"
                  value={formData.client_code}
                  onChange={handleChange}
                  className="min-h-11 border-stone-200"
                  required
                  placeholder="Ej: XAXX010101000"
                />
                <p className="text-xs text-gray-500 mt-1">El RFC es el código único del cliente (obligatorio para facturación)</p>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código de cliente
                </label>
                <p className="text-sm text-gray-600 py-1">
                  {suggestedCashCode ? (
                    <span>Código asignado: <strong>{suggestedCashCode}</strong></span>
                  ) : (
                    <span className="text-gray-400">Cargando...</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-0">Se genera automáticamente para clientes de efectivo</p>
              </div>
            )}
            
            {/* Datos de contacto */}
            <div className="mb-4 md:col-span-2">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Dirección (Opcional)
              </label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                className="min-h-11 border-stone-200"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="contact_name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de Contacto *
              </label>
              <input
                type="text"
                id="contact_name"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleChange}
                className="min-h-11 border-stone-200"
                required
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Correo Electrónico (Opcional)
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email || ''}
                onChange={handleChange}
                className="min-h-11 border-stone-200"
                placeholder="ejemplo@dominio.com"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono *
              </label>
              <div className="flex rounded-md shadow-xs">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  +52
                </span>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={(e) => {
                    // Solo permitir números y guiones
                    const value = e.target.value.replace(/[^\d-]/g, '');
                    setFormData((prev) => ({
                      ...prev,
                      phone: value
                    }));
                  }}
                  placeholder="1234-567-890"
                  className="flex-1 p-2 border border-gray-300 rounded-r-md focus:ring-blue-500 focus:border-blue-500"
                  maxLength={12}
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Formato: 1234-567-890
              </p>
            </div>
            
            <div className="mb-4">
              <label htmlFor="credit_status" className="block text-sm font-medium text-gray-700 mb-1">
                Estado de Crédito
              </label>
              <select
                id="credit_status"
                name="credit_status"
                value={formData.credit_status}
                onChange={handleChange}
                className="min-h-11 border-stone-200"
              >
                <option value="ACTIVE">Activo</option>
                <option value="SUSPENDED">Suspendido</option>
                <option value="BLACKLISTED">Lista Negra</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label htmlFor="client_type" className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Cliente
              </label>
              <select
                id="client_type"
                name="client_type"
                value={formData.client_type}
                onChange={handleChange}
                className="min-h-11 border-stone-200"
              >
                <option value="normal">Cliente normal</option>
                <option value="de_la_casa">Cliente de la casa</option>
                <option value="asignado">Cliente asignado</option>
                <option value="nuevo">Cliente nuevo</option>
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor="assigned_user_id" className="block text-sm font-medium text-gray-700 mb-1">
                Usuario asignado
              </label>
              <select
                id="assigned_user_id"
                name="assigned_user_id"
                value={formData.assigned_user_id || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    assigned_user_id: value || '',
                    client_type: value ? 'asignado' : prev.client_type,
                  }));
                }}
                className="min-h-11 border-stone-200"
              >
                <option value="">Sin asignar</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          </section>

          <section className={cn(commercialPanelClass)}>
            <h2 className={cn(commercialSectionTitleClass, 'mb-4')}>Obras</h2>
            <CommercialWorkflowCallout variant="info" title="Obras después de autorizar el cliente">
              <p className="mb-2">{COMMERCIAL_WORKFLOW_STEPS}</p>
              <p>
                Las obras se registran desde el detalle del cliente, una vez que Finanzas haya{' '}
                <strong>autorizado</strong> al cliente. Cada obra también requiere autorización antes de
                usarse en cotizaciones.
              </p>
            </CommercialWorkflowCallout>
          </section>
      </form>

      <CommercialStickyActionBar
        primaryLabel={isSubmitting ? 'Guardando...' : 'Guardar Cliente'}
        onPrimary={() => {
          const form = document.getElementById('new-client-form') as HTMLFormElement | null;
          form?.requestSubmit();
        }}
        primaryDisabled={isSubmitting}
        primaryLoading={isSubmitting}
        secondaryLabel="Cancelar"
        onSecondary={() => router.push('/clients')}
      />

      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Posible duplicado?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">
                  Se encontraron clientes similares en el sistema. Revise si no es un duplicado antes de continuar.
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {potentialDuplicates.map((d) => (
                    <li key={d.id} className="flex justify-between gap-4">
                      <span>{d.business_name}</span>
                      <span className="text-muted-foreground">
                        {d.client_code || '—'} • {d.match_reason}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3">¿Desea crear el cliente de todos modos?</p>
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
    </CommercialWorkspaceLayout>
  );
} 