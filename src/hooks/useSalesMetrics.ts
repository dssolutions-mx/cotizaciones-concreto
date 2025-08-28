import { useMemo } from 'react';
import { VAT_RATE } from '@/lib/sales-utils';

interface UseSalesMetricsProps {
  filteredRemisiones: any[];
  salesData: any[];
  clientFilter: string;
}

export const useSalesMetrics = ({ filteredRemisiones, salesData, clientFilter }: UseSalesMetricsProps) => {
  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const result = {
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

    // Process remisiones (Concrete, Bombeo)
    filteredRemisiones.forEach(remision => {
      const volume = remision.volumen_fabricado || 0;
      let price = 0;
      const orderForRemision = salesData.find(o => o.id === remision.order_id);
      const orderItemsForRemision = orderForRemision?.items || [];
      const recipeCode = remision.recipe?.recipe_code;

      // Find the right order item for this remision, EXCLUDING "Vacío de Olla" types
      const orderItemForRemision = orderItemsForRemision.find((item: any) => {
        if (
          item.product_type === 'VACÍO DE OLLA' ||
          item.product_type === 'EMPTY_TRUCK_CHARGE' ||
          (recipeCode === 'SER001' && (item.product_type === recipeCode || item.has_empty_truck_charge)) ||
          item.has_empty_truck_charge === true
        ) {
          return false;
        }
        if (remision.tipo_remision === 'BOMBEO' && item.has_pump_service) {
          return true;
        }
        if (remision.tipo_remision !== 'BOMBEO' && (item.product_type === recipeCode || (item.recipe_id && item.recipe_id.toString() === recipeCode))) {
          return true;
        }
        return false;
      });

      if (orderItemForRemision) {
        if (remision.tipo_remision === 'BOMBEO') {
          price = orderItemForRemision.pump_price || 0;
          result.pumpVolume += volume;
          result.pumpAmount += price * volume;
        } else {
          price = orderItemForRemision.unit_price || 0;
          result.concreteVolume += volume;
          result.concreteAmount += price * volume;
        }

        if (orderForRemision?.requires_invoice) {
          result.invoiceAmount += price * volume;
          result.invoiceAmountWithVAT += (price * volume) * (1 + VAT_RATE);
        } else {
          result.cashAmount += price * volume;
          result.cashAmountWithVAT += price * volume;
        }
      }
    });

    // Process "Vacío de Olla" charges from filteredOrders that match current client filter
    let filteredOrders = [...salesData];

    if (clientFilter && clientFilter !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.client_id === clientFilter);
    }

    filteredOrders.forEach(order => {
      const emptyTruckItem = order.items?.find(
        (item: any) =>
          item.product_type === 'VACÍO DE OLLA' ||
          item.product_type === 'EMPTY_TRUCK_CHARGE' ||
          item.has_empty_truck_charge === true
      );

      if (emptyTruckItem) {
        const price = emptyTruckItem.unit_price || emptyTruckItem.empty_truck_price || 0;
        const volume = 1; // Count as 1 unit

        result.emptyTruckVolume += volume;
        result.emptyTruckAmount += price * volume;

        if (order.requires_invoice) {
          result.invoiceAmount += price * volume;
          result.invoiceAmountWithVAT += (price * volume) * (1 + VAT_RATE);
        } else {
          result.cashAmount += price * volume;
          result.cashAmountWithVAT += price * volume;
        }
      }
    });

    // Calculate totals
    result.totalAmount = result.cashAmount + result.invoiceAmount;
    result.totalAmountWithVAT = result.cashAmountWithVAT + result.invoiceAmountWithVAT;
    result.totalVolume = result.concreteVolume + result.pumpVolume + result.emptyTruckVolume;

    // Calculate weighted prices
    if (result.concreteVolume > 0) {
      result.weightedConcretePrice = result.concreteAmount / result.concreteVolume;
      result.weightedConcretePriceWithVAT = (result.concreteAmount * (1 + VAT_RATE)) / result.concreteVolume;
    }

    if (result.pumpVolume > 0) {
      result.weightedPumpPrice = result.pumpAmount / result.pumpVolume;
      result.weightedPumpPriceWithVAT = (result.pumpAmount * (1 + VAT_RATE)) / result.pumpVolume;
    }

    if (result.emptyTruckVolume > 0) {
      result.weightedEmptyTruckPrice = result.emptyTruckAmount / result.emptyTruckVolume;
      result.weightedEmptyTruckPriceWithVAT = (result.emptyTruckAmount * (1 + VAT_RATE)) / result.emptyTruckVolume;
    }

    return result;
  }, [filteredRemisiones, salesData, clientFilter]);

  // Group concrete remisiones by recipe
  const concreteByRecipe = useMemo(() => {
    const concreteRemisiones = filteredRemisiones.filter(r => r.tipo_remision !== 'BOMBEO');
    return concreteRemisiones.reduce<Record<string, { volume: number; count: number }>>((acc, remision) => {
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
  }, [filteredRemisiones]);

  // Extract unique values for filters
  const filterOptions = useMemo(() => {
    const uniqueResistances = Array.from(new Set(filteredRemisiones?.map(r => r.recipe?.strength_fc?.toString()).filter(Boolean) as string[] || [])).sort();
    const uniqueTipos = Array.from(new Set(filteredRemisiones?.map(r => r.tipo_remision).filter(Boolean) as string[] || [])).sort();
    const uniqueProductCodes = Array.from(new Set(filteredRemisiones?.map(r => r.recipe?.recipe_code).filter(Boolean) as string[] || [])).sort();

    return {
      resistances: uniqueResistances,
      tipos: uniqueTipos,
      productCodes: uniqueProductCodes,
    };
  }, [filteredRemisiones]);

  return {
    summaryMetrics,
    concreteByRecipe,
    filterOptions,
  };
};
