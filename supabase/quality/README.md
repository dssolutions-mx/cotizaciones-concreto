# Quality Control Module - Phase 3 Deployment

This document outlines the steps to deploy Phase 3 of the Quality Control Module (Triggers and Automations).

## Prerequisites

- Supabase CLI installed
- Access to the Supabase project with appropriate permissions
- Phase 1 (Database Structure) and Phase 2 (Functions) already deployed

## Deployment Steps

### 1. Apply Database Migrations

```bash
# Apply the migrations for triggers and automations
supabase db push --db-url postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

Alternatively, you can run the SQL script directly in the Supabase SQL Editor:
- Navigate to your Supabase project dashboard
- Go to SQL Editor
- Open and run the file `20240615_quality_module_triggers.sql`

### 2. Deploy Edge Function

Before deploying the Edge Function, ensure environment variables are set:

```bash
# Set environment variables for the Edge Function
supabase secrets set SENDGRID_API_KEY=your_sendgrid_api_key
supabase secrets set FRONTEND_URL=https://your-frontend-url.com
```

Deploy the Edge Function:

```bash
# Deploy the notification Edge Function
supabase functions deploy ensayo-notification
```

### 3. Create Storage Bucket

The storage bucket for quality evidence files needs to be created manually:

- Navigate to your Supabase project dashboard
- Go to Storage
- Click "Create bucket"
- Set the name to "quality"
- Uncheck "Public bucket" option
- Click "Create bucket"

After creating the bucket, apply the security policies using the SQL Editor:

```sql
-- Add security policies for the bucket
CREATE POLICY "Evidence files visible to authenticated users" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'quality');

CREATE POLICY "Evidence files insertable by quality team"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'quality' AND
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER')
    )
);
```

### 4. Enable Webhook Trigger

After testing that the Edge Function works correctly, enable the webhook trigger by running this SQL:

```sql
-- Uncomment and run the following code to enable the webhook trigger
CREATE TRIGGER after_alerta_insert
AFTER INSERT ON alertas_ensayos
FOR EACH ROW
WHEN (NEW.estado = 'PENDIENTE')
EXECUTE FUNCTION handle_ensayo_notification_webhook();
```

### 5. Run Tests

To verify the implementation, run the test script:

- Navigate to your Supabase project dashboard
- Go to SQL Editor
- Open and run the file `test_quality_module_triggers.sql`

The test script will create sample data and test the triggers. It rolls back changes by default, so no test data will remain in the database.

## Verification

After deployment, verify that:

1. When registering a new test (ensayo), resistencia_calculada and porcentaje_cumplimiento are automatically calculated
2. When registering a test, the status of the sample (muestra) is updated to "ENSAYADO"
3. When registering a test, any related alert is marked as "COMPLETADA"
4. Quality metrics are recalculated when a new test is registered
5. When a new alert is created, the notification is sent correctly (check logs in Supabase Edge Functions)

## Troubleshooting

### Edge Function Issues

If the Edge Function fails to send notifications:

1. Check the Edge Function logs in Supabase dashboard
2. Verify environment variables are set correctly
3. Test the Edge Function directly:

```bash
curl -X POST https://[YOUR-PROJECT-REF].functions.supabase.co/ensayo-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [YOUR-ANON-KEY]" \
  -d '{"muestra_id":"[SAMPLE_ID]", "fecha_alerta":"2023-06-15", "estado":"PENDIENTE"}'
```

### Database Trigger Issues

If database triggers aren't functioning correctly:

1. Check that the SQL migration was applied successfully
2. Verify the functions exist in the database:

```sql
SELECT proname, prosrc FROM pg_proc WHERE proname LIKE '%ensayo%';
```

3. Verify triggers exist:

```sql
SELECT tgname, tgrelid::regclass, tgenabled FROM pg_trigger WHERE tgname LIKE '%ensayo%';
```

## Next Steps

After successful deployment of Phase 3, proceed to Phase 4: Services and State implementation on the frontend side. 