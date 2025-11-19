# Credit Context Integration Guide

This guide shows how to integrate the Credit Context Panel into order validation pages.

## Integration into Order Detail Page

### Step 1: Import the Component

Add the import to `/src/components/orders/OrderDetails.tsx`:

```typescript
import CreditContextPanel from '@/components/credit/CreditContextPanel';
```

### Step 2: Add the Panel to the Layout

Find the section where credit validation buttons are shown (around where `isCreditValidator` is used).

Add the CreditContextPanel **before** or **alongside** the credit validation buttons:

```typescript
{/* Credit Context - Show for credit validators and executives */}
{(isCreditValidator || isManager) && order && order.client && (
  <div className="mb-6">
    <CreditContextPanel
      clientId={order.client.id}
      clientName={order.client.business_name}
      orderAmount={order.total_amount || 0}
      compact={false} // Use compact=true for sidebar layout
    />
  </div>
)}

{/* Existing credit validation buttons */}
{isCreditValidator && order?.credit_status === 'pending' && (
  <div className="flex gap-2">
    <Button onClick={handleApprove}>Aprobar</Button>
    <Button onClick={handleReject} variant="destructive">Rechazar</Button>
  </div>
)}
```

### Step 3: Layout Options

**Full Width (Recommended for order detail page):**
```typescript
<CreditContextPanel
  clientId={clientId}
  clientName={clientName}
  orderAmount={orderAmount}
  compact={false}
/>
```

**Compact Mode (For sidebars or smaller spaces):**
```typescript
<CreditContextPanel
  clientId={clientId}
  clientName={clientName}
  orderAmount={orderAmount}
  compact={true}
/>
```

## Example Integration Locations

### 1. Order Detail Page (`/orders/[id]`)
Best placed **above** the credit validation buttons, showing full context.

### 2. Credit Validation Queue
Use compact mode in a sidebar while showing the list of pending orders.

### 3. Order Creation/Edit Forms
Show compact credit info to help sales agents know client's available credit before submitting.

## Component Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `clientId` | string | Yes | UUID of the client |
| `clientName` | string | Yes | Display name of the client |
| `orderAmount` | number | Yes | Total amount of the current order |
| `compact` | boolean | No | Use compact layout (default: false) |

## Features Included

✅ Real-time credit status
✅ Current balance vs credit limit
✅ Projected balance after order
✅ Utilization percentage (current & projected)
✅ Payment compliance info
✅ Warning if order exceeds credit limit
✅ Link to full credit profile
✅ Automatic data refresh

## Visual Indicators

- 🟢 **Green** - Healthy (< 70% utilization)
- 🟠 **Orange** - Warning (70-90% utilization)
- 🔴 **Red** - Critical or over limit (> 90% or exceeds limit)

## Notes

- The panel is **informational only** - it does not block order approval
- Credit validators retain final approval authority
- Data refreshes automatically when client or order amount changes
- Works seamlessly with existing RLS policies
