'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientService } from '@/lib/supabase/clients';

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
}

export default function EditClientForm({ id }: { id: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
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
    credit_status: 'ACTIVE'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Validate required fields
      if (!formData.business_name.trim()) {
        throw new Error('El nombre de la empresa es obligatorio');
      }
      
      if (!formData.contact_name.trim()) {
        throw new Error('El nombre de contacto es obligatorio');
      }
      
      if (!formData.phone.trim()) {
        throw new Error('El número de teléfono es obligatorio');
      }
      
      // Si requiere factura, el RFC es obligatorio
      if (formData.requires_invoice && !formData.rfc?.trim()) {
        throw new Error('El RFC es obligatorio cuando se requiere factura');
      }
      
      // Update the client
      await clientService.updateClient(id, {
        business_name: formData.business_name,
        client_code: formData.client_code,
        rfc: formData.rfc,
        requires_invoice: formData.requires_invoice,
        address: formData.address,
        contact_name: formData.contact_name,
        email: formData.email,
        phone: formData.phone,
        credit_status: formData.credit_status
      });
      
      setSuccess(true);
      // Redirect after a short delay to show success message
      setTimeout(() => {
        router.push(`/clients/${id}`);
        router.refresh();
      }, 1500);
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
      
      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-md mb-6">
          Cliente actualizado correctamente
        </div>
      )}
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <h2 className="text-xl font-semibold mb-4">Información del Cliente</h2>
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
                value={formData.business_name || ''}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
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
              <div className="flex rounded-md shadow-sm">
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
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <Link
              href={`/clients/${id}`}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}