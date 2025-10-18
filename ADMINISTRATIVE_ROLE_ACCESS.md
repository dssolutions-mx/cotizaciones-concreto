# ADMINISTRATIVE Role Access to Finanzas and CXP

## Summary
Added full access to the Finanzas section and Cuentas por Pagar (CXP) functionality for users with the ADMINISTRATIVE role.

## Changes Made

### 1. API Access - Payables Endpoint
**File**: `src/app/api/ap/payables/route.ts`
- Added `ADMINISTRATIVE` to the allowed roles array for GET requests
- ADMINISTRATIVE users can now view all payables with appropriate filters

### 2. API Access - Payments Endpoint
**File**: `src/app/api/ap/payments/route.ts`
- Added `ADMINISTRATIVE` to allowed roles for GET (view payments)
- Added `ADMINISTRATIVE` to allowed roles for POST (create payments)
- ADMINISTRATIVE users can now view and record payments against payables

### 3. Layout Access Control
**File**: `src/app/finanzas/layout.tsx`
- Updated `canAccessFinanzas` check to include `ADMINISTRATIVE` role
- Prevents unauthorized redirect when ADMINISTRATIVE users access /finanzas routes

### 4. Sidebar Navigation
**File**: `src/app/layout.tsx`
- Added new case for `ADMINISTRATIVE` role in navigation switch statement
- Sets `addFinanzasLink = true` for ADMINISTRATIVE users
- ADMINISTRATIVE users will see the Finanzas menu item in the sidebar
- Full Finanzas submenu will be available (including CXP, Dashboard, Production Reports, etc.)

## Permissions Summary for ADMINISTRATIVE Role

### Full Access To:
- **Finanzas Section** (`/finanzas`)
  - Dashboard Finanzas
  - **Cuentas por Pagar (CXP)** - View all payables, grouped by supplier
  - Reporte de Producción
  - Balances de Clientes
  - Reporte de Ventas
  - Datos Históricos
  - Reporte Diario
  - Pagos Diarios
  - Remisiones por Cliente
  - Reportes Dinámicos

### CXP Capabilities:
- View all payables with detailed information
- Filter by status, due date, supplier, invoice number
- See material vs fleet cost breakdown
- **Record payments** against open or partially paid accounts
- View payment history
- Access KPI dashboard showing:
  - Total amounts due
  - Overdue accounts
  - Accounts due soon (7 days)
  - Material vs Fleet cost breakdown

## Role Comparison

| Feature | EXECUTIVE | ADMIN_OPERATIONS | ADMINISTRATIVE | PLANT_MANAGER |
|---------|-----------|------------------|----------------|---------------|
| View Payables | ✓ | ✓ | ✓ | ✓ (own plant) |
| Record Payments | ✓ | ✓ | ✓ | ✓ |
| Full Finanzas Access | ✓ | Limited | ✓ | ✓ |
| Production Control | ✓ | ✓ | ✗ | ✓ |
| Admin Panel | ✓ | ✗ | ✗ | ✗ |

## Testing Checklist

- [ ] ADMINISTRATIVE user can see Finanzas in sidebar
- [ ] ADMINISTRATIVE user can access /finanzas/cxp page
- [ ] ADMINISTRATIVE user can view all payables
- [ ] ADMINISTRATIVE user can filter payables
- [ ] ADMINISTRATIVE user can record payments
- [ ] ADMINISTRATIVE user can view KPI cards
- [ ] ADMINISTRATIVE user sees all Finanzas submenu items
- [ ] No unauthorized access errors

## Notes

- ADMINISTRATIVE role has full accounting/finance access similar to EXECUTIVE
- Unlike ADMIN_OPERATIONS, they get full Finanzas submenu (not restricted subset)
- This role is designed for accounting team members who need comprehensive financial tools
- They do NOT have access to production control or admin panel

