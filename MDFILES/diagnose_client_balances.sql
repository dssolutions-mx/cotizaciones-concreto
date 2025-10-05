-- Check if client_balances table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'client_balances'
) AS table_exists;

-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'client_balances';

-- Count records in client_balances
SELECT COUNT(*) AS total_records FROM client_balances;

-- Check records with construction_site = null
SELECT COUNT(*) AS total_general_balances 
FROM client_balances 
WHERE construction_site IS NULL;

-- Check records with current_balance > 0
SELECT COUNT(*) AS total_positive_balances
FROM client_balances 
WHERE construction_site IS NULL 
AND current_balance > 0;

-- Sample of client_balances data (first 5 records)
SELECT * FROM client_balances LIMIT 5; 