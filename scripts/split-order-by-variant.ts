/**
 * Split an order that mixes multiple recipe variants under one master line
 * into separate orders (one per variant). Keeps the first variant on the
 * original order; moves the second variant to a new order.
 *
 * Run:
 *   ORDER_ID=<uuid> npx tsx --env-file=.env.local scripts/split-order-by-variant.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { recalculateOrderAmount } from '../src/services/orderService';
import { assertSupabaseServiceRoleKey } from './lib/assertSupabaseServiceRoleKey';

type VariantGroup = {
  recipeId: string;
  recipeCode: string;
  masterRecipeId: string | null;
  volume: number;
  remisionNumbers: string[];
};

type RemisionRow = {
  remision_number: string;
  tipo_remision: string;
  volumen_fabricado: number;
  recipe_id: string | null;
  master_recipe_id: string | null;
  fecha: string | null;
  hora_carga: string | null;
  plant_id: string | null;
  created_by: string | null;
};

function nextOrderNumber(existing: string): string {
  const parts = existing.split('-');
  const seq = parseInt(parts[parts.length - 1], 10);
  parts[parts.length - 1] = String(seq + 1).padStart(3, '0');
  return parts.join('-');
}

async function findAvailableOrderNumber(admin: SupabaseClient, baseNumber: string): Promise<string> {
  let candidate = nextOrderNumber(baseNumber);
  for (let i = 0; i < 20; i++) {
    const { data } = await admin.from('orders').select('id').eq('order_number', candidate).maybeSingle();
    if (!data) return candidate;
    candidate = nextOrderNumber(candidate);
  }
  throw new Error(`Could not find available order number after ${baseNumber}`);
}

async function nextPumpRemisionNumber(admin: SupabaseClient, plantId: string): Promise<string> {
  const { data } = await admin
    .from('remisiones')
    .select('remision_number')
    .eq('plant_id', plantId)
    .eq('tipo_remision', 'BOMBEO');

  const maxNumeric = (data ?? []).reduce((max, row) => {
    const n = parseInt(String(row.remision_number).replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  return String(maxNumeric + 1);
}

async function splitPumpRemisiones(
  admin: SupabaseClient,
  orderId: string,
  pumpRemisiones: RemisionRow[],
  keepVolume: number,
  moveVolume: number,
  newOrderId: string,
) {
  if (pumpRemisiones.length === 0) return;

  if (pumpRemisiones.length >= 2) {
    const sorted = [...pumpRemisiones].sort(
      (a, b) => Number(b.volumen_fabricado) - Number(a.volumen_fabricado),
    );
    const [largest, ...rest] = sorted;
    await admin
      .from('remisiones')
      .update({ order_id: newOrderId })
      .eq('order_id', orderId)
      .eq('remision_number', largest.remision_number);
    if (rest.length > 0 && keepVolume <= 0) {
      await admin
        .from('remisiones')
        .update({ volumen_fabricado: Number(largest.volumen_fabricado) })
        .eq('order_id', newOrderId)
        .eq('remision_number', largest.remision_number);
    }
    return;
  }

  const pump = pumpRemisiones[0];
  const totalPump = Number(pump.volumen_fabricado) || 0;

  if (totalPump > 0 && Math.abs(totalPump - (keepVolume + moveVolume)) > 0.01) {
    keepVolume = Math.round((keepVolume / (keepVolume + moveVolume)) * totalPump * 100) / 100;
    moveVolume = Math.round((totalPump - keepVolume) * 100) / 100;
  }

  await admin
    .from('remisiones')
    .update({ volumen_fabricado: keepVolume })
    .eq('order_id', orderId)
    .eq('remision_number', pump.remision_number);

  if (moveVolume <= 0 || !pump.plant_id) return;

  const newRemisionNumber = await nextPumpRemisionNumber(admin, pump.plant_id);
  const { error: insertErr } = await admin.from('remisiones').insert({
    order_id: newOrderId,
    remision_number: newRemisionNumber,
    fecha: pump.fecha,
    hora_carga: pump.hora_carga,
    volumen_fabricado: moveVolume,
    tipo_remision: 'BOMBEO',
    plant_id: pump.plant_id,
    created_by: pump.created_by,
    recipe_id: null,
    master_recipe_id: null,
  });

  if (insertErr) {
    throw new Error(`Failed to create split pump remision: ${insertErr.message}`);
  }
}

async function main() {
  const sourceOrderId = process.env.ORDER_ID;
  if (!sourceOrderId) {
    console.error('Set ORDER_ID=<uuid>');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  assertSupabaseServiceRoleKey(key);

  const admin = createClient(url, key);

  const { data: source, error: sourceErr } = await admin
    .from('orders')
    .select('*')
    .eq('id', sourceOrderId)
    .single();

  if (sourceErr || !source) {
    console.error('Source order not found:', sourceErr?.message);
    process.exit(1);
  }

  const { data: remisiones, error: remErr } = await admin
    .from('remisiones')
    .select('remision_number, tipo_remision, volumen_fabricado, recipe_id, master_recipe_id, fecha, hora_carga, plant_id, created_by')
    .eq('order_id', sourceOrderId)
    .order('remision_number');

  if (remErr || !remisiones?.length) {
    console.error('No remisiones found:', remErr?.message);
    process.exit(1);
  }

  const recipeIds = [...new Set(remisiones.filter((r) => r.tipo_remision === 'CONCRETO' && r.recipe_id).map((r) => r.recipe_id!))];
  const { data: recipes } = await admin.from('recipes').select('id, recipe_code, master_recipe_id').in('id', recipeIds);
  const recipeMap = new Map((recipes ?? []).map((r) => [r.id, r]));

  const variantGroups: VariantGroup[] = [];
  for (const recipeId of recipeIds) {
    const recipe = recipeMap.get(recipeId);
    if (!recipe) continue;
    const rows = remisiones.filter((r) => r.tipo_remision === 'CONCRETO' && r.recipe_id === recipeId);
    variantGroups.push({
      recipeId,
      recipeCode: recipe.recipe_code,
      masterRecipeId: recipe.master_recipe_id,
      volume: rows.reduce((s, r) => s + (Number(r.volumen_fabricado) || 0), 0),
      remisionNumbers: rows.map((r) => r.remision_number),
    });
  }

  variantGroups.sort((a, b) => a.remisionNumbers[0]?.localeCompare(b.remisionNumbers[0] ?? '') ?? 0);

  if (variantGroups.length !== 2) {
    console.error(`Expected exactly 2 variants, found ${variantGroups.length}:`, variantGroups.map((v) => v.recipeCode));
    process.exit(1);
  }

  const [keepVariant, moveVariant] = variantGroups;
  const pumpRemisiones = remisiones.filter((r) => r.tipo_remision === 'BOMBEO') as RemisionRow[];
  const totalConcrete = keepVariant.volume + moveVariant.volume;
  const keepPumpVolume = totalConcrete > 0
    ? Math.round((keepVariant.volume / totalConcrete) * pumpRemisiones.reduce((s, r) => s + (Number(r.volumen_fabricado) || 0), 0) * 100) / 100
    : 0;
  const movePumpVolume = pumpRemisiones.reduce((s, r) => s + (Number(r.volumen_fabricado) || 0), 0) - keepPumpVolume;

  const { data: orderItems } = await admin.from('order_items').select('*').eq('order_id', sourceOrderId);
  const concreteItem = orderItems?.find(
    (i) => i.product_type !== 'SERVICIO DE BOMBEO' && i.product_type !== 'VACÍO DE OLLA' && !i.product_type?.startsWith('PRODUCTO ADICIONAL:') && !i.has_empty_truck_charge,
  );
  const pumpItem = orderItems?.find((i) => i.product_type === 'SERVICIO DE BOMBEO');

  if (!concreteItem) {
    console.error('No concrete order item found');
    process.exit(1);
  }

  const unitPrice = Number(concreteItem.unit_price) || 0;
  const pumpPrice = Number(pumpItem?.pump_price ?? pumpItem?.unit_price) || 310;
  const quoteDetailId = concreteItem.quote_detail_id;
  const masterRecipeId = concreteItem.master_recipe_id ?? keepVariant.masterRecipeId;

  const newOrderNumber = await findAvailableOrderNumber(admin, source.order_number as string);
  const splitNote = `Separada por variante (sobrecosto): ${keepVariant.recipeCode} en ${source.order_number}, ${moveVariant.recipeCode} en ${newOrderNumber}`;

  const { data: newOrder, error: createErr } = await admin
    .from('orders')
    .insert({
      quote_id: source.quote_id,
      client_id: source.client_id,
      construction_site: source.construction_site,
      construction_site_id: source.construction_site_id,
      plant_id: source.plant_id,
      order_number: newOrderNumber,
      requires_invoice: source.requires_invoice,
      delivery_date: source.delivery_date,
      delivery_time: source.delivery_time,
      special_requirements: source.special_requirements,
      elemento: source.elemento,
      total_amount: moveVariant.volume * unitPrice + movePumpVolume * pumpPrice,
      preliminary_amount: moveVariant.volume * unitPrice + movePumpVolume * pumpPrice,
      order_status: source.order_status,
      credit_status: source.credit_status,
      created_by: source.created_by,
      auto_generated: source.auto_generated,
      effective_for_balance: source.effective_for_balance,
      client_approval_status: source.client_approval_status,
      comentarios_internos: splitNote,
    })
    .select('id')
    .single();

  if (createErr || !newOrder) {
    console.error('Failed to create new order:', createErr?.message);
    process.exit(1);
  }

  const newOrderId = newOrder.id as string;
  console.log('Created new order:', newOrderId, newOrderNumber);

  await admin.from('orders').update({
    total_amount: keepVariant.volume * unitPrice + keepPumpVolume * pumpPrice,
    preliminary_amount: keepVariant.volume * unitPrice + keepPumpVolume * pumpPrice,
    comentarios_internos: splitNote,
    updated_at: new Date().toISOString(),
  }).eq('id', sourceOrderId);

  await admin.from('order_items').update({
    product_type: keepVariant.recipeCode,
    recipe_id: keepVariant.recipeId,
    master_recipe_id: masterRecipeId,
    quote_detail_id: quoteDetailId,
    volume: keepVariant.volume,
    unit_price: unitPrice,
    total_price: keepVariant.volume * unitPrice,
    concrete_volume_delivered: 0,
  }).eq('id', concreteItem.id);

  if (pumpItem) {
    await admin.from('order_items').update({
      volume: keepPumpVolume,
      pump_volume: keepPumpVolume,
      pump_price: pumpPrice,
      unit_price: pumpPrice,
      total_price: keepPumpVolume * pumpPrice,
      pump_volume_delivered: 0,
    }).eq('id', pumpItem.id);
  }

  const newItems: Record<string, unknown>[] = [{
    order_id: newOrderId,
    quote_detail_id: quoteDetailId,
    product_type: moveVariant.recipeCode,
    recipe_id: moveVariant.recipeId,
    master_recipe_id: masterRecipeId,
    volume: moveVariant.volume,
    unit_price: unitPrice,
    total_price: moveVariant.volume * unitPrice,
    has_pump_service: false,
    has_empty_truck_charge: false,
    concrete_volume_delivered: 0,
  }];

  if (movePumpVolume > 0) {
    newItems.push({
      order_id: newOrderId,
      product_type: 'SERVICIO DE BOMBEO',
      volume: movePumpVolume,
      pump_volume: movePumpVolume,
      pump_price: pumpPrice,
      unit_price: pumpPrice,
      total_price: movePumpVolume * pumpPrice,
      has_pump_service: true,
      has_empty_truck_charge: false,
      concrete_volume_delivered: 0,
      pump_volume_delivered: 0,
    });
  }

  const { error: createItemsErr } = await admin.from('order_items').insert(newItems);
  if (createItemsErr) {
    console.error('Failed to create new order items:', createItemsErr.message);
    process.exit(1);
  }

  const { error: moveRemErr } = await admin
    .from('remisiones')
    .update({ order_id: newOrderId })
    .eq('order_id', sourceOrderId)
    .in('remision_number', moveVariant.remisionNumbers);

  if (moveRemErr) {
    console.error('Failed to move remisiones:', moveRemErr.message);
    process.exit(1);
  }

  await splitPumpRemisiones(admin, sourceOrderId, pumpRemisiones, keepPumpVolume, movePumpVolume, newOrderId);

  const { error: bulkOn } = await admin.rpc('set_arkik_bulk_mode', { enabled: true } as never);
  if (bulkOn) {
    console.error('set_arkik_bulk_mode:', bulkOn.message);
    process.exit(1);
  }

  try {
    console.log(`Recalculating ${keepVariant.recipeCode} order…`);
    await recalculateOrderAmount(sourceOrderId, admin);
    console.log(`Recalculating ${moveVariant.recipeCode} order…`);
    await recalculateOrderAmount(newOrderId, admin);
  } finally {
    await admin.rpc('set_arkik_bulk_mode', { enabled: false } as never);
  }

  await admin.rpc('update_client_balance_with_uuid', {
    p_client_id: source.client_id,
    p_site_id: source.construction_site_id,
    p_site_name: source.construction_site,
  } as never);

  const { data: summary } = await admin
    .from('orders')
    .select(`
      id, order_number, total_amount, final_amount, invoice_amount,
      order_items (product_type, volume, unit_price, concrete_volume_delivered, pump_volume_delivered)
    `)
    .in('id', [sourceOrderId, newOrderId]);

  console.log('\nSplit complete:\n', JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
