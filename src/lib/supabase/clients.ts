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
        .select('*')
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
        is_active: siteData.is_active ?? true // Default to true if not specified
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
  }
}; 