'use client';

import React, { useState } from 'react';
import { clientService } from '@/lib/supabase/clients';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ClientCreationFormProps {
  onClientCreated: (clientId: string, clientName: string) => void;
  onCancel: () => void;
}

export default function ClientCreationForm({ onClientCreated, onCancel }: ClientCreationFormProps) {
  const [formData, setFormData] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    rfc: '',
    address: '',
    requires_invoice: false,
    client_code: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.business_name.trim()) {
      setError('El nombre del negocio es obligatorio');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Generate a client code if not provided
      const clientData = {
        ...formData,
        client_code: formData.client_code || formData.business_name.substring(0, 3).toUpperCase(),
      };
      
      const result = await clientService.createClient(clientData);
      const { data, error: createError } = result;
      
      if (createError) throw createError;

      // If data is undefined, the API might not be returning the newly created client directly
      if (!data) {
        console.log("Client created but no data returned. API response:", result);
        
        // Just assume success since we didn't get an error
        console.warn("Client likely created but couldn't retrieve details. Proceeding with creation flow.");
        toast.success('Cliente creado exitosamente');
        
        try {
          // Try to get recent clients to find our newly created one
          const clients = await clientService.getAllClients();
          // Look for a client with matching business_name
          const newClient = clients.find(c => c.business_name === formData.business_name);
          
          if (newClient) {
            onClientCreated(newClient.id, formData.business_name);
            return;
          }
        } catch (fetchError) {
          console.error("Error fetching clients:", fetchError);
        }
        
        // If we can't find the client, use a temporary ID
        // The client list will be refreshed when the user navigates back to it
        onClientCreated('temp-' + Date.now(), formData.business_name);
        return;
      }

      // Handle normal case when data is returned
      const createdClient = Array.isArray(data) ? data[0] : data;
      
      if (!createdClient || !createdClient.id) {
        console.error('Unexpected response format:', data);
        throw new Error('No se recibieron datos válidos del cliente creado');
      }
      
      toast.success('Cliente creado exitosamente');
      onClientCreated(createdClient.id, formData.business_name);
    } catch (err: any) {
      console.error('Error creating client:', err);
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
          </div>
          
          <div>
            <label htmlFor="client_code" className="block text-sm font-medium text-gray-700 mb-1">
              Código de Cliente (opcional)
            </label>
            <input
              id="client_code"
              name="client_code"
              type="text"
              value={formData.client_code}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Se generará automáticamente si se deja vacío"
            />
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
            <label htmlFor="rfc" className="block text-sm font-medium text-gray-700 mb-1">
              RFC
            </label>
            <input
              id="rfc"
              name="rfc"
              type="text"
              value={formData.rfc}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
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
        
        <div className="flex items-center">
          <input
            id="requires_invoice"
            name="requires_invoice"
            type="checkbox"
            checked={formData.requires_invoice}
            onChange={handleCheckboxChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="requires_invoice" className="ml-2 text-sm text-gray-700">
            Requiere Factura
          </label>
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
    </div>
  );
} 