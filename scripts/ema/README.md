# EMA scripts

## Why fechas were not auto-filled in the database

The compliance plan treats **codes as weak identifiers** when names and serials disagree. For the standard VCM inventario, legacy codes follow a **deterministic pattern**: `DC-P01-02-01` → `DC-02-01` (strip the `Pnn` segment). If the CSV **Verificación/Calibración** column matches the conjunto’s `tipo_servicio` and **Próxima** is a real date, that pair is a safe schedule row.

One CSV line may map to a codigo that **does not exist** in the DB (example: `DC-P01-03-01` → `DC-03-01` if that instrument was never seeded). Those rows are skipped by the SQL `UPDATE` (no matching `instrumentos.codigo`).

After bulk dates are applied, run `SELECT ema_refresh_compliance_and_programa(NULL::uuid);` so `programa_calibraciones` and compliance flags stay in sync.

To **apply reviewed dates in bulk** (after you trust the `instrumento_id` + `fecha_proximo_evento` pairs), use the admin API:

```bash
curl -X POST "$APP_URL/api/ema/admin/schedule-backfill" \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"updates":[
    {"instrumento_id":"<uuid>","fecha_proximo_evento":"2026-06-15"}
  ]}'
```

Roles: `EXECUTIVE`, `ADMIN`, or `ADMIN_OPERATIONS`. Max **500** rows per request. The handler updates `instrumentos.fecha_proximo_evento` and runs `ema_refresh_compliance_and_programa` to sync `programa_calibraciones`.

You can build `updates` from `proposed_updates` in the JSON report (`--out-json`) after removing any rows you do not want.

## `audit_inventory_csv_schedule.py`

Dry-run matcher between the legacy **inventario VCM CSV** and instruments exported from Supabase.

1. Export instruments to JSON (must include `id`, `codigo`, `nombre`, `numero_serie`, `ubicacion_dentro_planta`, `fecha_proximo_evento`, `estado`, `plant_id`, `codigo_conjunto`, `nombre_conjunto`, `categoria`, `tipo_servicio`).
2. Run:

```bash
python3 scripts/ema/audit_inventory_csv_schedule.py \
  --csv "/path/to/DCEMA-HC-LC-P05-6.4.13-01 INVENTARIO-VCM (1).csv" \
  --instruments-json ./tmp/instruments.json \
  --out-json ./tmp/ema_audit_report.json
```

Optional `--mapping-json scripts/ema/code_mapping.example.json` for explicit CSV code → `instrumento_id` overrides.

**Strong matches** may propose `fecha_proximo_evento` updates; apply only after review (plan: weak/code-only matches are not auto-applied).

### Legacy inventario → SQL (DC-P… → DC-…)

To print a reviewed `UPDATE` you can run in the Supabase SQL editor (no instruments JSON):

```bash
python3 scripts/ema/audit_inventory_csv_schedule.py \
  --csv "/path/to/DCEMA-...-INVENTARIO-VCM (1).csv" \
  --emit-legacy-inventory-sql > scripts/ema/tmp/inventory_backfill.sql
```

With `--instruments-json`, the matcher also scores **legacy_code** when the mapped codigo and `tipo_servicio` align (same trust model as a serial match, slightly below it).

## DB refresh

After deploying migration `20260424120000_ema_refresh_compliance_and_programa.sql`, run drift checks in `docs/ema_schedule_compliance_verification.sql`.
