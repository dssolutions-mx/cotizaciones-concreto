# Order Reconstruction Guide

## Situation

Order `ORD-20260128-7243` (ID: `8c292525-aaeb-4287-b890-a5ccfdac9254`) was **hard-deleted** from the database. 

### Search Results:
- ❌ Not found in current production database
- ❌ Not found in backup from Feb 5th
- ❌ Not found in order_items table
- ❌ Not found in order_notifications table
- ❌ Not found in any related tables

**Conclusion:** The order and ALL related records were deleted (CASCADE DELETE).

## Solution: Reconstruct from Email Data

Since you have emails with the order information, we can reconstruct the order document.

### Information Needed from Emails:

1. **Order Details:**
   - Order Number: `ORD-20260128-7243` ✅ (you have this)
   - Order ID: `8c292525-aaeb-4287-b890-a5ccfdac9254` ✅ (you have this)
   - Construction Site/Location
   - Total Amount
   - Delivery Date
   - Created By (user who created it)

2. **Client Information:**
   - Client Name/Business Name

3. **Products:**
   - Product names/types
   - Quantities
   - Unit prices
   - Total prices

4. **Additional Info:**
   - Any notes or special instructions
   - Site validation details (if mentioned)

### How to Reconstruct:

#### Option 1: Use the Script
```bash
./scripts/reconstruct-from-email.sh
```

This will prompt you for all the information and create a JSON document.

#### Option 2: Manual JSON Creation

Create a file with this structure:

```json
{
  "order_id": "8c292525-aaeb-4287-b890-a5ccfdac9254",
  "order_number": "ORD-20260128-7243",
  "reconstructed_from": "Email data",
  "reconstruction_date": "2026-02-09T...",
  "order": {
    "construction_site": "...",
    "total_amount": ...,
    "delivery_date": "...",
    "created_by": "..."
  },
  "client": {
    "business_name": "..."
  },
  "order_items": [
    {
      "product_name": "...",
      "quantity": ...,
      "unit_price": ...,
      "total_price": ...
    }
  ],
  "evidence": {
    "source": "Email notifications",
    "note": "Reconstructed from email data after hard deletion"
  }
}
```

## What to Look For in Emails

Check your email notifications for:

1. **Order Creation Email:**
   - Usually contains: order number, client, location, total amount

2. **Daily Schedule Email:**
   - Contains: order details, delivery date, location

3. **Credit Validation Email:**
   - Contains: order number, amount, client

4. **Any PDF attachments:**
   - Order confirmations
   - Quotes that became orders
   - Invoices

## Using the Reconstructed Data

Once you have the reconstructed order:

1. **Save as Evidence:**
   - The JSON file serves as documentation
   - Can be used for legal/audit purposes

2. **Re-create Order (if needed):**
   - You can manually create a new order with this data
   - Mark it as "Recovered" or "Reconstructed"

3. **Contact Support:**
   - Provide Supabase Support with:
     - Order ID: `8c292525-aaeb-4287-b890-a5ccfdac9254`
     - Order Number: `ORD-20260128-7243`
     - Date needed: February 3rd, 2026 backup
     - Reconstructed data (for verification)

## Next Steps

1. ✅ Extract all information from emails
2. ✅ Run reconstruction script or create JSON manually
3. ⏳ Wait for Supabase Support backup (if available)
4. ✅ Use reconstructed data as evidence

The reconstructed order document will serve as proof of the order's existence and details, even though it's not in the database anymore.
