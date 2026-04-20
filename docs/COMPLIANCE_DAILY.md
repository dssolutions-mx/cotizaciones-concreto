# Compliance diario (cotizador × mantenimiento)

## 1. Migración

Aplicar en el proyecto **cotizador**:

```bash
supabase db push
# o ejecutar el SQL en supabase/migrations/20260420120000_daily_compliance_tables.sql
```

## 2. Variables de entorno

Ver `.env.example`: `MANTENIMIENTO_SUPABASE_*`, `COMPLIANCE_CRON_SECRET`, `COMPLIANCE_OVERRIDES_JSON` (opcional; overrides por planta también en BD), `COMPLIANCE_DIGEST_RECIPIENTS` (respaldo si el digest en BD está vacío), `SENDGRID_API_KEY`, `NEXT_PUBLIC_APP_URL`.

**Destinatarios desde la app:** en `/production-control/daily-compliance` puedes editar digest y overrides por planta (tablas `compliance_email_settings` y `compliance_plant_email_overrides`); la política CC regional sigue codificada en `resolveComplianceRecipients`.

**Vercel (Next.js):** el cálculo completo (`/api/compliance/daily/run`, escritura en `compliance_daily_runs`, correos opcionales) **se ejecuta en el servidor de Next** en Vercel. Esa ruta está expuesta públicamente; sin secreto, cualquiera con la URL podría disparar corridas o envíos. El Edge Function solo reenvía la petición con el mismo header: quien **valida** la llamada a Next es Next mismo, por eso el valor tiene que existir también en el entorno de Vercel (mismo string que en Supabase).

**Supabase Edge (`daily-compliance-check`):** en Dashboard → Edge Functions → Secrets, definir al menos:

- `COMPLIANCE_CRON_SECRET` — igual que en Vercel
- `APP_URL` — origen de producción del Next.js (sin barra final), o `NEXT_PUBLIC_APP_URL` como respaldo

La función valida el header `x-compliance-secret` antes de reenviar el request al API de Next.

## 3. Programación (opcional)

**Uso manual (por defecto):** entra a `/production-control/daily-compliance`, elige fecha y **Calcular ahora**. No hace falta `pg_cron`, Edge ni SQL de schedule.

**Automatización opcional (solo si la quieres):** no usamos `vercel.json` `crons`. Puedes programar en **Supabase `pg_cron`** una llamada a la Edge Function, que reenvía al mismo endpoint de Next. Ver `[docs/COMPLIANCE_PG_CRON.sql](./COMPLIANCE_PG_CRON.sql)`. Requiere desplegar `daily-compliance-check` y secrets en Edge (`COMPLIANCE_CRON_SECRET`, `APP_URL`).

`supabase/config.toml` define `[functions.daily-compliance-check] verify_jwt = false` para llamadas al Edge con `x-compliance-secret` en lugar de JWT de Supabase.

## 4. UI y correos por planta

**Ruta:** `/production-control/daily-compliance`.

- Los hallazgos se agrupan por tipo (sin producción, sin entradas de material, evidencia, bombeo, checklist, conductor vs operador, unidad desconocida; diesel solo informativo en panel).
- **Un botón = un correo** para esa categoría y esa planta. El número entre paréntesis es la **cantidad de hallazgos** incluidos en ese único correo, no la cantidad de envíos.
- Categorías con botón de envío: `missingProduction`, `missingMaterialEntries`, `missingEvidence`, `missingPumping`, `missingChecklist`, `operatorMismatch`, `unknownUnit`. Reglas de diesel (`noDieselActivity`, `dieselWithoutProduction`) se muestran en pantalla sin botón de correo.
- El reporte en caliente enriquece pedidos con número de orden y cliente/obra cuando hay `orderId` en el hallazgo (lectura al cargar reporte y al enviar disputa).
- **CC:** Tijuana (P002, P003, P004, DIACE) usa Alberto BU + Enrique + RH. Resto: Héctor + Enrique + RH; **P004P y P005** agregan a Mario (`marioperez@dcconcretos.com.mx`) por operaciones (no se usa `planta5@` como CC fijo).
- **P004P — dosificador extra:** sembrado en BD (`compliance_plant_email_overrides`, migración `20260422120000_compliance_p004p_dosificador_seed.sql`) con `planta4@dcconcretos.com.mx` en **Para** (idempotente `ON CONFLICT DO NOTHING`).

## 5. Smoke test manual

Con variables cargadas:

```bash
curl -sS -H "x-compliance-secret: $COMPLIANCE_CRON_SECRET" \
  "$NEXT_PUBLIC_APP_URL/api/compliance/daily/run?date=2026-04-18&notify=0"
```

Debe devolver JSON con `report.findings`.

Probar la Edge Function (mismo secreto):

```bash
curl -sS -H "x-compliance-secret: $COMPLIANCE_CRON_SECRET" \
  "https://<PROJECT_REF>.supabase.co/functions/v1/daily-compliance-check?notify=0"
```

