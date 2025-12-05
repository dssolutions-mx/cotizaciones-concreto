import csv
from collections import defaultdict

# Plant IDs
PLANT_2_ID = '836cbbcf-67b2-4534-97cc-b83e71722ff7'  # Tijuana Planta 2
PLANT_4_ID = '78fba7b9-645a-4006-96e7-e6c4d5a9d10e'  # Tijuana Planta 4
SEDENA_CLIENT_ID = '241d39e9-ec9b-41b9-a93b-7c20e3638f1c'  # FIDEICOMISO DE ADMINISTRACION Y PAGO SEDENA 80778
JESUS_OCHOA_CLIENT_ID = '2690972d-b975-4a69-a35d-5c4461a7554c'  # JESUS OCHOA

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
        
        # Parse date (11/1/25 -> 2025-11-01)
        fecha_parts = fecha_str.split('/')
        month = int(fecha_parts[0])
        day = int(fecha_parts[1])
        year = 2000 + int(fecha_parts[2])
        fecha = f'{year}-{month:02d}-{day:02d}'
        
        # Determine plant based on unit
        # BP02 -> Plant 4, BP01/BP03 -> Plant 2 (based on filename P2 Y P4)
        if unidad == 'BP02':
            plant_id = PLANT_4_ID
            plant_name = 'P4'
        else:  # BP01, BP03
            plant_id = PLANT_2_ID
            plant_name = 'P2'
        
        # Determine client ID
        if cliente == 'SEDENA':
            client_id = SEDENA_CLIENT_ID
        elif cliente == 'JESUS OCHOA':
            client_id = JESUS_OCHOA_CLIENT_ID
        else:
            client_id = SEDENA_CLIENT_ID  # Default to SEDENA
        
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
            'plant_name': plant_name
        })

# Group by date, client, and plant
groups = defaultdict(lambda: {'remisiones': [], 'total_volumen': 0, 'precio': 0, 'plant_id': None, 'client_id': None})

for r in remisiones:
    key = (r['fecha'], r['cliente'], r['plant_name'])
    groups[key]['remisiones'].append(r)
    groups[key]['total_volumen'] += r['volumen']
    groups[key]['precio'] = r['precio']
    groups[key]['plant_id'] = r['plant_id']
    groups[key]['client_id'] = r['client_id']

# Print summary
print(f'Total remisiones: {len(remisiones)}')
print(f'Total groups: {len(groups)}')
print()
print('Groups by date/client/plant:')
for (fecha, cliente, plant), data in sorted(groups.items()):
    print(f'{fecha} | {cliente} | {plant} | {len(data["remisiones"])} remisiones | {data["total_volumen"]:.2f} m³ | ${data["precio"]:.2f}')




