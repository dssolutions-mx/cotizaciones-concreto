/**
 * Validate P004P February 2026 bombeo volumes: CSV vs DB
 * - Remision-level: each CSV row volume matches DB volumen_fabricado
 * - Order-level: order_items.pump_volume matches SUM(remisiones)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const PLANT_P004P_ID = 'af86c90f-c76f-44fb-9e2d-d5460ae51aca';

function extractRemisionNum(csvVal: string): string {
  const parts = csvVal.trim().split('-');
  if (parts.length >= 2) {
    return String(parseInt(parts[parts.length - 1], 10));
  }
  return String(parseInt(parts[0] || '0', 10));
}

function parseCsv(filePath: string): Map<string, number> {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer', raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
  const expected = new Map<string, number>();
  for (const row of rows) {
    const rem = (row['Remision'] ?? row['remision'] ?? '') as string;
    if (!rem) continue;
    const m3 = Number(row['M3'] ?? row['m3'] ?? 0);
    const num = extractRemisionNum(String(rem));
    expected.set(num, m3);
  }
  return expected;
}

async function main() {
  const csvPath = path.join(process.cwd(), 'BOMBEO PLATA P004P FEB.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  const csvExpected = parseCsv(csvPath);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .eq('plant_id', PLANT_P004P_ID)
    .gte('delivery_date', '2026-02-01')
    .lte('delivery_date', '2026-02-28');

  const orderIds = (orders || []).map((o) => o.id);
  if (orderIds.length === 0) {
    console.error('No P004P February orders found');
    process.exit(1);
  }

  const { data: remisiones, error: remErr } = await supabase
    .from('remisiones')
    .select('remision_number, volumen_fabricado, order_id')
    .eq('tipo_remision', 'BOMBEO')
    .in('order_id', orderIds);

  if (remErr) {
    console.error('Remisiones error:', remErr);
    process.exit(1);
  }

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('order_id, pump_volume')
    .eq('product_type', 'SERVICIO DE BOMBEO')
    .in('order_id', orderIds);

  const dbRemisiones = remisiones || [];
  const pumpOrderItems = (orderItems || []).filter(
    (oi) => oi.pump_volume != null && Number(oi.pump_volume) > 0
  );

  console.log('='.repeat(60));
  console.log('P004P February Bombeo - Volume Validation');
  console.log('='.repeat(60));
  console.log(`CSV remisiones: ${csvExpected.size} | Total m³: ${Array.from(csvExpected.values()).reduce((a, b) => a + b, 0).toFixed(2)}`);
  console.log(`DB remisiones:  ${dbRemisiones.length} | Total m³: ${dbRemisiones.reduce((a, r) => a + Number(r.volumen_fabricado || 0), 0).toFixed(2)}`);
  console.log('');

  const errors: string[] = [];

  for (const r of dbRemisiones) {
    const num = String(r.remision_number);
    const dbVol = Number(r.volumen_fabricado || 0);
    const csvVol = csvExpected.get(num);
    if (csvVol === undefined) {
      errors.push(`Remision ${num}: IN DB but NOT in CSV`);
    } else if (Math.abs(dbVol - csvVol) > 0.01) {
      errors.push(`Remision ${num}: CSV=${csvVol} DB=${dbVol} DIFF=${(dbVol - csvVol).toFixed(2)}`);
    }
  }
  for (const [num, vol] of Array.from(csvExpected)) {
    const found = dbRemisiones.some((r) => String(r.remision_number) === num);
    if (!found) {
      errors.push(`Remision ${num}: IN CSV but NOT in DB (expected vol=${vol})`);
    }
  }

  if (errors.length > 0) {
    console.log('ERRORS (remision-level):');
    errors.forEach((e) => console.log('  ', e));
    process.exitCode = 1;
  } else {
    console.log('OK: All remisiones match CSV volumes.');
  }

  console.log('');
  console.log('Order-level: pump_volume vs SUM(remisiones)');
  const volByOrder = new Map<string, number>();
  for (const r of dbRemisiones) {
    const oid = r.order_id as string;
    volByOrder.set(oid, (volByOrder.get(oid) || 0) + Number(r.volumen_fabricado || 0));
  }
  for (const oi of pumpOrderItems) {
    const oid = oi.order_id as string;
    const pumpVol = Number(oi.pump_volume || 0);
    const sumRem = volByOrder.get(oid) || 0;
    if (Math.abs(pumpVol - sumRem) > 0.01) {
      console.log(`  Order ${oid.slice(0, 8)}...: pump_volume=${pumpVol} sum_remisiones=${sumRem} MISMATCH`);
      process.exitCode = 1;
    }
  }
  if (process.exitCode !== 1) {
    console.log('OK: All order pump_volumes match sum of remisiones.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
