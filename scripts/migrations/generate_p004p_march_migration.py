#!/usr/bin/env python3
"""
Generate migration for P004P (Planta 4 Pitahaya) March 2026 pumping remisiones
from BOMBEO P4p MARZO 2026.csv.

Volume-based match to orders (see plan). Same procedure as February:
order_items first, remisiones second, total_amount updates.
"""

import csv
from datetime import datetime
from collections import defaultdict
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_DATA = _REPO_ROOT / 'archive' / 'data'

PLANT_P004P_ID = 'af86c90f-c76f-44fb-9e2d-d5460ae51aca'

# Pump remision_number -> order_id (March 2026 P004P)
REMISION_TO_ORDER = {
    '1857': 'a0483f37-5820-45c5-aabc-bdf4f23e6240',
    '1858': 'bb925763-d980-471b-b459-0c7d75fc1a89',
    '1859': 'bad811f4-1074-4d19-8080-dfb8b150d647',
    '1864': 'dc15e6f4-a4d5-415a-ac8e-10a9ca504200',
    '2981': 'c83bf49a-7b14-4ef9-aaea-0975ff6ce4ef',
    '2982': '468fe44f-7804-464e-a4a4-994d9b28423d',
    '2983': 'c4065eb7-6c29-41ef-ab08-1eb27333a9c3',
    '2984': '8d798102-2c38-470f-b9e7-ff5b2062e636',
    '2985': '10c5afbd-e617-4a0d-921b-3975078ef054',
    '2986': 'bfe7c55a-e9d0-44bd-b5bd-5a02a7c0e865',
    '2987': 'ee94c6b6-180b-4142-895a-ec2c751215a6',
    '2988': '83caa901-2c57-416a-955e-d21eee044a40',
    '2989': 'd2888ae0-6ab3-404e-ae71-6b6c0be64868',
    '2990': '4f839bf1-075c-40a5-b890-805c34f64cc5',
    '2991': '80ef8528-0bf4-4f7e-972b-3f4631d3b74f',
    '2992': '51335321-26f9-49d2-9285-dba385a53aca',
    '2993': '7afce0c2-2e9d-4c38-bf71-92e1eed09f57',
    '2994': '6d565ff7-1216-4283-9216-1886ce998066',
    '2995': 'c652c15b-d460-4ae8-ad28-642229a00a96',
    '2996': 'baab5299-3416-4478-8642-396d33117ea5',
    '2997': '8922997b-7144-4885-a589-6c95539b1118',
    '2998': '30e478f7-5a85-4260-834f-9bd2e72e67e5',
}


def extract_remision_num(csv_val):
    """Plain '1857' or 'P004-006287' -> normalized string."""
    s = str(csv_val).strip()
    parts = s.split('-')
    if len(parts) >= 2:
        return str(int(parts[-1]))
    return str(int(parts[0])) if parts else ''


def normalize_key(d):
    return {k.strip(): v for k, v in d.items()} if isinstance(d, dict) else d


def parse_csv(file_path):
    rows = []
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            row = normalize_key(row)
            rem_key = None
            for k in ('REMISION', 'Remision', 'remision'):
                if row.get(k, '').strip():
                    rem_key = k
                    break
            if not rem_key:
                continue
            try:
                remision_raw = row[rem_key].strip()
                remision_num = extract_remision_num(remision_raw)
                fecha_key = next((k for k in ('FECHA', 'Fecha', 'fecha') if k in row), 'FECHA')
                fecha_str = row[fecha_key].strip()
                m3 = float(str(row.get('M3', '0')).strip())
                pu_str = str(row.get('P.U', row.get(' P.U ', '0'))).replace('$', '').replace(',', '').strip()
                unidad = str(row.get('UNIDAD', '')).strip() or 'BP-04'
                oper_key = next((k for k in ('OPERADOR', 'Operador', 'operador') if k in row), 'OPERADOR')
                operador = str(row.get(oper_key, '')).strip() or 'Omar Saucedo'

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
                print(f"Skip row {row.get(rem_key)}: {e}")
    return rows


def sql_escape(s):
    return s.replace("'", "''")


def main():
    csv_path = str(_DATA / 'BOMBEO P4p MARZO 2026.csv')
    remisiones = parse_csv(csv_path)
    print(f"Parsed {len(remisiones)} remisiones from {csv_path}")

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
        print(f"WARNING: Unmatched remision numbers: {unmatched}")

    sql_parts = [
        "-- ============================================================================",
        "-- PUMPING REMISIONES - MARCH 2026 - PLANT P004P (PITAHAYA)",
        "-- Source: BOMBEO P4p MARZO 2026.csv | Volume-based order match",
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
        unit_price = sum(g['prices']) / len(g['prices']) if g['prices'] else 310.0
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
            op = sql_escape(rem['operador'])
            conductor_val = f"'{op}'" if rem['operador'] else 'NULL'
            unidad_esc = sql_escape(rem['unidad'])
            fecha_str = rem['fecha'].strftime('%Y-%m-%d')
            remisiones_sql.append(f"""
INSERT INTO remisiones (order_id, remision_number, fecha, hora_carga, volumen_fabricado, tipo_remision, conductor, unidad, plant_id, created_at)
VALUES ('{order_id}', '{rem['remision_number']}', '{fecha_str}'::date, '08:00:00'::time, {rem['volumen_fabricado']:.2f}, 'BOMBEO', {conductor_val}, '{unidad_esc}', '{PLANT_P004P_ID}', NOW());""")

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

    out_path = str(_REPO_ROOT / 'supabase/migrations/20260407_p004p_march_pumping_remisiones.sql')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_parts))

    print(f"Written {out_path}")
    print(f"  - {len(order_groups)} orders with pumping")
    print(f"  - {len(remisiones_sql)} remisiones")
    print(f"  - {len(unmatched)} unmatched")


if __name__ == '__main__':
    main()
