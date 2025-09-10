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

// Normalize quote_details which can be either an object or an array with a single element
const getQuoteDetails = (p: any): { final_price?: number; recipe_id?: string | number } | undefined => {
  const qd = p?.quote_details;
  if (!qd) return undefined;
  return Array.isArray(qd) ? (qd[0] || undefined) : qd;
};

// Shared sophisticated price finding utility (extracted from remisiones page)
export const findProductPrice = (productType: string, remisionOrderId: string, recipeId?: string, orderItems?: any[]): number => {
  if (!orderItems || orderItems.length === 0) return 0;
  
  // For SER001 (Vacío de Olla)
  if (productType === 'SER001') {
    // First try to find empty truck product in the specific order
    const orderSpecificEmptyTruck = orderItems.find(p => 
      (p.product_type === 'VACÍO DE OLLA' || p.has_empty_truck_charge || p.product_type === 'SER001') && 
      String(p.order_id) === String(remisionOrderId)
    );
    
    if (orderSpecificEmptyTruck) {
      // Prefer explicit empty_truck_price, then unit_price, then quote_details.final_price
      const qd = getQuoteDetails(orderSpecificEmptyTruck);
      return (
        orderSpecificEmptyTruck.empty_truck_price ??
        orderSpecificEmptyTruck.unit_price ??
        qd?.final_price ??
        0
      );
    }
    
    // Fallback to any empty truck product
    const emptyTruckProduct = orderItems.find(p => 
      p.product_type === 'VACÍO DE OLLA' || p.has_empty_truck_charge || p.product_type === 'SER001'
    );
    const qd = emptyTruckProduct ? getQuoteDetails(emptyTruckProduct) : undefined;
    return (
      emptyTruckProduct?.empty_truck_price ??
      emptyTruckProduct?.unit_price ??
      qd?.final_price ??
      0
    );
  }
  
  // For SER002 (Bombeo)
  if (productType === 'SER002') {
    // First try to find pump product in the specific order
    const orderSpecificPump = orderItems.find(p => 
      (p.has_pump_service || p.product_type === 'SER002') && String(p.order_id) === String(remisionOrderId)
    );
    
    if (orderSpecificPump) {
      // Prefer explicit pump_price, then unit_price, then quote_details.final_price
      const qd = getQuoteDetails(orderSpecificPump);
      return (
        orderSpecificPump.pump_price ??
        orderSpecificPump.unit_price ??
        qd?.final_price ??
        0
      );
    }
    
    // Fallback to any pump product
    const pumpProduct = orderItems.find(p => p.has_pump_service || p.product_type === 'SER002');
    const qd = pumpProduct ? getQuoteDetails(pumpProduct) : undefined;
    return (
      pumpProduct?.pump_price ??
      pumpProduct?.unit_price ??
      qd?.final_price ??
      0
    );
  }
  
  // For concrete products, first try to find in the specific order
  const orderSpecificProducts = orderItems.filter(p => String(p.order_id) === String(remisionOrderId));
  
  // Normalize recipeId for comparisons
  const recipeIdStr = recipeId ? String(recipeId) : undefined;
  
  // 1) Prefer match via quote_details.recipe_id (quote detail linkage)
  let concreteProduct = recipeIdStr
    ? orderSpecificProducts.find(p => {
        const qd = getQuoteDetails(p);
        const qdRecipeId = qd?.recipe_id ? String(qd.recipe_id) : undefined;
        return qdRecipeId && qdRecipeId === recipeIdStr;
      })
    : undefined;
  
  // 2) Try exact match by order_item.recipe_id if provided
  if (!concreteProduct && recipeIdStr) {
    concreteProduct = orderSpecificProducts.find(p => p.recipe_id && String(p.recipe_id) === recipeIdStr);
  }
  
  // 3) Try exact match by product_type or recipe_id string
  if (!concreteProduct) {
    concreteProduct = orderSpecificProducts.find(p => 
      p.product_type === productType || 
      (p.recipe_id && p.recipe_id.toString() === productType)
    );
  }
  
  // 4) Try with hyphen removal in specific order
  if (!concreteProduct) {
    const normalized = productType.replace(/-/g, '');
    concreteProduct = orderSpecificProducts.find(p => 
      (p.product_type && normalized === p.product_type.replace(/-/g, '')) || 
      (p.recipe_id && normalized === p.recipe_id.toString().replace(/-/g, ''))
    );
  }
  
  // 5) If still not found, try global by quote_details.recipe_id
  if (!concreteProduct && recipeIdStr) {
    concreteProduct = orderItems.find(p => {
      const qd = getQuoteDetails(p);
      const qdRecipeId = qd?.recipe_id ? String(qd.recipe_id) : undefined;
      return qdRecipeId && qdRecipeId === recipeIdStr;
    });
  }

  // 6) Global fallback by order_item.recipe_id or product_type
  if (!concreteProduct) {
    concreteProduct = orderItems.find(p => 
      p.product_type === productType || 
      (p.recipe_id && p.recipe_id.toString() === productType)
    );
    
    // Last attempt with hyphen removal globally
    if (!concreteProduct) {
      const normalized = productType.replace(/-/g, '');
      concreteProduct = orderItems.find(p => 
        (p.product_type && normalized === p.product_type.replace(/-/g, '')) || 
        (p.recipe_id && normalized === p.recipe_id.toString().replace(/-/g, ''))
      );
    }
  }
  
  // 7) If we matched a product but its price is zero/undefined, try to salvage a sensible price
  const concreteQd = concreteProduct ? getQuoteDetails(concreteProduct) : undefined;
  let price = (
    concreteProduct?.unit_price ??
    concreteQd?.final_price ??
    0
  );

  if (!price || price === 0) {
    // Prefer first non-zero unit_price among order-specific products
    const nonZeroOrderSpecific = orderSpecificProducts.find(p => (p.unit_price ?? 0) > 0);
    if (nonZeroOrderSpecific) {
      price = nonZeroOrderSpecific.unit_price!;
    }
  }

  if (!price || price === 0) {
    // Try non-zero final_price from quote_details in this order
    const nonZeroFinalPriceInOrder = orderSpecificProducts.find(p => {
      const qd = getQuoteDetails(p);
      return qd?.final_price && qd.final_price > 0;
    });
    if (nonZeroFinalPriceInOrder) {
      price = getQuoteDetails(nonZeroFinalPriceInOrder)!.final_price!;
    }
  }

  if (!price || price === 0) {
    // As a very last resort, use any non-zero unit_price in all products
    const anyNonZero = orderItems.find(p => (p.unit_price ?? 0) > 0);
    if (anyNonZero) {
      price = anyNonZero.unit_price!;
    }
  }

  if (!price || price === 0) {
    // Final fallback to any non-zero final_price globally
    const anyNonZeroFinal = orderItems.find(p => {
      const qd = getQuoteDetails(p);
      return qd?.final_price && qd.final_price > 0;
    });
    if (anyNonZeroFinal) {
      price = getQuoteDetails(anyNonZeroFinal)!.final_price!;
    }
  }

  return price || 0;
};

export type PriceMatchDebug = {
  matchedStage: string;
  priceSelected: number;
  orderSpecificCount: number;
  recipeIdStr?: string;
  productType: string;
  remisionOrderId: string;
  tried: string[];
  matchedItemSummary?: {
    id?: string | number;
    order_id?: string | number;
    product_type?: string;
    recipe_id?: string | number;
    unit_price?: number;
    qd_recipe_id?: string | number;
    qd_final_price?: number;
  };
};

export const explainPriceMatch = (productType: string, remisionOrderId: string, recipeId?: string, orderItems?: any[]): PriceMatchDebug => {
  const tried: string[] = [];
  const normalize = (s: string) => (s || '').toString().replace(/-/g, '').trim().toUpperCase();
  const recipeIdStr = recipeId ? String(recipeId) : undefined;
  const orderSpecificProducts = (orderItems || []).filter(p => String(p.order_id) === String(remisionOrderId));

  let matchedStage = 'none';
  let matchedItem: any | undefined;

  // 1) order-specific by quote_details.recipe_id
  tried.push('order.qd_recipe_id');
  if (!matchedItem && recipeIdStr) {
    matchedItem = orderSpecificProducts.find(p => {
      const qd = getQuoteDetails(p);
      const qdRecipeId = qd?.recipe_id ? String(qd.recipe_id) : undefined;
      return qdRecipeId && qdRecipeId === recipeIdStr;
    });
    if (matchedItem) matchedStage = 'order.qd_recipe_id';
  }

  // 2) order-specific by order_item.recipe_id
  tried.push('order.item_recipe_id');
  if (!matchedItem && recipeIdStr) {
    matchedItem = orderSpecificProducts.find(p => p.recipe_id && String(p.recipe_id) === recipeIdStr);
    if (matchedItem) matchedStage = 'order.item_recipe_id';
  }

  // 3) order-specific by product_type or recipe_id string
  tried.push('order.product_or_recipe_str');
  if (!matchedItem) {
    matchedItem = orderSpecificProducts.find(p => p.product_type === productType || (p.recipe_id && p.recipe_id.toString() === productType));
    if (matchedItem) matchedStage = 'order.product_or_recipe_str';
  }

  // 4) order-specific normalized hyphenless match
  tried.push('order.normalized');
  if (!matchedItem) {
    const normalized = normalize(productType);
    matchedItem = orderSpecificProducts.find(p => (p.product_type && normalize(p.product_type) === normalized) || (p.recipe_id && normalize(p.recipe_id.toString()) === normalized));
    if (matchedItem) matchedStage = 'order.normalized';
  }

  // 5) global by quote_details.recipe_id
  tried.push('global.qd_recipe_id');
  if (!matchedItem && recipeIdStr && orderItems && orderItems.length) {
    matchedItem = orderItems.find(p => {
      const qd = getQuoteDetails(p);
      const qdRecipeId = qd?.recipe_id ? String(qd.recipe_id) : undefined;
      return qdRecipeId && qdRecipeId === recipeIdStr;
    });
    if (matchedItem) matchedStage = 'global.qd_recipe_id';
  }

  // 6) global by product_type or recipe_id string
  tried.push('global.product_or_recipe_str');
  if (!matchedItem && orderItems && orderItems.length) {
    matchedItem = orderItems.find(p => p.product_type === productType || (p.recipe_id && p.recipe_id.toString() === productType));
    if (matchedItem) matchedStage = 'global.product_or_recipe_str';
  }

  // 7) global normalized hyphenless match
  tried.push('global.normalized');
  if (!matchedItem && orderItems && orderItems.length) {
    const normalized = normalize(productType);
    matchedItem = orderItems.find(p => (p.product_type && normalize(p.product_type) === normalized) || (p.recipe_id && normalize(p.recipe_id.toString()) === normalized));
    if (matchedItem) matchedStage = 'global.normalized';
  }

  // Price resolution mirroring findProductPrice
  const qd = matchedItem ? getQuoteDetails(matchedItem) : undefined;
  let price = (matchedItem?.unit_price ?? qd?.final_price ?? 0) || 0;

  if (!price || price === 0) {
    const nonZeroOrderSpecific = orderSpecificProducts.find(p => (p.unit_price ?? 0) > 0);
    if (nonZeroOrderSpecific) {
      price = nonZeroOrderSpecific.unit_price!;
      if (!matchedItem) matchedItem = nonZeroOrderSpecific;
      if (matchedStage === 'none') matchedStage = 'fallback.order.unit_price';
    }
  }

  if (!price || price === 0) {
    const nonZeroFinalPriceInOrder = orderSpecificProducts.find(p => {
      const d = getQuoteDetails(p);
      return d?.final_price && d.final_price > 0;
    });
    if (nonZeroFinalPriceInOrder) {
      price = getQuoteDetails(nonZeroFinalPriceInOrder)!.final_price!;
      if (!matchedItem) matchedItem = nonZeroFinalPriceInOrder;
      if (matchedStage === 'none') matchedStage = 'fallback.order.qd_final_price';
    }
  }

  if (!price || price === 0) {
    const anyNonZero = (orderItems || []).find(p => (p.unit_price ?? 0) > 0);
    if (anyNonZero) {
      price = anyNonZero.unit_price!;
      if (!matchedItem) matchedItem = anyNonZero;
      if (matchedStage === 'none') matchedStage = 'fallback.global.unit_price';
    }
  }

  if (!price || price === 0) {
    const anyNonZeroFinal = (orderItems || []).find(p => {
      const d = getQuoteDetails(p);
      return d?.final_price && d.final_price > 0;
    });
    if (anyNonZeroFinal) {
      price = getQuoteDetails(anyNonZeroFinal)!.final_price!;
      if (!matchedItem) matchedItem = anyNonZeroFinal;
      if (matchedStage === 'none') matchedStage = 'fallback.global.qd_final_price';
    }
  }

  const summary: PriceMatchDebug = {
    matchedStage,
    priceSelected: price || 0,
    orderSpecificCount: orderSpecificProducts.length,
    recipeIdStr,
    productType,
    remisionOrderId,
    tried,
    matchedItemSummary: matchedItem
      ? {
          id: matchedItem.id,
          order_id: matchedItem.order_id,
          product_type: matchedItem.product_type,
          recipe_id: matchedItem.recipe_id,
          unit_price: matchedItem.unit_price,
          qd_recipe_id: getQuoteDetails(matchedItem)?.recipe_id,
          qd_final_price: getQuoteDetails(matchedItem)?.final_price,
        }
      : undefined,
  };

  return summary;
};

export class SalesDataProcessor {
  static calculateSummaryMetrics(
    remisiones: Remision[],
    salesData: Order[],
    clientFilter: string,
    allOrderItems?: any[] // Add order items parameter for sophisticated price matching
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

    // STEP 1: Calculate volumes using the simple, accurate approach (same as daily sales)
    remisiones.forEach(remision => {
      const volume = remision.volumen_fabricado || 0;
      const recipeCode = remision.recipe?.recipe_code;

      if (volume <= 0) return; // Skip zero volume remisiones

      // Simple direct volume aggregation (matching daily sales logic)
      if (remision.tipo_remision === 'BOMBEO') {
        result.pumpVolume += volume;
      } else if (remision.tipo_remision === 'VACÍO DE OLLA') {
        result.emptyTruckVolume += volume || 1; // usually 1 m³ equivalent
      } else {
        result.concreteVolume += volume; // All other types are concrete
      }
    });

    // Use the shared sophisticated price finding utility

    // STEP 2: Calculate amounts using sophisticated price matching (from remisiones page)
    if (allOrderItems && allOrderItems.length > 0) {
      remisiones.forEach(remision => {
        const volume = remision.volumen_fabricado || 0;
        const recipeCode = remision.recipe?.recipe_code;
        const recipeId = (remision as any).recipe_id;

        if (volume <= 0) return; // Skip zero volume remisiones

        // Find the corresponding order
        const order = salesData.find(o => o.id === remision.order_id);
        if (!order) return;

        // Use sophisticated price finding
        let unitPrice = 0;
        let calculatedAmount = 0;

        if (remision.tipo_remision === 'BOMBEO') {
          // Pump service - use SER002 code
          unitPrice = findProductPrice('SER002', remision.order_id, recipeId, allOrderItems);
          calculatedAmount = unitPrice * volume;
          result.pumpAmount += calculatedAmount;

        } else if (recipeCode === 'SER001' || remision.tipo_remision === 'VACÍO DE OLLA') {
          // Empty truck charge - use SER001 code, typically volume is 1
          const unitCount = volume || 1;
          unitPrice = findProductPrice('SER001', remision.order_id, recipeId, allOrderItems);
          calculatedAmount = unitPrice * unitCount;
          result.emptyTruckAmount += calculatedAmount;

        } else {
          // Regular concrete - use recipe code for sophisticated matching
          const productCode = recipeCode || 'PRODUCTO';
          unitPrice = findProductPrice(productCode, remision.order_id, recipeId, allOrderItems);
          calculatedAmount = unitPrice * volume;
          result.concreteAmount += calculatedAmount;
        }

        // Separate cash vs invoice amounts (before VAT)
        if (order.requires_invoice) {
          result.invoiceAmount += calculatedAmount;
        } else {
          result.cashAmount += calculatedAmount;
        }
      });
    }

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
