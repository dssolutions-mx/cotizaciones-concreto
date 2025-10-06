# Client Portal Balance Comprehensive Display - Complete Implementation

## Overview

This document describes the comprehensive fix implemented for the client portal balance display, including volume calculation per construction site, monetary amounts, and color coding based on balance status.

## Changes Implemented

### 1. Balance API Enhancement (`src/app/api/client-portal/balance/route.ts`)

#### Volume Calculation Per Construction Site
- **Problem**: Volume per construction site was not being calculated correctly
- **Solution**: 
  - Created a mapping system that tracks remisiones by construction site through orders
  - Excluded BOMBEO (pumping) remisiones from volume calculations
  - Aggregated volumes per construction site from `volumen_fabricado` field

```typescript
// Map remisiones to construction sites via orders, track volumes AND monetary amounts
const siteVolumes: Record<string, number> = {};
const siteMonetaryAmounts: Record<string, number> = {};
const ordersWithRemisiones = new Set<string>();

remisiones.forEach((rem: any) => {
  const order = orders?.find(o => o.id === rem.order_id);
  if (order && order.construction_site) {
    const site = order.construction_site;
    siteVolumes[site] = (siteVolumes[site] || 0) + (parseFloat(rem.volumen_fabricado) || 0);
    ordersWithRemisiones.add(rem.order_id);
  }
});
```

#### Monetary Amount Per Construction Site
- **Problem**: No monetary amounts were being displayed per construction site
- **Solution**:
  - Track orders that have actual remisiones (deliveries)
  - Sum `final_amount` from orders grouped by construction site
  - Only include orders that have been delivered (have remisiones)

```typescript
// Calculate monetary amounts per site (from orders that have remisiones)
orders?.forEach(order => {
  if (ordersWithRemisiones.has(order.id) && order.construction_site) {
    const site = order.construction_site;
    siteMonetaryAmounts[site] = (siteMonetaryAmounts[site] || 0) + (parseFloat(order.final_amount as any) || 0);
  }
});
```

#### Total Volume Delivered
- **Added**: `total_volume` field to general balance summary
- **Calculation**: Sum of all `volumen_fabricado` from non-BOMBEO remisiones

```typescript
const totalDeliveredVolume = remisiones.reduce((sum, r) => sum + (parseFloat(r.volumen_fabricado) || 0), 0);
```

#### Enhanced Response Structure
```typescript
{
  general: {
    current_balance: number,
    total_delivered: number,      // Monetary amount
    total_paid: number,
    total_volume: number          // Volume in m³
  },
  sites: [{
    site_name: string,
    balance: number,
    volume: number,                // Volume delivered per site
    monetary_amount: number        // Monetary amount per site
  }],
  recentPayments: [...],
  adjustments: [...]
}
```

### 2. Balance Page UI Enhancement (`src/app/client-portal/balance/page.tsx`)

#### Color Coding System
Implemented a traffic light system for balance visualization:

- **Red** (`text-red-500`): Positive balance = Client owes money to company
- **Green** (`text-green-500`): Negative balance = Company owes money to client (credit)
- **Default** (`text-label-primary`): Zero balance = Account is current

#### Main Balance Card
```tsx
<h2 
  className={`text-6xl font-bold ${
    (data?.general.current_balance || 0) > 0 
      ? 'text-red-500' 
      : (data?.general.current_balance || 0) < 0 
        ? 'text-green-500' 
        : 'text-label-primary'
  }`}
>
  ${(data?.general.current_balance || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
</h2>
<p className="text-caption text-label-tertiary mt-2">
  {(data?.general.current_balance || 0) > 0 
    ? 'Pendiente de pago' 
    : (data?.general.current_balance || 0) < 0 
      ? 'Saldo a favor' 
      : 'Al corriente'}
</p>
```

#### Comprehensive Summary Cards
Enhanced from 2 to 3 summary cards with additional information:

1. **Total Entregado** (Total Delivered)
   - Displays monetary amount
   - Shows total volume in m³

2. **Total Pagado** (Total Paid)
   - Displays total payments received

3. **Pendiente** (Pending)
   - Shows absolute value of balance
   - Color-coded (red/green) based on who owes whom

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
  <div className="glass-thin rounded-2xl p-6">
    <div className="flex items-center gap-4 mb-3">
      <TrendingUp className="w-5 h-5 text-label-tertiary" />
      <p className="text-footnote text-label-tertiary uppercase tracking-wide">
        Total Entregado
      </p>
    </div>
    <p className="text-title-2 font-bold text-label-primary">
      ${(data?.general.total_delivered || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
    </p>
    <p className="text-caption text-label-tertiary mt-2">
      {(data?.general.total_volume || 0).toFixed(2)} m³
    </p>
  </div>
  {/* ... other cards */}
</div>
```

#### Per-Site Balance Display
Enhanced construction site cards with comprehensive information:

```tsx
<motion.div className="glass-thin rounded-xl p-6">
  <div className="flex items-center justify-between mb-4">
    <p className="text-body font-semibold text-label-primary">
      {site.site_name}
    </p>
    <p 
      className={`text-title-3 font-bold ${
        site.balance > 0 
          ? 'text-red-500' 
          : site.balance < 0 
            ? 'text-green-500' 
            : 'text-label-primary'
      }`}
    >
      ${site.balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
    </p>
  </div>
  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10">
    <div>
      <p className="text-caption text-label-tertiary mb-1">
        Volumen Entregado
      </p>
      <p className="text-callout font-semibold text-label-secondary">
        {site.volume.toFixed(2)} m³
      </p>
    </div>
    <div>
      <p className="text-caption text-label-tertiary mb-1">
        Monto Entregado
      </p>
      <p className="text-callout font-semibold text-label-secondary">
        ${site.monetary_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
      </p>
    </div>
  </div>
</motion.div>
```

## Data Flow

```
Orders (client_id) 
  → Remisiones (order_id, volumen_fabricado, construction_site via order)
    → Site Volumes (aggregated by construction_site)
    → Site Monetary Amounts (sum of order.final_amount)
      → Client Balance Display
```

## Key Features

### 1. Accurate Volume Tracking
- ✅ Volumes calculated from actual remisiones (delivery tickets)
- ✅ Excludes BOMBEO (pumping) remisiones from volume calculations
- ✅ Properly mapped to construction sites through order relationships

### 2. Comprehensive Financial Display
- ✅ General balance with color coding
- ✅ Total delivered (monetary + volume)
- ✅ Total paid
- ✅ Per-site balances with volume and monetary amounts

### 3. Intuitive Color System
- ✅ Red for amounts owed by client (positive balance)
- ✅ Green for credit/amounts owed to client (negative balance)
- ✅ Applied consistently across all balance displays

### 4. Modern UI/UX
- ✅ Glass morphism design with iOS 26 typography
- ✅ Smooth animations and transitions
- ✅ Responsive grid layout
- ✅ Clear visual hierarchy

## Testing Recommendations

1. **Test with multiple construction sites**
   - Verify volumes are correctly assigned to each site
   - Verify monetary amounts match delivered orders

2. **Test color coding**
   - Positive balance should show red
   - Negative balance should show green
   - Zero balance should show default color

3. **Test volume calculations**
   - Verify BOMBEO remisiones are excluded
   - Verify total volume matches sum of site volumes
   - Verify volumes match remisiones data

4. **Test with various balance scenarios**
   - Client owes money (positive balance)
   - Client has credit (negative balance)
   - Account is current (zero balance)

## Database Tables Involved

- `client_balances`: Stores current balance per client and construction site
- `orders`: Contains order amounts and construction site assignments
- `remisiones`: Delivery tickets with volumes (`volumen_fabricado`)
- `client_payments`: Payment records
- `client_payment_distributions`: Payment distributions across sites
- `client_balance_adjustments`: Manual balance adjustments

## Verification Queries

To verify the calculations are correct:

```sql
-- Total volume per construction site
SELECT 
  o.construction_site,
  SUM(r.volumen_fabricado) as total_volume,
  COUNT(r.id) as remision_count
FROM remisiones r
JOIN orders o ON r.order_id = o.id
WHERE o.client_id = 'client-uuid'
  AND r.tipo_remision != 'BOMBEO'
GROUP BY o.construction_site;

-- Total monetary amount per construction site
SELECT 
  o.construction_site,
  SUM(o.final_amount) as total_amount
FROM orders o
WHERE o.client_id = 'client-uuid'
  AND EXISTS (
    SELECT 1 FROM remisiones r 
    WHERE r.order_id = o.id 
    AND r.tipo_remision != 'BOMBEO'
  )
GROUP BY o.construction_site;
```

## Future Enhancements

1. **Export functionality**: Add ability to export balance details to PDF/Excel
2. **Date filtering**: Allow filtering by date range
3. **Detailed drill-down**: Click on site to see detailed order and delivery history
4. **Payment allocation**: Show how payments were allocated across construction sites
5. **Historical trends**: Add charts showing balance trends over time

## Conclusion

This implementation provides a fully comprehensive balance display for the client portal, with:
- ✅ Accurate volume tracking per construction site
- ✅ Complete monetary information per site and overall
- ✅ Intuitive color coding for balance status
- ✅ Professional, modern UI with smooth animations
- ✅ All data properly fetched and displayed

The system now provides clients with complete transparency into their financial status with DC Concretos.

