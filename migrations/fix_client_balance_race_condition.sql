-- Fix for race condition in update_client_balance function
-- This replaces the check-then-insert pattern with UPSERT to handle concurrent insertions

CREATE OR REPLACE FUNCTION update_client_balance(p_client_id uuid, p_site_name text DEFAULT NULL)
RETURNS void AS $$
DECLARE
    v_total_orders numeric := 0;
    v_total_payments numeric := 0;
    v_current_balance numeric := 0;
    v_general_credit numeric := 0;
BEGIN
    -- Calcular total de órdenes (solo las que tienen remisiones)
    SELECT COALESCE(SUM(orders.final_amount), 0) INTO v_total_orders
    FROM orders
    WHERE orders.client_id = p_client_id
    AND orders.order_status NOT IN ('cancelled')
    AND (
        (p_site_name IS NULL AND (orders.construction_site IS NULL OR orders.construction_site = '')) 
        OR 
        (p_site_name IS NOT NULL AND orders.construction_site = p_site_name)
    )
    AND EXISTS (
        SELECT 1 FROM remisiones 
        WHERE remisiones.order_id = orders.id
    );
    
    -- Verificar si existe la tabla de distribución de pagos
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_payment_distributions') THEN
        -- Usar método con distribuciones
        SELECT COALESCE(SUM(cpd.distributed_amount), 0) INTO v_total_payments
        FROM client_payment_distributions cpd
        WHERE cpd.client_id = p_client_id
        AND (
            (p_site_name IS NULL AND (cpd.construction_site IS NULL OR cpd.construction_site = '')) 
            OR 
            (p_site_name IS NOT NULL AND cpd.construction_site = p_site_name)
        );
        
        -- Si estamos calculando para una obra específica, verificar si hay crédito general
        IF p_site_name IS NOT NULL THEN
            SELECT 
                CASE 
                    WHEN current_balance < 0 THEN ABS(current_balance)
                    ELSE 0
                END INTO v_general_credit
            FROM client_balances
            WHERE client_id = p_client_id
            AND construction_site IS NULL;
            
            IF v_general_credit > 0 THEN
                -- Agregar el crédito general a los pagos de esta obra
                v_total_payments := v_total_payments + LEAST(v_general_credit, v_total_orders);
            END IF;
        END IF;
    ELSE
        -- Método anterior si no existe la tabla de distribuciones
        SELECT COALESCE(SUM(client_payments.amount), 0) INTO v_total_payments
        FROM client_payments
        WHERE client_payments.client_id = p_client_id
        AND (
            (p_site_name IS NULL AND (client_payments.construction_site IS NULL OR client_payments.construction_site = '')) 
            OR 
            (p_site_name IS NOT NULL AND client_payments.construction_site = p_site_name)
        );
        
        -- Si estamos calculando para una obra específica, verificar si hay crédito general
        IF p_site_name IS NOT NULL THEN
            SELECT 
                CASE 
                    WHEN current_balance < 0 THEN ABS(current_balance)
                    ELSE 0
                END INTO v_general_credit
            FROM client_balances
            WHERE client_id = p_client_id
            AND construction_site IS NULL;
            
            IF v_general_credit > 0 THEN
                -- Agregar el crédito general a los pagos de esta obra
                v_total_payments := v_total_payments + LEAST(v_general_credit, v_total_orders);
            END IF;
        END IF;
    END IF;
    
    -- Calcular balance actual
    v_current_balance := v_total_orders - v_total_payments;
    
    -- FIXED: Use UPSERT instead of check-then-insert to prevent race conditions
    -- This handles concurrent insertions gracefully
    INSERT INTO client_balances (client_id, construction_site, current_balance, last_updated)
    VALUES (p_client_id, p_site_name, v_current_balance, timezone('utc'::text, now()))
    ON CONFLICT (client_id, construction_site) 
    DO UPDATE SET 
        current_balance = EXCLUDED.current_balance,
        last_updated = EXCLUDED.last_updated;
        
END;
$$ LANGUAGE plpgsql;

-- Create the unique constraint if it doesn't exist
-- This ensures the UPSERT will work correctly
DO $$
BEGIN
    -- Check if constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_client_site_balance'
        AND table_name = 'client_balances'
    ) THEN
        -- Add the unique constraint
        ALTER TABLE client_balances 
        ADD CONSTRAINT unique_client_site_balance 
        UNIQUE (client_id, construction_site);
    END IF;
END $$;

-- Re-apply the trigger after function update
DROP TRIGGER IF EXISTS payment_process_trigger ON client_payments;
CREATE TRIGGER payment_process_trigger
AFTER INSERT ON client_payments
FOR EACH ROW
EXECUTE FUNCTION process_client_payment();

-- Update the process_client_payment function to use the new signature
CREATE OR REPLACE FUNCTION process_client_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar balance del cliente usando la función mejorada
    PERFORM update_client_balance(NEW.client_id, NEW.construction_site);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
