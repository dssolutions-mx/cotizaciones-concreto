import csv
from datetime import datetime
from collections import defaultdict
import json

# Fixed IDs from database
CLIENT_IDS = {
    'SEDENA': '241d39e9-ec9b-41b9-a93b-7c20e3638f1c',  # FIDEICOMISO DE ADMINISTRACION Y PAGO SEDENA 80778
    'JESUS OCHOA': '2690972d-b975-4a69-a35d-5c4461a7554c',
    'DECODI': '46ba7f7b-468d-4a56-b353-4e79e9832e82',
    'GRUPO ARZER': 'b0af2dbd-eaec-42ea-8585-774c2eb88337',
}

PLANT_IDS = {
    'P002': '836cbbcf-67b2-4534-97cc-b83e71722ff7',  # Tijuana Planta 2
}


def normalize_unit(unit_str):
    """Normalize unit names: BP2 -> BP02, BP1 -> BP01"""
    if not unit_str:
        return None
    unit = unit_str.strip().upper()
    if unit == 'BP2':
        return 'BP02'
    elif unit == 'BP1':
        return 'BP01'
    return unit


def parse_csv(file_path):
    """Parse CSV file with proper encoding and BOM handling"""
    remisiones_data = []
    with open(file_path, mode='r', encoding='utf-8-sig') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            if not row.get('REMISION', '').strip():
                continue
            remisiones_data.append(row)
    return remisiones_data


def parse_remision(row):
    """Parse a single remision row"""
    try:
        remision_num = row['REMISION'].strip()
        fecha_str = row['FECHA'].strip()
        cliente = row['CLIENTE'].strip()
        m3 = float(row['M3'].strip())
        pu_str = row[' P.U '].strip().replace('$', '').replace(',', '').strip()
        unidad_raw = row[' UNIDAD '].strip()
        operador_raw = row[' OPERADOR '].strip()
        planta_raw = row[' PLANTA  '].strip()

        fecha_parts = fecha_str.split('/')
        month = int(fecha_parts[0])
        day = int(fecha_parts[1])
        year_part = int(fecha_parts[2])
        year = 2026 if year_part == 26 else 2026

        fecha = datetime(year, month, day).date()
        unit_price = float(pu_str)
        unidad = normalize_unit(unidad_raw) or (unidad_raw.strip().upper() if unidad_raw.strip() else 'RENTADA')
        operador = operador_raw if operador_raw else None
        planta = planta_raw.strip()

        return {
            'remision_number': remision_num,
            'fecha': fecha,
            'cliente': cliente,
            'volumen_fabricado': m3,
            'unit_price': unit_price,
            'unidad': unidad,
            'operador': operador,
            'planta': planta
        }
    except Exception as e:
        print(f"Error parsing remision {row.get('REMISION', 'unknown')}: {e}")
        return None


def group_remisiones(remisiones):
    """Group remisiones by (date, client, plant)"""
    groups = defaultdict(lambda: {
        'remisiones': [],
        'total_volume': 0.0,
        'unit_price': 0.0,
        'client_name': None,
        'client_id': None,
        'plant_code': None,
        'plant_id': None,
        'date': None
    })

    for remision in remisiones:
        if remision is None:
            continue

        client_name = remision['cliente']
        client_id = None

        if 'SEDENA' in client_name.upper():
            client_id = CLIENT_IDS['SEDENA']
            client_name = 'FIDEICOMISO DE ADMINISTRACION Y PAGO SEDENA 80778'
        elif 'JESUS OCHOA' in client_name.upper():
            client_id = CLIENT_IDS['JESUS OCHOA']
            client_name = 'JESUS OCHOA'
        elif 'DECODI' in client_name.upper():
            client_id = CLIENT_IDS['DECODI']
            client_name = 'DECODI'
        elif 'ARZER' in client_name.upper() or 'GRUPO ARZER' in client_name.upper():
            client_id = CLIENT_IDS['GRUPO ARZER']
            client_name = 'GRUPO ARZER'

        if not client_id:
            print(f"WARNING: Unknown client '{remision['cliente']}'. Skipping remision {remision['remision_number']}")
            continue

        plant_code = remision['planta']
        plant_id = PLANT_IDS.get(plant_code)
        if not plant_id:
            print(f"WARNING: Unknown plant '{plant_code}'. Skipping remision {remision['remision_number']}")
            continue

        date_str = remision['fecha'].strftime('%Y-%m-%d')
        key = (date_str, client_id, plant_id)

        if groups[key]['date'] is None:
            groups[key]['date'] = remision['fecha']
            groups[key]['client_name'] = client_name
            groups[key]['client_id'] = client_id
            groups[key]['plant_code'] = plant_code
            groups[key]['plant_id'] = plant_id
            groups[key]['unit_price'] = remision['unit_price']

        groups[key]['remisiones'].append(remision)
        groups[key]['total_volume'] += remision['volumen_fabricado']

    return groups


def find_closest_order(orders, target_date, client_id, plant_id):
    """Find the closest order by date for the given client/plant"""
    if not orders:
        return None, None

    candidate_orders = [o for o in orders if o['client_id'] == client_id and o['plant_id'] == plant_id]
    if not candidate_orders:
        return None, None

    target_date_obj = datetime.strptime(target_date, '%Y-%m-%d').date() if isinstance(target_date, str) else target_date
    best_order = None
    min_diff = None

    for order in candidate_orders:
        order_date = order['delivery_date']
        if isinstance(order_date, str):
            order_date = datetime.strptime(order_date, '%Y-%m-%d').date()
        diff = abs((order_date - target_date_obj).days)
        if min_diff is None or diff < min_diff:
            min_diff = diff
            best_order = order
        elif diff == min_diff and order_date < target_date_obj:
            best_order = order

    return best_order, min_diff


def generate_migration_sql(groups, orders_data):
    """Generate SQL migration file"""
    sql_parts = []
    sql_parts.append("-- ============================================================================")
    sql_parts.append("-- PUMPING REMISIONES - FEBRUARY 2026 - PLANT 2 (TIJUANA)")
    sql_parts.append("-- ============================================================================")
    sql_parts.append("-- 1. order_items FIRST (pump_volume_delivered = NULL)")
    sql_parts.append("-- 2. remisiones SECOND (triggers update pump_volume_delivered)")
    sql_parts.append("-- 3. Update order totals")
    sql_parts.append("-- ============================================================================")
    sql_parts.append("")
    sql_parts.append("BEGIN;")
    sql_parts.append("")
    sql_parts.append("-- STEP 1: Create pumping order items FIRST")
    sql_parts.append("-- ============================================================================")

    orders_by_key = {}
    for order in orders_data:
        date_str = order['delivery_date']
        if isinstance(date_str, str):
            date_str = date_str.split('T')[0] if 'T' in str(date_str) else date_str
        else:
            date_str = date_str.strftime('%Y-%m-%d')
        key = (date_str, order['client_id'], order['plant_id'])
        if key not in orders_by_key:
            orders_by_key[key] = []
        orders_by_key[key].append(order)

    order_items_inserts = []
    remisiones_inserts = []
    orders_to_update = set()
    unmatched_groups = []

    for (date_str, client_id, plant_id), group_data in sorted(groups.items()):
        target_order = None
        date_diff = None
        key = (date_str, client_id, plant_id)

        if key in orders_by_key and orders_by_key[key]:
            target_order = orders_by_key[key][0]
            date_diff = 0
        else:
            all_orders = [o for o in orders_data if o['client_id'] == client_id and o['plant_id'] == plant_id]
            result = find_closest_order(all_orders, date_str, client_id, plant_id)
            if result[0]:
                target_order, date_diff = result

        if not target_order:
            unmatched_groups.append({
                'date': date_str,
                'client': group_data['client_name'],
                'plant': group_data['plant_code'],
                'volume': group_data['total_volume']
            })
            print(f"WARNING: No order for {date_str} | {group_data['client_name']} | {group_data['plant_code']}")
            continue

        order_id = target_order['id']
        orders_to_update.add(order_id)

        if date_diff and date_diff > 0:
            print(f"INFO: Closest order (date diff: {date_diff} days) for {date_str} | {group_data['client_name']}")

        total_volume = group_data['total_volume']
        unit_price = group_data['unit_price']
        total_price = total_volume * unit_price

        sql_parts.append(f"-- Date: {date_str} | Client: {group_data['client_name']} | Volume: {total_volume:.2f} m³ | ${total_price:,.2f}")
        if date_diff and date_diff > 0:
            sql_parts.append(f"-- NOTE: Using closest order (date difference: {date_diff} days)")

        order_items_inserts.append(f"""
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
  {total_volume:.2f},
  {unit_price:.2f},
  {total_price:.2f},
  true,
  {unit_price:.2f},
  {total_volume:.2f},
  NULL,
  NOW(),
  NULL
);""")

        for remision in group_data['remisiones']:
            conductor_value = f"'{remision['operador']}'" if remision['operador'] else 'NULL'
            unidad = remision['unidad'] or 'RENTADA'
            sql_parts.append(f"-- Remision {remision['remision_number']} | {remision['volumen_fabricado']:.2f} m³ | {unidad}")
            remisiones_inserts.append(f"""
INSERT INTO remisiones (order_id, remision_number, fecha, hora_carga, volumen_fabricado, tipo_remision, conductor, unidad, plant_id, created_at)
VALUES ('{order_id}', '{remision['remision_number']}', '{date_str}'::date, '08:00:00'::time, {remision['volumen_fabricado']:.2f}, 'BOMBEO', {conductor_value}, '{unidad}', '{plant_id}', NOW());""")

    sql_parts.extend(order_items_inserts)
    sql_parts.append("")
    sql_parts.append("-- STEP 2: Create pumping remisiones SECOND")
    sql_parts.append("-- ============================================================================")
    sql_parts.extend(remisiones_inserts)
    sql_parts.append("")
    sql_parts.append("-- STEP 3: Update order totals")
    sql_parts.append("-- ============================================================================")

    for order_id in sorted(orders_to_update):
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

    if unmatched_groups:
        sql_parts.append("")
        sql_parts.append("-- WARNING: Skipped (no matching order):")
        for g in unmatched_groups:
            sql_parts.append(f"-- {g['date']} | {g['client']} | {g['plant']} | {g['volume']:.2f} m³")

    return '\n'.join(sql_parts), unmatched_groups


if __name__ == "__main__":
    try:
        with open('february_orders.json', 'r') as f:
            orders_data = json.load(f)
        print(f"Loaded {len(orders_data)} orders from february_orders.json")
    except FileNotFoundError:
        print("Run: node --env-file=.env.local -r ts-node/register scripts/fetch-february-orders.ts")
        exit(1)

    csv_rows = parse_csv('RELACION BOMBEO FEB.csv')
    remisiones = []
    for r in csv_rows:
        p = parse_remision(r)
        if p:
            remisiones.append(p)
    print(f"Parsed {len(remisiones)} remisiones from CSV")

    groups = group_remisiones(remisiones)
    print(f"Grouped into {len(groups)} groups")

    migration_sql, unmatched = generate_migration_sql(groups, orders_data)

    migration_file = 'supabase/migrations/20260203_february_pumping_remisiones_p2.sql'
    with open(migration_file, 'w', encoding='utf-8') as f:
        f.write(migration_sql)

    print(f"\nGenerated {migration_file}")
    print(f"Groups: {len(groups)}, Unmatched: {len(unmatched)}")
    if unmatched:
        for g in unmatched:
            print(f"  {g['date']} | {g['client']} | {g['volume']:.2f} m³")
