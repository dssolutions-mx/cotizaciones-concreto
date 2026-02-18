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
   * @param approvedOnly - Si true, solo devuelve clientes aprobados (para quotes, órdenes, etc.)
   * @returns Lista de clientes con información básica
   */
  async getAllClients(approvedOnly = false) {
    try {
      let query = supabase
        .from('clients')
        .select('id, business_name, client_code, approval_status, valid_until, credit_status')
        .order('business_name');

      if (approvedOnly) {
        query = query.eq('approval_status', 'APPROVED');
        // Exclude clients with expired valid_until
        query = query.or('valid_until.is.null,valid_until.gte.' + new Date().toISOString().slice(0, 10));
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = handleError(error, 'getAllClients');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Obtiene solo clientes aprobados (para uso en quotes, órdenes, Arkik)
   * @returns Lista de clientes aprobados
   */
  async getApprovedClients() {
    return this.getAllClients(true);
  },

  /**
   * Busca posibles clientes duplicados por coincidencia difusa (nombre, código)
   * Usar antes de crear para advertir al usuario.
   * @param businessName Nombre de la empresa
   * @param clientCode Código de cliente (opcional)
   * @returns Lista de clientes potencialmente duplicados
   */
  async findPotentialDuplicates(businessName: string, clientCode?: string): Promise<Array<{ id: string; business_name: string; client_code: string | null; match_reason: string }>> {
    try {
      const params = new URLSearchParams({ business_name: (businessName || '').trim() });
      if (clientCode?.trim()) params.set('client_code', clientCode.trim());
      const res = await fetch(`/api/clients/check-duplicates?${params}`);
      const json = await res.json();
      return json.potentialDuplicates || [];
    } catch (e) {
      console.error('findPotentialDuplicates:', e);
      return [];
    }
  },

  /**
   * Genera el siguiente código para cliente de efectivo: {initials}-{seq} (e.g. JJ-001)
   * @param initials Iniciales del creador (e.g. "JJ")
   * @returns Código único sugerido
   */
  async getNextCashOnlyClientCode(initials: string): Promise<string> {
    const prefix = `${(initials || 'XX').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)}-`;
    const { data } = await supabase
      .from('clients')
      .select('client_code')
      .ilike('client_code', `${prefix}%`)
      .order('client_code', { ascending: false })
      .limit(100);

    let maxNum = 0;
    (data || []).forEach((row: { client_code?: string }) => {
      const match = (row.client_code || '').match(new RegExp(`^${prefix.replace(/-$/, '')}-(\\d+)$`, 'i'));
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    });
    return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
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
   * Crea un nuevo cliente (requiere aprobación del BU manager para uso en quotes/órdenes)
   * @param clientData Datos del cliente - client_code requerido (RFC si requires_invoice, o {initials}-{seq} para efectivo)
   * @returns Cliente creado
   */
  async createClient(clientData: {
    business_name: string;
    client_code: string; // Required - RFC for invoice clients, {initials}-{seq} for cash-only
    rfc?: string;
    requires_invoice?: boolean;
    address?: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    credit_status?: string;
  }) {
    try {
      const code = (clientData.client_code || '').trim();
      if (!code) {
        throw new Error('El código de cliente es obligatorio');
      }

      const dataToInsert = {
        ...clientData,
        approval_status: 'PENDING_APPROVAL', // New clients require BU manager approval
      };

      const { data, error } = await supabase
        .from('clients')
        .insert([dataToInsert])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(`El código de cliente "${code}" ya existe. Use un código único.`);
        }
        throw error;
      }
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
   * Obtiene las obras (sitios de construcción) de un cliente
   * @param clientId ID del cliente
   * @param approvedOnly Si true, solo devuelve obras aprobadas (para quotes, órdenes)
   * @param includeInactive Si true, incluye obras inactivas (para gestión en detalle de cliente)
   * @returns Lista de obras del cliente
   */
  async getClientSites(clientId: string, approvedOnly = false, includeInactive = false): Promise<ConstructionSite[]> {
    try {
      let query = supabase
        .from('construction_sites')
        .select('*')
        .eq('client_id', clientId)
        .order('name');

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      if (approvedOnly) {
        query = query.eq('approval_status', 'APPROVED');
      }

      const { data, error } = await query;
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

      // Solo clientes autorizados pueden tener obras
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, business_name, approval_status')
        .eq('id', clientId)
        .single();

      if (clientError || !client) {
        throw new Error('Cliente no encontrado');
      }
      if (client.approval_status !== 'APPROVED') {
        throw new Error(
          `No se pueden crear obras para este cliente. El cliente "${client.business_name || 'Sin nombre'}" aún no ha sido autorizado. ` +
          'Solicita la aprobación en Finanzas > Autorización de Clientes.'
        );
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