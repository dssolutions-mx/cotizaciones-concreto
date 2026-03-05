#!/usr/bin/env python3
"""
Generate migration for P004P (Planta 4 Pitahaya) February 2026 pumping remisiones
from BOMBEO PLATA P004P FEB.csv.

Match by remision number WITHOUT "P004-" prefix: P004-006287 → find concrete
remision "6287" in P004P → add BOMBEO remision to same order.
Same procedure as Plant 2: order_items first, remisiones second, total_amount updates.
"""

import csv
from datetime import datetime
from collections import defaultdict

PLANT_P004P_ID = 'af86c90f-c76f-44fb-9e2d-d5460ae51aca'

# Concrete remisiones in P004P Feb 2026: remision_number -> order_id
REMISION_TO_ORDER = {
    '6285': 'ad64848e-8e4f-4912-805c-680166770013', '6286': '1c17a9ba-34ef-4e56-95ad-f7ff363c7912',
    '6287': '21e377c2-7298-4af7-a622-fe1a0020514a', '6288': '40ee9012-bd3a-4afb-a894-70a698888841',
    '6289': '40ee9012-bd3a-4afb-a894-70a698888841', '6290': '28b177e6-6cc1-437a-a15f-177f565e0cd5',
    '6291': '28b177e6-6cc1-437a-a15f-177f565e0cd5', '6292': '28b177e6-6cc1-437a-a15f-177f565e0cd5',
    '6293': '28b177e6-6cc1-437a-a15f-177f565e0cd5', '6294': '28b177e6-6cc1-437a-a15f-177f565e0cd5',
    '6295': '28b177e6-6cc1-437a-a15f-177f565e0cd5', '6296': 'f53faf0c-abbf-4331-83f5-1c2900cd0d05',
    '6297': 'd9b09943-89e1-4997-a53a-778f33a6307f', '6298': '7ab38186-0467-472b-94d5-afd77695bd16',
    '6299': '7ab38186-0467-472b-94d5-afd77695bd16', '6300': '06d542ab-09a1-46b2-9e36-30b46da7c8b2',
    '6301': '06d542ab-09a1-46b2-9e36-30b46da7c8b2', '6306': '50155aba-1829-4f0d-8dd9-bfcc68d7bf9a',
    '6307': '4ff95308-2f41-484c-b43c-28221b82720a', '6308': 'd68a3024-1c58-4fd0-b35a-fc2665cfb75e',
    '6309': 'feec1a71-a611-413c-8d3c-31d3de665286', '6310': 'feec1a71-a611-413c-8d3c-31d3de665286',
    '6311': 'bd52663b-0dfe-40b1-a8af-44294962c3e0', '6312': 'bd52663b-0dfe-40b1-a8af-44294962c3e0',
    '6313': 'bd52663b-0dfe-40b1-a8af-44294962c3e0', '6314': 'bd52663b-0dfe-40b1-a8af-44294962c3e0',
    '6315': 'feec1a71-a611-413c-8d3c-31d3de665286', '6316': 'bd52663b-0dfe-40b1-a8af-44294962c3e0',
    '6317': 'bd52663b-0dfe-40b1-a8af-44294962c3e0', '6318': 'bd52663b-0dfe-40b1-a8af-44294962c3e0',
    '6327': '46f4e229-313d-41b5-8d59-b54fd1ca7dd7', '6328': '46f4e229-313d-41b5-8d59-b54fd1ca7dd7',
    '6329': '46f4e229-313d-41b5-8d59-b54fd1ca7dd7', '6330': '46f4e229-313d-41b5-8d59-b54fd1ca7dd7',
    '6331': '46f4e229-313d-41b5-8d59-b54fd1ca7dd7', '6332': '46f4e229-313d-41b5-8d59-b54fd1ca7dd7',
    '6333': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae', '6334': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae',
    '6335': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae', '6336': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae',
    '6337': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae', '6338': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae',
    '6339': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae', '6340': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae',
    '6341': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae', '6342': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae',
    '6343': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae', '6344': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae',
    '6345': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae', '6346': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae',
    '6347': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae', '6348': '1288fb38-f118-4a12-ab61-eac30199accd',
    '6349': '1288fb38-f118-4a12-ab61-eac30199accd', '6350': '985a0d12-0dd1-4a4e-9c26-77aa8ac026ae',
    '6351': 'dd60969a-1462-43e0-adc2-03aad7f45a19', '6352': 'dd60969a-1462-43e0-adc2-03aad7f45a19',
    '6353': 'dd60969a-1462-43e0-adc2-03aad7f45a19', '6354': 'cdec71fa-6b37-4ce7-b1ce-5d950ed3e2a8',
    '6355': 'cdec71fa-6b37-4ce7-b1ce-5d950ed3e2a8', '6356': '5fc36f79-68c1-4294-b038-6ed3e0bf1a6f',
    '6361': '3fa6d2b8-afe3-4e94-adfd-df555619ed24', '6362': '3fa6d2b8-afe3-4e94-adfd-df555619ed24',
    '6363': '3fa6d2b8-afe3-4e94-adfd-df555619ed24', '6364': '3fa6d2b8-afe3-4e94-adfd-df555619ed24',
    '6365': '3fa6d2b8-afe3-4e94-adfd-df555619ed24', '6366': '3fa6d2b8-afe3-4e94-adfd-df555619ed24',
    '6367': '0c46e5cf-7da3-4880-a3f6-2f085e6ecfdb', '6383': '3d7c84ea-f7d2-4849-ad61-6701e51af00b',
    '6384': '3d7c84ea-f7d2-4849-ad61-6701e51af00b', '6385': '3d7c84ea-f7d2-4849-ad61-6701e51af00b',
    '6386': '3d7c84ea-f7d2-4849-ad61-6701e51af00b', '6387': '3d7c84ea-f7d2-4849-ad61-6701e51af00b',
    '6388': '3d7c84ea-f7d2-4849-ad61-6701e51af00b', '6390': '3d7c84ea-f7d2-4849-ad61-6701e51af00b',
    '6391': '3d7c84ea-f7d2-4849-ad61-6701e51af00b', '6392': '3d7c84ea-f7d2-4849-ad61-6701e51af00b',
    '6393': 'd493a183-57d6-46af-8ec0-55c0aaa9cf3b',
}


def extract_remision_num(csv_val):
    """P004-006287 -> 6287"""
    parts = str(csv_val).strip().split('-')
    if len(parts) >= 2:
        return str(int(parts[-1]))  # 006287 -> 6287
    return str(int(parts[0])) if parts else ''


def normalize_key(d):
    return {k.strip(): v for k, v in d.items()} if isinstance(d, dict) else d


def parse_csv(file_path):
    rows = []
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            row = normalize_key(row)
            if not row.get('Remision', '').strip():
                continue
            try:
                remision_raw = row['Remision'].strip()
                remision_num = extract_remision_num(remision_raw)
                fecha_str = row['Fecha'].strip()
                m3 = float(str(row.get('M3', '0')).strip())
                pu_str = str(row.get('P.U', row.get(' P.U ', '0'))).replace('$', '').replace(',', '').strip()
                unidad = str(row.get('UNIDAD', '')).strip().upper() or 'BP04'
                operador = str(row.get('OPERADOR', '')).strip() or 'OMAR SANCHEZ'

                parts = fecha_str.split('/')
                month, day = int(parts[0]), int(parts[1])
                year = 2000 + int(parts[2]) if len(parts[2]) == 2 else int(parts[2])
                fecha = datetime(year, month, day).date()
                unit_price = float(pu_str) if pu_str else 0

                rows.append({
                    'remision_number': remision_num,
                    'fecha': fecha,
                    'volumen_fabricado': m3,
                    'unit_price': unit_price,
                    'unidad': unidad,
                    'operador': operador,
                })
            except Exception as e:
                print(f"Skip row {row.get('Remision')}: {e}")
    return rows


def main():
    csv_path = 'BOMBEO PLATA P004P FEB.csv'
    remisiones = parse_csv(csv_path)
    print(f"Parsed {len(remisiones)} remisiones from {csv_path}")

    # Match each to order via concrete remision_number
    order_groups = defaultdict(lambda: {'remisiones': [], 'total_vol': 0.0, 'prices': []})
    unmatched = []

    for r in remisiones:
        order_id = REMISION_TO_ORDER.get(r['remision_number'])
        if not order_id:
            unmatched.append(r['remision_number'])
            continue
        order_groups[order_id]['remisiones'].append(r)
        order_groups[order_id]['total_vol'] += r['volumen_fabricado']
        order_groups[order_id]['prices'].append(r['unit_price'])

    if unmatched:
        print(f"WARNING: Unmatched remision numbers: {unmatched[:10]}{'...' if len(unmatched) > 10 else ''}")

    # Generate SQL (same structure as Plant 2)
    sql_parts = [
        "-- ============================================================================",
        "-- PUMPING REMISIONES - FEBRUARY 2026 - PLANT P004P (PITAHAYA)",
        "-- Source: BOMBEO PLATA P004P FEB.csv | Match by remision_number (no P004- prefix)",
        "-- Same procedure as Plant 2: order_items, remisiones, total_amount",
        "-- ============================================================================",
        "",
        "BEGIN;",
        "",
        "-- STEP 1: Create pumping order items FIRST",
        "-- ============================================================================",
    ]

    remisiones_sql = []
    for order_id in sorted(order_groups.keys()):
        g = order_groups[order_id]
        total_vol = g['total_vol']
        unit_price = sum(g['prices']) / len(g['prices']) if g['prices'] else 360.0
        total_price = total_vol * unit_price

        sql_parts.append(f"""
INSERT INTO order_items (
  order_id,
  product_type,
  volume,
  unit_price,
  total_price,
  has_pump_service,
  pump_price,
  pump_volume,
  quote_detail_id,
  created_at,
  pump_volume_delivered
)
VALUES (
  '{order_id}',
  'SERVICIO DE BOMBEO',
  {total_vol:.2f},
  {unit_price:.2f},
  {total_price:.2f},
  true,
  {unit_price:.2f},
  {total_vol:.2f},
  NULL,
  NOW(),
  NULL
);""")

        for rem in g['remisiones']:
            conductor_val = f"'{rem['operador']}'" if rem['operador'] else 'NULL'
            fecha_str = rem['fecha'].strftime('%Y-%m-%d')
            remisiones_sql.append(f"""
INSERT INTO remisiones (order_id, remision_number, fecha, hora_carga, volumen_fabricado, tipo_remision, conductor, unidad, plant_id, created_at)
VALUES ('{order_id}', '{rem['remision_number']}', '{fecha_str}'::date, '08:00:00'::time, {rem['volumen_fabricado']:.2f}, 'BOMBEO', {conductor_val}, '{rem['unidad']}', '{PLANT_P004P_ID}', NOW());""")

    sql_parts.append("")
    sql_parts.append("-- STEP 2: Create pumping remisiones SECOND")
    sql_parts.append("-- ============================================================================")
    sql_parts.extend(remisiones_sql)
    sql_parts.append("")
    sql_parts.append("-- STEP 3: Update order totals")
    sql_parts.append("-- ============================================================================")

    for order_id in sorted(order_groups.keys()):
        sql_parts.append(f"""
UPDATE orders
SET total_amount = (
  SELECT COALESCE(SUM(total_price), 0)
  FROM order_items
  WHERE order_id = '{order_id}'
)
WHERE id = '{order_id}';""")

    sql_parts.append("")
    sql_parts.append("COMMIT;")

    out_path = 'supabase/migrations/20260203_p004p_february_pumping_remisiones.sql'
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_parts))

    print(f"Written {out_path}")
    print(f"  - {len(order_groups)} orders with pumping")
    print(f"  - {len(remisiones_sql)} remisiones")
    print(f"  - {len(unmatched)} unmatched")


if __name__ == '__main__':
    main()
