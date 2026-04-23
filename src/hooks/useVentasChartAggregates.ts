import { useMemo } from 'react';
import { VAT_RATE } from '@/lib/sales-utils';
import {
  findProductPrice,
  resolveProductCodeForRemisionPricing,
  SalesDataProcessor,
  type Order,
  type Remision,
} from '@/utils/salesDataProcessor';

export type VentasProductGroupMode = 'recipe_code' | 'master';

type ProductAgg = { volume: number; amount: number; label: string };

function pickLabel(prev: string, next: string) {
  if (!prev) return next;
  if (next.length > prev.length && next !== 'Sin especificación') return next;
  return prev;
}

function groupKeyForProduct(r: any, mode: VentasProductGroupMode): string {
  if (mode === 'recipe_code') {
    return r.recipe?.recipe_code || 'N/A';
  }
  const mid =
    r.master_recipe_id ??
    r.recipe?.master_recipe_id ??
    r.master_recipes?.id;
  if (mid) return `m:${mid}`;
  return `r:${r.recipe?.recipe_code || 'N/A'}`;
}

function displayLabelForProduct(r: any, mode: VentasProductGroupMode): string {
  if (mode === 'recipe_code') {
    return r.recipe?.recipe_code || 'N/A';
  }
  const mr = r.master_recipes;
  const spec =
    mr?.master_code ||
    [mr?.strength_fc != null ? `FC${mr.strength_fc}` : '', mr?.slump != null ? `${mr.slump} cm` : '']
      .filter(Boolean)
      .join(' · ');
  return spec || r.recipe?.recipe_code || 'Sin especificación';
}

function accumulateConcreteProductRows(
  filteredRemisionesWithVacioDeOlla: any[],
  salesData: any[],
  includeVAT: boolean,
  orderItems: any[] | undefined,
  pricingMap: Map<string, { subtotal_amount: number; volumen_fabricado: number }>,
  mode: VentasProductGroupMode
): Record<string, ProductAgg> {
  const acc: Record<string, ProductAgg> = {};

  for (const r of filteredRemisionesWithVacioDeOlla) {
    const recipeCode = r.recipe?.recipe_code || 'N/A';
    if (r.tipo_remision === 'BOMBEO' || recipeCode === 'SER001') continue;

    const volume = r.volumen_fabricado || 0;
    if (volume <= 0) continue;

    const order = salesData.find((o) => o.id === r.order_id);
    if (!order) continue;

    const recipeId = r.recipe_id ?? r.recipe?.id;
    const remisionMasterRecipeId =
      r.master_recipe_id ?? r.recipe?.master_recipe_id ?? r.master_recipes?.id;
    const productCode = resolveProductCodeForRemisionPricing(r);

    const unitPrice = findProductPrice(
      productCode,
      r.order_id,
      recipeId,
      orderItems || [],
      pricingMap,
      r.id,
      remisionMasterRecipeId ? String(remisionMasterRecipeId) : undefined
    );
    let amount = unitPrice * volume;
    if (includeVAT && order.requires_invoice) {
      amount *= 1 + VAT_RATE;
    }

    const key = groupKeyForProduct(r, mode);
    const label = displayLabelForProduct(r, mode);
    if (!acc[key]) {
      acc[key] = { volume: 0, amount: 0, label };
    }
    acc[key].volume += volume;
    acc[key].amount += amount;
    acc[key].label = pickLabel(acc[key].label, label);
  }

  return acc;
}

export function useVentasChartAggregates(
  filteredRemisionesWithVacioDeOlla: any[],
  salesData: any[],
  includeVAT: boolean,
  orderItems: any[] | undefined,
  pricingMap: Map<string, { subtotal_amount: number; volumen_fabricado: number }>,
  productGroupMode: VentasProductGroupMode = 'master'
) {
  const productCodeAmountData = useMemo(() => {
    const grouped = accumulateConcreteProductRows(
      filteredRemisionesWithVacioDeOlla,
      salesData,
      includeVAT,
      orderItems,
      pricingMap,
      productGroupMode
    );
    const rows = Object.entries(grouped).map(([, data]) => ({
      name: data.label,
      volume: data.volume,
      amount: data.amount,
    }));

    const addCharges = SalesDataProcessor.listAdditionalProductCharges(
      filteredRemisionesWithVacioDeOlla as Remision[],
      salesData as Order[],
      orderItems || [],
      undefined
    );
    let additionalDisplay = 0;
    for (const c of addCharges) {
      let a = c.amount;
      if (includeVAT && c.requires_invoice) {
        a *= 1 + VAT_RATE;
      }
      additionalDisplay += a;
    }
    if (additionalDisplay > 0) {
      rows.push({ name: 'Productos adicionales', volume: 0, amount: additionalDisplay });
    }

    return rows.sort((a, b) => b.amount - a.amount);
  }, [
    filteredRemisionesWithVacioDeOlla,
    salesData,
    includeVAT,
    orderItems,
    pricingMap,
    productGroupMode,
  ]);

  const productCodeVolumeData = useMemo(() => {
    const grouped = accumulateConcreteProductRows(
      filteredRemisionesWithVacioDeOlla,
      salesData,
      false,
      orderItems,
      pricingMap,
      productGroupMode
    );
    return Object.entries(grouped)
      .map(([, data]) => ({
        name: data.label,
        volume: data.volume,
      }))
      .sort((a, b) => b.volume - a.volume);
  }, [
    filteredRemisionesWithVacioDeOlla,
    salesData,
    orderItems,
    pricingMap,
    productGroupMode,
  ]);

  const clientVolumeData = useMemo(() => {
    const clientSummary = filteredRemisionesWithVacioDeOlla.reduce(
      (acc: Record<string, { clientName: string; volume: number }>, remision) => {
        const clientId = remision.order?.client_id || 'unknown';
        const clients = remision.order?.clients;
        const clientName = clients
          ? typeof clients === 'object'
            ? (clients as { business_name?: string }).business_name || 'Desconocido'
            : 'Desconocido'
          : 'Desconocido';

        if (!acc[clientId]) {
          acc[clientId] = { clientName, volume: 0 };
        }

        const volume = remision.volumen_fabricado || 0;
        acc[clientId].volume += volume;
        return acc;
      },
      {} as Record<string, { clientName: string; volume: number }>
    );

    const clientValues: { clientName: string; volume: number }[] = Object.values(clientSummary);
    const mappedData: { name: string; value: number }[] = clientValues.map((summary) => ({
      name: summary.clientName,
      value: summary.volume,
    }));

    return mappedData.sort((a, b) => b.value - a.value);
  }, [filteredRemisionesWithVacioDeOlla]);

  const clientAmountData = useMemo(() => {
    const clientSummary: Record<string, { clientName: string; volume: number; amount: number }> =
      filteredRemisionesWithVacioDeOlla.reduce(
      (
        acc: Record<string, { clientName: string; volume: number; amount: number }>,
        remision
      ) => {
        const clientId = remision.order?.client_id || 'unknown';
        const clients = remision.order?.clients;
        const clientName = clients
          ? typeof clients === 'object'
            ? (clients as { business_name?: string }).business_name || 'Desconocido'
            : 'Desconocido'
          : 'Desconocido';

        if (!acc[clientId]) {
          acc[clientId] = { clientName, volume: 0, amount: 0 };
        }

        const volume = remision.volumen_fabricado || 0;
        if (volume <= 0) return acc;

        const order = salesData.find((o) => o.id === remision.order_id);
        if (!order) return acc;

        const recipeId = (remision as any).recipe_id ?? remision.recipe?.id;
        const remisionMasterRecipeId =
          (remision as any).master_recipe_id || (remision as any).recipe?.master_recipe_id;

        let price = 0;
        let calculatedAmount = 0;

        if (remision.tipo_remision === 'BOMBEO') {
          price = findProductPrice(
            'SER002',
            remision.order_id,
            recipeId,
            orderItems || [],
            pricingMap,
            remision.id,
            remisionMasterRecipeId
          );
          calculatedAmount = price * volume;
        } else if (
          remision.recipe?.recipe_code === 'SER001' ||
          remision.tipo_remision === 'VACÍO DE OLLA'
        ) {
          const unitCount = volume || 1;
          price = findProductPrice(
            'SER001',
            remision.order_id,
            recipeId,
            orderItems || [],
            pricingMap,
            remision.id,
            remisionMasterRecipeId
          );
          calculatedAmount = price * unitCount;
        } else {
          const productCode = resolveProductCodeForRemisionPricing(remision);
          price = findProductPrice(
            productCode,
            remision.order_id,
            recipeId,
            orderItems || [],
            pricingMap,
            remision.id,
            remisionMasterRecipeId
          );
          calculatedAmount = price * volume;
        }

        if (includeVAT && order.requires_invoice) {
          calculatedAmount *= 1 + VAT_RATE;
        }

        acc[clientId].volume += volume;
        acc[clientId].amount += calculatedAmount;
        return acc;
      },
      {} as Record<string, { clientName: string; volume: number; amount: number }>
    );

    const addCharges = SalesDataProcessor.listAdditionalProductCharges(
      filteredRemisionesWithVacioDeOlla as Remision[],
      salesData as Order[],
      orderItems || [],
      undefined
    );
    for (const c of addCharges) {
      let amt = c.amount;
      if (includeVAT && c.requires_invoice) {
        amt *= 1 + VAT_RATE;
      }
      const id = c.clientId;
      if (!clientSummary[id]) {
        clientSummary[id] = { clientName: c.clientName, volume: 0, amount: 0 };
      }
      clientSummary[id].amount += amt;
    }

    return Object.values(clientSummary)
      .map((summary) => ({
        name: summary.clientName,
        value: summary.amount,
        volume: summary.volume,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRemisionesWithVacioDeOlla, salesData, includeVAT, pricingMap, orderItems]);

  return {
    productCodeAmountData,
    productCodeVolumeData,
    clientVolumeData,
    clientAmountData,
  };
}
