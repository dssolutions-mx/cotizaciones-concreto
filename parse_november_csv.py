import csv
from collections import defaultdict
from datetime import datetime

# Read CSV
remisiones = []
with open('BOMBEO P2 Y P4.csv', 'r', encoding='utf-8-sig') as f:  # utf-8-sig handles BOM
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
        
        # Parse date (11/1/25 -> 2025-11-01)
        fecha_parts = fecha_str.split('/')
        month = int(fecha_parts[0])
        day = int(fecha_parts[1])
        year = 2000 + int(fecha_parts[2])
        fecha = f'{year}-{month:02d}-{day:02d}'
        
        remisiones.append({
            'remision': remision_num,
            'fecha': fecha,
            'cliente': cliente,
            'volumen': volumen,
            'precio': precio,
            'unidad': unidad,
            'operador': operador
        })

# Group by date, client, and plant
# Based on filename 'P2 Y P4', BP01/BP02/BP03 -> Plant 2 for SEDENA
groups = defaultdict(lambda: {'remisiones': [], 'total_volumen': 0, 'precio': 0})

for r in remisiones:
    # Determine plant - all BP units go to Plant 2 for now
    plant_key = 'P2'  # Plant 2
    
    key = (r['fecha'], r['cliente'], plant_key)
    groups[key]['remisiones'].append(r)
    groups[key]['total_volumen'] += r['volumen']
    groups[key]['precio'] = r['precio']  # Should be same for all in group

# Print summary
print(f'Total remisiones: {len(remisiones)}')
print(f'Total groups: {len(groups)}')
print()
print('Groups by date/client/plant:')
for (fecha, cliente, plant), data in sorted(groups.items()):
    print(f'{fecha} | {cliente} | {plant} | {len(data["remisiones"])} remisiones | {data["total_volumen"]:.2f} m³ | ${data["precio"]:.2f}')

