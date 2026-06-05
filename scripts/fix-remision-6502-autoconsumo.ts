/**
 * Move misassigned remisión 6502 (autoconsumo) from ICC order P004P-260501-008
 * to a new DC CONCRETOS $0 order, then recalculate amounts and balances.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/fix-remision-6502-autoconsumo.ts
 *   DRY_RUN=1 npx tsx --env-file=.env.local scripts/fix-remision-6502-autoconsumo.ts
 */

import { createClient } from '@supabase/supabase-js';
import { recalculateOrderAmount } from '../src/services/orderService';
import { assertSupabaseServiceRoleKey } from './lib/assertSupabaseServiceRoleKey';

const ICC_ORDER_ID = 'cd73113a-c9f9-4740-a040-106e02d470b3';
const REMISION_ID = 'b7bf3b33-e0ae-46a7-8035-6b65b3461302';
const ICC_CLIENT_ID = '2d30610b-9492-42cb-90e3-c6cf89d7940a';
const DC_CLIENT_ID = '24ae8213-de48-4678-bc26-6b2dff3da8e8';
const P004P_PLANT_ID = 'af86c90f-c76f-44fb-9e2d-d5460ae51aca';
const TEMPLATE_ORDER_ID = 'fd3c995c-8161-433b-87e1-eb0b6a5201c1';
const ORDER_NUMBER_BASE = 'P004P-260318';
const ICC_SITE = 'FABRICA DE POSTES';
const DC_SITE = 'PLANTA 5';

const dryRun = process.env.DRY_RUN === '1';

async function findAvailableOrderNumber(
  admin: ReturnType<typeof createClient>,
): Promise<string> {
  for (let seq = 1; seq <= 99; seq++) {
    const candidate = `${ORDER_NUMBER_BASE}-${String(seq).padStart(3, '0')}`;
    const { data } = await admin.from('orders').select('id').eq('order_number', candidate).maybeSingle();
    if (!data) return candidate;
  }
  throw new Error(`No available order number under ${ORDER_NUMBER_BASE}-*`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  assertSupabaseServiceRoleKey(key);

  const admin = createClient(url, key);

  const { data: remision, error: remErr } = await admin
    .from('remisiones')
    .select('id, remision_number, order_id, volumen_fabricado, hora_carga')
    .eq('id', REMISION_ID)
    .single();

  if (remErr || !remision) {
    console.error('Remisión not found:', remErr?.message);
    process.exit(1);
  }

  if (remision.order_id !== ICC_ORDER_ID) {
    console.error(
      `Remisión ${remision.remision_number} is on order ${remision.order_id}, expected ${ICC_ORDER_ID}. Abort.`,
    );
    process.exit(1);
  }

  const { data: template, error: tplErr } = await admin
    .from('orders')
    .select('*')
    .eq('id', TEMPLATE_ORDER_ID)
    .single();

  if (tplErr || !template) {
    console.error('Template order not found:', tplErr?.message);
    process.exit(1);
  }

  const { data: templateItem, error: itemErr } = await admin
    .from('order_items')
    .select('*')
    .eq('order_id', TEMPLATE_ORDER_ID)
    .limit(1)
    .single();

  if (itemErr || !templateItem) {
    console.error('Template order item not found:', itemErr?.message);
    process.exit(1);
  }

  const orderNumber = await findAvailableOrderNumber(admin);
  const volume = Number(remision.volumen_fabricado) || 4;

  console.log('Plan:', {
    dryRun,
    remision: remision.remision_number,
    fromOrder: ICC_ORDER_ID,
    newOrderNumber: orderNumber,
    volumeM3: volume,
  });

  if (dryRun) {
    console.log('DRY_RUN=1 — no writes.');
    return;
  }

  const { data: newOrder, error: orderInsErr } = await admin
    .from('orders')
    .insert({
      order_number: orderNumber,
      client_id: DC_CLIENT_ID,
      quote_id: template.quote_id,
      construction_site: DC_SITE,
      construction_site_id: template.construction_site_id,
      plant_id: P004P_PLANT_ID,
      delivery_date: '2026-03-18',
      delivery_time: remision.hora_carga ?? template.delivery_time,
      total_amount: 0,
      preliminary_amount: 0,
      final_amount: 0,
      invoice_amount: 0,
      order_status: template.order_status ?? 'created',
      credit_status: 'approved',
      requires_invoice: template.requires_invoice ?? true,
      auto_generated: true,
      effective_for_balance: true,
      created_by: template.created_by,
      elemento: template.elemento,
      special_requirements: template.special_requirements,
      client_approval_status: template.client_approval_status ?? 'not_required',
      location_data_status: template.location_data_status ?? 'none',
    })
    .select('id, order_number')
    .single();

  if (orderInsErr || !newOrder) {
    console.error('Failed to create DC order:', orderInsErr?.message);
    process.exit(1);
  }

  console.log('Created DC order:', newOrder.order_number, newOrder.id);

  const { error: oiErr } = await admin.from('order_items').insert({
    order_id: newOrder.id,
    product_type: templateItem.product_type,
    master_recipe_id: templateItem.master_recipe_id,
    quote_detail_id: templateItem.quote_detail_id,
    volume,
    unit_price: 0,
    total_price: 0,
    has_pump_service: false,
    has_empty_truck_charge: false,
    concrete_volume_delivered: 0,
    pump_volume_delivered: 0,
  });

  if (oiErr) {
    console.error('Failed to create order item:', oiErr.message);
    await admin.from('orders').delete().eq('id', newOrder.id);
    process.exit(1);
  }

  const { error: moveErr } = await admin
    .from('remisiones')
    .update({ order_id: newOrder.id })
    .eq('id', REMISION_ID);

  if (moveErr) {
    console.error('Failed to move remisión:', moveErr.message);
    process.exit(1);
  }

  console.log('Moved remisión 6502 to', newOrder.id);

  const { error: bulkOn } = await admin.rpc('set_arkik_bulk_mode', { enabled: true } as never);
  if (bulkOn) {
    console.error('set_arkik_bulk_mode:', bulkOn.message);
    process.exit(1);
  }

  try {
    console.log('Recalculating ICC order…');
    await recalculateOrderAmount(ICC_ORDER_ID, admin);
    console.log('Recalculating DC order…');
    await recalculateOrderAmount(newOrder.id, admin);
  } finally {
    await admin.rpc('set_arkik_bulk_mode', { enabled: false } as never);
  }

  for (const [clientId, site] of [
    [ICC_CLIENT_ID, ICC_SITE],
    [ICC_CLIENT_ID, null],
    [DC_CLIENT_ID, DC_SITE],
    [DC_CLIENT_ID, null],
  ] as const) {
    const { error } = await admin.rpc('update_client_balance', {
      p_client_id: clientId,
      p_site_name: site,
    } as never);
    if (error) console.error('update_client_balance', clientId, site, error.message);
  }

  console.log('\n--- Verification ---');

  const { data: iccCheck } = await admin
    .from('remisiones')
    .select('remision_number, orders!inner(final_amount), order_items:orders(order_items(concrete_volume_delivered))')
    .eq('order_id', ICC_ORDER_ID);

  const { data: dcCheck } = await admin
    .from('remisiones')
    .select('remision_number, orders!inner(order_number, client_id, final_amount)')
    .eq('id', REMISION_ID)
    .single();

  const { data: balances } = await admin
    .from('client_balances')
    .select('construction_site, current_balance')
    .eq('client_id', ICC_CLIENT_ID);

  console.log('ICC remisiones on order:', iccCheck?.map((r) => r.remision_number));
  console.log('Remisión 6502 target:', dcCheck);
  console.log('ICC balances:', balances);

  const { data: iccOrder } = await admin
    .from('orders')
    .select('final_amount, order_items(concrete_volume_delivered)')
    .eq('id', ICC_ORDER_ID)
    .single();

  console.log('ICC order final_amount:', iccOrder?.final_amount);
  console.log('ICC delivered:', iccOrder?.order_items);

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
