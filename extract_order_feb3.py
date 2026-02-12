#!/usr/bin/env python3
"""Extract order ORD-20260128-7243 from February 3rd backup"""

import json
import os
from datetime import datetime

ORDER_ID = "8c292525-aaeb-4287-b890-a5ccfdac9254"
ORDER_NUMBER = "ORD-20260128-7243"
BACKUP_FILE = "db_cluster-03-02-2026@04-33-47.backup"

print(f"Searching backup: {BACKUP_FILE}")
print(f"Order ID: {ORDER_ID}")
print(f"Order Number: {ORDER_NUMBER}")
print("=" * 70)

order_found = False
order_line = None
order_items = []
order_notifications = []
current_table = None

try:
    with open(BACKUP_FILE, 'r', encoding='utf-8', errors='ignore') as f:
        for line_num, line in enumerate(f, 1):
            # Track table
            if 'COPY public.orders' in line:
                current_table = 'orders'
                print(f"Found orders table at line {line_num}")
                continue
            elif 'COPY public.order_items' in line:
                current_table = 'order_items'
                print(f"Found order_items table at line {line_num}")
                continue
            elif 'COPY public.order_notifications' in line:
                current_table = 'order_notifications'
                print(f"Found order_notifications table at line {line_num}")
                continue
            elif line.startswith('COPY ') or (line.startswith('\\') and len(line.strip()) > 1):
                current_table = None
                continue
            
            # Search for order_id
            if ORDER_ID in line:
                if current_table == 'orders':
                    order_found = True
                    order_line = line.strip()
                    print(f"\n✅ FOUND ORDER at line {line_num}!")
                    print(f"   {line.strip()[:500]}")
                elif current_table == 'order_items':
                    order_items.append((line_num, line.strip()))
                    print(f"   Found order item at line {line_num}")
                elif current_table == 'order_notifications':
                    order_notifications.append((line_num, line.strip()))
                    print(f"   Found notification at line {line_num}")
            
            # Also search for order_number
            if ORDER_NUMBER in line and not order_found:
                if current_table == 'orders':
                    order_found = True
                    order_line = line.strip()
                    print(f"\n✅ FOUND ORDER by number at line {line_num}!")
                    print(f"   {line.strip()[:500]}")
            
            # Progress indicator
            if line_num % 50000 == 0:
                print(f"   Searched {line_num:,} lines...", end='\r')
    
    print(f"\n{'='*70}")
    print("SUMMARY:")
    print(f"  Order found: {'✅ YES' if order_found else '❌ NO'}")
    print(f"  Order items found: {len(order_items)}")
    print(f"  Notifications found: {len(order_notifications)}")
    
    if order_found:
        print(f"\n✅ ORDER DATA:")
        print(f"   {order_line}")
    
    if order_items:
        print(f"\n✅ Order Items ({len(order_items)}):")
        for line_num, item in order_items[:10]:
            print(f"   Line {line_num}: {item[:200]}")
    
    if order_notifications:
        print(f"\n✅ Notifications ({len(order_notifications)}):")
        for line_num, notif in order_notifications[:5]:
            print(f"   Line {line_num}: {notif[:200]}")
    
    # Save results
    output = {
        "extraction_date": datetime.now().isoformat(),
        "backup_file": BACKUP_FILE,
        "order_id": ORDER_ID,
        "order_number": ORDER_NUMBER,
        "order_found": order_found,
        "order_data": order_line,
        "order_items_count": len(order_items),
        "order_items": [item[1] for item in order_items],
        "notifications_count": len(order_notifications),
        "notifications": [notif[1] for notif in order_notifications]
    }
    
    os.makedirs("recovery-exports", exist_ok=True)
    output_file = f"recovery-exports/order-found-feb3-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"\n✅ Results saved to: {output_file}")
        
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
