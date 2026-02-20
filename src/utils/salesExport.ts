import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { findProductPrice } from './salesDataProcessor';

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
  recipe_id?: string;
  order_id?: string;
  billing_type?: 'PER_M3' | 'PER_ORDER_FIXED' | 'PER_UNIT' | null;
  quote_details?: {
    recipe_id?: string;
    final_price?: number;
  } | Array<{
    recipe_id?: string;
    final_price?: number;
  }>;
}

interface Order {
  id: string;
  order_number: string;
  clientName?: string;
  clients?: {
    business_name: string;
  };
  requires_invoice: boolean;
  delivery_date?: string;
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
    id?: string; // UUID for proper matching
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
    // Extract all order items from salesData for sophisticated price matching
    // Note: order items include quote_details relationship which contains recipe_id
    // when the order_item.recipe_id is null. The findProductPrice utility prioritizes
    // quote_details.recipe_id as the first matching strategy.
    const allOrderItems = salesData.flatMap(order => 
      (order.items || []).map((item: any) => ({
        ...item,
        order_id: order.id // Ensure order_id is present
      }))
    );
    const concreteVolumeByOrder = filteredRemisionesWithVacioDeOlla.reduce((acc, remision) => {
      if (remision.tipo_remision === 'CONCRETO' && !remision.isVirtualVacioDeOlla) {
        acc[remision.order_id] = (acc[remision.order_id] || 0) + (Number(remision.volumen_fabricado) || 0);
      }
      return acc;
    }, {} as Record<string, number>);
    const referenceRemisionByOrder = new Map<string, Remision>();
    filteredRemisionesWithVacioDeOlla.forEach((remision) => {
      if (!referenceRemisionByOrder.has(remision.order_id)) {
        referenceRemisionByOrder.set(remision.order_id, remision);
      }
    });

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

      // Handle regular remisiones with sophisticated price matching
      const recipeCode = remision.recipe?.recipe_code;
      const recipeId = remision.recipe?.id; // Use the UUID for proper matching
      const volume = remision.volumen_fabricado || 0;

      // Determine product type for price lookup
      let productType = recipeCode || 'PRODUCTO';
      let displayVolume = volume;
      
      const isEmptyTruck = recipeCode === 'SER001';
      const isBombeo = remision.tipo_remision === 'BOMBEO';
      
      if (isBombeo) {
        productType = 'SER002'; // Bombeo service code
      } else if (isEmptyTruck) {
        productType = 'SER001'; // Empty truck code
        displayVolume = 1; // Empty truck is counted as 1 unit
      }

      // Use sophisticated price matching (same as table display)
      const unitPrice = findProductPrice(productType, remision.order_id, recipeId, allOrderItems);
      const calculatedAmount = unitPrice * displayVolume;

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
        'Código Producto': isBombeo ? 'SER002' :
          isEmptyTruck ? 'SER001' :
          recipeCode || 'N/A',
        'Producto': isBombeo ? 'SERVICIO DE BOMBEO' :
          isEmptyTruck ? 'VACIO DE OLLA' :
          'CONCRETO PREMEZCLADO',
        'Volumen (m³)': displayVolume.toFixed(1),
        'Precio de Venta': `$${unitPrice.toFixed(2)}`,
        'SubTotal': `$${calculatedAmount.toFixed(2)}`,
        'Tipo Facturación': order?.requires_invoice ? 'Fiscal' : 'Efectivo',
        'Número de Orden': order?.order_number || 'N/A'
      };
    });

    // Add additional product rows for all orders (with or without remisiones)
    let additionalSubtotalNoVAT = 0;
    let additionalSubtotalWithVAT = 0;
    salesData.forEach((order) => {
      const additionalItems = (order.items || []).filter(i => i.product_type?.startsWith('PRODUCTO ADICIONAL:'));
      if (additionalItems.length === 0) return;

      const referenceRemision = referenceRemisionByOrder.get(order.id);
      const rowDate = referenceRemision?.fecha || order.delivery_date || '';
      const rowDateObj = rowDate ? new Date(`${rowDate}T00:00:00`) : new Date();
      const formattedDate = isValid(rowDateObj) ? format(rowDateObj, 'dd/MM/yyyy', { locale: es }) : 'Fecha inválida';
      const orderConcreteVolume = concreteVolumeByOrder[order.id] || 0;

      additionalItems.forEach((item) => {
        const billingType = item.billing_type || 'PER_M3';
        const qtyOrRate = Number(item.volume || 0);
        const unitPrice = Number(item.unit_price || 0);
        const subtotal =
          billingType === 'PER_ORDER_FIXED'
            ? unitPrice
            : billingType === 'PER_UNIT'
              ? qtyOrRate * unitPrice
              : orderConcreteVolume * unitPrice;
        const exportQty =
          billingType === 'PER_ORDER_FIXED'
            ? 1
            : billingType === 'PER_UNIT'
              ? qtyOrRate
              : orderConcreteVolume;
        const codeMatch = item.product_type?.match(/\(([^)]+)\)\s*$/);
        const productCode = codeMatch?.[1] || 'ADDL';
        const productLabel = item.product_type?.replace(/^PRODUCTO ADICIONAL:\s*/, '') || 'PRODUCTO ADICIONAL';
        const billingLabel =
          billingType === 'PER_ORDER_FIXED'
            ? 'ADICIONAL (FIJO ORDEN)'
            : billingType === 'PER_UNIT'
              ? 'ADICIONAL (POR UNIDAD)'
              : 'ADICIONAL (POR M3)';

        additionalSubtotalNoVAT += subtotal;
        additionalSubtotalWithVAT += includeVAT && order.requires_invoice ? subtotal * (1 + VAT_RATE) : subtotal;

        excelData.push({
          'Remisión': referenceRemision?.remision_number || `SIN-REMISION-${order.order_number}`,
          'Fecha': formattedDate,
          'Cliente': order.clientName || order.clients?.business_name || 'N/A',
          'Código Producto': productCode,
          'Producto': productLabel,
          'Volumen (m³)': exportQty.toFixed(1),
          'Precio de Venta': `$${unitPrice.toFixed(2)}`,
          'SubTotal': `$${subtotal.toFixed(2)}`,
          'Tipo Facturación': `${order.requires_invoice ? 'Fiscal' : 'Efectivo'} / ${billingLabel}`,
          'Número de Orden': order.order_number || 'N/A'
        });
      });
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
      'SubTotal': `$${(
        includeVAT
          ? (summaryMetrics.totalAmountWithVAT + additionalSubtotalWithVAT)
          : (summaryMetrics.totalAmount + additionalSubtotalNoVAT)
      ).toFixed(2)}`,
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
