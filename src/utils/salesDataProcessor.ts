import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface SummaryMetrics {
  concreteVolume: number;
  pumpVolume: number;
  emptyTruckVolume: number;
  totalVolume: number;
  concreteAmount: number;
  pumpAmount: number;
  emptyTruckAmount: number;
  totalAmount: number;
  cashAmount: number;
  invoiceAmount: number;
  weightedConcretePrice: number;
  weightedPumpPrice: number;
  weightedEmptyTruckPrice: number;
  weightedResistance: number;
  resistanceTooltip: string;
  totalAmountWithVAT: number;
  cashAmountWithVAT: number;
  invoiceAmountWithVAT: number;
  weightedConcretePriceWithVAT: number;
  weightedPumpPriceWithVAT: number;
  weightedEmptyTruckPriceWithVAT: number;
}

export interface OrderItem {
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

export interface Order {
  id: string;
  order_number: string;
  clientName?: string;
  clients?: {
    business_name: string;
  };
  requires_invoice: boolean;
  items?: OrderItem[];
  delivery_date?: string;
}

export interface Remision {
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
    strength_fc?: number;
  };
}

export interface ConcreteByRecipe {
  [key: string]: {
    volume: number;
    count: number;
  };
}

export interface VirtualRemision {
  id: string;
  remision_number: string;
  order_id: string;
  fecha: string;
  tipo_remision: string;
  volumen_fabricado: number;
  recipe: { recipe_code: string };
  order: {
    client_id: string;
    order_number: string;
    clients: any;
    requires_invoice: boolean;
  };
  isVirtualVacioDeOlla: boolean;
  originalOrderItem: OrderItem;
}

const VAT_RATE = 0.16;

export class SalesDataProcessor {
  static calculateSummaryMetrics(
    remisiones: Remision[],
    salesData: Order[],
    clientFilter: string
  ): SummaryMetrics {
    const result: SummaryMetrics = {
      concreteVolume: 0,
      pumpVolume: 0,
      emptyTruckVolume: 0,
      totalVolume: 0,
      concreteAmount: 0,
      pumpAmount: 0,
      emptyTruckAmount: 0,
      totalAmount: 0,
      cashAmount: 0,
      invoiceAmount: 0,
      weightedConcretePrice: 0,
      weightedPumpPrice: 0,
      weightedEmptyTruckPrice: 0,
      weightedResistance: 0,
      resistanceTooltip: '',
      totalAmountWithVAT: 0,
      cashAmountWithVAT: 0,
      invoiceAmountWithVAT: 0,
      weightedConcretePriceWithVAT: 0,
      weightedPumpPriceWithVAT: 0,
      weightedEmptyTruckPriceWithVAT: 0
    };

    // Helper function to find the correct order item for a remision
    const findOrderItemForRemision = (order: Order, remision: Remision) => {
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
          item.has_empty_truck_charge === true ||
          item.product_type === 'SER001'
        );
      }

      // For concrete - simplified matching, prioritize product_type match
      if (recipeCode) {
        // Primary match: product_type equals recipe_code
        const primaryMatch = order.items.find((item: any) =>
          item.product_type === recipeCode
        );
        if (primaryMatch) return primaryMatch;

        // Fallback: try recipe_id match if available
        if (remision.recipe?.id) {
          const fallbackMatch = order.items.find((item: any) =>
            item.recipe_id === remision.recipe.id
          );
          if (fallbackMatch) return fallbackMatch;
        }
      }

      // Last resort: if no recipe code, try to find any concrete item for this order
      return order.items.find((item: any) =>
        !item.has_pump_service &&
        !item.has_empty_truck_charge &&
        item.product_type !== 'VACÍO DE OLLA' &&
        item.product_type !== 'EMPTY_TRUCK_CHARGE' &&
        item.product_type !== 'SER001'
      );
    };

    // Process each remision individually for accurate calculations
    remisiones.forEach(remision => {
      const volume = remision.volumen_fabricado || 0;
      const recipeCode = remision.recipe?.recipe_code;

      if (volume <= 0) return; // Skip zero volume remisiones

      // Find the corresponding order and order item
      const order = salesData.find(o => o.id === remision.order_id);
      if (!order) return;

      const orderItem = findOrderItemForRemision(order, remision);
      if (!orderItem) return;

      // Extract prices based on remision type
      let unitPrice = 0;
      let calculatedAmount = 0;

      if (remision.tipo_remision === 'BOMBEO') {
        // Pump service
        unitPrice = parseFloat(orderItem.pump_price?.toString() || '0');
        calculatedAmount = unitPrice * volume;
        result.pumpVolume += volume;
        result.pumpAmount += calculatedAmount;

      } else if (recipeCode === 'SER001' || remision.tipo_remision === 'VACÍO DE OLLA') {
        // Empty truck charge - use unit count (typically 1) not volume
        const unitCount = parseFloat(orderItem.empty_truck_volume?.toString() || '') || parseFloat(orderItem.volume?.toString() || '') || 1;

        if (orderItem.total_price) {
          calculatedAmount = parseFloat(orderItem.total_price.toString());
        } else {
          unitPrice = parseFloat(orderItem.unit_price?.toString() || '') || parseFloat(orderItem.empty_truck_price?.toString() || '') || 0;
          calculatedAmount = unitPrice * unitCount;
        }

        result.emptyTruckVolume += unitCount;
        result.emptyTruckAmount += calculatedAmount;

      } else {
        // Regular concrete
        unitPrice = parseFloat(orderItem.unit_price?.toString() || '0');
        calculatedAmount = unitPrice * volume;
        result.concreteVolume += volume;
        result.concreteAmount += calculatedAmount;
      }

      // Separate cash vs invoice amounts (before VAT)
      if (order.requires_invoice) {
        result.invoiceAmount += calculatedAmount;
      } else {
        result.cashAmount += calculatedAmount;
      }
    });

    // Process "Vacío de Olla" items that don't have corresponding remisiones
    let filteredOrders = [...salesData];

    if (clientFilter && clientFilter !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.client_id === clientFilter);
    }

    filteredOrders.forEach(order => {
      const emptyTruckItem = order.items?.find((item: any) =>
        item.product_type === 'VACÍO DE OLLA' ||
        item.product_type === 'EMPTY_TRUCK_CHARGE' ||
        item.has_empty_truck_charge === true
      );

      if (emptyTruckItem) {
        // Check if this empty truck item was already processed via remisiones
        const hasCorrespondingRemision = remisiones.some(remision =>
          remision.order_id === order.id &&
          (remision.recipe?.recipe_code === 'SER001' || remision.tipo_remision === 'VACÍO DE OLLA')
        );

        if (!hasCorrespondingRemision) {
          // Process this empty truck item since it wasn't captured in remisiones
          const unitCount = parseFloat(emptyTruckItem.empty_truck_volume?.toString() || '') || parseFloat(emptyTruckItem.volume?.toString() || '') || 1;
          let calculatedAmount = 0;

          if (emptyTruckItem.total_price) {
            calculatedAmount = parseFloat(emptyTruckItem.total_price.toString());
          } else {
            const unitPrice = parseFloat(emptyTruckItem.unit_price?.toString() || '') || parseFloat(emptyTruckItem.empty_truck_price?.toString() || '') || 0;
            calculatedAmount = unitPrice * unitCount;
          }

          result.emptyTruckVolume += unitCount;
          result.emptyTruckAmount += calculatedAmount;

          if (order.requires_invoice) {
            result.invoiceAmount += calculatedAmount;
          } else {
            result.cashAmount += calculatedAmount;
          }
        }
      }
    });

    // Calculate totals
    result.totalVolume = result.concreteVolume + result.pumpVolume; // Exclude empty truck from volume count
    result.totalAmount = result.concreteAmount + result.pumpAmount + result.emptyTruckAmount;

    // Apply VAT only to invoice amounts
    result.invoiceAmountWithVAT = result.invoiceAmount * (1 + VAT_RATE);
    result.cashAmountWithVAT = result.cashAmount; // No VAT on cash sales
    result.totalAmountWithVAT = result.cashAmountWithVAT + result.invoiceAmountWithVAT;

    // Calculate weighted prices (without VAT first)
    result.weightedConcretePrice = result.concreteVolume > 0 ? result.concreteAmount / result.concreteVolume : 0;
    result.weightedPumpPrice = result.pumpVolume > 0 ? result.pumpAmount / result.pumpVolume : 0;
    result.weightedEmptyTruckPrice = result.emptyTruckVolume > 0 ? result.emptyTruckAmount / result.emptyTruckVolume : 0;

    // Calculate weighted prices with VAT (only applied proportionally to invoice amounts)
    const concreteInvoicePortion = result.concreteAmount > 0 ? (result.invoiceAmount * (result.concreteAmount / result.totalAmount)) : 0;
    const pumpInvoicePortion = result.pumpAmount > 0 ? (result.invoiceAmount * (result.pumpAmount / result.totalAmount)) : 0;
    const emptyTruckInvoicePortion = result.emptyTruckAmount > 0 ? (result.invoiceAmount * (result.emptyTruckAmount / result.totalAmount)) : 0;

    result.weightedConcretePriceWithVAT = result.concreteVolume > 0 ?
      (result.concreteAmount + (concreteInvoicePortion * VAT_RATE)) / result.concreteVolume : 0;
    result.weightedPumpPriceWithVAT = result.pumpVolume > 0 ?
      (result.pumpAmount + (pumpInvoicePortion * VAT_RATE)) / result.pumpVolume : 0;
    result.weightedEmptyTruckPriceWithVAT = result.emptyTruckVolume > 0 ?
      (result.emptyTruckAmount + (emptyTruckInvoicePortion * VAT_RATE)) / result.emptyTruckVolume : 0;

    // Calculate weighted resistance for concrete only
    let totalWeightedResistanceSum = 0;
    let totalConcreteVolumeForResistance = 0;
    const resistanceTooltipNotes: string[] = [];

    remisiones.forEach(remision => {
      if (remision.tipo_remision === 'CONCRETO' || remision.tipo_remision === 'PISO INDUSTRIAL') {
        const volume = remision.volumen_fabricado || 0;
        const resistance = remision.recipe?.strength_fc;

        if (typeof resistance === 'number' && volume > 0) {
          let adjustedResistance = resistance;
          if (remision.recipe?.recipe_code?.toUpperCase().includes('MR')) {
             adjustedResistance = resistance / 0.13;
             if (!resistanceTooltipNotes.includes(`Resistencias "MR" divididas por 0.13`)) {
                resistanceTooltipNotes.push(`Resistencias "MR" divididas por 0.13`);
             }
          }

          totalWeightedResistanceSum += volume * adjustedResistance;
          totalConcreteVolumeForResistance += volume;
        }
      }
    });

    result.weightedResistance = totalConcreteVolumeForResistance > 0
      ? totalWeightedResistanceSum / totalConcreteVolumeForResistance
      : 0;
    result.resistanceTooltip = resistanceTooltipNotes.join('; ');

    return result;
  }

  static createVirtualVacioDeOllaRemisiones(
    salesData: Order[],
    remisionesData: Remision[],
    clientFilter: string,
    searchTerm: string,
    layoutType: 'current' | 'powerbi',
    tipoFilter: string,
    efectivoFiscalFilter: string
  ): VirtualRemision[] {
    // Get orders that match current filters
    let filteredOrders = [...salesData];

    // Apply client filter to orders
    if (clientFilter && clientFilter !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.client_id === clientFilter);
    }

    const virtualRemisiones: VirtualRemision[] = [];

    filteredOrders.forEach(order => {
      // Find vacío de olla items
      const emptyTruckItem = order.items?.find(
        (item: any) =>
          item.product_type === 'VACÍO DE OLLA' ||
          item.product_type === 'EMPTY_TRUCK_CHARGE' ||
          item.has_empty_truck_charge === true
      );

      if (emptyTruckItem) {
        // Find the remision with the lowest volume for this order to assign its number
        const orderRemisiones = remisionesData.filter(r => r.order_id === order.id);

        // Only create virtual remision if there are actual remisiones for this order
        if (orderRemisiones.length > 0) {
          // Sort by volume ascending and take the first one (lowest volume)
          const sortedRemisiones = orderRemisiones.sort((a, b) =>
            (a.volumen_fabricado || 0) - (b.volumen_fabricado || 0)
          );
          const assignedRemisionNumber = sortedRemisiones[0].remision_number;

          // Create a virtual remision object for this vacío de olla item
          const virtualRemision: VirtualRemision = {
            id: `vacio-${order.id}-${emptyTruckItem.id}`, // Generate a unique ID
            remision_number: assignedRemisionNumber, // Use the assigned remision number
            order_id: order.id,
            fecha: sortedRemisiones[0].fecha, // Use the actual remision's local date
            tipo_remision: 'VACÍO DE OLLA',
            volumen_fabricado: parseFloat(emptyTruckItem.empty_truck_volume?.toString() || '') || parseFloat(emptyTruckItem.volume?.toString() || '') || 1,
            recipe: { recipe_code: 'SER001' }, // Standard code for vacío de olla
            order: {
              client_id: order.client_id || '',
              order_number: order.order_number,
              clients: order.clients,
              requires_invoice: order.requires_invoice
            },
            // Flag this as a virtual remision
            isVirtualVacioDeOlla: true,
            // Store the original order item for reference
            originalOrderItem: emptyTruckItem
          };

          // Apply search filter if needed
          if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const matchesSearch =
              virtualRemision.remision_number.toLowerCase().includes(term) ||
              order.order_number.toLowerCase().includes(term) ||
              (order.clientName && order.clientName.toLowerCase().includes(term)) ||
              'VACÍO DE OLLA'.toLowerCase().includes(term) ||
              'SER001'.includes(term);

            if (!matchesSearch) {
              return; // Skip if doesn't match search
            }
          }

          // Apply tipo filter if needed in PowerBI layout
          if (layoutType === 'powerbi' && tipoFilter && tipoFilter !== 'all' && tipoFilter !== 'VACÍO DE OLLA') {
            return; // Skip if filtered by tipo and not matching
          }

          // Apply efectivo/fiscal filter if needed in PowerBI layout
          if (layoutType === 'powerbi' && efectivoFiscalFilter && efectivoFiscalFilter !== 'all') {
            const requiresInvoice = efectivoFiscalFilter === 'fiscal';
            if (order.requires_invoice !== requiresInvoice) {
              return; // Skip if doesn't match efectivo/fiscal filter
            }
          }

          // Add the virtual remision to the combined list
          virtualRemisiones.push(virtualRemision);
        }
      }
    });

    return virtualRemisiones;
  }

  static calculateConcreteByRecipe(remisiones: Remision[]): ConcreteByRecipe {
    return remisiones.reduce<ConcreteByRecipe>((acc, remision) => {
      const recipeCode = remision.recipe?.recipe_code || 'Sin receta';
      if (!acc[recipeCode]) {
        acc[recipeCode] = {
          volume: 0,
          count: 0
        };
      }
      acc[recipeCode].volume += remision.volumen_fabricado || 0;
      acc[recipeCode].count += 1;
      return acc;
    }, {});
  }

  static getLast6Months(): string[] {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push(format(date, 'MMM yyyy', { locale: es }));
    }
    return months;
  }

  static getDateRangeText(startDate: Date | undefined, endDate: Date | undefined): string {
    if (!startDate || !endDate) return '';

    const start = format(startDate, 'dd/MM/yyyy', { locale: es });
    const end = format(endDate, 'dd/MM/yyyy', { locale: es });

    if (start === end) {
      return `Fecha: ${start}`;
    }

    return `Del ${start} al ${end}`;
  }
}
