/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase'
import { handleError } from '@/utils/errorHandler';

export interface Client {
  id: string;
  business_name: string;
  client_code: string;
}

export interface Quote {
  id: string
  quote_number: string
  client_id: string
  construction_site: string
  location: string
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  validity_date: string
  created_by: string
  created_at: string
  updated_at: string
  // Campos relacionados con joins
  client?: Client
  details?: QuoteDetail[]
}

export interface QuoteDetail {
  id: string
  product_id: string
  volume: number
  base_price: number
  profit_margin: number
  final_price: number
  pump_service: boolean
  pump_price?: number
  total_amount: number
  includes_vat: boolean
}

export interface CreateQuoteData {
  client_id: string;
  construction_site: string;
  location: string;
  validity_date: string;
  plant_id?: string;
  details: Array<{
    product_id: string;
    volume: number;
    base_price: number;
    profit_margin: number;
    final_price: number;
    pump_service: boolean;
    pump_price?: number;
    includes_vat: boolean;
  }>;
}

export const QuotesService = {
  async getQuotes(): Promise<Quote[]> {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          client:clients(business_name, client_code),
          quote_details(*)
        `)
        .eq('created_by', '00000000-0000-4000-8000-000000000000')
        .order('created_at', { ascending: false });

      if (error) {
        const errorMessage = handleError(error, 'getQuotes');
        console.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      // Transform the data to match our interface structure
      const transformedData = (data || []).map(quote => {
        return {
          ...quote,
          client: quote.client ? quote.client[0] : undefined,
          details: quote.quote_details
        };
      });
      
      return transformedData as Quote[];
    } catch (error) {
      console.error('Error al obtener cotizaciones:', error);
      throw error;
    }
  },

  async updateStatus(
    id: string, 
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED', 
    additionalData: { 
      rejection_reason?: string, 
      approval_date?: string, 
      rejection_date?: string,
      approved_by?: string 
    } = {}
  ): Promise<Quote> {
    try {
      console.log(`Starting updateStatus for quote ${id} to status ${status}`);
      
      // Get current authenticated user
      const { data: authData, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Authentication error in updateStatus:', authError);
        throw new Error(`Error de autenticación: ${authError.message}`);
      }
      
      if (!authData.user) {
        console.error('No authenticated user found in updateStatus');
        throw new Error('Usuario no autenticado. Debe iniciar sesión para actualizar cotizaciones.');
      }
      
      console.log(`Authenticated user: ${authData.user.id}`);

      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };

      // Add additional data for specific status changes
      if (status === 'APPROVED') {
        updateData.approval_date = additionalData.approval_date || new Date().toISOString();
        updateData.approved_by = additionalData.approved_by || authData.user.id;
      } else if (status === 'REJECTED') {
        updateData.rejection_date = additionalData.rejection_date || new Date().toISOString();
        updateData.rejection_reason = additionalData.rejection_reason || null;
      }
      
      console.log('Quote update data:', updateData);

      // First check if the user has permission to update this quote
      const { data: quoteData, error: fetchError } = await supabase
        .from('quotes')
        .select('created_by, status')
        .eq('id', id)
        .single();
        
      if (fetchError) {
        console.error(`Error fetching quote ${id}:`, fetchError);
        throw new Error(`No se pudo obtener la cotización: ${fetchError.message}`);
      }
      
      console.log('Current quote data:', quoteData);
      
      // Check permissions based on RLS policies logic
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();
        
      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        throw new Error(`No se pudo obtener el perfil de usuario: ${profileError.message}`);
      }
      
      console.log('User profile:', userProfile);
      
      // Simulate RLS policy check
      const canUpdate = 
        // Created by user and is draft
        (quoteData.created_by === authData.user.id && quoteData.status === 'DRAFT') ||
        // Or is manager/executive
        (userProfile.role === 'PLANT_MANAGER' || userProfile.role === 'EXECUTIVE');
        
      if (!canUpdate) {
        console.error('User does not have permission to update this quote');
        throw new Error('No tiene permiso para actualizar esta cotización. Solo el creador puede modificar borradores, y solo gerentes pueden modificar otras cotizaciones.');
      }

      const { data, error } = await supabase
        .from('quotes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error(`Error updating quote ${id} status to ${status}:`, error);
        const errorMessage = handleError(error, `updateStatus:${id}`);
        console.error(errorMessage);
        throw new Error(`Error al actualizar estado: ${errorMessage}`);
      }
      
      console.log(`Successfully updated quote ${id} to status ${status}`);
      return data;
    } catch (error) {
      console.error(`Error al actualizar estado de cotización ${id}:`, error);
      throw error;
    }
  },

  async sendToApproval(id: string): Promise<Quote> {
    console.log(`Sending quote ${id} to approval`);
    try {
      return await this.updateStatus(id, 'PENDING_APPROVAL');
    } catch (error) {
      console.error(`Error sending quote ${id} to approval:`, error);
      throw error;
    }
  },

  async updateProfitMargin(id: string, newMargin: number): Promise<QuoteDetail> {
    try {
      // Primero obtenemos el detalle actual para acceder al precio base y volumen
      const { data: currentDetail, error: fetchError } = await supabase
        .from('quote_details')
        .select('base_price, volume')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        const errorMessage = handleError(fetchError, `updateProfitMargin:fetch:${id}`);
        console.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      if (!currentDetail) {
        throw new Error(`No se encontró el detalle de cotización con ID ${id}`);
      }
      
      // Calcular nuevos valores
      const finalPrice = currentDetail.base_price * (1 + newMargin/100);
      const totalAmount = finalPrice * currentDetail.volume;
      
      // Actualizar con valores calculados
      const { data, error } = await supabase
        .from('quote_details')
        .update({ 
          profit_margin: newMargin,
          final_price: finalPrice,
          total_amount: totalAmount
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        const errorMessage = handleError(error, `updateProfitMargin:update:${id}`);
        console.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (error) {
      console.error(`Error al actualizar margen de ganancia para detalle ${id}:`, error);
      throw error;
    }
  }
}

export const createQuote = async (quoteData: CreateQuoteData) => {
  try {
    // Get current user's ID from the auth session
    const { data: authData } = await supabase.auth.getSession();
    
    if (!authData.session?.user?.id) {
      throw new Error('Usuario no autenticado. Debe iniciar sesión para crear cotizaciones.');
    }
    
    // Extract the details array from quoteData
    const { details, ...quoteMainData } = quoteData;
    
    // Begin by creating the quote
    const quoteInsertData = {
      ...quoteMainData,
      created_by: authData.session.user.id
    };
    
    // Add plant_id if provided
    if (quoteData.plant_id) {
      quoteInsertData.plant_id = quoteData.plant_id;
    }
    
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert([quoteInsertData])
      .select()
      .single();

    if (quoteError) {
      const errorMessage = handleError(quoteError, 'createQuote');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    // Now insert the details with the quote_id
    const detailsWithQuoteId = details.map(detail => ({
      ...detail,
      quote_id: quote.id,
      // Ensure pump_price is only included when pump_service is true
      pump_price: detail.pump_service ? detail.pump_price : null,
      total_amount: detail.final_price * detail.volume
    }));
    
    const { error: detailsError } = await supabase
      .from('quote_details')
      .insert(detailsWithQuoteId);
      
    if (detailsError) {
      const errorMessage = handleError(detailsError, 'createQuoteDetails');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    return quote;
  } catch (error) {
    console.error('Error al crear cotización:', error);
    throw error;
  }
}; 