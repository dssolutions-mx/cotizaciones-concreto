'use client';

import React, { useState, useEffect } from 'react';
import { clientService } from '@/lib/supabase/clients';
import { Button } from '@/components/ui/button';
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

interface ClientCreationFormProps {
  onClientCreated: (clientId: string, clientName: string) => void;
  onCancel: () => void;
}

export default function ClientCreationForm({ onClientCreated, onCancel }: ClientCreationFormProps) {
  const { profile } = useAuthBridge();
  const [formData, setFormData] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    client_code: '', // RFC when requires_invoice, or auto-generated when cash-only
    address: '',
    requires_invoice: false,
    client_type: 'de_la_casa' as 'normal' | 'de_la_casa' | 'asignado' | 'nuevo',
    assigned_user_id: '' as string | null,
  });
  const [suggestedCashCode, setSuggestedCashCode] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [potentialDuplicates, setPotentialDuplicates] = useState<Array<{ id: string; business_name: string; client_code: string | null; match_reason: string }>>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [liveDuplicates, setLiveDuplicates] = useState<Array<{ id: string; business_name: string; client_code: string | null; match_reason: string }>>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
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
        /* silencioso */
      }
    };
    loadUsers();
  }, []);

  // Sugerir código para cliente de efectivo (cuando no requiere factura)
  useEffect(() => {
    if (!formData.requires_invoice) {
      const initials = getCreatorInitials();
      clientService.getNextCashOnlyClientCode(initials).then(setSuggestedCashCode).catch(() => setSuggestedCashCode('XX-001'));
    } else {
      setSuggestedCashCode(null);
    }
  }, [formData.requires_invoice, profile]);

  function getCreatorInitials(): string {
    const fn = (profile as { first_name?: string } | null)?.first_name?.trim().slice(0, 1) || '';
    const ln = (profile as { last_name?: string } | null)?.last_name?.trim().slice(0, 1) || '';
    return (fn + ln).toUpperCase() || 'XX';
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const doCreateClient = async () => {
    const clientCode = formData.requires_invoice
      ? formData.client_code.trim()
      : (suggestedCashCode || formData.client_code || 'XX-001');
    const clientData = {
      ...formData,
      client_code: clientCode,
      rfc: formData.requires_invoice ? formData.client_code.trim() : undefined,
      assigned_user_id: formData.assigned_user_id || null,
    };
    const result = await clientService.createClient(clientData);
    const { data, error: createError } = result;
    if (createError) throw createError;
    if (!data) {
      toast.success('Cliente creado exitosamente');
      try {
        const clients = await clientService.getAllClients();
        const newClient = clients.find(c => c.business_name === formData.business_name);
        if (newClient) {
          onClientCreated(newClient.id, formData.business_name);
          return;
        }
      } catch {
        /* ignore */
      }
      onClientCreated('temp-' + Date.now(), formData.business_name);
      return;
    }
    const createdClient = Array.isArray(data) ? data[0] : data;
    if (!createdClient?.id) throw new Error('No se recibieron datos válidos del cliente creado');
    toast.success('Cliente creado exitosamente');
    onClientCreated(createdClient.id, formData.business_name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.business_name.trim()) {
      setError('El nombre del negocio es obligatorio');
      return;
    }
    if (!formData.phone.trim()) {
      setError('El número de contacto es obligatorio');
      return;
    }
    if (formData.requires_invoice && !formData.client_code.trim()) {
      setError('El RFC es obligatorio cuando el cliente requiere factura');
      return;
    }
    setError(null);
    try {
      const codeForDupCheck = formData.requires_invoice
        ? formData.client_code.trim()
        : (suggestedCashCode || formData.client_code || undefined);
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
    } catch (err: any) {
      console.error('Error creating client:', err);
      setError(err.message || 'Error al crear el cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCreateDespiteDuplicates = async () => {
    setShowDuplicateDialog(false);
    try {
      setIsSubmitting(true);
      await doCreateClient();
    } catch (err: any) {
      setError(err.message || 'Error al crear el cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 border border-red-200">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Negocio *
            </label>
            <input
              id="business_name"
              name="business_name"
              type="text"
              required
              value={formData.business_name}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requiere Factura
            </label>
            <div className="flex items-center">
              <input
                id="requires_invoice"
                name="requires_invoice"
                type="checkbox"
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
        </div>

        {formData.requires_invoice ? (
          <div>
            <label htmlFor="client_code" className="block text-sm font-medium text-gray-700 mb-1">
              RFC / Código de cliente *
            </label>
            <input
              id="client_code"
              name="client_code"
              type="text"
              required
              value={formData.client_code}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Ej: XAXX010101000"
            />
            <p className="text-xs text-gray-500 mt-1">El RFC es el código único del cliente (obligatorio para facturación)</p>
          </div>
        ) : (
          <div>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="client_type" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Cliente
            </label>
            <select
              id="client_type"
              name="client_type"
              value={formData.client_type}
              onChange={(e) => setFormData(prev => ({ ...prev, client_type: e.target.value as any }))}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="normal">Cliente normal</option>
              <option value="de_la_casa">Cliente de la casa</option>
              <option value="asignado">Cliente asignado</option>
              <option value="nuevo">Cliente nuevo</option>
            </select>
          </div>
          <div>
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
                  assigned_user_id: value || '' ,
                  client_type: value ? 'asignado' : prev.client_type
                }));
              }}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Sin asignar</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {users.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">No hay usuarios disponibles para asignar.</p>
            )}
            {users.length > 0 && (
              <p className="mt-1 text-xs text-gray-400">Usuarios disponibles: {users.length}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="contact_name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de Contacto
            </label>
            <input
              id="contact_name"
              name="contact_name"
              type="text"
              value={formData.contact_name}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo Electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono *
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              value={formData.phone}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Ej: 55 1234 5678"
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
            Dirección
          </label>
          <textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            rows={2}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creando...' : 'Crear Cliente'}
          </Button>
        </div>
      </form>

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
    </div>
  );
} 