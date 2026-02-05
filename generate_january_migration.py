import csv
from datetime import datetime
from collections import defaultdict
import json

# Fixed IDs from database queries
CLIENT_IDS = {
    'SEDENA': '241d39e9-ec9b-41b9-a93b-7c20e3638f1c',  # FIDEICOMISO DE ADMINISTRACION Y PAGO SEDENA 80778
    'JESUS OCHOA': '2690972d-b975-4a69-a35d-5c4461a7554c',
    'IMPULSORA TLAXTALECA': '573922b3-e5d0-4b43-8567-38b075e89de7',  # IMPULSORA TLAXCALTECA DE INDUSTRIAS
    'IMPULSORA TLAXCALTECA': '573922b3-e5d0-4b43-8567-38b075e89de7',  # Alternative spelling
}

PLANT_IDS = {
    'P002': '836cbbcf-67b2-4534-97cc-b83e71722ff7',  # Tijuana Planta 2
    'P003': 'baf175a7-fcf7-4e71-b18f-e952d8802129',  # Tijuana Planta 3
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
            # Skip empty rows
            if not row.get('REMISION', '').strip():
                continue
            remisiones_data.append(row)
    return remisiones_data

def parse_remision(row):
    """Parse a single remision row and return structured data"""
    try:
        remision_num = row['REMISION'].strip()
        fecha_str = row['FECHA'].strip()
        cliente = row['CLIENTE'].strip()
        m3 = float(row['M3'].strip())
        pu_str = row[' P.U '].strip().replace('$', '').replace(',', '').strip()
        unidad_raw = row[' UNIDAD '].strip()
        operador_raw = row[' OPERADOR '].strip()
        planta_raw = row[' PLANTA  '].strip()
        
        # Parse date (MM/DD/YY format) - Note: dates show /25 but this is January 2026
        # Need to handle year correctly
        fecha_parts = fecha_str.split('/')
        month = int(fecha_parts[0])
        day = int(fecha_parts[1])
        year_part = int(fecha_parts[2])
        
        # If year is 25, it's actually 2025 but context says January so it's 2026
        # If year is 26, it's 2026
        year = 2026 if year_part == 26 else 2026  # January 2026
        
        fecha = datetime(year, month, day).date()
        
        # Parse price
        unit_price = float(pu_str)
        
        # Normalize unit
        unidad = normalize_unit(unidad_raw)
        
        # Handle operator (keep multiple as-is, NULL if empty)
        operador = operador_raw if operador_raw else None
        
        # Normalize plant code
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
        
        # Map client name
        client_name = remision['cliente']
        client_id = None
        
        if 'SEDENA' in client_name.upper():
            client_id = CLIENT_IDS['SEDENA']
            client_name = 'FIDEICOMISO DE ADMINISTRACION Y PAGO SEDENA 80778'
        elif 'JESUS OCHOA' in client_name.upper():
            client_id = CLIENT_IDS['JESUS OCHOA']
            client_name = 'JESUS OCHOA'
        elif 'IMPULSORA' in client_name.upper():
            client_id = CLIENT_IDS['IMPULSORA TLAXTALECA']
            client_name = 'IMPULSORA TLAXCALTECA DE INDUSTRIAS'
        
        if not client_id:
            print(f"WARNING: Unknown client '{remision['cliente']}'. Skipping remision {remision['remision_number']}")
            continue
        
        # Get plant ID
        plant_code = remision['planta']
        plant_id = PLANT_IDS.get(plant_code)
        if not plant_id:
            print(f"WARNING: Unknown plant code '{plant_code}'. Skipping remision {remision['remision_number']}")
            continue
        
        # Create group key
        date_str = remision['fecha'].strftime('%Y-%m-%d')
        key = (date_str, client_id, plant_id)
        
        # Initialize group if needed
        if groups[key]['date'] is None:
            groups[key]['date'] = remision['fecha']
            groups[key]['client_name'] = client_name
            groups[key]['client_id'] = client_id
            groups[key]['plant_code'] = plant_code
            groups[key]['plant_id'] = plant_id
            groups[key]['unit_price'] = remision['unit_price']
        
        # Add remision to group
        groups[key]['remisiones'].append(remision)
        groups[key]['total_volume'] += remision['volumen_fabricado']
    
    return groups

def find_closest_order(orders, target_date, client_id, plant_id):
    """Find the closest order by date for the given client/plant"""
    if not orders:
        return None, None
    
    # Filter orders for same client and plant
    candidate_orders = [
        o for o in orders
        if o['client_id'] == client_id and o['plant_id'] == plant_id
    ]
    
    if not candidate_orders:
        return None, None
    
    # Calculate date differences
    if isinstance(target_date, str):
        target_date_obj = datetime.strptime(target_date, '%Y-%m-%d').date()
    else:
        target_date_obj = target_date
    
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
        elif diff == min_diff:
            # Prefer orders before the remision date if tie
            if order_date < target_date_obj:
                best_order = order
    
    return best_order, min_diff

def generate_migration_sql(groups, orders_data):
    """Generate SQL migration file"""
    sql_parts = []
    
    sql_parts.append("-- ============================================================================")
    sql_parts.append("-- PUMPING REMISIONES IMPLEMENTATION - JANUARY 2026")
    sql_parts.append("-- Tijuana Plants 2 and 3")
    sql_parts.append("-- ============================================================================")
    sql_parts.append("-- ")
    sql_parts.append("-- Strategy:")
    sql_parts.append("-- 1. Creates order_items FIRST with pump_volume_delivered = NULL")
    sql_parts.append("-- 2. Creates remisiones SECOND (triggers will update pump_volume_delivered)")
    sql_parts.append("-- 3. Updates order totals")
    sql_parts.append("-- ============================================================================")
    sql_parts.append("")
    sql_parts.append("BEGIN;")
    sql_parts.append("")
    sql_parts.append("-- STEP 1: Create pumping order items FIRST")
    sql_parts.append("-- ============================================================================")
    sql_parts.append("")
    
    # Group orders by date/client/plant for easy lookup
    orders_by_key = {}
    for order in orders_data:
        date_str = order['delivery_date']
        if isinstance(date_str, str):
            date_str = datetime.strptime(date_str, '%Y-%m-%d').date().strftime('%Y-%m-%d')
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
    
    # Process each group
    for (date_str, client_id, plant_id), group_data in sorted(groups.items()):
        # Try exact match first
        target_order = None
        date_diff = None
        
        key = (date_str, client_id, plant_id)
        if key in orders_by_key and orders_by_key[key]:
            target_order = orders_by_key[key][0]
            date_diff = 0
        else:
            # Fallback to closest date
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
            print(f"WARNING: No order found for {date_str} | {group_data['client_name']} | {group_data['plant_code']}")
            continue
        
        order_id = target_order['id']
        orders_to_update.add(order_id)
        
        if date_diff and date_diff > 0:
            print(f"INFO: Using closest order (date diff: {date_diff} days) for {date_str} | {group_data['client_name']} | {group_data['plant_code']}")
        
        # Create order_item
        total_volume = group_data['total_volume']
        unit_price = group_data['unit_price']
        total_price = total_volume * unit_price
        
        sql_parts.append(f"-- Date: {date_str} | Client: {group_data['client_name']} | Plant: {group_data['plant_code']} | Volume: {total_volume:.2f} m³ | Price: ${total_price:,.2f}")
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
        
        # Create remisiones
        for remision in group_data['remisiones']:
            conductor_value = f"'{remision['operador']}'" if remision['operador'] else 'NULL'
            sql_parts.append(f"-- Remision {remision['remision_number']} | {remision['volumen_fabricado']:.2f} m³ | {remision['unidad']}")
            remisiones_inserts.append(f"""
INSERT INTO remisiones (order_id, remision_number, fecha, hora_carga, volumen_fabricado, tipo_remision, conductor, unidad, plant_id, created_at)
VALUES ('{order_id}', '{remision['remision_number']}', '{date_str}'::date, '08:00:00'::time, {remision['volumen_fabricado']:.2f}, 'BOMBEO', {conductor_value}, '{remision['unidad']}', '{plant_id}', NOW());""")
    
    sql_parts.extend(order_items_inserts)
    sql_parts.append("")
    sql_parts.append("-- STEP 2: Create pumping remisiones SECOND")
    sql_parts.append("-- ============================================================================")
    sql_parts.append("")
    sql_parts.extend(remisiones_inserts)
    sql_parts.append("")
    sql_parts.append("-- STEP 3: Update order totals")
    sql_parts.append("-- ============================================================================")
    sql_parts.append("")
    
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
        sql_parts.append("-- ============================================================================")
        sql_parts.append("-- WARNING: The following groups had no matching orders and were skipped:")
        sql_parts.append("-- ============================================================================")
        for group in unmatched_groups:
            sql_parts.append(f"-- {group['date']} | {group['client']} | {group['plant']} | {group['volume']:.2f} m³")
    
    return '\n'.join(sql_parts), unmatched_groups

if __name__ == "__main__":
    # Load orders from JSON file (saved from database query)
    orders_file = 'january_orders.json'
    try:
        with open(orders_file, 'r') as f:
            orders_data = json.load(f)
        print(f"Loaded {len(orders_data)} orders from {orders_file}")
    except FileNotFoundError:
        print(f"ERROR: {orders_file} not found. Please save orders data first.")
        print("The orders data should be saved from the database query result.")
        exit(1)
    
    # Parse CSV
    csv_file_path = 'RELACION DE BOMBEO 2026 (1).csv'
    print(f"Parsing CSV: {csv_file_path}")
    csv_rows = parse_csv(csv_file_path)
    
    # Parse remisiones
    remisiones = []
    for row in csv_rows:
        remision = parse_remision(row)
        if remision:
            remisiones.append(remision)
    
    print(f"Parsed {len(remisiones)} remisiones")
    
    # Group remisiones
    groups = group_remisiones(remisiones)
    print(f"Grouped into {len(groups)} groups")
    
    # Generate migration
    migration_sql, unmatched = generate_migration_sql(groups, orders_data)
    
    migration_file = 'supabase/migrations/20260102_january_pumping_remisiones_p2_p3.sql'
    with open(migration_file, 'w', encoding='utf-8') as f:
        f.write(migration_sql)
    
    print(f"\nMigration file generated: {migration_file}")
    print(f"Total groups: {len(groups)}")
    print(f"Unmatched groups: {len(unmatched)}")
    if unmatched:
        print("\nUnmatched groups:")
        for group in unmatched:
            print(f"  {group['date']} | {group['client']} | {group['plant']} | {group['volume']:.2f} m³")
