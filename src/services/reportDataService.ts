import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { 
  ReportFilter, 
  ReportRemisionData, 
  ReportSummary,
  ReportConfiguration 
} from '@/types/pdf-reports';

export class ReportDataService {
  /**
   * Fetch comprehensive remisiones data for PDF reports
   * Based on existing patterns from remisiones and ventas modules
   */
  static async fetchReportData(filters: ReportFilter): Promise<{
    data: ReportRemisionData[];
    summary: ReportSummary;
  }> {
    try {
      const { dateRange, clientId, constructionSite, recipeCode, deliveryStatus, invoiceRequirement, singleDateMode } = filters;

      if (!dateRange.from || !dateRange.to) {
        throw new Error('Date range is required');
      }

      if (!clientId) {
        throw new Error('Client ID is required');
      }

      // Format dates for Supabase query
      const formattedStartDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedEndDate = format(dateRange.to, 'yyyy-MM-dd');

      // Step 1: Get all orders for the selected client
      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          construction_site,
          elemento,
          requires_invoice,
          total_amount,
          final_amount,
          invoice_amount,
          client_id,
          order_status,
          clients:client_id (
            id,
            business_name,
            client_code,
            rfc,
            address,
            contact_name,
            email
          )
        `)
        .eq('client_id', clientId);

      // Apply construction site filter if specified
      if (constructionSite && constructionSite !== 'todos') {
        ordersQuery = ordersQuery.eq('construction_site', constructionSite);
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      
      if (ordersError) throw ordersError;
      
      if (!orders || orders.length === 0) {
        return {
          data: [],
          summary: this.createEmptySummary()
        };
      }

      // Step 2: Get order items for pricing information
      const orderIds = orders.map(order => order.id);
      
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);
      
      if (itemsError) throw itemsError;

      // Step 3: Fetch remisiones with comprehensive joins
      let remisionesQuery = supabase
        .from('remisiones')
        .select(`
          *,
          recipe:recipes (
            recipe_code,
            strength_fc,
            placement_type,
            max_aggregate_size,
            slump,
            age_days
          ),
          materiales:remision_materiales(*)
        `)
        .in('order_id', orderIds);

      // Apply date filtering based on mode (same as existing remisiones module)
      if (singleDateMode && dateRange.from) {
        const dateStr = format(dateRange.from, 'yyyy-MM-dd');
        remisionesQuery = remisionesQuery.eq('fecha', dateStr);
      } else {
        remisionesQuery = remisionesQuery
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate);
      }

      // Apply recipe filter if specified
      if (recipeCode && recipeCode !== 'all') {
        // We'll filter this after the query since it's a joined field
      }

      const { data: remisionesData, error: remisionesError } = await remisionesQuery
        .order('fecha', { ascending: false });
      
      if (remisionesError) throw remisionesError;

      // Step 4: Enrich remisiones with order and client data
      const enrichedRemisiones: ReportRemisionData[] = (remisionesData || []).map(remision => {
        const order = orders.find(o => o.id === remision.order_id);
        const client = order?.clients;
        
        // Find corresponding order item for pricing
        const orderItem = orderItems?.find(item => 
          item.order_id === remision.order_id && 
          (item.product_type === remision.recipe?.recipe_code || 
           item.recipe_id?.toString() === remision.recipe?.recipe_code)
        );

        // Calculate financial fields
        const unitPrice = orderItem?.unit_price || 0;
        const lineTotal = unitPrice * remision.volumen_fabricado;
        const vatAmount = lineTotal * 0.16; // 16% VAT
        const finalTotal = lineTotal + vatAmount;

        return {
          ...remision,
          order: order ? {
            order_number: order.order_number,
            construction_site: order.construction_site,
            elemento: order.elemento,
            requires_invoice: order.requires_invoice,
            total_amount: order.total_amount,
            final_amount: order.final_amount,
            invoice_amount: order.invoice_amount,
            client_id: order.client_id
          } : undefined,
          client: client ? {
            id: client.id,
            business_name: client.business_name,
            client_code: client.client_code,
            rfc: client.rfc,
            address: client.address,
            contact_name: client.contact_name,
            email: client.email
          } : undefined,
          // Calculated financial fields
          unit_price: unitPrice,
          line_total: lineTotal,
          vat_amount: vatAmount,
          final_total: finalTotal
        };
      });

      // Step 5: Apply additional filters
      let filteredData = enrichedRemisiones;

      // Filter by recipe code if specified
      if (recipeCode && recipeCode !== 'all') {
        filteredData = filteredData.filter(item => 
          item.recipe?.recipe_code === recipeCode
        );
      }

      // Filter by delivery status if specified
      if (deliveryStatus && deliveryStatus !== 'all') {
        // For this implementation, we assume all fetched remisiones are delivered
        // This can be expanded based on business logic
      }

      // Filter by invoice requirement if specified
      if (invoiceRequirement && invoiceRequirement !== 'all') {
        const requiresInvoice = invoiceRequirement === 'with_invoice';
        filteredData = filteredData.filter(item => 
          item.order?.requires_invoice === requiresInvoice
        );
      }

      // Step 6: Generate summary
      const summary = this.generateSummary(filteredData);

      return {
        data: filteredData,
        summary
      };

    } catch (error) {
      console.error('Error fetching report data:', error);
      throw error;
    }
  }

  /**
   * Get clients that have remisiones within a date range
   * Based on existing pattern from remisiones module
   */
  static async getClientsWithRemisiones(dateRange: { from: Date; to: Date }): Promise<any[]> {
    try {
      const formattedStartDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedEndDate = format(dateRange.to, 'yyyy-MM-dd');

      // Get remisiones within date range
      const { data: remisionesInRange, error: remisionesError } = await supabase
        .from('remisiones')
        .select('order_id')
        .gte('fecha', formattedStartDate)
        .lte('fecha', formattedEndDate);
      
      if (remisionesError) throw remisionesError;
      
      if (!remisionesInRange || remisionesInRange.length === 0) {
        return [];
      }

      // Get unique order IDs
      const orderIds = Array.from(new Set(remisionesInRange.map(r => r.order_id)));
      
      // Get orders to find client IDs
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, client_id')
        .in('id', orderIds);
      
      if (ordersError) throw ordersError;
      
      if (!orders || orders.length === 0) {
        return [];
      }

      // Get unique client IDs
      const clientIds = Array.from(new Set(orders.map(order => order.client_id)));
      
      // Get client details
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          business_name,
          client_code,
          rfc,
          address,
          contact_name,
          email,
          phone
        `)
        .in('id', clientIds)
        .order('business_name');
      
      if (clientsError) throw clientsError;
      
      return clients || [];

    } catch (error) {
      console.error('Error fetching clients with remisiones:', error);
      return [];
    }
  }

  /**
   * Get construction sites for a specific client within a date range
   * Only shows sites that actually have remisiones in the selected period
   */
  static async getClientConstructionSites(clientId: string, dateRange: { from: Date; to: Date }): Promise<string[]> {
    try {
      const formattedStartDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedEndDate = format(dateRange.to, 'yyyy-MM-dd');

      // Get remisiones for this client within date range
      const { data: remisiones, error: remisionesError } = await supabase
        .from('remisiones')
        .select(`
          order_id,
          orders!inner(construction_site)
        `)
        .gte('fecha', formattedStartDate)
        .lte('fecha', formattedEndDate)
        .eq('orders.client_id', clientId);
      
      if (remisionesError) throw remisionesError;
      
      if (!remisiones || remisiones.length === 0) {
        return [];
      }

      // Get unique construction sites
      const sites = Array.from(new Set(
        remisiones
          .map(r => r.orders?.construction_site)
          .filter(site => site && site.trim() !== '')
      ));
      
      return sites.sort();

    } catch (error) {
      console.error('Error fetching client construction sites:', error);
      return [];
    }
  }

  /**
   * Get available recipe codes for filtering within a date range and for a specific client
   * Only shows recipes that actually have remisiones in the selected period for the selected client
   */
  static async getAvailableRecipeCodes(dateRange: { from: Date; to: Date }, clientId?: string): Promise<string[]> {
    try {
      const formattedStartDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedEndDate = format(dateRange.to, 'yyyy-MM-dd');

      let query = supabase
        .from('remisiones')
        .select(`
          recipe:recipes(recipe_code),
          orders!inner(client_id)
        `)
        .gte('fecha', formattedStartDate)
        .lte('fecha', formattedEndDate)
        .not('recipe_id', 'is', null);

      // Filter by client if specified
      if (clientId) {
        query = query.eq('orders.client_id', clientId);
      }
      
      const { data: remisiones, error: remisionesError } = await query;
      
      if (remisionesError) throw remisionesError;
      
      if (!remisiones || remisiones.length === 0) {
        return [];
      }

      // Get unique recipe codes
      const recipeCodes = Array.from(new Set(
        remisiones
          .map(r => r.recipe?.recipe_code)
          .filter(code => code && code.trim() !== '')
      ));
      
      return recipeCodes.sort();

    } catch (error) {
      console.error('Error fetching recipe codes:', error);
      return [];
    }
  }



  /**
   * Generate comprehensive summary from remisiones data
   */
  private static generateSummary(data: ReportRemisionData[]): ReportSummary {
    const summary: ReportSummary = {
      totalRemisiones: data.length,
      totalVolume: 0,
      totalAmount: 0,
      totalVAT: 0,
      finalTotal: 0,
      groupedByRecipe: {},
      groupedByDate: {}
    };

    data.forEach(item => {
      // Totals
      summary.totalVolume += item.volumen_fabricado;
      summary.totalAmount += item.line_total || 0;
      summary.totalVAT += item.vat_amount || 0;
      summary.finalTotal += item.final_total || 0;

      // Group by recipe
      const recipeCode = item.recipe?.recipe_code || 'Sin Receta';
      if (!summary.groupedByRecipe[recipeCode]) {
        summary.groupedByRecipe[recipeCode] = {
          count: 0,
          volume: 0,
          amount: 0
        };
      }
      summary.groupedByRecipe[recipeCode].count += 1;
      summary.groupedByRecipe[recipeCode].volume += item.volumen_fabricado;
      summary.groupedByRecipe[recipeCode].amount += item.line_total || 0;

      // Group by date
      const dateKey = format(new Date(item.fecha), 'yyyy-MM-dd');
      if (!summary.groupedByDate[dateKey]) {
        summary.groupedByDate[dateKey] = {
          count: 0,
          volume: 0,
          amount: 0
        };
      }
      summary.groupedByDate[dateKey].count += 1;
      summary.groupedByDate[dateKey].volume += item.volumen_fabricado;
      summary.groupedByDate[dateKey].amount += item.line_total || 0;
    });

    return summary;
  }

  /**
   * Create empty summary for when no data is found
   */
  private static createEmptySummary(): ReportSummary {
    return {
      totalRemisiones: 0,
      totalVolume: 0,
      totalAmount: 0,
      totalVAT: 0,
      finalTotal: 0,
      groupedByRecipe: {},
      groupedByDate: {}
    };
  }

  /**
   * Validate report configuration
   */
  static validateReportConfiguration(config: ReportConfiguration): string[] {
    const errors: string[] = [];

    if (!config.filters.dateRange.from || !config.filters.dateRange.to) {
      errors.push('Rango de fechas es requerido');
    }

    if (!config.filters.clientId) {
      errors.push('Cliente es requerido');
    }

    if (config.selectedColumns.length === 0) {
      errors.push('Al menos una columna debe estar seleccionada');
    }

    if (config.filters.dateRange.from && config.filters.dateRange.to) {
      if (config.filters.dateRange.from > config.filters.dateRange.to) {
        errors.push('La fecha de inicio debe ser anterior a la fecha de fin');
      }

      // Check if date range is too large (performance consideration)
      const daysDiff = Math.abs(
        (config.filters.dateRange.to.getTime() - config.filters.dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysDiff > 365) {
        errors.push('El rango de fechas no puede ser mayor a 365 días');
      }
    }

    return errors;
  }

  /**
   * Transform data for specific column configuration
   * This ensures only selected columns are processed for PDF generation
   */
  static transformDataForColumns(
    data: ReportRemisionData[], 
    selectedColumnIds: string[]
  ): any[] {
    return data.map((item, index) => {
      const transformedItem: any = {
        // Ensure unique ID for each transformed item
        _uniqueId: item.id || `transformed-${index}`
      };
      
      selectedColumnIds.forEach(columnId => {
        switch (columnId) {
          case 'remision_number':
            transformedItem.remision_number = item.remision_number;
            break;
          case 'fecha':
            transformedItem.fecha = item.fecha;
            break;
          case 'construction_site':
            transformedItem.construction_site = item.order?.construction_site;
            break;
          case 'volumen_fabricado':
            transformedItem.volumen_fabricado = item.volumen_fabricado;
            break;
          case 'conductor':
            transformedItem.conductor = item.conductor;
            break;
          case 'unidad':
            transformedItem.unidad = item.unidad;
            break;
          case 'recipe_code':
            transformedItem.recipe_code = item.recipe?.recipe_code;
            break;
          case 'strength_fc':
            transformedItem.strength_fc = item.recipe?.strength_fc;
            break;
          case 'placement_type':
            transformedItem.placement_type = item.recipe?.placement_type;
            break;
          case 'max_aggregate_size':
            transformedItem.max_aggregate_size = item.recipe?.max_aggregate_size;
            break;
          case 'slump':
            transformedItem.slump = item.recipe?.slump;
            break;
          case 'unit_price':
            transformedItem.unit_price = item.unit_price;
            break;
          case 'line_total':
            transformedItem.line_total = item.line_total;
            break;
          case 'vat_amount':
            transformedItem.vat_amount = item.vat_amount;
            break;
          case 'final_total':
            transformedItem.final_total = item.final_total;
            break;
          case 'order_number':
            transformedItem.order_number = item.order?.order_number;
            break;
          case 'requires_invoice':
            transformedItem.requires_invoice = item.order?.requires_invoice;
            break;
          case 'business_name':
            transformedItem.business_name = item.client?.business_name;
            break;
          case 'client_rfc':
            transformedItem.client_rfc = item.client?.rfc;
            break;
          default:
            // Handle nested field access with dot notation
            const value = this.getNestedValue(item, columnId);
            if (value !== undefined) {
              transformedItem[columnId] = value;
            }
        }
      });
      
      return transformedItem;
    });
  }

  /**
   * Helper to get nested values from objects using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}
