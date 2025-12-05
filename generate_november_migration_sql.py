import csv
from collections import defaultdict

# Plant IDs
PLANT_2_ID = '836cbbcf-67b2-4534-97cc-b83e71722ff7'  # Tijuana Planta 2
PLANT_4_ID = '78fba7b9-645a-4006-96e7-e6c4d5a9d10e'  # Tijuana Planta 4
SEDENA_CLIENT_ID = '241d39e9-ec9b-41b9-a93b-7c20e3638f1c'  # FIDEICOMISO DE ADMINISTRACION Y PAGO SEDENA 80778
JESUS_OCHOA_CLIENT_ID = '2690972d-b975-4a69-a35d-5c4461a7554c'  # JESUS OCHOA

# Order mapping - manually matched from database query results
# Format: (date, client, plant_code): order_id
ORDER_MAPPING = {
    # Plant 2 orders
    ('2025-11-01', 'SEDENA', 'P2'): 'da0ac20b-90cc-49f2-8bcd-c999dab8c5c0',  # P002-251112-007
    ('2025-11-03', 'SEDENA', 'P2'): 'da0ac20b-90cc-49f2-8bcd-c999dab8c5c0',  # P002-251112-007 (using Nov 1 order since no Nov 3 Plant 2 order)
    ('2025-11-04', 'SEDENA', 'P2'): '955bd9ed-137f-4a1c-bc54-01056c8ef341',  # P002-251106-001
    ('2025-11-05', 'SEDENA', 'P2'): '7ae397b3-f050-4edd-a1ce-a4924f6ee07a',  # P002-251106-006
    ('2025-11-06', 'SEDENA', 'P2'): '7097cb02-0cba-4ab7-bb91-82ddf97f9f11',  # P002-251106-012
    ('2025-11-07', 'SEDENA', 'P2'): '7097cb02-0cba-4ab7-bb91-82ddf97f9f11',  # P002-251106-012 (using Nov 6 order)
    ('2025-11-08', 'SEDENA', 'P2'): '7097cb02-0cba-4ab7-bb91-82ddf97f9f11',  # P002-251106-012 (using Nov 6 order)
    ('2025-11-10', 'SEDENA', 'P2'): '97e3f2de-fd24-49f6-8508-ae98746afcfe',  # P002-251112-011
    ('2025-11-11', 'SEDENA', 'P2'): '35af3a46-3716-4d05-9052-570970350930',  # P002-251112-001
    ('2025-11-12', 'SEDENA', 'P2'): '6a1872b7-6be3-434b-9cca-4c8fccd60cdc',  # P002-251126-001
    ('2025-11-13', 'SEDENA', 'P2'): 'e8d700d6-107d-4166-a0ea-591c04f7c722',  # P002-251126-008
    ('2025-11-14', 'SEDENA', 'P2'): 'a5b3f764-cec6-4595-a370-0f683b7dadfc',  # P002-251126-015
    ('2025-11-19', 'SEDENA', 'P2'): '33bbac62-1d0a-4fb3-8fbd-35a4ada923ee',  # P002-251124-002
    ('2025-11-20', 'SEDENA', 'P2'): '438bae40-865b-4972-8f47-5a310909c313',  # P002-251121-001
    ('2025-11-21', 'SEDENA', 'P2'): '781a8060-6a8f-49e9-b8a7-8cc73dbbe624',  # P002-251121-004
    ('2025-11-22', 'JESUS OCHOA', 'P2'): '91d005bf-efb7-45be-a88f-b8decead2ff7',  # P002-251124-008
    ('2025-11-22', 'SEDENA', 'P2'): '6eacc7de-2179-4a17-ac02-586f20e6eac7',  # P002-251124-006
    ('2025-11-24', 'SEDENA', 'P2'): 'a12f154b-f685-422a-95fb-7060f9d80d33',  # P002-251125-002
    ('2025-11-25', 'SEDENA', 'P2'): '3e8cba0b-9361-42c2-bebf-9b98d40839ac',  # P002-251127-016
    ('2025-11-26', 'SEDENA', 'P2'): '6eed7421-8fac-434f-8fc9-9f602b9d8999',  # P002-251127-001
    ('2025-11-27', 'SEDENA', 'P2'): 'ab4478ea-9f36-424f-854a-14a644d6dc05',  # P002-251128-003
    ('2025-11-28', 'SEDENA', 'P2'): '4f8b3782-113f-4c81-a8e8-73e3215b8eee',  # P002-251129-001
    ('2025-11-29', 'SEDENA', 'P2'): 'e1356450-ea55-4d35-97a0-e8f4d5778ece',  # P002-251201-003
    
    # Plant 4 orders
    ('2025-11-01', 'SEDENA', 'P4'): '6e552f8d-d6ad-4b3f-ab8c-f4a691a4921e',  # P004-251107-001
    # Note: For dates without Plant 4 orders (Nov 25, 26, 28, 29), BP02 units will be assigned to Plant 2
}

# Read CSV
remisiones = []
with open('BOMBEO P2 Y P4.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        remision_num = row['REMISION'].strip()
        fecha_str = row['FECHA'].strip()
        cliente = row['CLIENTE'].strip()
        volumen = float(row['M3'].strip())
        precio_str = row[' P.U '].strip().replace('$', '').replace(',', '').replace(' ', '')
        precio = float(precio_str)
        unidad = row[' UNIDAD '].strip()
        operador = row[' OPERADOR '].strip()
        
        # Parse date
        fecha_parts = fecha_str.split('/')
        month = int(fecha_parts[0])
        day = int(fecha_parts[1])
        year = 2000 + int(fecha_parts[2])
        fecha = f'{year}-{month:02d}-{day:02d}'
        
        # Determine plant - BP02 goes to Plant 4 if order exists, otherwise Plant 2
        # We'll check later if Plant 4 order exists for the date
        if unidad == 'BP02':
            plant_code = 'P4'
        else:
            plant_code = 'P2'
        
        # Default plant_id - will be adjusted if no Plant 4 order exists
        plant_id = PLANT_4_ID if unidad == 'BP02' else PLANT_2_ID
        
        # Determine client
        if cliente == 'SEDENA':
            client_id = SEDENA_CLIENT_ID
        elif cliente == 'JESUS OCHOA':
            client_id = JESUS_OCHOA_CLIENT_ID
        else:
            client_id = SEDENA_CLIENT_ID
        
        remisiones.append({
            'remision': remision_num,
            'fecha': fecha,
            'cliente': cliente,
            'client_id': client_id,
            'volumen': volumen,
            'precio': precio,
            'unidad': unidad,
            'operador': operador,
            'plant_id': plant_id,
            'plant_code': plant_code
        })

# Group by date, client, and plant
groups = defaultdict(lambda: {'remisiones': [], 'total_volumen': 0, 'precio': 0, 'plant_id': None, 'client_id': None, 'order_id': None, 'plant_code': None})

for r in remisiones:
    key = (r['fecha'], r['cliente'], r['plant_code'])
    groups[key]['remisiones'].append(r)
    groups[key]['total_volumen'] += r['volumen']
    groups[key]['precio'] = r['precio']
    groups[key]['plant_id'] = r['plant_id']
    groups[key]['client_id'] = r['client_id']
    groups[key]['plant_code'] = r['plant_code']
    # Get order_id from mapping
    order_id = ORDER_MAPPING.get(key)
    groups[key]['order_id'] = order_id
    
    # If no Plant 4 order exists, reassign to Plant 2
    if r['plant_code'] == 'P4' and not order_id:
        # Reassign to Plant 2
        key_p2 = (r['fecha'], r['cliente'], 'P2')
        if key_p2 not in groups:
            groups[key_p2] = {'remisiones': [], 'total_volumen': 0, 'precio': 0, 'plant_id': PLANT_2_ID, 'client_id': r['client_id'], 'order_id': ORDER_MAPPING.get(key_p2), 'plant_code': 'P2'}
        groups[key_p2]['remisiones'].append({**r, 'plant_id': PLANT_2_ID, 'plant_code': 'P2'})
        groups[key_p2]['total_volumen'] += r['volumen']
        groups[key_p2]['precio'] = r['precio']
        # Remove from P4 group
        groups[key]['remisiones'] = [rem for rem in groups[key]['remisiones'] if rem['remision'] != r['remision']]
        groups[key]['total_volumen'] -= r['volumen']
        if groups[key]['total_volumen'] == 0:
            del groups[key]

# Generate SQL
sql_parts = []
sql_parts.append("-- ============================================================================")
sql_parts.append("-- PUMPING REMISIONES IMPLEMENTATION - NOVEMBER 2025")
sql_parts.append("-- Tijuana Plants 2 and 4")
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

# Generate order_items
order_ids_to_update = set()
for (fecha, cliente, plant), data in sorted(groups.items()):
    if not data['order_id']:
        print(f"WARNING: No order found for {fecha} | {cliente} | {plant}")
        continue
    
    order_ids_to_update.add(data['order_id'])
    total_price = data['total_volumen'] * data['precio']
    
    sql_parts.append(f"-- Date: {fecha} | Client: {cliente} | Plant: {plant} | Volume: {data['total_volumen']:.2f} m³ | Price: ${total_price:,.2f}")
    sql_parts.append("INSERT INTO order_items (")
    sql_parts.append("  order_id,")
    sql_parts.append("  product_type,")
    sql_parts.append("  volume,")
    sql_parts.append("  unit_price,")
    sql_parts.append("  total_price,")
    sql_parts.append("  has_pump_service,")
    sql_parts.append("  pump_price,")
    sql_parts.append("  pump_volume,")
    sql_parts.append("  quote_detail_id,")
    sql_parts.append("  created_at,")
    sql_parts.append("  pump_volume_delivered")
    sql_parts.append(")")
    sql_parts.append("VALUES (")
    sql_parts.append(f"  '{data['order_id']}',")
    sql_parts.append("  'SERVICIO DE BOMBEO',")
    sql_parts.append(f"  {data['total_volumen']:.2f},")
    sql_parts.append(f"  {int(data['precio'])},")
    sql_parts.append(f"  {total_price:.2f},")
    sql_parts.append("  true,")
    sql_parts.append(f"  {int(data['precio'])},")
    sql_parts.append(f"  {data['total_volumen']:.2f},")
    sql_parts.append("  NULL,")
    sql_parts.append("  NOW(),")
    sql_parts.append("  NULL")
    sql_parts.append(");")
    sql_parts.append("")

sql_parts.append("-- STEP 2: Create pumping remisiones SECOND")
sql_parts.append("-- ============================================================================")

# Generate remisiones
for (fecha, cliente, plant), data in sorted(groups.items()):
    if not data['order_id']:
        continue
    
    sql_parts.append(f"-- Date: {fecha} | Client: {cliente} | Plant: {plant} | {len(data['remisiones'])} remisiones")
    for r in data['remisiones']:
        sql_parts.append(f"INSERT INTO remisiones (order_id, remision_number, fecha, hora_carga, volumen_fabricado, tipo_remision, conductor, unidad, plant_id, created_at)")
        sql_parts.append(f"VALUES ('{data['order_id']}', '{r['remision']}', '{r['fecha']}'::date, '08:00:00'::time, {r['volumen']:.2f}, 'BOMBEO', '{r['operador']}', '{r['unidad']}', '{r['plant_id']}', NOW());")
    sql_parts.append("")

sql_parts.append("-- STEP 3: Update order totals")
sql_parts.append("-- ============================================================================")
sql_parts.append("UPDATE orders o")
sql_parts.append("SET total_amount = (")
sql_parts.append("    SELECT COALESCE(SUM(oi.total_price), 0)")
sql_parts.append("    FROM order_items oi")
sql_parts.append("    WHERE oi.order_id = o.id")
sql_parts.append("),")
sql_parts.append("updated_at = NOW()")
sql_parts.append("WHERE o.id IN (")

order_id_list = ",\n  ".join([f"'{oid}'" for oid in sorted(order_ids_to_update)])
sql_parts.append(f"  {order_id_list}")
sql_parts.append(");")
sql_parts.append("")
sql_parts.append("COMMIT;")
sql_parts.append("")
sql_parts.append("-- ============================================================================")
sql_parts.append(f"-- SUMMARY:")
sql_parts.append(f"-- Pumping remisiones created: {len(remisiones)}")
sql_parts.append(f"-- Orders updated: {len(order_ids_to_update)}")
total_vol = sum(g['total_volumen'] for g in groups.values())
total_rev = sum(g['total_volumen'] * g['precio'] for g in groups.values())
sql_parts.append(f"-- Total volume: {total_vol:.2f} m³")
sql_parts.append(f"-- Total revenue: ${total_rev:,.2f}")
sql_parts.append("-- ============================================================================")

# Write to file
with open('supabase/migrations/20251102_november_pumping_remisiones_p2_p4.sql', 'w') as f:
    f.write('\n'.join(sql_parts))

print(f"Migration file created: supabase/migrations/20251102_november_pumping_remisiones_p2_p4.sql")
print(f"Total remisiones: {len(remisiones)}")
print(f"Total groups: {len(groups)}")
print(f"Orders to update: {len(order_ids_to_update)}")

