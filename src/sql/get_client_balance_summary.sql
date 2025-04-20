CREATE OR REPLACE FUNCTION get_client_balance_summary()
RETURNS TABLE (
  client_id uuid,
  business_name text,
  current_balance numeric,
  last_payment_date timestamp with time zone,
  credit_status text,
  last_updated timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  WITH client_general_balances AS (
    -- Get only the general balances (no construction_site)
    SELECT 
      cb.client_id,
      cb.current_balance,
      cb.last_updated
    FROM 
      client_balances cb
    WHERE 
      cb.construction_site IS NULL
  ),
  latest_payments AS (
    -- Get the latest payment date for each client
    SELECT DISTINCT ON (cp.client_id)
      cp.client_id,
      cp.payment_date as last_payment_date
    FROM 
      client_payments cp
    ORDER BY 
      cp.client_id, cp.payment_date DESC
  )
  -- Join all tables to get the required information
  SELECT 
    cgb.client_id,
    c.business_name,
    cgb.current_balance,
    lp.last_payment_date,
    c.credit_status,
    cgb.last_updated
  FROM 
    client_general_balances cgb
    JOIN clients c ON cgb.client_id = c.id
    LEFT JOIN latest_payments lp ON cgb.client_id = lp.client_id
  ORDER BY 
    cgb.current_balance DESC;
END;
$$ LANGUAGE plpgsql; 