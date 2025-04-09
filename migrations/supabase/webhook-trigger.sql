-- Create a database webhook trigger for credit validation notifications
-- First, let's create a custom function to handle the webhook

-- First, enable the pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS credit_validation_webhook ON public.orders;
DROP FUNCTION IF EXISTS handle_credit_validation_webhook;

-- Create a custom function to handle the webhook using net.http_post directly
CREATE OR REPLACE FUNCTION handle_credit_validation_webhook()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
  request_id bigint;
BEGIN
  -- Build the payload as JSONB
  payload := jsonb_build_object('record', jsonb_build_object('id', NEW.id));
  
  -- Use net.http_post directly instead of supabase_functions.http_request
  SELECT net.http_post(
    'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/credit-validation-notification',
    payload,
    '{}'::jsonb, -- params
    '{
      "Content-Type": "application/json",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranF6bm9nZmxnYm53emt6bXBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgzNzAxMSwiZXhwIjoyMDU1NDEzMDExfQ.dmTHUSOrcqxg6djnxsUHF_Jf-urAlTZsbgEzoIulilo"
    }'::jsonb, -- headers
    1000 -- timeout
  ) INTO request_id;
  
  -- Optional: Log the webhook request
  RAISE NOTICE 'Webhook sent with request_id: %', request_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Now create the trigger that uses our custom function
CREATE TRIGGER credit_validation_webhook
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
WHEN (NEW.status = 'PENDING_CREDIT_VALIDATION')
EXECUTE FUNCTION handle_credit_validation_webhook();

-- Use this query to check status of webhook calls:
-- SELECT * FROM net.http_request_queue ORDER BY created_at DESC LIMIT 10;

-- This approach separates the string concatenation into a PL/pgSQL function
-- which has better syntax handling for operations like string concatenation

-- Note: You'll need to replace {{SUPABASE_PROJECT_REF}} with your actual Supabase project reference ID
-- or use the Supabase Dashboard to create this webhook 