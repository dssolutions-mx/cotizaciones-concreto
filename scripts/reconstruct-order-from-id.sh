#!/bin/bash
# Reconstruct order data using order_id from related tables
# Even if order was deleted, related tables might still have data

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

ORDER_ID="8c292525-aaeb-4287-b890-a5ccfdac9254"
ORDER_NUMBER="ORD-20260128-7243"
DB_URL="postgresql://postgres.pkjqznogflgbnwzkzmpg:Jj25844105826@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
OUTPUT_DIR="./recovery-exports"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo -e "${BLUE}=== Reconstructing Order from Related Tables ===${NC}\n"
echo "Order ID: $ORDER_ID"
echo "Order Number: $ORDER_NUMBER"
echo ""

mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}Step 1: Checking for order_items...${NC}"
ITEMS_FILE="$OUTPUT_DIR/order-items-$TIMESTAMP.json"

docker run --rm -i postgres:15 psql "$DB_URL" -c "
SELECT 
    json_build_object(
        'order_items', json_agg(
            json_build_object(
                'id', oi.id,
                'product_id', oi.product_id,
                'product_name', p.name,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'total_price', oi.total_price,
                'notes', oi.notes,
                'created_at', oi.created_at
            )
        ),
        'total_items', COUNT(*),
        'total_amount', COALESCE(SUM(oi.total_price), 0)
    ) as items_data
FROM order_items oi
LEFT JOIN products p ON p.id = oi.product_id
WHERE oi.order_id = '$ORDER_ID';
" > "$ITEMS_FILE" 2>&1

if grep -qi "total_items.*[1-9]" "$ITEMS_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Found order items!${NC}"
    cat "$ITEMS_FILE"
else
    echo -e "${YELLOW}No order items found${NC}"
fi

echo ""
echo -e "${GREEN}Step 2: Checking order_notifications...${NC}"
NOTIF_FILE="$OUTPUT_DIR/order-notifications-$TIMESTAMP.json"

docker run --rm -i postgres:15 psql "$DB_URL" -c "
SELECT 
    json_agg(
        json_build_object(
            'id', id,
            'notification_type', notification_type,
            'recipient', recipient,
            'sent_at', sent_at,
            'delivery_status', delivery_status,
            'metadata', metadata
        )
    ) as notifications
FROM order_notifications
WHERE order_id = '$ORDER_ID'
ORDER BY sent_at DESC;
" > "$NOTIF_FILE" 2>&1

if grep -qi "\"id\"" "$NOTIF_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Found notifications!${NC}"
    cat "$NOTIF_FILE" | head -30
else
    echo -e "${YELLOW}No notifications found${NC}"
fi

echo ""
echo -e "${GREEN}Step 3: Checking other related tables...${NC}"
OTHER_FILE="$OUTPUT_DIR/other-order-data-$TIMESTAMP.json"

docker run --rm -i postgres:15 psql "$DB_URL" -c "
SELECT 
    json_build_object(
        'site_validations', (
            SELECT json_agg(row_to_json(osv.*))
            FROM order_site_validations osv
            WHERE osv.order_id = '$ORDER_ID'
        ),
        'additional_products', (
            SELECT json_agg(row_to_json(oap.*))
            FROM order_additional_products oap
            WHERE oap.order_id = '$ORDER_ID'
        ),
        'remisiones', (
            SELECT json_agg(row_to_json(r.*))
            FROM remisiones r
            WHERE r.order_id = '$ORDER_ID'
        )
    ) as other_data;
" > "$OTHER_FILE" 2>&1

echo ""
echo -e "${GREEN}Step 4: Searching backup file for order_id...${NC}"
BACKUP_SEARCH="$OUTPUT_DIR/backup-search-$TIMESTAMP.txt"

python3 << 'PYTHON_SCRIPT' > "$BACKUP_SEARCH" 2>&1
import re

order_id = "8c292525-aaeb-4287-b890-a5ccfdac9254"
backup_file = "recovery-backups/db_cluster-05-02-2026@03-56-28.backup"

print(f"Searching backup for order_id: {order_id}")
print("=" * 60)

found_contexts = []
table_context = None

try:
    with open(backup_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            # Track which table we're in
            if 'COPY public.' in line:
                table_context = line.strip()
            
            if order_id in line:
                context = {
                    'table': table_context or 'unknown',
                    'line': line.strip()[:300]
                }
                found_contexts.append(context)
                
                if len(found_contexts) >= 50:
                    break
    
    if found_contexts:
        print(f"✅ Found {len(found_contexts)} references!")
        print()
        for i, ctx in enumerate(found_contexts[:20], 1):
            print(f"{i}. Table: {ctx['table']}")
            print(f"   {ctx['line']}")
            print()
    else:
        print("❌ Order ID not found in backup")
except Exception as e:
    print(f"Error: {e}")
PYTHON_SCRIPT

cat "$BACKUP_SEARCH"

echo ""
echo -e "${BLUE}=== Summary ===${NC}"
echo ""
echo "Files created:"
echo "  📄 Order Items: $ITEMS_FILE"
echo "  📄 Notifications: $NOTIF_FILE"
echo "  📄 Other Data: $OTHER_FILE"
echo "  📄 Backup Search: $BACKUP_SEARCH"
echo ""
echo -e "${GREEN}Recovery complete! Check the files above for order data.${NC}"
