import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { 
  ReportFilter, 
  ReportRemisionData, 
  ReportSummary,
  ReportConfiguration,
  HierarchicalReportData,
  SelectableClient,
  SelectableOrder,
  SelectableRemision,
  SelectionSummary
} from '@/types/pdf-reports';

export class ReportDataService {
  /**
   * Fetch hierarchical data for flexible selection
   * Supports multi-client, multi-order, and multi-remision selection
   */
  static async fetchHierarchicalData(dateRange: { from: Date; to: Date }): Promise<HierarchicalReportData> {
    try {
      if (!dateRange.from || !dateRange.to) {
        throw new Error('Date range is required');
      }

      const formattedStartDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedEndDate = format(dateRange.to, 'yyyy-MM-dd');

      // Get all remisiones within date range with full relationships
      const { data: remisionesData, error: remisionesError } = await supabase
        .from('remisiones')
        .select(`
          id,
          remision_number,
          fecha,
          order_id,
          volumen_fabricado,
          conductor,
          unidad,
          tipo_remision,
          recipe:recipes (
            recipe_code,
            strength_fc,
            placement_type,
            max_aggregate_size,
            slump,
            age_days
          ),
          orders!inner(
            id,
            order_number,
            construction_site,
            elemento,
            requires_invoice,
            total_amount,
            final_amount,
            client_id,
            order_status,
            clients!inner(
              id,
              business_name,
              client_code,
              rfc,
              address,
              contact_name,
              email
            )
          ),
          plant:plants (
            id,
            code,
            name,
            business_unit:business_units (
              id,
              name,
              vat_rate
            )
          )
        `)
        .gte('fecha', formattedStartDate)
        .lte('fecha', formattedEndDate)
        .order('fecha', { ascending: false });

      if (remisionesError) throw remisionesError;

      if (!remisionesData || remisionesData.length === 0) {
        return {
          clients: [],
          selectionSummary: {
            totalClients: 0,
            totalOrders: 0,
            totalRemisiones: 0,
            totalVolume: 0,
            totalAmount: 0,
            selectedClients: [],
            selectedOrders: [],
            selectedRemisiones: []
          }
        };
      }

      // Get order items for pricing
      const orderIds = Array.from(new Set(remisionesData.map(r => r.order_id)));
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      // Build hierarchical structure
      const clientsMap = new Map<string, SelectableClient>();

      remisionesData.forEach(remision => {
        const order = remision.orders;
        const client = order?.clients;
        
        if (!client || !order) return;

        // Find order item for pricing
        const orderItem = orderItems?.find(item => 
          item.order_id === remision.order_id && 
          (item.product_type === remision.recipe?.recipe_code || 
           item.recipe_id?.toString() === remision.recipe?.recipe_code)
        );

        const unitPrice = orderItem?.unit_price || 0;
        const lineTotal = unitPrice * remision.volumen_fabricado;

        // Build client structure
        if (!clientsMap.has(client.id)) {
          clientsMap.set(client.id, {
            id: client.id,
            business_name: client.business_name,
            client_code: client.client_code,
            rfc: client.rfc,
            selected: false,
            orders: []
          });
        }

        const clientData = clientsMap.get(client.id)!;
        
        // Find or create order
        let orderData = clientData.orders.find(o => o.id === order.id);
        if (!orderData) {
          orderData = {
            id: order.id,
            order_number: order.order_number,
            construction_site: order.construction_site,
            elemento: order.elemento,
            client_id: client.id,
            client_name: client.business_name,
            total_remisiones: 0,
            total_volume: 0,
            total_amount: 0,
            selected: false,
            remisiones: []
          };
          clientData.orders.push(orderData);
        }

        // Add remision
        const remisionData: SelectableRemision = {
          id: remision.id,
          remision_number: remision.remision_number,
          fecha: remision.fecha,
          order_id: remision.order_id,
          volumen_fabricado: remision.volumen_fabricado,
          recipe_code: remision.recipe?.recipe_code,
          conductor: remision.conductor,
          line_total: lineTotal,
          selected: false,
          plant_info: remision.plant ? {
            plant_id: remision.plant.id,
            plant_code: remision.plant.code,
            plant_name: remision.plant.name,
            vat_percentage: remision.plant.business_unit?.vat_rate || 16
          } : undefined
        };

        orderData.remisiones.push(remisionData);
        orderData.total_remisiones += 1;
        orderData.total_volume += remision.volumen_fabricado;
        orderData.total_amount += lineTotal;
      });

      const clients = Array.from(clientsMap.values());
      
      // Calculate totals
      const totalRemisiones = clients.reduce((sum, c) => 
        sum + c.orders.reduce((orderSum, o) => orderSum + o.total_remisiones, 0), 0
      );
      const totalVolume = clients.reduce((sum, c) => 
        sum + c.orders.reduce((orderSum, o) => orderSum + o.total_volume, 0), 0
      );
      const totalAmount = clients.reduce((sum, c) => 
        sum + c.orders.reduce((orderSum, o) => orderSum + o.total_amount, 0), 0
      );

      return {
        clients,
        selectionSummary: {
          totalClients: clients.length,
          totalOrders: clients.reduce((sum, c) => sum + c.orders.length, 0),
          totalRemisiones,
          totalVolume,
          totalAmount,
          selectedClients: [],
          selectedOrders: [],
          selectedRemisiones: []
        }
      };

    } catch (error) {
      console.error('Error fetching hierarchical data:', error);
      throw error;
    }
  }

  /**
   * Fetch comprehensive remisiones data for PDF reports
   * Enhanced to support multiple selections
   */
  static async fetchReportData(filters: ReportFilter): Promise<{
    data: ReportRemisionData[];
    summary: ReportSummary;
  }> {
    try {
      const { dateRange } = filters;

      if (!dateRange.from || !dateRange.to) {
        throw new Error('Date range is required');
      }

      // Support both single and multiple selection across levels
      const clientIds = filters.clientIds && filters.clientIds.length > 0 ? filters.clientIds : 
                       (filters.clientId ? [filters.clientId] : []);
      const orderIdsFilter = filters.orderIds && filters.orderIds.length > 0 ? filters.orderIds : [];
      const remisionIdsFilter = filters.remisionIds && filters.remisionIds.length > 0 ? filters.remisionIds : [];

      // Require at least one selection at any level
      if (clientIds.length === 0 && orderIdsFilter.length === 0 && remisionIdsFilter.length === 0) {
        throw new Error('Debe seleccionar al menos una remisión, orden o cliente');
      }

      // Format dates for Supabase query
      const formattedStartDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedEndDate = format(dateRange.to, 'yyyy-MM-dd');

      // Prepare variables used across branches
      let orders: any[] = [];
      let orderItems: any[] | null = null;

      // Branch A: Remisión-level selection → fetch remisiones first, then orders/items
      if (remisionIdsFilter.length > 0) {
        // Fetch remisiones by IDs only (avoid also filtering by order to keep URL small)
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
            materiales:remision_materiales(*),
            plant:plants (
              id,
              code,
              name,
              business_unit:business_units (
                id,
                name,
                vat_rate
              )
            )
          `)
          .in('id', remisionIdsFilter);

        // Apply date filtering
        if (filters.singleDateMode && dateRange.from) {
          const dateStr = format(dateRange.from, 'yyyy-MM-dd');
          remisionesQuery = remisionesQuery.eq('fecha', dateStr);
        } else {
          remisionesQuery = remisionesQuery
            .gte('fecha', formattedStartDate)
            .lte('fecha', formattedEndDate);
        }

        // Apply plant filter
        if (filters.plantIds && filters.plantIds.length > 0) {
          remisionesQuery = remisionesQuery.in('plant_id', filters.plantIds);
        }

        const { data: remisionesData, error: remisionesError } = await remisionesQuery
          .order('fecha', { ascending: false });
        if (remisionesError) throw remisionesError;

        // If nothing found
        if (!remisionesData || remisionesData.length === 0) {
          return { data: [], summary: this.createEmptySummary() };
        }

        // Fetch orders and order_items for these remisiones
        const orderIds = Array.from(new Set(remisionesData.map(r => r.order_id)));
        const ordersQuery = supabase
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
          .in('id', orderIds);
        const { data: ordersData, error: ordersErr } = await ordersQuery;
        if (ordersErr) throw ordersErr;
        orders = ordersData || [];

        const { data: itemsData, error: itemsErr } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);
        if (itemsErr) throw itemsErr;
        orderItems = itemsData || [];

        // Continue to enrichment step using remisionesData
        // Enrichment code below will use current scope remisionesData
        // so we assign it to a common variable via closure
        var remisionesDataForEnrichment = remisionesData;

        // Enrichment and post-filtering moved below common block

        // Continue after common block
        // eslint-disable-next-line no-inner-declarations
        const enrichAndReturn = () => {
          // Step 4: Enrich remisiones with order and client data
          const enrichedRemisiones: ReportRemisionData[] = (remisionesDataForEnrichment || []).map(remision => {
            const order = orders.find(o => o.id === remision.order_id);
            const client = order?.clients;
            const orderItem = orderItems?.find(item => 
              item.order_id === remision.order_id && 
              (item.product_type === remision.recipe?.recipe_code || 
               item.recipe_id?.toString() === remision.recipe?.recipe_code)
            );
            const unitPrice = orderItem?.unit_price || 0;
            const lineTotal = unitPrice * remision.volumen_fabricado;
            const vatRate = remision.plant?.business_unit?.vat_rate || 16;
            const vatAmount = lineTotal * (vatRate / 100);
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
              unit_price: unitPrice,
              line_total: lineTotal,
              vat_amount: vatAmount,
              final_total: finalTotal,
              plant_info: remision.plant ? {
                plant_id: remision.plant.id,
                plant_code: remision.plant.code,
                plant_name: remision.plant.name,
                vat_percentage: vatRate
              } : undefined
            };
          });

          // Step 5: Apply additional filters (recipe, invoice)
          let filteredData = enrichedRemisiones;
          if (filters.recipeCodes && filters.recipeCodes.length > 0) {
            filteredData = filteredData.filter(item => 
              item.recipe?.recipe_code && filters.recipeCodes!.includes(item.recipe.recipe_code)
            );
          } else if (filters.recipeCode && filters.recipeCode !== 'all') {
            filteredData = filteredData.filter(item => 
              item.recipe?.recipe_code === filters.recipeCode
            );
          }
          if (filters.invoiceRequirement && filters.invoiceRequirement !== 'all') {
            const requiresInvoice = filters.invoiceRequirement === 'with_invoice';
            filteredData = filteredData.filter(item => 
              item.order?.requires_invoice === requiresInvoice
            );
          }

          const summary = this.generateSummary(filteredData);
          return { data: filteredData, summary };
        };

        return enrichAndReturn();
      }

      // Branch B: Order-level selection → fetch those orders
      if (orderIdsFilter.length > 0) {
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
          .in('id', orderIdsFilter);

        // Apply construction site filter if specified (multiple sites supported)
        if (filters.constructionSites && filters.constructionSites.length > 0) {
          ordersQuery = ordersQuery.in('construction_site', filters.constructionSites);
        } else if (filters.constructionSite && filters.constructionSite !== 'todos') {
          ordersQuery = ordersQuery.eq('construction_site', filters.constructionSite);
        }

        const { data: ordersData, error: ordersError } = await ordersQuery;
        if (ordersError) throw ordersError;
        if (!ordersData || ordersData.length === 0) {
          return { data: [], summary: this.createEmptySummary() };
        }
        orders = ordersData;

        const orderIds = orders.map(o => o.id);
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);
        if (itemsError) throw itemsError;
        orderItems = itemsData || [];

        // Fetch remisiones for these orders
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
            materiales:remision_materiales(*),
            plant:plants (
              id,
              code,
              name,
              business_unit:business_units (
                id,
                name,
                vat_rate
              )
            )
          `)
          .in('order_id', orderIds);

        if (filters.singleDateMode && dateRange.from) {
          const dateStr = format(dateRange.from, 'yyyy-MM-dd');
          remisionesQuery = remisionesQuery.eq('fecha', dateStr);
        } else {
          remisionesQuery = remisionesQuery
            .gte('fecha', formattedStartDate)
            .lte('fecha', formattedEndDate);
        }
        if (filters.plantIds && filters.plantIds.length > 0) {
          remisionesQuery = remisionesQuery.in('plant_id', filters.plantIds);
        }
        const { data: remisionesData, error: remisionesError } = await remisionesQuery.order('fecha', { ascending: false });
        if (remisionesError) throw remisionesError;

        // Enrich and return
        const enrichedRemisiones: ReportRemisionData[] = (remisionesData || []).map(remision => {
          const order = orders.find(o => o.id === remision.order_id);
          const client = order?.clients;
          const orderItem = orderItems?.find(item => 
            item.order_id === remision.order_id && 
            (item.product_type === remision.recipe?.recipe_code || 
             item.recipe_id?.toString() === remision.recipe?.recipe_code)
          );
          const unitPrice = orderItem?.unit_price || 0;
          const lineTotal = unitPrice * remision.volumen_fabricado;
          const vatRate = remision.plant?.business_unit?.vat_rate || 16;
          const vatAmount = lineTotal * (vatRate / 100);
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
            unit_price: unitPrice,
            line_total: lineTotal,
            vat_amount: vatAmount,
            final_total: finalTotal,
            plant_info: remision.plant ? {
              plant_id: remision.plant.id,
              plant_code: remision.plant.code,
              plant_name: remision.plant.name,
              vat_percentage: vatRate
            } : undefined
          };
        });

        let filteredData = enrichedRemisiones;
        if (filters.recipeCodes && filters.recipeCodes.length > 0) {
          filteredData = filteredData.filter(item => 
            item.recipe?.recipe_code && filters.recipeCodes!.includes(item.recipe.recipe_code)
          );
        } else if (filters.recipeCode && filters.recipeCode !== 'all') {
          filteredData = filteredData.filter(item => 
            item.recipe?.recipe_code === filters.recipeCode
          );
        }
        if (filters.invoiceRequirement && filters.invoiceRequirement !== 'all') {
          const requiresInvoice = filters.invoiceRequirement === 'with_invoice';
          filteredData = filteredData.filter(item => 
            item.order?.requires_invoice === requiresInvoice
          );
        }

        const summary = this.generateSummary(filteredData);
        return { data: filteredData, summary };
      }

      // Branch C: Client-level selection (existing flow)
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
        .in('client_id', clientIds);

      if (filters.constructionSites && filters.constructionSites.length > 0) {
        ordersQuery = ordersQuery.in('construction_site', filters.constructionSites);
      } else if (filters.constructionSite && filters.constructionSite !== 'todos') {
        ordersQuery = ordersQuery.eq('construction_site', filters.constructionSite);
      }
      if (filters.orderIds && filters.orderIds.length > 0) {
        ordersQuery = ordersQuery.in('id', filters.orderIds);
      }

      const { data: ordersClient, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;
      if (!ordersClient || ordersClient.length === 0) {
        return {
          data: [],
          summary: this.createEmptySummary()
        };
      }
      orders = ordersClient;

      const orderIds = orders.map(order => order.id);
      const { data: orderItemsClient, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);
      if (itemsError) throw itemsError;
      orderItems = orderItemsClient || [];

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
          materiales:remision_materiales(*),
          plant:plants (
            id,
            code,
            name,
            business_unit:business_units (
              id,
              name,
              vat_rate
            )
          )
        `)
        .in('order_id', orderIds);

      // Apply date filtering based on mode (same as existing remisiones module)
      if (filters.singleDateMode && dateRange.from) {
        const dateStr = format(dateRange.from, 'yyyy-MM-dd');
        remisionesQuery = remisionesQuery.eq('fecha', dateStr);
      } else {
        remisionesQuery = remisionesQuery
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate);
      }

      // Apply specific remision filter if specified
      if (filters.remisionIds && filters.remisionIds.length > 0) {
        remisionesQuery = remisionesQuery.in('id', filters.remisionIds);
      }

      // Apply plant filter if specified (multiple plants supported)
      if (filters.plantIds && filters.plantIds.length > 0) {
        remisionesQuery = remisionesQuery.in('plant_id', filters.plantIds);
      }

      // Apply recipe filter if specified (multiple recipes supported)
      // We'll filter this after the query since it's a joined field

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
        const vatRate = remision.plant?.business_unit?.vat_rate || 16; // Use plant's business unit VAT rate or default to 16%
        const vatAmount = lineTotal * (vatRate / 100);
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
          final_total: finalTotal,
          // Plant information for VAT calculation
          plant_info: remision.plant ? {
            plant_id: remision.plant.id,
            plant_code: remision.plant.code,
            plant_name: remision.plant.name,
            vat_percentage: vatRate
          } : undefined
        };
      });

      // Step 5: Apply additional filters
      let filteredData = enrichedRemisiones;

      // Filter by recipe code if specified (multiple recipes supported)
      if (filters.recipeCodes && filters.recipeCodes.length > 0) {
        filteredData = filteredData.filter(item => 
          item.recipe?.recipe_code && filters.recipeCodes!.includes(item.recipe.recipe_code)
        );
      } else if (filters.recipeCode && filters.recipeCode !== 'all') {
        filteredData = filteredData.filter(item => 
          item.recipe?.recipe_code === filters.recipeCode
        );
      }

      // Filter by delivery status if specified
      if (filters.deliveryStatus && filters.deliveryStatus !== 'all') {
        // For this implementation, we assume all fetched remisiones are delivered
        // This can be expanded based on business logic
      }

      // Filter by invoice requirement if specified
      if (filters.invoiceRequirement && filters.invoiceRequirement !== 'all') {
        const requiresInvoice = filters.invoiceRequirement === 'with_invoice';
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
   * Get construction sites for multiple clients within a date range
   * Only shows sites that actually have remisiones in the selected period
   */
  static async getConstructionSitesForClients(clientIds: string[], dateRange: { from: Date; to: Date }): Promise<string[]> {
    try {
      if (clientIds.length === 0) return [];
      
      const formattedStartDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedEndDate = format(dateRange.to, 'yyyy-MM-dd');

      // Get remisiones for these clients within date range
      const { data: remisiones, error: remisionesError } = await supabase
        .from('remisiones')
        .select(`
          order_id,
          orders!inner(construction_site)
        `)
        .gte('fecha', formattedStartDate)
        .lte('fecha', formattedEndDate)
        .in('orders.client_id', clientIds);
      
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
      console.error('Error fetching construction sites for clients:', error);
      return [];
    }
  }

  /**
   * Get construction sites for a specific client within a date range
   * Only shows sites that actually have remisiones in the selected period
   * @deprecated Use getConstructionSitesForClients instead
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
   * Get available recipe codes for filtering within a date range and for multiple clients
   * Only shows recipes that actually have remisiones in the selected period for the selected clients
   */
  static async getAvailableRecipeCodesForClients(dateRange: { from: Date; to: Date }, clientIds?: string[]): Promise<string[]> {
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

      // Filter by clients if specified
      if (clientIds && clientIds.length > 0) {
        query = query.in('orders.client_id', clientIds);
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
      console.error('Error fetching recipe codes for clients:', error);
      return [];
    }
  }

  /**
   * Get available recipe codes for filtering within a date range and for a specific client
   * Only shows recipes that actually have remisiones in the selected period for the selected client
   * @deprecated Use getAvailableRecipeCodesForClients instead
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

    // Do not require explicit clientId; selection can be at order/remision level

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
