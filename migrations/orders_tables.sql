-- Create the orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    quote_id UUID NOT NULL,
    client_id UUID NOT NULL,
    construction_site VARCHAR NOT NULL,
    order_number VARCHAR NOT NULL,
    requires_invoice BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_date DATE NOT NULL,
    delivery_time TIME WITHOUT TIME ZONE NOT NULL,
    special_requirements TEXT,
    total_amount NUMERIC(10,2) NOT NULL,
    credit_status VARCHAR NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    credit_validated_by UUID,
    credit_validation_date TIMESTAMP WITH TIME ZONE,
    order_status VARCHAR NOT NULL DEFAULT 'created', -- created, validated, scheduled, completed, cancelled
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT orders_pkey PRIMARY KEY (id),
    CONSTRAINT orders_order_number_key UNIQUE (order_number),
    CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id),
    CONSTRAINT orders_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id),
    CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
    CONSTRAINT orders_credit_validated_by_fkey FOREIGN KEY (credit_validated_by) REFERENCES auth.users(id)
);

-- Create the order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    order_id UUID NOT NULL,
    quote_detail_id UUID,
    product_type VARCHAR NOT NULL,
    volume NUMERIC(10,2) NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    has_pump_service BOOLEAN DEFAULT FALSE,
    pump_price NUMERIC(10,2),
    has_empty_truck_charge BOOLEAN DEFAULT FALSE,
    empty_truck_volume NUMERIC(10,2),
    empty_truck_price NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT order_items_pkey PRIMARY KEY (id),
    CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT order_items_quote_detail_id_fkey FOREIGN KEY (quote_detail_id) REFERENCES quote_details(id)
);

-- Create the order_notifications table
CREATE TABLE IF NOT EXISTS public.order_notifications (
    id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    order_id UUID NOT NULL,
    notification_type VARCHAR NOT NULL,
    recipient VARCHAR NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    delivery_status VARCHAR,
    CONSTRAINT order_notifications_pkey PRIMARY KEY (id),
    CONSTRAINT order_notifications_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Function to generate a unique order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    year_prefix TEXT;
    sequence_num INT;
    new_order_number TEXT;
    existing_count INT;
BEGIN
    -- Get current year as prefix (e.g., '24' for 2024)
    year_prefix := to_char(CURRENT_DATE, 'YY');
    
    -- Get the max order sequence number for this year
    SELECT COALESCE(
      MAX(
        CASE WHEN order_number ~ ('^' || year_prefix || '-[0-9]+$') 
        THEN CAST(split_part(order_number, '-', 2) AS INTEGER)
        ELSE 0 
        END
      ), 
      0
    ) + 1
    INTO sequence_num
    FROM orders;
    
    -- Create the new order number
    new_order_number := year_prefix || '-' || LPAD(sequence_num::TEXT, 5, '0');
    
    -- Check if this order number already exists (safety check)
    SELECT COUNT(*) INTO existing_count 
    FROM orders 
    WHERE order_number = new_order_number;
    
    -- If it exists, recursively try the next one
    IF existing_count > 0 THEN
        RETURN generate_order_number();
    END IF;
    
    RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- Function to create an order from a quote
CREATE OR REPLACE FUNCTION create_order_from_quote(
    quote_id UUID,
    delivery_date DATE,
    delivery_time TIME,
    requires_invoice BOOLEAN,
    special_requirements TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_quote RECORD;
    v_order_id UUID;
    v_order_number TEXT;
    v_total_amount NUMERIC(10,2) := 0;
    v_has_pump_service BOOLEAN := FALSE;
    v_total_pump_price NUMERIC(10,2) := 0;
BEGIN
    -- Verify the quote exists and is approved
    SELECT q.id, q.client_id, q.construction_site, q.status
    INTO v_quote
    FROM quotes q
    WHERE q.id = quote_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cotización no encontrada';
    END IF;
    
    IF v_quote.status != 'APPROVED' THEN
        RAISE EXCEPTION 'Solo se pueden crear pedidos de cotizaciones aprobadas';
    END IF;
    
    -- Calculate total concrete amount
    SELECT SUM(final_price * volume)
    INTO v_total_amount
    FROM quote_details 
    WHERE quote_id = quote_id;
    
    -- Check if there is pump service and calculate its cost
    SELECT 
        BOOL_OR(pump_service),
        SUM(CASE WHEN pump_service THEN COALESCE(pump_price, 0) ELSE 0 END)
    INTO 
        v_has_pump_service,
        v_total_pump_price
    FROM 
        quote_details
    WHERE 
        quote_id = quote_id;
    
    -- Update total including pump
    v_total_amount := v_total_amount + COALESCE(v_total_pump_price, 0);
    
    -- Generate order number
    v_order_number := generate_order_number();
    
    -- Create the order
    INSERT INTO orders (
        quote_id,
        client_id,
        construction_site,
        order_number,
        requires_invoice,
        delivery_date,
        delivery_time,
        special_requirements,
        total_amount,
        created_by
    ) VALUES (
        quote_id,
        v_quote.client_id,
        v_quote.construction_site,
        v_order_number,
        requires_invoice,
        delivery_date,
        delivery_time,
        special_requirements,
        v_total_amount,
        auth.uid()
    )
    RETURNING id INTO v_order_id;
    
    -- Create order items from quote details
    INSERT INTO order_items (
        order_id,
        quote_detail_id,
        product_type,
        volume,
        unit_price,
        total_price,
        has_pump_service,
        pump_price
    )
    SELECT 
        v_order_id,
        qd.id,
        r.recipe_code,
        qd.volume,
        qd.final_price,
        qd.final_price * qd.volume,
        qd.pump_service,
        qd.pump_price
    FROM 
        quote_details qd
    JOIN 
        recipes r ON qd.recipe_id = r.id
    WHERE 
        qd.quote_id = quote_id;
    
    -- Send notification for credit validation
    PERFORM pg_notify('credit_validation_required', json_build_object(
        'order_id', v_order_id,
        'client_id', v_quote.client_id,
        'requires_invoice', requires_invoice,
        'created_by', auth.uid()
    )::text);
    
    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create an order with empty truck details
CREATE OR REPLACE FUNCTION create_order_with_details(
    quote_id UUID,
    delivery_date DATE,
    delivery_time TIME,
    requires_invoice BOOLEAN,
    special_requirements TEXT DEFAULT NULL,
    empty_truck_volume NUMERIC(10,2) DEFAULT NULL,
    has_empty_truck_charge BOOLEAN DEFAULT FALSE,
    empty_truck_price NUMERIC(10,2) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_order_id UUID;
    v_total_amount NUMERIC(10,2);
BEGIN
    -- Create basic order
    SELECT create_order_from_quote(
        quote_id, 
        delivery_date, 
        delivery_time, 
        requires_invoice, 
        special_requirements
    ) INTO v_order_id;
    
    -- If there's an empty truck charge, update the order
    IF has_empty_truck_charge AND empty_truck_volume > 0 AND empty_truck_price > 0 THEN
        -- Update total order amount
        UPDATE orders 
        SET total_amount = total_amount + (empty_truck_volume * empty_truck_price)
        WHERE id = v_order_id
        RETURNING total_amount INTO v_total_amount;
        
        -- Register empty truck charge
        INSERT INTO order_items (
            order_id,
            quote_detail_id,
            product_type,
            volume,
            unit_price,
            total_price,
            has_pump_service,
            pump_price,
            has_empty_truck_charge,
            empty_truck_volume,
            empty_truck_price
        ) VALUES (
            v_order_id,
            NULL,
            'EMPTY_TRUCK_CHARGE',
            empty_truck_volume,
            empty_truck_price,
            empty_truck_volume * empty_truck_price,
            FALSE,
            NULL,
            TRUE,
            empty_truck_volume,
            empty_truck_price
        );
    END IF;
    
    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve credit for an order
CREATE OR REPLACE FUNCTION approve_order_credit(
    order_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- Get the order
    SELECT id, credit_status, order_status
    INTO v_order
    FROM orders
    WHERE id = order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido no encontrado';
    END IF;
    
    -- Validate order status
    IF v_order.order_status != 'created' THEN
        RAISE EXCEPTION 'Solo se puede validar crédito para pedidos en estado "created"';
    END IF;
    
    -- Validate credit status
    IF v_order.credit_status != 'pending' THEN
        RAISE EXCEPTION 'Solo se puede validar crédito para pedidos con estado de crédito "pending"';
    END IF;
    
    -- Update order
    UPDATE orders
    SET 
        credit_status = 'approved',
        order_status = 'validated',
        credit_validated_by = auth.uid(),
        credit_validation_date = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = order_id;
    
    -- Send notification that order is validated
    PERFORM pg_notify('order_credit_approved', json_build_object(
        'order_id', order_id,
        'approved_by', auth.uid()
    )::text);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject credit for an order
CREATE OR REPLACE FUNCTION reject_order_credit(
    order_id UUID,
    rejection_reason TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- Get the order
    SELECT id, credit_status, order_status
    INTO v_order
    FROM orders
    WHERE id = order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido no encontrado';
    END IF;
    
    -- Validate order status
    IF v_order.order_status != 'created' THEN
        RAISE EXCEPTION 'Solo se puede rechazar crédito para pedidos en estado "created"';
    END IF;
    
    -- Validate credit status
    IF v_order.credit_status != 'pending' THEN
        RAISE EXCEPTION 'Solo se puede rechazar crédito para pedidos con estado de crédito "pending"';
    END IF;
    
    -- Update order
    UPDATE orders
    SET 
        credit_status = 'rejected',
        order_status = 'cancelled',
        credit_validated_by = auth.uid(),
        credit_validation_date = timezone('utc'::text, now()),
        special_requirements = COALESCE(special_requirements, '') || E'\n\nRazón de rechazo: ' || rejection_reason,
        updated_at = timezone('utc'::text, now())
    WHERE id = order_id;
    
    -- Send notification that order credit is rejected
    PERFORM pg_notify('order_credit_rejected', json_build_object(
        'order_id', order_id,
        'rejected_by', auth.uid(),
        'rejection_reason', rejection_reason
    )::text);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a notification trigger for new orders
CREATE OR REPLACE FUNCTION notify_on_new_order()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('new_order_created', json_build_object(
        'order_id', NEW.id,
        'client_id', NEW.client_id,
        'requires_invoice', NEW.requires_invoice,
        'created_by', NEW.created_by
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER new_order_trigger
AFTER INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION notify_on_new_order();

-- Add Row Level Security (RLS) policies for orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- All users can read orders
CREATE POLICY orders_select ON orders
    FOR SELECT
    USING (TRUE);

-- Only authenticated users with proper roles can insert orders
CREATE POLICY orders_insert ON orders
    FOR INSERT
    WITH CHECK (
        auth.role() IN ('authenticated') AND
        auth.uid() IN (
            SELECT auth.uid() FROM user_profiles
            WHERE role IN ('ADMIN', 'SALES_AGENT', 'EXECUTIVE', 'PLANT_MANAGER')
        )
    );

-- Credit validation by proper roles
CREATE POLICY orders_update_credit ON orders
    FOR UPDATE
    USING (
        auth.role() IN ('authenticated') AND
        auth.uid() IN (
            SELECT auth.uid() FROM user_profiles
            WHERE role IN ('ADMIN', 'EXECUTIVE', 'PLANT_MANAGER')
        )
    );

-- Order items RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- All users can read order items
CREATE POLICY order_items_select ON order_items
    FOR SELECT
    USING (TRUE);

-- Only authenticated users with proper roles can insert/update order items
CREATE POLICY order_items_insert ON order_items
    FOR INSERT
    WITH CHECK (
        auth.role() IN ('authenticated') AND
        auth.uid() IN (
            SELECT auth.uid() FROM user_profiles
            WHERE role IN ('ADMIN', 'SALES_AGENT', 'EXECUTIVE', 'PLANT_MANAGER')
        )
    );

-- Order notifications RLS
ALTER TABLE order_notifications ENABLE ROW LEVEL SECURITY;

-- All users can read order notifications
CREATE POLICY order_notifications_select ON order_notifications
    FOR SELECT
    USING (TRUE);

-- System only inserts notifications
CREATE POLICY order_notifications_insert ON order_notifications
    FOR INSERT
    WITH CHECK (
        auth.role() IN ('service_role', 'supabase_admin')
    );

-- Add permission for the service role to send notifications
GRANT INSERT ON public.order_notifications TO service_role; 