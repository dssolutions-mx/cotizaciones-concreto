#!/bin/bash
# Reconstruct order from email data
# Use this to document what you know from emails

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ORDER_ID="8c292525-aaeb-4287-b890-a5ccfdac9254"
ORDER_NUMBER="ORD-20260128-7243"
OUTPUT_DIR="./recovery-exports"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo -e "${BLUE}=== Reconstruct Order from Email Data ===${NC}\n"
echo "Order ID: $ORDER_ID"
echo "Order Number: $ORDER_NUMBER"
echo ""
echo "Please provide information from your emails:"
echo ""

mkdir -p "$OUTPUT_DIR"
RECONSTRUCTED_FILE="$OUTPUT_DIR/reconstructed-order-$TIMESTAMP.json"

# Collect information
read -p "Client Name/Business: " CLIENT_NAME
read -p "Construction Site/Location: " CONSTRUCTION_SITE
read -p "Total Amount: " TOTAL_AMOUNT
read -p "Delivery Date (YYYY-MM-DD): " DELIVERY_DATE
read -p "Created By (user email/name): " CREATED_BY
read -p "Products (comma-separated): " PRODUCTS
read -p "Quantities (comma-separated, matching products): " QUANTITIES
read -p "Unit Prices (comma-separated, matching products): " UNIT_PRICES
read -p "Any additional notes: " NOTES

echo ""
echo -e "${GREEN}Creating reconstructed order document...${NC}"

# Create JSON document
cat > "$RECONSTRUCTED_FILE" << EOF
{
  "order_id": "$ORDER_ID",
  "order_number": "$ORDER_NUMBER",
  "reconstructed_from": "Email data",
  "reconstruction_date": "$(date -Iseconds)",
  "order": {
    "id": "$ORDER_ID",
    "order_number": "$ORDER_NUMBER",
    "construction_site": "$CONSTRUCTION_SITE",
    "total_amount": $TOTAL_AMOUNT,
    "delivery_date": "$DELIVERY_DATE",
    "created_by": "$CREATED_BY",
    "notes": "$NOTES"
  },
  "client": {
    "business_name": "$CLIENT_NAME"
  },
  "order_items": [
EOF

# Parse products, quantities, prices
IFS=',' read -ra PROD_ARRAY <<< "$PRODUCTS"
IFS=',' read -ra QTY_ARRAY <<< "$QUANTITIES"
IFS=',' read -ra PRICE_ARRAY <<< "$UNIT_PRICES"

for i in "${!PROD_ARRAY[@]}"; do
    if [ $i -gt 0 ]; then
        echo "," >> "$RECONSTRUCTED_FILE"
    fi
    QTY=${QTY_ARRAY[$i]:-0}
    PRICE=${PRICE_ARRAY[$i]:-0}
    TOTAL=$(echo "$QTY * $PRICE" | bc 2>/dev/null || echo "0")
    cat >> "$RECONSTRUCTED_FILE" << EOF
    {
      "product_name": "${PROD_ARRAY[$i]}",
      "quantity": $QTY,
      "unit_price": $PRICE,
      "total_price": $TOTAL
    }
EOF
done

cat >> "$RECONSTRUCTED_FILE" << EOF
  ],
  "evidence": {
    "source": "Email notifications",
    "order_id_from_email": "$ORDER_ID",
    "order_number_from_email": "$ORDER_NUMBER",
    "note": "This order was hard-deleted from database. Reconstructed from email data."
  }
}
EOF

echo ""
echo -e "${GREEN}✅ Order reconstructed!${NC}"
echo ""
echo "File saved to: $RECONSTRUCTED_FILE"
echo ""
echo "=== Reconstructed Order ==="
cat "$RECONSTRUCTED_FILE" | python3 -m json.tool 2>/dev/null || cat "$RECONSTRUCTED_FILE"
echo ""
echo -e "${BLUE}You can use this document as evidence of the order.${NC}"
