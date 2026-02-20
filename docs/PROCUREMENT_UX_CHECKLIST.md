# Procurement UX — Enterprise Checklist

## Information Architecture

| Item | Status |
|------|--------|
| Procurement Hub (Centro Financiero) quick links: PO, CXP, Análisis Proveedores | ✅ |
| Sidebar nav: Compras / PO, CXP, Análisis de Proveedores | ✅ |
| Flujo navegable: PO → Entry → Payable → Payment | ✅ |

## Summary → Detail

| Item | Status |
|------|--------|
| PO: resumen (ordered/received/credits/net) antes de items | ✅ |
| CXP: KPIs antes de lista de facturas | ✅ |
| Supplier Analysis: KPIs y tendencia antes de tabla | ✅ |

## Filtros y Estados

| Item | Status |
|------|--------|
| Filtros activos visibles (plant, status, supplier, date) | ✅ |
| Loading skeleton durante fetch | ✅ |
| Empty state cuando no hay resultados | ✅ |
| Error state con retry | ✅ |

## Identificadores

| Item | Status |
|------|--------|
| PO: po_number (o PO #xxx) en primera columna | ✅ |
| CXP: invoice_number destacado | ✅ |
| Entries: entry_number | ✅ |

## Accesibilidad (WCAG)

| Item | Status |
|------|--------|
| Estados no solo por color: badges con texto (Abierto, Pagado, etc.) | ✅ |
| Warnings financieros con role="alert" | ✅ |
| Contraste texto/fondo en badges y banners | ✅ |
| Navegación por teclado (formularios modales) | ✅ |

## Explainability

| Item | Status |
|------|--------|
| 3-way match: copy explicativo + acción sugerida | ✅ |
| Credit history en EditPOModal | ✅ |
