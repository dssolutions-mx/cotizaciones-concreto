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
// pricingMap: Map of remision_id -> { subtotal_amount, volumen_fabricado } from remisiones_with_pricing view
// remisionId: Optional remision ID to check pricing map first (respects zero prices)
// remisionMasterRecipeId: Optional master recipe ID from remision (for master-to-master matching)
export const findProductPrice = (
  productType: string, 
  remisionOrderId: string, 
  recipeId?: string, 
  orderItems?: any[],
  pricingMap?: Map<string, { subtotal_amount: number; volumen_fabricado: number }>,
  remisionId?: string,
  remisionMasterRecipeId?: string
): number => {
  // FIRST: Check pricing map from remisiones_with_pricing view (source of truth)
  // This respects zero prices for internal transfers
  if (pricingMap && remisionId) {
    const pricingData = pricingMap.get(String(remisionId));
    if (pricingData !== undefined) {
      // View has pricing data - use it as source of truth
      // Calculate unit price: subtotal_amount / volumen_fabricado
      // If volumen_fabricado is 0, return 0 (avoid division by zero)
      if (pricingData.volumen_fabricado > 0) {
        return pricingData.subtotal_amount / pricingData.volumen_fabricado;
      }
      // If volumen is 0 but subtotal is also 0, return 0 (internal transfer)
      return pricingData.subtotal_amount;
    }
  }

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
    const isPumpProduct = (p: any) => {
      const t = (p.product_type || '').toString().toUpperCase();
      return t === 'SER002' || t.includes('BOMBEO');
    };

    // 1) Order-specific pump service line (by product_type only)
    const orderSpecificPump = orderItems.find(p => 
      String(p.order_id) === String(remisionOrderId) && isPumpProduct(p)
    );
    if (orderSpecificPump) {
      const qd = getQuoteDetails(orderSpecificPump);
      return (
        orderSpecificPump.pump_price ??
        orderSpecificPump.unit_price ??
        qd?.final_price ??
        0
      );
    }

    // 2) Any pump service line (by product_type only)
    const anyPump = orderItems.find(isPumpProduct);
    if (anyPump) {
      const qd = getQuoteDetails(anyPump);
      return (
        anyPump.pump_price ??
        anyPump.unit_price ??
        qd?.final_price ??
        0
      );
    }

    // Final fallback: 0 (avoid using concrete lines with has_pump_service)
    return 0;
  }
  
  // For concrete products, first try to find in the specific order
  const orderSpecificProducts = orderItems.filter(p => String(p.order_id) === String(remisionOrderId));
  
  // Normalize recipeId and masterRecipeId for comparisons
  const recipeIdStr = recipeId ? String(recipeId) : undefined;
  const remisionMasterRecipeIdStr = remisionMasterRecipeId ? String(remisionMasterRecipeId) : undefined;
  
  // PRECISE MATCHING LOGIC (using both recipe_id and master_recipe_id from remision)
  // Remisiones have BOTH recipe_id (actual variant) AND master_recipe_id (master it belongs to)
  // Order items have EITHER recipe_id (legacy) OR master_recipe_id (new)
  
  // 1) Master-to-master matching (highest priority - most precise)
  //    Match remision.master_recipe_id to order_item.master_recipe_id or quote_details.master_recipe_id
  let concreteProduct = remisionMasterRecipeIdStr
    ? orderSpecificProducts.find(p => {
        // Check order_item.master_recipe_id directly
        if (p.master_recipe_id && String(p.master_recipe_id) === remisionMasterRecipeIdStr) {
          return true;
        }
        // Check quote_details.master_recipe_id
        const qd = getQuoteDetails(p);
        const qdMasterRecipeId = qd?.master_recipe_id ? String(qd.master_recipe_id) : undefined;
        return qdMasterRecipeId && qdMasterRecipeId === remisionMasterRecipeIdStr;
      })
    : undefined;
  
  // 2) Variant-to-variant matching (legacy but still precise)
  //    Match remision.recipe_id to order_item.recipe_id or quote_details.recipe_id
  if (!concreteProduct && recipeIdStr) {
    concreteProduct = orderSpecificProducts.find(p => {
      // Check order_item.recipe_id directly
      if (p.recipe_id && String(p.recipe_id) === recipeIdStr) {
        return true;
      }
      // Check quote_details.recipe_id
      const qd = getQuoteDetails(p);
      const qdRecipeId = qd?.recipe_id ? String(qd.recipe_id) : undefined;
      return qdRecipeId && qdRecipeId === recipeIdStr;
    });
  }
  
  // 3) Variant-to-master matching (remision has variant, order item has master)
  //    Match remision.master_recipe_id to order_item.master_recipe_id
  //    This handles cases where remision used a specific variant but order was placed at master level
  if (!concreteProduct && remisionMasterRecipeIdStr) {
    concreteProduct = orderSpecificProducts.find(p => {
      // Order item has master_recipe_id that matches remision's master
      if (p.master_recipe_id && String(p.master_recipe_id) === remisionMasterRecipeIdStr) {
        return true;
      }
      // Quote detail has master_recipe_id that matches remision's master
      const qd = getQuoteDetails(p);
      const qdMasterRecipeId = qd?.master_recipe_id ? String(qd.master_recipe_id) : undefined;
      return qdMasterRecipeId && qdMasterRecipeId === remisionMasterRecipeIdStr;
    });
  }
  
  // 4) Try matching by recipe_code (fallback for edge cases)
  //    Handles cases where IDs don't match but recipe codes do
  if (!concreteProduct && productType) {
    concreteProduct = orderSpecificProducts.find(p => {
      const qd = getQuoteDetails(p);
      const qdRecipe = qd?.recipes || qd?.recipe;
      const qdRecipeCode = qdRecipe?.recipe_code;
      return qdRecipeCode && qdRecipeCode === productType;
    });
  }
  
  // 5) Try exact match by product_type (legacy fallback)
  if (!concreteProduct) {
    concreteProduct = orderSpecificProducts.find(p => 
      p.product_type === productType || 
      (p.recipe_id && p.recipe_id.toString() === productType)
    );
  }
  
  // 6) Try with hyphen removal in specific order (legacy fallback)
  if (!concreteProduct) {
    const normalized = productType.replace(/-/g, '');
    concreteProduct = orderSpecificProducts.find(p => 
      (p.product_type && normalized === p.product_type.replace(/-/g, '')) || 
      (p.recipe_id && normalized === p.recipe_id.toString().replace(/-/g, ''))
    );
  }
  
  // GLOBAL FALLBACKS (if order-specific matching failed)
  
  // 7) Global master-to-master matching
  if (!concreteProduct && remisionMasterRecipeIdStr) {
    concreteProduct = orderItems.find(p => {
      if (p.master_recipe_id && String(p.master_recipe_id) === remisionMasterRecipeIdStr) {
        return true;
      }
      const qd = getQuoteDetails(p);
      const qdMasterRecipeId = qd?.master_recipe_id ? String(qd.master_recipe_id) : undefined;
      return qdMasterRecipeId && qdMasterRecipeId === remisionMasterRecipeIdStr;
    });
  }
  
  // 8) Global variant-to-variant matching (legacy)
  if (!concreteProduct && recipeIdStr) {
    concreteProduct = orderItems.find(p => {
      if (p.recipe_id && String(p.recipe_id) === recipeIdStr) {
        return true;
      }
      const qd = getQuoteDetails(p);
      const qdRecipeId = qd?.recipe_id ? String(qd.recipe_id) : undefined;
      return qdRecipeId && qdRecipeId === recipeIdStr;
    });
  }

  // 9) Global fallback by product_type (legacy)
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
    allOrderItems?: any[], // Add order items parameter for sophisticated price matching
    pricingMap?: Map<string, { subtotal_amount: number; volumen_fabricado: number }> // Pricing map from remisiones_with_pricing view
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
        // Use recipe_id if present; otherwise fall back to related recipe.id
        // This aligns per-plant table (which selects recipe relation) with main KPI (which often has recipe_id)
        const recipeId = (remision as any).recipe_id ?? remision.recipe?.id;

        if (volume <= 0) return; // Skip zero volume remisiones

        // Find the corresponding order
        const order = salesData.find(o => o.id === remision.order_id);
        if (!order) return;

        // Use sophisticated price finding
        let unitPrice = 0;
        let calculatedAmount = 0;

        // Get master recipe ID from remision if available
        const remisionMasterRecipeId = (remision as any).master_recipe_id || (remision as any).recipe?.master_recipe_id;

        if (remision.tipo_remision === 'BOMBEO') {
          // Pump service - use SER002 code
          unitPrice = findProductPrice('SER002', remision.order_id, recipeId, allOrderItems, pricingMap, remision.id, remisionMasterRecipeId);
          calculatedAmount = unitPrice * volume;
          result.pumpAmount += calculatedAmount;

        } else if (recipeCode === 'SER001' || remision.tipo_remision === 'VACÍO DE OLLA') {
          // Empty truck charge - use SER001 code, typically volume is 1
          const unitCount = volume || 1;
          unitPrice = findProductPrice('SER001', remision.order_id, recipeId, allOrderItems, pricingMap, remision.id, remisionMasterRecipeId);
          calculatedAmount = unitPrice * unitCount;
          result.emptyTruckAmount += calculatedAmount;
          // debug removed

        } else {
          // Regular concrete - use recipe code for sophisticated matching
          const productCode = recipeCode || 'PRODUCTO';
          unitPrice = findProductPrice(productCode, remision.order_id, recipeId, allOrderItems, pricingMap, remision.id, remisionMasterRecipeId);
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

    // REMOVED: Old code that processed vacío de olla from order_items
    // Now we ONLY use virtual remisiones for vacío de olla
    // This ensures proper filtering and prevents duplication

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
      // Treat all non-pump and non-empty-truck as concrete for resistance purposes
      if (remision.tipo_remision !== 'BOMBEO' && remision.tipo_remision !== 'VACÍO DE OLLA') {
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
    tipoFilter: string | string[], // Support both string and array for backward compatibility
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
          if (layoutType === 'powerbi') {
            // Handle both string (legacy) and array (new multi-select) formats
            const tipoArray = Array.isArray(tipoFilter) ? tipoFilter : (tipoFilter === 'all' || !tipoFilter ? [] : [tipoFilter]);
            
            // If tipo filter is set and doesn't include "VACÍO DE OLLA", skip this virtual remision
            if (tipoArray.length > 0 && !tipoArray.includes('VACÍO DE OLLA')) {
              return;
            }
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
