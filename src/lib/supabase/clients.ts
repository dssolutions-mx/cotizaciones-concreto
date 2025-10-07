import { supabase } from './client';
import { handleError } from '@/utils/errorHandler';

interface ConstructionSite {
  id: string;
  name: string;
  location: string;
  access_restrictions: string;
  special_conditions: string;
  client_id: string;
  created_at: string;
  is_active: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export const clientService = {
  /**
   * Obtiene todos los clientes ordenados por nombre de empresa
   * @returns Lista de clientes con información básica
   */
  async getAllClients() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, business_name, client_code')
        .order('business_name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = handleError(error, 'getAllClients');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Obtiene un cliente por su ID
   * @param clientId ID del cliente
   * @returns Datos completos del cliente
   */
  async getClientById(clientId: string) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*, logo_path')
        .eq('id', clientId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      const errorMessage = handleError(error, `getClientById:${clientId}`);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },
  
  /**
   * Obtiene una lista paginada de clientes
   * @param page Número de página (empieza en 1)
   * @param limit Límite de registros por página
   * @returns Lista paginada de clientes y total de registros
   */
  async getPaginatedClients(page = 1, limit = 20) {
    try {
      const startIndex = (page - 1) * limit;
      
      const { data, error, count } = await supabase
        .from('clients')
        .select('id, business_name, client_code', { count: 'exact' })
        .order('business_name')
        .range(startIndex, startIndex + limit - 1);

      if (error) throw error;
      return { data: data || [], count };
    } catch (error) {
      const errorMessage = handleError(error, `getPaginatedClients:${page}:${limit}`);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Crea un nuevo cliente
   * @param clientData Datos del cliente a crear
   * @returns Cliente creado
   */
  async createClient(clientData: {
    business_name: string;
    client_code?: string;
    rfc?: string;
    requires_invoice?: boolean;
    address?: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    credit_status?: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([clientData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      const errorMessage = handleError(error, 'createClient');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Crea un nuevo cliente con sus obras asociadas
   * @param clientData Datos del cliente
   * @param sitesData Datos de las obras asociadas
   * @returns ID del cliente creado
   */
  async createClientWithSites(clientData: {
    business_name: string;
    client_code?: string;
    rfc?: string;
    requires_invoice?: boolean;
    address?: string;
    contact_name: string; // Required
    email?: string;
    phone: string; // Required
    credit_status?: string;
  }, sitesData: Array<{
    name: string;
    location?: string;
    access_restrictions?: string;
    special_conditions?: string;
  }> = []) {
    try {
      const { data, error } = await supabase
        .rpc('create_client_with_sites', {
          client_data: clientData,
          sites_data: sitesData
        });

      if (error) throw error;
      return data;
    } catch (error) {
      const errorMessage = handleError(error, 'createClientWithSites');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Obtiene todas las obras (sitios de construcción) de un cliente
   * @param clientId ID del cliente
   * @returns Lista de obras del cliente
   */
  async getClientSites(clientId: string): Promise<ConstructionSite[]> {
    try {
      const { data, error } = await supabase
        .from('construction_sites')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = handleError(error, `getClientSites:${clientId}`);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },
  
  /**
   * Crea una nueva obra (sitio de construcción) para un cliente existente
   * @param clientId ID del cliente
   * @param siteData Datos de la obra
   * @returns La obra creada
   */
  async createSite(clientId: string, siteData: {
    name: string;
    location?: string;
    access_restrictions?: string;
    special_conditions?: string;
    is_active?: boolean;
    latitude?: number | null;
    longitude?: number | null;
  }) {
    try {
      console.log('createSite called with:', { clientId, siteData });
      
      if (!clientId) {
        throw new Error('Client ID is required to create a site');
      }
      
      const dataToInsert = {
        client_id: clientId,
        name: siteData.name,
        location: siteData.location || null,
        access_restrictions: siteData.access_restrictions || null,
        special_conditions: siteData.special_conditions || null,
        is_active: siteData.is_active ?? true, // Default to true if not specified
        latitude: siteData.latitude || null,
        longitude: siteData.longitude || null
      };
      
      console.log('Inserting site data:', dataToInsert);
      
      const { data, error } = await supabase
        .from('construction_sites')
        .insert([dataToInsert])
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating site:', error);
        throw error;
      }
      
      console.log('Site created successfully:', data);
      return data;
    } catch (error) {
      const errorMessage = handleError(error, `createSite:${clientId}`);
      console.error('Error creating site:', errorMessage, error);
      throw new Error(errorMessage);
    }
  },

  /**
   * Actualiza una obra (sitio de construcción) existente
   * @param clientId ID del cliente (opcional, para validación o logging futuro)
   * @param siteId ID de la obra a actualizar
   * @param siteData Datos de la obra a actualizar
   * @returns La obra actualizada
   */
  async updateSite(clientId: string, siteId: string, siteData: Partial<Omit<ConstructionSite, 'id' | 'client_id' | 'created_at'>>) {
    try {
      console.log('updateSite called with:', { clientId, siteId, siteData });
      
      if (!siteId) {
        throw new Error('Site ID is required to update a site');
      }
      
      // Prepare data for update, ensuring no undefined values are sent for nullable fields unless intended
      const dataToUpdate = {
        name: siteData.name,
        location: siteData.location,
        access_restrictions: siteData.access_restrictions,
        special_conditions: siteData.special_conditions,
        is_active: siteData.is_active,
        latitude: siteData.latitude,
        longitude: siteData.longitude
      };

      // Remove undefined properties to avoid overwriting with null unless explicitly provided as null
      Object.keys(dataToUpdate).forEach(key => 
        (dataToUpdate as any)[key] === undefined && delete (dataToUpdate as any)[key]
      );

      console.log('Updating site data:', dataToUpdate);
      
      const { data, error } = await supabase
        .from('construction_sites')
        .update(dataToUpdate)
        .eq('id', siteId)
        // Optionally, you might want to also match by client_id for extra security/scoping
        // .eq('client_id', clientId) 
        .select()
        .single();

      if (error) {
        console.error('Supabase error updating site:', error);
        throw error;
      }
      
      console.log('Site updated successfully:', data);
      return data;
    } catch (error) {
      const errorMessage = handleError(error, `updateSite:${siteId}`);
      console.error('Error updating site:', errorMessage, error);
      throw new Error(errorMessage);
    }
  },

  /**
   * Actualiza un cliente existente
   * @param clientId ID del cliente a actualizar
   * @param clientData Datos actualizados del cliente
   * @returns Cliente actualizado
   */
  async updateClient(clientId: string, clientData: {
    business_name?: string;
    client_code?: string;
    rfc?: string;
    requires_invoice?: boolean;
    address?: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    credit_status?: string;
    logo_path?: string | null;
  }) {
    try {
      console.log('Updating client:', { clientId, clientData });
      
      if (!clientId) {
        throw new Error('Client ID is required to update a client');
      }
      
      const { data, error } = await supabase
        .from('clients')
        .update(clientData)
        .eq('id', clientId)
        .select()
        .single();

      if (error) {
        console.error('Supabase error updating client:', error);
        throw error;
      }
      
      console.log('Client updated successfully:', data);
      return data;
    } catch (error) {
      const errorMessage = handleError(error, `updateClient:${clientId}`);
      console.error('Error updating client:', errorMessage, error);
      throw new Error(errorMessage);
    }
  },
  
  /**
   * Elimina un cliente
   * @param clientId ID del cliente a eliminar
   * @returns true si la eliminación fue exitosa
   */
  async deleteClient(clientId: string) {
    try {
      console.log('Deleting client:', clientId);
      
      if (!clientId) {
        throw new Error('Client ID is required to delete a client');
      }
      
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (error) {
        console.error('Supabase error deleting client:', error);
        throw error;
      }
      
      console.log('Client deleted successfully');
      return true;
    } catch (error) {
      const errorMessage = handleError(error, `deleteClient:${clientId}`);
      console.error('Error deleting client:', errorMessage, error);
      throw new Error(errorMessage);
    }
  },

  /**
   * Actualiza el estado de una obra
   * @param siteId ID de la obra
   * @param isActive Nuevo estado de la obra
   * @returns La obra actualizada
   */
  async updateSiteStatus(siteId: string, isActive: boolean) {
    try {
      const { data, error } = await supabase
        .from('construction_sites')
        .update({ is_active: isActive })
        .eq('id', siteId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      const errorMessage = handleError(error, `updateSiteStatus:${siteId}`);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Elimina permanentemente una obra (sitio de construcción)
   * @param siteId ID de la obra a eliminar
   * @returns true si la eliminación fue exitosa
   */
  async deleteSite(siteId: string) {
    try {
      console.log('Deleting site:', siteId);
      
      if (!siteId) {
        throw new Error('Site ID is required to delete a site');
      }
      
      const { error } = await supabase
        .from('construction_sites')
        .delete()
        .eq('id', siteId);

      if (error) {
        console.error('Supabase error deleting site:', error);
        throw error;
      }
      
      console.log('Site deleted successfully');
      return true;
    } catch (error) {
      const errorMessage = handleError(error, `deleteSite:${siteId}`);
      console.error('Error deleting site:', errorMessage, error);
      throw new Error(errorMessage);
    }
  },

  /**
   * Obtiene los pagos realizados por un cliente
   * @param clientId ID del cliente
   * @returns Lista de pagos realizados por el cliente
   */
  async getClientPayments(clientId: string) {
    try {
      const { data, error } = await supabase
        .from('client_payments')
        .select('*')
        .eq('client_id', clientId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = handleError(error, `getClientPayments:${clientId}`);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Obtiene los balances financieros de un cliente
   * @param clientId ID del cliente
   * @returns Lista de balances del cliente (general y por obra)
   */
  async getClientBalances(clientId: string) {
    try {
      const { data, error } = await supabase
        .from('client_balances')
        .select('*')
        .eq('client_id', clientId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = handleError(error, `getClientBalances:${clientId}`);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Registra un nuevo pago realizado por un cliente
   * @param clientId ID del cliente
   * @param paymentData Datos del pago
   * @returns El pago registrado
   */
  async createPayment(clientId: string, paymentData: {
    amount: number;
    payment_method: string;
    payment_date: string;
    reference_number?: string;
    notes?: string;
    construction_site?: string | null;
  }) {
    try {
      const dataToInsert = {
        client_id: clientId,
        amount: paymentData.amount,
        payment_method: paymentData.payment_method,
        payment_date: paymentData.payment_date,
        reference_number: paymentData.reference_number || null,
        notes: paymentData.notes || null,
        construction_site: paymentData.construction_site || null
      };
      
      const { data, error } = await supabase
        .from('client_payments')
        .insert([dataToInsert])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      const errorMessage = handleError(error, `createPayment:${clientId}`);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },
}; 