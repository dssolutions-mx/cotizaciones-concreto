import { supabase } from './client';
import { handleError } from '@/utils/errorHandler';

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
  }
}; 