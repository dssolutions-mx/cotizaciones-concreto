# Pumping Analysis View - Simple Plant-Level Aggregation

## Overview
Simple views for pumping (BOMBEO) service data aggregated by plant and date. Designed for use in partnered systems to fetch pumping revenue metrics. Supports both daily and monthly aggregation.

## View Names
- `vw_pumping_analysis_by_plant_date` - Daily aggregation view
- `vw_pumping_analysis_unified` - Unified view with daily (last 3 months) and monthly (older) data

## Columns

### vw_pumping_analysis_by_plant_date (Daily View)
| Column | Type | Description |
|--------|------|-------------|
| `plant_id` | UUID | Plant identifier |
| `plant_code` | VARCHAR | Plant code (P001, P002, P003, etc.) |
| `plant_name` | VARCHAR | Plant name |
| `fecha` | DATE | Date of remisiones |
| `remisiones_count` | BIGINT | Number of pumping remisiones for this plant/date |
| `volumen_bombeo_m3` | NUMERIC | Total pumping volume (m³) |
| `subtotal_total` | NUMERIC | Total subtotal amount (revenue) |
| `precio_unitario` | NUMERIC | Weighted average unit price (subtotal_total / volumen_bombeo_m3) |
| `precio_unitario_promedio` | NUMERIC | Average of individual unit prices (alternative calculation) |

### vw_pumping_analysis_unified (Unified View)
| Column | Type | Description |
|--------|------|-------------|
| `plant_id` | UUID | Plant identifier |
| `plant_code` | VARCHAR | Plant code (P001, P002, P003, etc.) |
| `plant_name` | VARCHAR | Plant name |
| `period_start` | DATE | Start of period (same as fecha for daily, first day of month for monthly) |
| `period_end` | DATE | End of period (same as fecha for daily, last day of month for monthly) |
| `remisiones_count` | BIGINT | Number of pumping remisiones |
| `volumen_bombeo_m3` | NUMERIC | Total pumping volume (m³) |
| `subtotal_total` | NUMERIC | Total subtotal amount (revenue) |
| `precio_unitario` | NUMERIC | Weighted average unit price |
| `precio_unitario_promedio` | NUMERIC | Average of individual unit prices |
| `snapshot_date` | DATE | Date when data was captured |
| `data_source` | TEXT | 'current' for daily data, 'monthly' for aggregated data |

## Usage Examples

### Get daily pumping data for a specific plant (last 3 months)
```sql
SELECT 
  period_start as fecha,
  volumen_bombeo_m3,
  precio_unitario,
  subtotal_total
FROM vw_pumping_analysis_unified
WHERE plant_code = 'P001'
  AND period_start = period_end  -- Daily data
  AND period_start >= '2025-10-01'
ORDER BY period_start DESC;
```

### Get monthly totals by plant (using unified view)
```sql
SELECT 
  plant_code,
  period_start as month_start,
  period_end as month_end,
  SUM(volumen_bombeo_m3) as total_volume,
  SUM(subtotal_total) as total_revenue,
  CASE 
    WHEN SUM(volumen_bombeo_m3) > 0 
    THEN SUM(subtotal_total) / SUM(volumen_bombeo_m3)
    ELSE 0 
  END as avg_unit_price
FROM vw_pumping_analysis_unified
WHERE period_start >= '2025-10-01' 
  AND period_start < '2025-11-01'
GROUP BY plant_code, period_start, period_end
HAVING period_start != period_end  -- Monthly aggregates only
ORDER BY plant_code, period_start DESC;
```

### Get monthly aggregation (alternative - groups daily data into months)
```sql
SELECT 
  plant_code,
  DATE_TRUNC('month', period_start)::date as month_start,
  SUM(volumen_bombeo_m3) as total_volume,
  SUM(subtotal_total) as total_revenue,
  CASE 
    WHEN SUM(volumen_bombeo_m3) > 0 
    THEN SUM(subtotal_total) / SUM(volumen_bombeo_m3)
    ELSE 0 
  END as avg_unit_price
FROM vw_pumping_analysis_unified
WHERE period_start >= '2025-10-01' 
  AND period_start < '2025-11-01'
GROUP BY plant_code, DATE_TRUNC('month', period_start)
ORDER BY plant_code;
```

### Get all plants summary for a date range
```sql
SELECT 
  plant_code,
  plant_name,
  SUM(volumen_bombeo_m3) as total_volume,
  SUM(subtotal_total) as total_revenue,
  SUM(subtotal_total) / NULLIF(SUM(volumen_bombeo_m3), 0) as avg_unit_price
FROM vw_pumping_analysis_by_plant_date
WHERE fecha BETWEEN '2025-10-01' AND '2025-10-31'
GROUP BY plant_code, plant_name
ORDER BY plant_code;
```

## Data Source
- Based on `remisiones_with_pricing` view
- Filters only `tipo_remision = 'BOMBEO'`
- Uses `subtotal_amount` from pricing view (respects zero prices for internal transfers)

## Unified View Behavior
- **Last 3 months**: Shows daily data (`period_start = period_end`)
- **Older than 3 months**: Automatically aggregated into monthly periods (`period_start` = first day of month, `period_end` = last day of month)
- This provides optimal performance: detailed daily data for recent periods, aggregated monthly data for historical periods

## Notes
- Unit price (`precio_unitario`) is calculated as weighted average: total subtotal / total volume
- Alternative `precio_unitario_promedio` provides simple average of individual remision unit prices
- Zero-priced remisiones (internal transfers) are included in volume but contribute $0 to subtotal
- Views update automatically as new remisiones are added
- Use `vw_pumping_analysis_unified` for queries spanning multiple months (handles daily/monthly automatically)
- Use `vw_pumping_analysis_by_plant_date` for simple daily queries only

## Integration
This view can be queried directly from Supabase or exposed via API endpoints for partnered systems.

