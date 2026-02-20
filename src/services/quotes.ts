/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase'
import { handleError } from '@/utils/errorHandler';
import { calculateDistanceInfo } from '@/lib/services/distanceService';
import type { DistanceCalculation } from '@/types/distance';

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
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' // Removed DRAFT and SENT - quotes go directly to PENDING_APPROVAL or APPROVED
  validity_date: string
  created_by: string
  created_at: string
  updated_at: string
  plant_id?: string
  // New distance-related fields
  distance_km?: number
  distance_range_code?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  bloque_number?: 2 | 3 | 4 | 5 | 6 | 7 | 8
  transport_cost_per_m3?: number
  total_per_trip?: number
  construction_site_id?: string
  auto_approved?: boolean
  margin_percentage?: number
  is_active?: boolean // false when construction site is deactivated; set by trigger
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
  plant_id: string; // Required for distance calculation
  construction_site_id?: string;
  details: Array<{
    product_id?: string;
    recipe_id?: string;
    master_recipe_id?: string;
    volume: number;
    base_price: number;
    profit_margin: number;
    final_price: number;
    pump_service: boolean;
    pump_price?: number;
    includes_vat: boolean;
  }>;
  // Distance calculation will be done automatically if plant_id and construction_site_id are provided
  // Or can be provided directly
  distance_info?: DistanceCalculation;
  margin_percentage?: number; // Overall margin for the quote
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
    status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED', 
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
        // Created by user and is SENT or PENDING_APPROVAL
        (quoteData.created_by === authData.user.id && quoteData.status === 'PENDING_APPROVAL') ||
        // Or is manager/executive
        (userProfile.role === 'PLANT_MANAGER' || userProfile.role === 'EXECUTIVE');
        
      if (!canUpdate) {
        console.error('User does not have permission to update this quote');
        throw new Error('No tiene permiso para actualizar esta cotización. Solo el creador puede modificar cotizaciones enviadas o pendientes, y solo gerentes pueden modificar otras cotizaciones.');
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

/**
 * Generate quote number with range code: COT-{YEAR}-{RANGE_CODE}-{SEQUENCE}
 */
function generateQuoteNumber(rangeCode: string): string {
  const currentYear = new Date().getFullYear();
  const randomSequence = Math.floor(Math.random() * 9000) + 1000; // 4-digit random number
  return `COT-${currentYear}-${rangeCode}-${randomSequence}`;
}

export const createQuote = async (quoteData: CreateQuoteData) => {
  try {
    const safeDetails = quoteData.details || [];

    // Get current user's ID from the auth session
    const { data: authData } = await supabase.auth.getSession();
    
    if (!authData.session?.user?.id) {
      throw new Error('Usuario no autenticado. Debe iniciar sesión para crear cotizaciones.');
    }
    
    if (!quoteData.plant_id) {
      throw new Error('plant_id es requerido para calcular la distancia');
    }

    // CRÍTICO: No permitir cotización si la obra no está aprobada
    if (quoteData.construction_site_id) {
      const { data: site, error: siteError } = await supabase
        .from('construction_sites')
        .select('id, name, approval_status')
        .eq('id', quoteData.construction_site_id)
        .single();
      if (siteError || !site) {
        throw new Error('Obra no encontrada. No se puede crear la cotización.');
      }
      if (site.approval_status !== 'APPROVED') {
        throw new Error(
          `La obra "${site.name || 'Sin nombre'}" no está aprobada. Solicita la aprobación en Finanzas → Autorización de Clientes (pestaña Obras) antes de crear la cotización.`
        );
      }
    } else if (quoteData.construction_site && quoteData.client_id) {
      // Validar por nombre cuando no hay construction_site_id (ej. duplicar cotización)
      const { data: site } = await supabase
        .from('construction_sites')
        .select('id, name, approval_status')
        .eq('client_id', quoteData.client_id)
        .eq('name', quoteData.construction_site)
        .maybeSingle();
      if (site && site.approval_status !== 'APPROVED') {
        throw new Error(
          `La obra "${site.name}" no está aprobada. Solicita la aprobación en Finanzas → Autorización de Clientes antes de crear la cotización.`
        );
      }
    }

    // Calculate distance if not provided
    let distanceInfo: DistanceCalculation | undefined = quoteData.distance_info;
    
    if (!distanceInfo && quoteData.construction_site_id && quoteData.plant_id) {
      try {
        distanceInfo = await calculateDistanceInfo(quoteData.plant_id, quoteData.construction_site_id);
      } catch (distanceError) {
        console.warn('Error calculating distance, continuing without distance info:', distanceError);
        // Continue without distance info - will need to be calculated later
      }
    }

    // Calculate margin percentage if not provided
    // Margin is calculated from total before margin
    let marginPercentage = quoteData.margin_percentage || 0;
    
    // Calculate totals for margin calculation
    const concreteSubtotal = safeDetails.reduce((sum, detail) => {
      const transportCost = distanceInfo?.transport_cost_per_m3 || 0;
      const pricePerM3 = detail.base_price + transportCost;
      return sum + (pricePerM3 * detail.volume);
    }, 0);

    // Get special products subtotal (will be calculated separately if products are added)
    // For now, assume 0 if not provided in quoteData
    const specialProductsSubtotal = 0; // TODO: Calculate from quote_additional_products
    
    const totalPerTrip = distanceInfo?.total_per_trip || 0;
    const totalBeforeMargin = concreteSubtotal + specialProductsSubtotal + totalPerTrip;

    // If margin not provided, calculate from profit_margin in details
    if (!quoteData.margin_percentage && safeDetails.length > 0) {
      // Use average margin from details as overall margin
      const avgMargin = safeDetails.reduce((sum, d) => sum + d.profit_margin, 0) / safeDetails.length;
      marginPercentage = avgMargin;
    }

    // Determine IVA status from details
    const requiresIVA = safeDetails.length > 0 && safeDetails.every(d => d.includes_vat);

    // AUTO-APPROVAL DISABLED: All quotes require manual approval
    // Conditional auto-approval threshold based on IVA status
    // With IVA (requires receipt): 8% margin
    // Without IVA (no receipt): 14% margin
    // const autoApprovalThreshold = requiresIVA ? 8.0 : 14.0;
    // const shouldAutoApprove = marginPercentage >= autoApprovalThreshold;
    const shouldAutoApprove = false; // Auto-approval disabled
    const initialStatus = 'PENDING_APPROVAL'; // All quotes require manual approval

    // Generate quote number with range code
    const rangeCode = distanceInfo?.range_code || 'G'; // Default to G if no distance info
    const quoteNumber = generateQuoteNumber(rangeCode);

    // Extract the details array from quoteData
    const { details, distance_info, margin_percentage, ...quoteMainData } = quoteData;
    
    // Begin by creating the quote with distance and pricing information
    const quoteInsertData: any = {
      ...quoteMainData,
      created_by: authData.session.user.id,
      status: initialStatus,
      quote_number: quoteNumber,
      plant_id: quoteData.plant_id,
    };

    // Add distance-related fields
    if (distanceInfo) {
      quoteInsertData.distance_km = distanceInfo.distance_km;
      quoteInsertData.distance_range_code = distanceInfo.range_code;
      quoteInsertData.bloque_number = distanceInfo.bloque_number;
      quoteInsertData.transport_cost_per_m3 = distanceInfo.transport_cost_per_m3;
      quoteInsertData.total_per_trip = distanceInfo.total_per_trip;
    }

    // Add construction_site_id if provided
    if (quoteData.construction_site_id) {
      quoteInsertData.construction_site_id = quoteData.construction_site_id;
    }

    // Add margin and auto-approval info
    quoteInsertData.margin_percentage = marginPercentage;
    quoteInsertData.auto_approved = shouldAutoApprove;

    // Add approval info if auto-approved
    if (shouldAutoApprove) {
      quoteInsertData.approval_date = new Date().toISOString();
      quoteInsertData.approved_by = authData.session.user.id;
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
    // Include transport cost in final_price calculation
    const transportCostPerM3 = distanceInfo?.transport_cost_per_m3 || 0;
    
    const detailsWithQuoteId = (details || []).map(detail => {
      // Price per m³ = base_price + transport_cost_per_m3
      const pricePerM3 = detail.base_price + transportCostPerM3;
      // Final price includes margin
      const finalPriceWithTransport = pricePerM3 * (1 + detail.profit_margin / 100);
      const totalAmount = finalPriceWithTransport * detail.volume;

      return {
        ...detail,
        quote_id: quote.id,
        base_price: detail.base_price, // Keep original base price
        final_price: finalPriceWithTransport, // Include transport cost
        // Ensure pump_price is only included when pump_service is true
        pump_price: detail.pump_service ? detail.pump_price : null,
        total_amount: totalAmount
      };
    });
    
    if (detailsWithQuoteId.length > 0) {
      const { error: detailsError } = await supabase
        .from('quote_details')
        .insert(detailsWithQuoteId);
        
      if (detailsError) {
        const errorMessage = handleError(detailsError, 'createQuoteDetails');
        console.error(errorMessage);
        throw new Error(errorMessage);
      }
    }
    
    // NOTE: Auto-approval product_prices creation is now handled by the caller
    // (QuoteBuilder) after all details and additional products are inserted
    // This ensures the quote is complete before trying to create product_prices
    
    return quote;
  } catch (error) {
    console.error('Error al crear cotización:', error);
    throw error;
  }
}; 