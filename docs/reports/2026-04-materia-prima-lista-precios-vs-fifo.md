# Materia prima: lista de precios vs FIFO (abril 2026)

Comparación rápida entre dos formas de medir el **costo total de materia prima** asociado a concreto en el mes de **abril de 2026** (2026-04-01 a 2026-04-30).

## Qué representa cada columna

| Enfoque | Fuente en base de datos | Alineación con las vistas |
|--------|-------------------------|---------------------------|
| **Lista de precios (`material_prices`)** | Valores archivados en `plant_financial_analysis_history` para `period_start = 2026-04-01` / `period_end = 2026-04-30`. Esos totales provienen de la misma lógica que alimenta el materialized view `vw_plant_financial_analysis`: costeo con **precios de lista por material/planta** (laterales a `material_prices`) sobre consumos de `remision_materiales` en el mes, no con capas FIFO. La vista `vw_plant_financial_analysis_unified` expone esas filas como `data_source = 'monthly'`. |
| **FIFO (capas)** | Suma de `remision_materiales.total_cost_fifo` en líneas ligadas a `remisiones` con `tipo_remision = 'CONCRETO'` y `fecha` en abril 2026, agrupado por planta. Refleja asignaciones a capas de entrada (`material_consumption_allocations` / costos de lote) cuando existen. |

**Importante:** no es el mismo “reporte” duplicado en dos columnas: uno es **snapshot mensual archivado (metodología lista)** y el otro es **costo acumulado en remisiones con FIFO persistido en columnas de remisión**.

## Cobertura FIFO en abril 2026

- Líneas de `remision_materiales` (concreto, abril): **7 131**
- Líneas con `total_cost_fifo` nulo o **0**: **230** (~**3,2 %**)

En esas ~230 líneas el costo FIFO no está reflejado (o es cero); el costo con lista de precios del archivo histórico **sí** incorpora esos consumos vía su propia regla de precios.

## Totales (plantas con producción en archivo)

| Métrica | Valor (MXN, aprox.) |
|--------|----------------------|
| **Σ costo MP (lista / archivo)** | 12 205 343,53 |
| **Σ costo MP (FIFO en remisiones)** | 12 456 705,75 |
| **Δ (FIFO − lista)** | **+251 362,22** (~**+2,06 %** sobre lista) |

*(La suma de lista incluye plantas con costo 0 en archivo; la suma FIFO solo aporta donde hubo líneas de remisión.)*

## Por planta

| Planta | Costo MP lista (archivo) | Costo MP FIFO (remisiones) | Δ (FIFO − lista) | % vs lista | Líneas con FIFO &gt; 0 | Líneas totales RM | Vol. producido (m³, archivo) |
|--------|---------------------------|----------------------------|-------------------|------------|------------------------|-------------------|------------------------------|
| DIACE | 0,00 | 0,00 | 0,00 | — | — | — | 0,00 |
| P001 | 2 830 904,81 | 2 983 195,23 | +152 290,42 | +5,38 % | 2 007 | 2 037 | 1 905,50 |
| P002 | 4 963 978,18 | 4 909 260,57 | −54 717,61 | −1,10 % | 2 401 | 2 457 | 2 527,00 |
| P003 | 0,00 | 0,00 | 0,00 | — | — | — | 0,00 |
| P004 | 0,00 | 0,00 | 0,00 | — | — | — | 0,00 |
| P004P | 2 023 311,02 | 2 301 628,34 | +278 317,32 | +13,76 % | 1 333 | 1 390 | 1 362,00 |
| P005 | 2 387 149,52 | 2 262 621,61 | −124 527,91 | −5,22 % | 1 160 | 1 247 | 1 588,50 |

## Lectura rápida

- **P004P** y **P001** muestran el FIFO **por encima** del costo con lista de precios del archivo (diferencias relativas más altas en la muestra).
- **P002** y **P005** muestran el FIFO **por debajo** del archivo.
- Las diferencias mezclan: (1) **momento y forma del precio** (lista mensual vs capa de compra/entrada), (2) **landed cost** en capas vs precio de lista, (3) líneas **sin FIFO** o con FIFO en cero, (4) posible **desfase temporal** entre cuándo se archivó el mes y correcciones posteriores a capas FIFO.

## Cómo reproducir (SQL de referencia)

Lista (archivo abril):

```sql
SELECT plant_code, costo_mp_total_concreto, volumen_producido_m3
FROM plant_financial_analysis_history
WHERE period_start = '2026-04-01' AND period_end = '2026-04-30'
ORDER BY plant_code;
```

FIFO por planta (abril, concreto):

```sql
SELECT p.code,
       SUM(COALESCE(rm.total_cost_fifo, 0)) AS costo_mp_fifo,
       COUNT(*) FILTER (WHERE rm.total_cost_fifo IS NOT NULL AND rm.total_cost_fifo > 0) AS con_fifo,
       COUNT(*) AS lineas
FROM remision_materiales rm
JOIN remisiones r ON r.id = rm.remision_id
JOIN plants p ON p.id = r.plant_id
WHERE r.tipo_remision::text = 'CONCRETO'
  AND r.fecha BETWEEN '2026-04-01' AND '2026-04-30'
GROUP BY p.code
ORDER BY p.code;
```

---

*Generado a partir de consultas contra el proyecto Supabase de producción (`cotizador`). Números en moneda local tal como están almacenados en la base.*
