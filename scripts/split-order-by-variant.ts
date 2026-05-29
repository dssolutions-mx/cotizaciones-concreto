/**
 * Split order a72040f4-60cf-4b76-ad14-bd8fd61ef3e1 into two orders by recipe variant.
 *
 * Original order keeps EX3 (48 m³) + pump remision 1938 (24 m³).
 * New order gets TEC (120 m³) + pump remision 1937 (128 m³).
 *
 * Run: npx tsx --env-file=.env.local scripts/split-order-by-variant.ts
 */

import { createClient } from '@supabase/supabase-js';
import { recalculateOrderAmount } from '../src/services/orderService';
import { assertSupabaseServiceRoleKey } from './lib/assertSupabaseServiceRoleKey';

const SOURCE_ORDER_ID = 'a72040f4-60cf-4b76-ad14-bd8fd61ef3e1';

const EX3_RECIPE_ID = '0e858182-ae43-4116-8d9e-d6b892910452';
const EX3_CODE = '0-250-2-C-28-18-B-2-EX3';
const EX3_VOLUME = 48;

const TEC_RECIPE_ID = '7932ff14-6923-47ec-9089-a7744b3ddbc9';
const TEC_CODE = '0-250-2-C-28-18-B-2-TEC';
const TEC_VOLUME = 120;

const MASTER_RECIPE_ID = '9bec1b94-6f2c-49f3-8c03-d971611afd6d';
const QUOTE_DETAIL_ID = '237e0ecf-3b1b-4594-8ea8-af1910a0eda9';
const UNIT_PRICE = 2780;
const PUMP_PRICE = 310;

const EX3_PUMP_VOLUME = 24;
const TEC_PUMP_VOLUME = 128;

const EX3_CONCRETE_ITEM_ID = '8b699672-469b-4396-94a2-c517b19859ae';
const EX3_PUMP_ITEM_ID = '26f8a7e8-3647-4d05-a196-94d7c247ed42';

const TEC_REMISION_NUMBERS = [
  '970', '971', '972', '973', '974', '975', '976', '977', '978', '979', '980', '981', '982', '983', '984',
];
const TEC_PUMP_REMISION = '1937';
const EX3_PUMP_REMISION = '1938';

async function main() {
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
    .eq('id', SOURCE_ORDER_ID)
    .single();

  if (sourceErr || !source) {
    console.error('Source order not found:', sourceErr?.message);
    process.exit(1);
  }

  const newOrderNumber = 'P005-260526-002';
  const { data: existingNumber } = await admin
    .from('orders')
    .select('id')
    .eq('order_number', newOrderNumber)
    .maybeSingle();

  if (existingNumber) {
    console.error(`Order number ${newOrderNumber} already exists (${existingNumber.id})`);
    process.exit(1);
  }

  const splitNote = 'Separada por variante (sobrecosto): EX3 en P005-260526-001, TEC en P005-260526-002';

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
      total_amount: TEC_VOLUME * UNIT_PRICE + TEC_PUMP_VOLUME * PUMP_PRICE,
      preliminary_amount: TEC_VOLUME * UNIT_PRICE + TEC_PUMP_VOLUME * PUMP_PRICE,
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

  const { error: updateSourceOrderErr } = await admin
    .from('orders')
    .update({
      total_amount: EX3_VOLUME * UNIT_PRICE + EX3_PUMP_VOLUME * PUMP_PRICE,
      preliminary_amount: EX3_VOLUME * UNIT_PRICE + EX3_PUMP_VOLUME * PUMP_PRICE,
      comentarios_internos: splitNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', SOURCE_ORDER_ID);

  if (updateSourceOrderErr) {
    console.error('Failed to update source order totals:', updateSourceOrderErr.message);
    process.exit(1);
  }

  const { error: updateEx3ConcreteErr } = await admin
    .from('order_items')
    .update({
      product_type: EX3_CODE,
      recipe_id: EX3_RECIPE_ID,
      master_recipe_id: MASTER_RECIPE_ID,
      quote_detail_id: QUOTE_DETAIL_ID,
      volume: EX3_VOLUME,
      unit_price: UNIT_PRICE,
      total_price: EX3_VOLUME * UNIT_PRICE,
      concrete_volume_delivered: 0,
    })
    .eq('id', EX3_CONCRETE_ITEM_ID);

  if (updateEx3ConcreteErr) {
    console.error('Failed to update EX3 concrete item:', updateEx3ConcreteErr.message);
    process.exit(1);
  }

  const { error: updateEx3PumpErr } = await admin
    .from('order_items')
    .update({
      volume: EX3_PUMP_VOLUME,
      pump_volume: EX3_PUMP_VOLUME,
      pump_price: PUMP_PRICE,
      unit_price: PUMP_PRICE,
      total_price: EX3_PUMP_VOLUME * PUMP_PRICE,
      pump_volume_delivered: 0,
    })
    .eq('id', EX3_PUMP_ITEM_ID);

  if (updateEx3PumpErr) {
    console.error('Failed to update EX3 pump item:', updateEx3PumpErr.message);
    process.exit(1);
  }

  const { error: createTecItemsErr } = await admin.from('order_items').insert([
    {
      order_id: newOrderId,
      quote_detail_id: QUOTE_DETAIL_ID,
      product_type: TEC_CODE,
      recipe_id: TEC_RECIPE_ID,
      master_recipe_id: MASTER_RECIPE_ID,
      volume: TEC_VOLUME,
      unit_price: UNIT_PRICE,
      total_price: TEC_VOLUME * UNIT_PRICE,
      has_pump_service: false,
      has_empty_truck_charge: false,
      concrete_volume_delivered: 0,
    },
    {
      order_id: newOrderId,
      product_type: 'SERVICIO DE BOMBEO',
      volume: TEC_PUMP_VOLUME,
      pump_volume: TEC_PUMP_VOLUME,
      pump_price: PUMP_PRICE,
      unit_price: PUMP_PRICE,
      total_price: TEC_PUMP_VOLUME * PUMP_PRICE,
      has_pump_service: true,
      has_empty_truck_charge: false,
      concrete_volume_delivered: 0,
      pump_volume_delivered: 0,
    },
  ]);

  if (createTecItemsErr) {
    console.error('Failed to create TEC order items:', createTecItemsErr.message);
    process.exit(1);
  }

  const { error: moveTecRemErr } = await admin
    .from('remisiones')
    .update({ order_id: newOrderId })
    .eq('order_id', SOURCE_ORDER_ID)
    .in('remision_number', TEC_REMISION_NUMBERS);

  if (moveTecRemErr) {
    console.error('Failed to move TEC remisiones:', moveTecRemErr.message);
    process.exit(1);
  }

  const { error: moveTecPumpErr } = await admin
    .from('remisiones')
    .update({ order_id: newOrderId })
    .eq('order_id', SOURCE_ORDER_ID)
    .eq('remision_number', TEC_PUMP_REMISION);

  if (moveTecPumpErr) {
    console.error('Failed to move TEC pump remision:', moveTecPumpErr.message);
    process.exit(1);
  }

  const { error: bulkOn } = await admin.rpc('set_arkik_bulk_mode', { enabled: true } as never);
  if (bulkOn) {
    console.error('set_arkik_bulk_mode:', bulkOn.message);
    process.exit(1);
  }

  try {
    console.log('Recalculating EX3 order…');
    await recalculateOrderAmount(SOURCE_ORDER_ID, admin);
    console.log('Recalculating TEC order…');
    await recalculateOrderAmount(newOrderId, admin);
  } finally {
    await admin.rpc('set_arkik_bulk_mode', { enabled: false } as never);
  }

  const { error: balanceErr } = await admin.rpc('update_client_balance_with_uuid', {
    p_client_id: source.client_id,
    p_site_id: source.construction_site_id,
    p_site_name: source.construction_site,
  } as never);

  if (balanceErr) {
    console.error('Balance update failed:', balanceErr.message);
    process.exit(1);
  }

  const { data: summary } = await admin
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      final_amount,
      invoice_amount,
      order_items (product_type, volume, unit_price, concrete_volume_delivered, pump_volume_delivered)
    `)
    .in('id', [SOURCE_ORDER_ID, newOrderId]);

  console.log('\nSplit complete:\n', JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
