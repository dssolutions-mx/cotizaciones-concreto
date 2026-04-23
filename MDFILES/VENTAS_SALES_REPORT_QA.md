# Finanzas / Ventas — QA checklist

Short manual matrix and acceptance notes for the sales report refactor (`effectivePlantIds`, unified filters, single data scope).

## Automated

- `npm run test:sales-report` — plant scope helpers + `calculateSummaryMetrics` fixtures (volume vs amount when order is missing / pricing map).

## Manual matrix (minimum)

| Scenario | What to verify |
|----------|----------------|
| One plant selected | KPI cards, tabla, comparativo por planta, gráfico histórico y agentes usan la misma planta en alcance. |
| Several plants | Totales = suma coherente de remisiones en rango; comparativo solo incluye plantas en alcance (no todo el catálogo). |
| “Todas las plantas” (selector vacío) | Alcance = todas las plantas accesibles (ACL ∩ picker), no “null = toda la BD” fuera de RLS. |
| Filtros avanzados | Resistencia, efectivo/fiscal, tipo y código aplican en el mismo pipeline que planta, fechas y clientes. |
| Usuario BU | Solo plantas del BU en selector y en consultas; no se puede ampliar más allá del ACL por UI. |
| Export Excel | Filas exportadas alineadas con remisiones visibles (mismos filtros). |
| Streaming / carga parcial | Barra o texto de progreso; aviso de remisiones sin orden si aplica. |

## Acceptance stories (plan §2 lenses)

1. **Intent:** Para rango de fechas y alcance elegido, los totales reflejan remisiones por `fecha` de remisión y reglas de precio (incl. vacío virtual cuando corresponde).
2. **Reach vs planta:** Números anclados en `plant_id` de la remisión; no se mezcla “obra en mapa” como segundo alcance silencioso.
3. **Revenue integrity:** Si hay volumen sin orden en `salesData`, el copy de alcance advierte; volumen e importe no se presentan como paridad implícita.
4. **Paridad con otras pantallas:** Misma planta y ventana que en remisiones por cliente debe sentirse comparable (misma semántica de planta).
5. **ACL:** Siempre lista finita `effectivePlantIds` en consultas del reporte.
6. **UX:** El bloque “Alcance del reporte” responde qué plantas, qué rango y base de tiempo (fecha de remisión).

## Debug tool

- Visible solo con `NODE_ENV === 'development'` o `NEXT_PUBLIC_SHOW_VENTAS_DEBUG === 'true'`.
