#!/bin/bash
# Comprehensive search for order_id in current database and backup

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

echo -e "${BLUE}=== Comprehensive Search for Order ID ===${NC}\n"
echo "Order ID: $ORDER_ID"
echo "Order Number: $ORDER_NUMBER"
echo ""

mkdir -p "$OUTPUT_DIR"
RESULTS_FILE="$OUTPUT_DIR/comprehensive-search-$TIMESTAMP.txt"

{
echo "=== SEARCH RESULTS FOR ORDER ID: $ORDER_ID ==="
echo "Order Number: $ORDER_NUMBER"
echo "Date: $(date)"
echo ""

echo "=== 1. CURRENT PRODUCTION DATABASE ==="
echo ""

echo "--- order_items ---"
docker run --rm -i postgres:15 psql "$DB_URL" -c "
SELECT 
    oi.id,
    oi.order_id,
    oi.product_id,
    p.name as product_name,
    oi.quantity,
    oi.unit_price,
    oi.total_price,
    oi.notes,
    oi.created_at
FROM order_items oi
LEFT JOIN products p ON p.id = oi.product_id
WHERE oi.order_id = '$ORDER_ID'
ORDER BY oi.created_at;
" 2>&1 || echo "Query failed"

echo ""
echo "--- order_notifications ---"
docker run --rm -i postgres:15 psql "$DB_URL" -c "
SELECT 
    id,
    order_id,
    notification_type,
    recipient,
    sent_at,
    delivery_status,
    metadata
FROM order_notifications
WHERE order_id = '$ORDER_ID'
ORDER BY sent_at DESC;
" 2>&1 || echo "Query failed"

echo ""
echo "--- order_site_validations ---"
docker run --rm -i postgres:15 psql "$DB_URL" -c "
SELECT * FROM order_site_validations WHERE order_id = '$ORDER_ID';
" 2>&1 || echo "Query failed"

echo ""
echo "--- order_additional_products ---"
docker run --rm -i postgres:15 psql "$DB_URL" -c "
SELECT * FROM order_additional_products WHERE order_id = '$ORDER_ID';
" 2>&1 || echo "Query failed"

echo ""
echo "--- remisiones ---"
docker run --rm -i postgres:15 psql "$DB_URL" -c "
SELECT * FROM remisiones WHERE order_id = '$ORDER_ID';
" 2>&1 || echo "Query failed"

echo ""
echo "=== 2. BACKUP FILE SEARCH ==="
echo ""

python3 << 'PYTHON_SCRIPT'
import re

order_id = "8c292525-aaeb-4287-b890-a5ccfdac9254"
backup_file = "recovery-backups/db_cluster-05-02-2026@03-56-28.backup"

print(f"Searching backup file: {backup_file}")
print(f"Looking for: {order_id}")
print()

found_any = False
current_table = None
matches = []

try:
    with open(backup_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line_num, line in enumerate(f, 1):
            if 'COPY public.' in line:
                current_table = line.strip()
            
            if order_id in line:
                found_any = True
                matches.append({
                    'table': current_table or 'unknown',
                    'line_num': line_num,
                    'content': line.strip()[:300]
                })
                
                if len(matches) >= 100:
                    break
            
            if line_num > 10000000:  # Limit to 10M lines
                break
    
    if found_any:
        print(f"✅ Found {len(matches)} references!")
        print()
        for match in matches[:20]:
            print(f"Line {match['line_num']} in {match['table']}:")
            print(f"  {match['content']}")
            print()
    else:
        print("❌ Order ID not found in backup file")
        print("   This confirms the order was deleted before this backup was created")
        
except Exception as e:
    print(f"Error searching backup: {e}")

PYTHON_SCRIPT

echo ""
echo "=== 3. RECOMMENDATIONS ==="
echo ""
echo "Since the order was hard-deleted, you have these options:"
echo ""
echo "1. Wait for Supabase Support to provide backup from Feb 3rd"
echo "2. Reconstruct order from email data you have:"
echo "   - Order ID: $ORDER_ID"
echo "   - Order Number: $ORDER_NUMBER"
echo "   - Check email for: client info, products, prices, location"
echo "3. Check application logs if available"
echo "4. Check any exported PDFs or reports"

} | tee "$RESULTS_FILE"

echo ""
echo -e "${GREEN}Results saved to: $RESULTS_FILE${NC}"
