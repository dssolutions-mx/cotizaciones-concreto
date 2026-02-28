'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientService } from '@/lib/supabase/clients';
import { authService } from '@/lib/supabase/auth';
import { validateClientForm, type ClientValidationErrors } from '@/lib/validation/clientValidation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface Client {
  id: string;
  business_name: string;
  client_code?: string;
  rfc?: string;
  requires_invoice: boolean;
  address?: string;
  contact_name: string;
  email?: string;
  phone: string;
  credit_status: string;
  client_type?: 'normal' | 'de_la_casa' | 'asignado' | 'nuevo';
  assigned_user_id?: string | null;
}

export default function EditClientForm({ id }: { id: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ClientValidationErrors>({});
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  
  const [formData, setFormData] = useState<Client>({
    id: '',
    business_name: '',
    client_code: '',
    rfc: '',
    requires_invoice: false,
    address: '',
    contact_name: '',
    email: '',
    phone: '',
    credit_status: 'ACTIVE',
    client_type: 'de_la_casa',
    assigned_user_id: '',
  });

  // Fetch client data on component mount
  useEffect(() => {
    async function fetchClient() {
      try {
        setIsLoading(true);
        const client = await clientService.getClientById(id);
        if (client) {
          setFormData(client);
        } else {
          setError('Cliente no encontrado');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar el cliente';
        setError(errorMessage);
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchClient();
  }, [id]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await authService.getAllUsers();
        const list = (data || []).map((u: any) => ({
          id: u.id,
          name: (u.first_name || u.last_name)
            ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
            : (u.email || 'Usuario')
        }));
        setUsers(list);
      } catch {
        // assignment is optional, keep form usable without this list
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
        [name]: checkbox.checked,
        ...(name === 'requires_invoice' && !checkbox.checked ? { rfc: '' } : {})
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value
      }));
    }
    if (Object.keys(fieldErrors).length > 0) {
      setFieldErrors({});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});
    
    try {
      const validation = validateClientForm({
        business_name: formData.business_name,
        contact_name: formData.contact_name,
        phone: formData.phone,
        requires_invoice: formData.requires_invoice,
        rfc: formData.rfc,
      });
      const hasValidationErrors = Object.keys(validation).length > 0;
      if (hasValidationErrors) {
        setFieldErrors(validation);
        const firstError = Object.values(validation)[0];
        setError(firstError || 'Revisa los campos obligatorios');
        return;
      }
      
      // Update the client
      await clientService.updateClient(id, {
        business_name: formData.business_name.trim(),
        rfc: formData.requires_invoice ? formData.rfc?.trim() : null,
        requires_invoice: formData.requires_invoice,
        address: formData.address?.trim(),
        contact_name: formData.contact_name.trim(),
        email: formData.email?.trim(),
        phone: formData.phone.trim(),
        credit_status: formData.credit_status,
        client_type: formData.client_type,
        assigned_user_id: formData.assigned_user_id || null,
      });
      toast.success('Cliente actualizado correctamente');
      router.push(`/clients/${id}`);
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar el cliente';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-6">Cargando información del cliente...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Link 
          href={`/clients/${id}`} 
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Volver a detalles del cliente
        </Link>
        <h1 className="text-2xl font-bold">Editar Cliente</h1>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6">
          {error}
        </div>
      )}
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <h2 className="text-xl font-semibold mb-4">Información del Cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Datos básicos */}
            <div className="mb-4">
              <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Negocio *
              </label>
              <input
                type="text"
                id="business_name"
                name="business_name"
                value={formData.business_name || ''}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
              {fieldErrors.business_name && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.business_name}</p>
              )}
            </div>
            
            <div className="mb-4">
              <label htmlFor="client_code" className="block text-sm font-medium text-gray-700 mb-1">
                Código de Cliente
              </label>
              <input
                type="text"
                id="client_code"
                name="client_code"
                value={formData.client_code || ''}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">
                El código de cliente no se puede modificar
              </p>
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
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="requires_invoice" className="ml-2 text-sm text-gray-700">
                  Sí, requiere factura
                </label>
              </div>
            </div>
            
            {formData.requires_invoice && (
              <div className="mb-4">
                <label htmlFor="rfc" className="block text-sm font-medium text-gray-700 mb-1">
                  RFC *
                </label>
                <input
                  type="text"
                  id="rfc"
                  name="rfc"
                  value={formData.rfc || ''}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required={formData.requires_invoice}
                />
                <p className="text-xs text-gray-500 mt-1">
                  El RFC es obligatorio cuando el cliente requiere factura.
                </p>
                {fieldErrors.rfc && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.rfc}</p>
                )}
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
                value={formData.address || ''}
                onChange={handleChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md"
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
                value={formData.contact_name || ''}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
              {fieldErrors.contact_name && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.contact_name}</p>
              )}
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
                className="w-full p-2 border border-gray-300 rounded-md"
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
                  value={formData.phone || ''}
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
              {fieldErrors.phone && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
              )}
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
                className="w-full p-2 border border-gray-300 rounded-md"
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
                value={formData.client_type || 'de_la_casa'}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
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
                  setFormData((prev) => ({
                    ...prev,
                    assigned_user_id: value || '',
                    client_type: value ? 'asignado' : prev.client_type,
                  }));
                }}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">Sin asignar</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <Button asChild variant="outline">
              <Link href={`/clients/${id}`}>
              Cancelar
              </Link>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}