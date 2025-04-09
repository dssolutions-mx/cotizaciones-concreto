# Setting Up the Credit Validation Webhook

This README explains how to set up a database webhook to trigger the `credit-validation-notification` edge function whenever an order needs credit validation.

## Option 1: Using SQL (Command Line)

1. Connect to your Supabase database using psql or the SQL editor in the Supabase Dashboard.
2. Run the SQL commands in the `webhook-trigger.sql` file:
   - Make sure to replace `{{SUPABASE_PROJECT_REF}}` with your actual Supabase project reference ID.
   - You can find your project reference ID in your Supabase project settings.

```sql
CREATE OR REPLACE TRIGGER credit_validation_webhook
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
WHEN (NEW.status = 'PENDING_CREDIT_VALIDATION')
EXECUTE FUNCTION supabase_functions.http_request(
  'https://your-project-ref.functions.supabase.co/credit-validation-notification',
  'POST',
  '{"Content-Type":"application/json"}',
  '{"record": {"id": "' || NEW.id || '"}}',
  '1000'
);
```

## Option 2: Using Supabase Dashboard (Recommended)

1. Log in to your Supabase Dashboard.
2. Navigate to the "Database" section in the sidebar.
3. Click on "Database Webhooks" (or "Webhooks" depending on your UI version).
4. Click "Create a new webhook" button.
5. Fill in the webhook details:
   - **Name**: `credit_validation_webhook`
   - **Table**: `public.orders`
   - **Events**: Select both `INSERT` and `UPDATE` (since we want to trigger when orders are created or updated)
   - **Condition**: Add the condition `status = 'PENDING_CREDIT_VALIDATION'`
   - **Type**: HTTP Request (POST)
   - **URL**: `https://your-project-ref.functions.supabase.co/credit-validation-notification`
   - **Headers**: Add a header with key `Content-Type` and value `application/json`
   - **HTTP Method**: `POST`
   - **Request Body**: `{"record": {"id": "{{ROW.id}}"}}`
   - **Timeout (ms)**: `1000`

6. Click "Create webhook"

## Monitoring Webhook Execution

You can monitor your webhook executions in the Supabase Dashboard:

1. Navigate to the "Database" section.
2. Click on "Database Webhooks".
3. Select your webhook from the list.
4. View the "Execution History" tab to see the status of webhook calls.

You can also query the `net.http_request_queue` table to see the status of webhook executions:

```sql
SELECT * FROM net.http_request_queue ORDER BY created_at DESC LIMIT 10;
```

## Troubleshooting

If webhooks aren't firing as expected:

1. Make sure your `pg_net` extension is enabled in your database.
2. Verify the condition is being met (check if any orders have `status = 'PENDING_CREDIT_VALIDATION'`).
3. Check the Edge Function logs in the Supabase Dashboard to ensure it's receiving the webhook requests.
4. For local development, use `host.docker.internal` instead of `localhost` in your webhook URL. 