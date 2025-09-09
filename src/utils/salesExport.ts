import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface OrderItem {
  id: string;
  product_type: string;
  unit_price: number;
  pump_price?: number;
  volume: number;
  empty_truck_volume?: number;
  total_price?: number;
  has_pump_service?: boolean;
  has_empty_truck_charge?: boolean;
  empty_truck_price?: number;
}

interface Order {
  id: string;
  order_number: string;
  clientName?: string;
  clients?: {
    business_name: string;
  };
  requires_invoice: boolean;
  items?: OrderItem[];
}

interface Remision {
  id: string;
  remision_number: string;
  fecha: string;
  tipo_remision: string;
  volumen_fabricado: number;
  order_id: string;
  isVirtualVacioDeOlla?: boolean;
  originalOrderItem?: OrderItem;
  recipe?: {
    recipe_code: string;
  };
}

interface ExportData {
  'Remisión': string;
  'Fecha': string;
  'Cliente': string;
  'Código Producto': string;
  'Producto': string;
  'Volumen (m³)': string;
  'Precio de Venta': string;
  'SubTotal': string;
  'Tipo Facturación': string;
  'Número de Orden': string;
}

export const exportSalesToExcel = (
  filteredRemisionesWithVacioDeOlla: Remision[],
  salesData: Order[],
  summaryMetrics: any,
  includeVAT: boolean,
  VAT_RATE: number,
  startDate: Date | undefined,
  endDate: Date | undefined
) => {
  try {
    // Helper function for Excel export (same logic as table display)
    const findOrderItemForRemisionExport = (order: Order, remision: Remision) => {
      if (!order?.items) return null;

      const recipeCode = remision.recipe?.recipe_code;

      // For BOMBEO, find item with pump service
      if (remision.tipo_remision === 'BOMBEO') {
        return order.items.find((item: any) => item.has_pump_service === true);
      }

      // For VACÍO DE OLLA, find empty truck item
      if (recipeCode === 'SER001' || remision.tipo_remision === 'VACÍO DE OLLA') {
        return order.items.find((item: any) =>
          item.product_type === 'VACÍO DE OLLA' ||
          item.product_type === 'EMPTY_TRUCK_CHARGE' ||
          item.has_empty_truck_charge === true
        );
      }

      // For concrete, match by recipe_id or product_type
      return order.items.find((item: any) => {
        // First try exact recipe_id match
        if (item.recipe_id && remision.recipe?.id) {
          return item.recipe_id === remision.recipe.id;
        }
        // Then try recipe_id as string match with recipe_code
        if (item.recipe_id && recipeCode) {
          return item.recipe_id.toString() === recipeCode;
        }
        // Finally try product_type match
        if (item.product_type && recipeCode) {
          return item.product_type === recipeCode;
        }
        return false;
      });
    };

    // Prepare data for export - using consistent calculation logic
    const excelData: ExportData[] = filteredRemisionesWithVacioDeOlla.map((remision) => {
      // Find the order for this remision
      const order = salesData.find(o => o.id === remision.order_id);

      // Handle virtual vacío de olla entries
      if (remision.isVirtualVacioDeOlla && remision.originalOrderItem) {
        const orderItem = remision.originalOrderItem;
        const unitCount = parseFloat(orderItem.empty_truck_volume?.toString() || '') || parseFloat(orderItem.volume?.toString() || '') || 1;
        let unitPrice = 0;
        let calculatedAmount = 0;

        if (orderItem.total_price) {
          calculatedAmount = parseFloat(orderItem.total_price.toString());
          unitPrice = unitCount > 0 ? calculatedAmount / unitCount : 0;
        } else {
          unitPrice = parseFloat(orderItem.unit_price?.toString() || '') ||
                      parseFloat(orderItem.empty_truck_price?.toString() || '') || 0;
          calculatedAmount = unitPrice * unitCount;
        }

        const date = order?.delivery_date ?
          new Date(order.delivery_date + 'T00:00:00') :
          new Date();
        const formattedDate = isValid(date) ?
          format(date, 'dd/MM/yyyy', { locale: es }) :
          'Fecha inválida';

        return {
          'Remisión': remision.remision_number,
          'Fecha': formattedDate,
          'Cliente': order?.clientName || order?.clients?.business_name || 'N/A',
          'Código Producto': 'SER001',
          'Producto': 'VACIO DE OLLA',
          'Volumen (m³)': unitCount.toFixed(1),
          'Precio de Venta': `$${unitPrice.toFixed(2)}`,
          'SubTotal': `$${calculatedAmount.toFixed(2)}`,
          'Tipo Facturación': order?.requires_invoice ? 'Fiscal' : 'Efectivo',
          'Número de Orden': order?.order_number || 'N/A'
        };
      }

      // Handle regular remisiones with improved matching
      const recipeCode = remision.recipe?.recipe_code;
      const orderItem = findOrderItemForRemisionExport(order!, remision);

      let unitPrice = 0;
      let calculatedAmount = 0;
      const volume = remision.volumen_fabricado || 0;
      let displayVolume = volume;

      if (orderItem) {
        if (remision.tipo_remision === 'BOMBEO') {
          // Pump service
          unitPrice = parseFloat(orderItem.pump_price?.toString() || '0');
          calculatedAmount = unitPrice * volume;
          displayVolume = volume;

        } else if (recipeCode === 'SER001' || remision.tipo_remision === 'VACÍO DE OLLA') {
          // Empty truck charge
          const unitCount = parseFloat(orderItem.empty_truck_volume?.toString() || '') || parseFloat(orderItem.volume?.toString() || '') || 1;

          if (orderItem.total_price) {
            calculatedAmount = parseFloat(orderItem.total_price.toString());
            unitPrice = unitCount > 0 ? calculatedAmount / unitCount : 0;
          } else {
            unitPrice = parseFloat(orderItem.unit_price?.toString() || '') || parseFloat(orderItem.empty_truck_price?.toString() || '') || 0;
            calculatedAmount = unitPrice * unitCount;
          }
          displayVolume = unitCount;

        } else {
          // Regular concrete
          unitPrice = parseFloat(orderItem.unit_price?.toString() || '0');
          calculatedAmount = unitPrice * volume;
          displayVolume = volume;
        }
      }

      // Fix date handling to avoid timezone issues
      const date = remision.fecha ?
        new Date(remision.fecha + 'T00:00:00') :
        new Date();
      const formattedDate = isValid(date) ?
        format(date, 'dd/MM/yyyy', { locale: es }) :
        'Fecha inválida';

      return {
        'Remisión': remision.remision_number,
        'Fecha': formattedDate,
        'Cliente': order?.clientName || order?.clients?.business_name || 'N/A',
        'Código Producto': remision.tipo_remision === 'BOMBEO' ? 'SER002' :
          recipeCode === 'SER001' || remision.tipo_remision === 'VACÍO DE OLLA' ? 'SER001' :
          recipeCode || 'N/A',
        'Producto': remision.tipo_remision === 'BOMBEO' ? 'SERVICIO DE BOMBEO' :
          recipeCode === 'SER001' || remision.tipo_remision === 'VACÍO DE OLLA' ? 'VACIO DE OLLA' :
          'CONCRETO PREMEZCLADO',
        'Volumen (m³)': displayVolume.toFixed(1),
        'Precio de Venta': `$${unitPrice.toFixed(2)}`,
        'SubTotal': `$${calculatedAmount.toFixed(2)}`,
        'Tipo Facturación': order?.requires_invoice ? 'Fiscal' : 'Efectivo',
        'Número de Orden': order?.order_number || 'N/A'
      };
    });

    // Add summary row
    const summaryRow: ExportData = {
      'Remisión': 'TOTAL',
      'Fecha': '',
      'Cliente': '',
      'Código Producto': '',
      'Producto': '',
      'Volumen (m³)': summaryMetrics.totalVolume.toFixed(1),
      'Precio de Venta': '',
      'SubTotal': `$${includeVAT ? summaryMetrics.totalAmountWithVAT.toFixed(2) : summaryMetrics.totalAmount.toFixed(2)}`,
      'Tipo Facturación': '',
      'Número de Orden': ''
    };

    excelData.push(summaryRow);

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const columnWidths = [
      { wch: 15 }, // Remisión
      { wch: 12 }, // Fecha
      { wch: 25 }, // Cliente
      { wch: 15 }, // Código Producto
      { wch: 20 }, // Producto
      { wch: 12 }, // Volumen
      { wch: 15 }, // Precio de Venta
      { wch: 15 }, // SubTotal
      { wch: 15 }, // Tipo Facturación
      { wch: 15 }  // Número de Orden
    ];
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte de Ventas');

    // Generate filename with date range
    const startDateStr = startDate ? format(startDate, 'dd-MM-yyyy') : 'fecha';
    const endDateStr = endDate ? format(endDate, 'dd-MM-yyyy') : 'fecha';
    const filename = `Reporte_Ventas_${startDateStr}_${endDateStr}.xlsx`;

    // Write and download the file
    XLSX.writeFile(workbook, filename);

    // Show success message (optional - you might want to add a toast notification)
    console.log('Excel file exported successfully');

    return { success: true, filename };
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
