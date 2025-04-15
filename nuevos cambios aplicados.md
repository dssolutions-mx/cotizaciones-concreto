# Implementación de Característica
## Tipo de Operación: Sistema de Balances de Clientes y Manejo de Montos en Órdenes

Este análisis y solución actualiza el sistema para implementar balances de clientes, diferenciación entre montos preliminares y finales, y soporte para productos adicionales en remisiones.

## Requisitos de Seguridad:
• El sistema debe respetar la estructura RBAC existente
• Solo roles PLANT_MANAGER y EXECUTIVE deben poder gestionar pagos
• Roles SALES_AGENT y CREDIT_VALIDATOR deben poder ver balances pero no modificarlos
• Debe existir restricción para productos adicionales según el rol del usuario

## Implementación de Esquema Adicional:

```sql
-- Tabla para productos adicionales en remisiones
CREATE TABLE IF NOT EXISTS remision_productos_adicionales (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    remision_id uuid NOT NULL REFERENCES remisiones(id),
    descripcion varchar NOT NULL,
    cantidad numeric NOT NULL,
    precio_unitario numeric NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Índice para mejorar rendimiento en consultas de productos adicionales
CREATE INDEX IF NOT EXISTS idx_remision_productos_adicionales_remision_id 
ON remision_productos_adicionales(remision_id);
```

## Implementación de Funciones:

```sql
-- Función para calcular balance preliminar al crear una orden
CREATE OR REPLACE FUNCTION calculate_preliminar_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Obtener balance actual del cliente
    SELECT COALESCE(SUM(current_balance), 0) INTO NEW.previous_client_balance
    FROM client_balances
    WHERE client_id = NEW.client_id
    AND (construction_site IS NULL OR construction_site = NEW.construction_site);
    
    -- Establecer montos preliminares
    NEW.preliminary_amount = NEW.total_amount;
    
    -- Calcular monto con IVA si se requiere factura
    IF NEW.requires_invoice THEN
        NEW.invoice_amount = NEW.total_amount * 1.16;
    ELSE
        NEW.invoice_amount = NEW.total_amount;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar balance de cliente (solo considerando órdenes con remisiones)
CREATE OR REPLACE FUNCTION update_client_balance(client_id uuid, site_name text DEFAULT NULL)
RETURNS void AS $$
DECLARE
    v_total_orders numeric := 0;
    v_total_payments numeric := 0;
    v_current_balance numeric := 0;
    v_balance_record_exists boolean;
BEGIN
    -- Obtener suma de órdenes con al menos una remisión registrada
    SELECT COALESCE(SUM(
        CASE 
            WHEN final_amount IS NOT NULL THEN 
                CASE WHEN requires_invoice THEN final_amount * 1.16 ELSE final_amount END
            ELSE 0 -- No considerar órdenes sin remisiones
        END
    ), 0) INTO v_total_orders
    FROM orders
    WHERE orders.client_id = update_client_balance.client_id
    AND (update_client_balance.site_name IS NULL OR orders.construction_site = update_client_balance.site_name)
    AND credit_status = 'approved'
    AND order_status NOT IN ('cancelled')
    -- Solo considerar órdenes que tienen al menos una remisión
    AND EXISTS (
        SELECT 1 FROM remisiones 
        WHERE remisiones.order_id = orders.id
    );
    
    -- Obtener suma de pagos
    SELECT COALESCE(SUM(amount), 0) INTO v_total_payments
    FROM client_payments
    WHERE client_payments.client_id = update_client_balance.client_id
    AND (update_client_balance.site_name IS NULL OR client_payments.construction_site = update_client_balance.site_name);
    
    -- Calcular balance actual
    v_current_balance := v_total_orders - v_total_payments;
    
    -- Verificar si ya existe registro de balance
    SELECT EXISTS(
        SELECT 1 FROM client_balances 
        WHERE client_balances.client_id = update_client_balance.client_id
        AND (
            (update_client_balance.site_name IS NULL AND client_balances.construction_site IS NULL) OR
            (client_balances.construction_site = update_client_balance.site_name)
        )
    ) INTO v_balance_record_exists;
    
    -- Actualizar o insertar registro de balance
    IF v_balance_record_exists THEN
        UPDATE client_balances
        SET 
            current_balance = v_current_balance,
            last_updated = timezone('utc'::text, now())
        WHERE client_id = update_client_balance.client_id
        AND (
            (update_client_balance.site_name IS NULL AND construction_site IS NULL) OR
            (construction_site = update_client_balance.site_name)
        );
    ELSE
        INSERT INTO client_balances (client_id, construction_site, current_balance)
        VALUES (update_client_balance.client_id, update_client_balance.site_name, v_current_balance);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar el monto final basado en remisiones y productos adicionales
CREATE OR REPLACE FUNCTION actualizar_volumenes_orden()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id uuid;
    v_total_concreto numeric := 0;
    v_total_bombeo numeric := 0;
    v_total_adicionales numeric := 0;
    v_total_vacio_olla numeric := 0;
    v_total numeric := 0;
    v_requires_invoice boolean;
BEGIN
    -- Obtener el ID de la orden desde la remisión
    v_order_id := NEW.order_id;
    
    -- Actualizar los volúmenes entregados en order_items
    UPDATE order_items oi
    SET concrete_volume_delivered = (
        SELECT COALESCE(SUM(volumen_fabricado), 0)
        FROM remisiones
        WHERE order_id = v_order_id
        AND tipo_remision = 'CONCRETO'
    ),
    pump_volume_delivered = (
        SELECT COALESCE(SUM(volumen_fabricado), 0)
        FROM remisiones
        WHERE order_id = v_order_id
        AND tipo_remision = 'BOMBEO'
    )
    WHERE oi.order_id = v_order_id;
    
    -- Calcular monto de concreto basado en volúmenes entregados
    SELECT COALESCE(SUM(oi.unit_price * oi.concrete_volume_delivered), 0)
    INTO v_total_concreto
    FROM order_items oi
    WHERE oi.order_id = v_order_id
    AND oi.concrete_volume_delivered > 0;
    
    -- Calcular monto de bombeo basado en volúmenes entregados
    SELECT COALESCE(SUM(CASE WHEN oi.has_pump_service THEN COALESCE(oi.pump_price, 0) * oi.pump_volume_delivered ELSE 0 END), 0)
    INTO v_total_bombeo
    FROM order_items oi
    WHERE oi.order_id = v_order_id
    AND oi.pump_volume_delivered > 0;
    
    -- Calcular monto de vacío de olla (definido en la creación de la orden, no cambia con remisiones)
    SELECT COALESCE(SUM(CASE WHEN oi.has_empty_truck_charge THEN oi.empty_truck_price * oi.empty_truck_volume ELSE 0 END), 0)
    INTO v_total_vacio_olla
    FROM order_items oi
    WHERE oi.order_id = v_order_id;
    
    -- Calcular monto de productos adicionales
    SELECT COALESCE(SUM(rpa.cantidad * rpa.precio_unitario), 0)
    INTO v_total_adicionales
    FROM remision_productos_adicionales rpa
    JOIN remisiones r ON r.id = rpa.remision_id
    WHERE r.order_id = v_order_id;
    
    -- Calcular total combinado
    v_total := v_total_concreto + v_total_bombeo + v_total_vacio_olla + v_total_adicionales;
    
    -- Verificar si la orden requiere factura
    SELECT requires_invoice INTO v_requires_invoice
    FROM orders
    WHERE id = v_order_id;
    
    -- Actualizar montos finales en la orden
    UPDATE orders
    SET 
        final_amount = v_total,
        invoice_amount = CASE WHEN v_requires_invoice THEN v_total * 1.16 ELSE v_total END
    WHERE id = v_order_id
    AND (final_amount IS NULL OR final_amount <> v_total);
    
    -- Actualizar los balances del cliente solo si hay al menos una remisión
    IF EXISTS (SELECT 1 FROM remisiones WHERE order_id = v_order_id) THEN
        PERFORM update_client_balance(
            (SELECT client_id FROM orders WHERE id = v_order_id),
            (SELECT construction_site FROM orders WHERE id = v_order_id)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para manejar productos adicionales
CREATE OR REPLACE FUNCTION after_remision_producto_adicional_change()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id uuid;
BEGIN
    -- Obtener ID de la orden asociada a la remisión
    SELECT order_id INTO v_order_id
    FROM remisiones
    WHERE id = NEW.remision_id;
    
    -- Utilizar una variable temporal para el NEW para operaciones DELETE
    IF TG_OP = 'DELETE' THEN
        SELECT order_id INTO v_order_id
        FROM remisiones
        WHERE id = OLD.remision_id;
    END IF;
    
    -- Ejecutar actualización de volúmenes para esta orden
    IF v_order_id IS NOT NULL THEN
        -- Crear un registro temporal de remisión para pasar a la función
        -- Esto es necesario porque actualizar_volumenes_orden() espera un NEW
        DECLARE
            temp_remision remisiones;
        BEGIN
            SELECT * INTO temp_remision 
            FROM remisiones 
            WHERE order_id = v_order_id 
            LIMIT 1;
            
            -- Usar la remisión temporal para activar la actualización
            PERFORM actualizar_volumenes_orden_wrapper(temp_remision);
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función wrapper para actualizar_volumenes_orden (para usar con productos adicionales)
CREATE OR REPLACE FUNCTION actualizar_volumenes_orden_wrapper(remision remisiones)
RETURNS void AS $$
BEGIN
    -- Ejecutar la función de actualización de volúmenes pasando la remisión
    PERFORM actualizar_volumenes_orden();
END;
$$ LANGUAGE plpgsql;

-- Función para procesar pagos de clientes
CREATE OR REPLACE FUNCTION process_client_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar balance del cliente
    PERFORM update_client_balance(NEW.client_id, NEW.construction_site);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Implementación de Triggers:

```sql
-- Trigger para asignar balance preliminar al crear orden
CREATE TRIGGER order_preliminar_balance_trigger
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION calculate_preliminar_balance();

-- Trigger para actualizar volúmenes y montos al registrar remisiones
CREATE TRIGGER after_remision_insert_or_update
AFTER INSERT OR UPDATE ON remisiones
FOR EACH ROW
EXECUTE FUNCTION actualizar_volumenes_orden();

-- Trigger para procesar pagos
CREATE TRIGGER payment_process_trigger
AFTER INSERT ON client_payments
FOR EACH ROW
EXECUTE FUNCTION process_client_payment();

-- Trigger para productos adicionales
CREATE TRIGGER after_remision_producto_adicional_change
AFTER INSERT OR UPDATE OR DELETE ON remision_productos_adicionales
FOR EACH ROW
EXECUTE FUNCTION after_remision_producto_adicional_change();
```

## Políticas RLS:

```sql
-- Habilitar RLS para productos adicionales
ALTER TABLE remision_productos_adicionales ENABLE ROW LEVEL SECURITY;

-- Políticas para remision_productos_adicionales
CREATE POLICY read_remision_productos_adicionales ON remision_productos_adicionales
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE', 'SALES_AGENT')
    )
);

CREATE POLICY insert_remision_productos_adicionales ON remision_productos_adicionales
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE')
    )
);

CREATE POLICY update_remision_productos_adicionales ON remision_productos_adicionales
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE')
    )
);

CREATE POLICY delete_remision_productos_adicionales ON remision_productos_adicionales
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE')
    )
);
```

## Implementación de Tablas Adicionales:

```sql
-- Tabla para rastrear la distribución de pagos por obra
CREATE TABLE IF NOT EXISTS client_payment_distributions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id uuid NOT NULL REFERENCES client_payments(id),
    construction_site text,
    amount numeric NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_client_payment_dist_payment_id ON client_payment_distributions(payment_id);
CREATE INDEX IF NOT EXISTS idx_client_payment_dist_site ON client_payment_distributions(construction_site);
```

## Actualizaciones de Funciones:

```sql
-- Función para manejar productos adicionales (CORREGIDA)
CREATE OR REPLACE FUNCTION after_remision_producto_adicional_change()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id uuid;
    v_total_concreto numeric := 0;
    v_total_bombeo numeric := 0;
    v_total_adicionales numeric := 0;
    v_total_vacio_olla numeric := 0;
    v_total numeric := 0;
    v_requires_invoice boolean;
    v_client_id uuid;
    v_construction_site text;
BEGIN
    -- Determine the relevant order_id based on the operation
    IF TG_OP = 'DELETE' THEN
        SELECT order_id INTO v_order_id
        FROM remisiones
        WHERE id = OLD.remision_id;
    ELSE -- INSERT or UPDATE
        SELECT order_id INTO v_order_id
        FROM remisiones
        WHERE id = NEW.remision_id;
    END IF;

    -- If we have an order_id, proceed to update the order totals
    IF v_order_id IS NOT NULL THEN
        -- Get order details needed for recalculation
        SELECT orders.requires_invoice, orders.client_id, orders.construction_site
        INTO v_requires_invoice, v_client_id, v_construction_site
        FROM orders
        WHERE orders.id = v_order_id;

        -- Recalculate Concrete Total - EXPLICITLY EXCLUDE items with product_type = 'VACÍO DE OLLA'
        SELECT COALESCE(SUM(oi.unit_price * oi.concrete_volume_delivered), 0)
        INTO v_total_concreto
        FROM order_items oi
        WHERE oi.order_id = v_order_id
        AND oi.concrete_volume_delivered > 0
        AND oi.product_type != 'VACÍO DE OLLA';
        
        -- Recalculate Pump Total
        SELECT COALESCE(SUM(CASE WHEN oi.has_pump_service THEN COALESCE(oi.pump_price, 0) * oi.pump_volume_delivered ELSE 0 END), 0)
        INTO v_total_bombeo
        FROM order_items oi
        WHERE oi.order_id = v_order_id
        AND oi.pump_volume_delivered > 0;
        
        -- Get Empty Truck charge - EXPLICITLY only for 'VACÍO DE OLLA' items
        SELECT COALESCE(SUM(CASE WHEN oi.has_empty_truck_charge THEN oi.empty_truck_price * oi.empty_truck_volume ELSE 0 END), 0)
        INTO v_total_vacio_olla
        FROM order_items oi
        WHERE oi.order_id = v_order_id
        AND oi.product_type = 'VACÍO DE OLLA';
        
        -- Recalculate the total for ALL additional products associated with this ORDER
        SELECT COALESCE(SUM(rpa.cantidad * rpa.precio_unitario), 0)
        INTO v_total_adicionales
        FROM remision_productos_adicionales rpa
        JOIN remisiones r ON r.id = rpa.remision_id
        WHERE r.order_id = v_order_id;

        -- Calculate the new total final_amount for the order
        v_total := v_total_concreto + v_total_bombeo + v_total_vacio_olla + v_total_adicionales;

        -- Directly update the final_amount and invoice_amount on the orders table
        UPDATE orders
        SET
            final_amount = v_total,
            invoice_amount = CASE WHEN v_requires_invoice THEN v_total * 1.16 ELSE v_total END,
            updated_at = timezone('utc'::text, now()) -- Ensure updated_at reflects this change
        WHERE id = v_order_id;

        -- After updating the order's amounts, update the client balance
        PERFORM update_client_balance(v_client_id, v_construction_site);
    END IF;

    -- Return the appropriate record for the trigger type
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar el monto final basado en remisiones y productos adicionales (CORREGIDA)
CREATE OR REPLACE FUNCTION actualizar_volumenes_orden()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id uuid;
    v_total_concreto numeric := 0;
    v_total_bombeo numeric := 0;
    v_total_adicionales numeric := 0;
    v_total_vacio_olla numeric := 0;
    v_total numeric := 0;
    v_requires_invoice boolean;
BEGIN
    -- Obtener el ID de la orden desde la remisión
    v_order_id := NEW.order_id;
    
    -- Actualizar los volúmenes entregados en order_items
    UPDATE order_items oi
    SET concrete_volume_delivered = (
        SELECT COALESCE(SUM(volumen_fabricado), 0)
        FROM remisiones
        WHERE order_id = v_order_id
        AND tipo_remision = 'CONCRETO'
    ),
    pump_volume_delivered = (
        SELECT COALESCE(SUM(volumen_fabricado), 0)
        FROM remisiones
        WHERE order_id = v_order_id
        AND tipo_remision = 'BOMBEO'
    )
    WHERE oi.order_id = v_order_id;
    
    -- Calcular monto de concreto basado en volúmenes entregados
    -- EXCLUDE 'VACÍO DE OLLA' items
    SELECT COALESCE(SUM(oi.unit_price * oi.concrete_volume_delivered), 0)
    INTO v_total_concreto
    FROM order_items oi
    WHERE oi.order_id = v_order_id
    AND oi.concrete_volume_delivered > 0
    AND oi.product_type != 'VACÍO DE OLLA';
    
    -- Calcular monto de bombeo basado en volúmenes entregados
    SELECT COALESCE(SUM(CASE WHEN oi.has_pump_service THEN COALESCE(oi.pump_price, 0) * oi.pump_volume_delivered ELSE 0 END), 0)
    INTO v_total_bombeo
    FROM order_items oi
    WHERE oi.order_id = v_order_id
    AND oi.pump_volume_delivered > 0;
    
    -- Calcular monto de vacío de olla (definido en la creación de la orden, no cambia con remisiones)
    -- ONLY include 'VACÍO DE OLLA' items here
    SELECT COALESCE(SUM(CASE WHEN oi.has_empty_truck_charge THEN oi.empty_truck_price * oi.empty_truck_volume ELSE 0 END), 0)
    INTO v_total_vacio_olla
    FROM order_items oi
    WHERE oi.order_id = v_order_id
    AND oi.product_type = 'VACÍO DE OLLA';
    
    -- Calcular monto de productos adicionales
    SELECT COALESCE(SUM(rpa.cantidad * rpa.precio_unitario), 0)
    INTO v_total_adicionales
    FROM remision_productos_adicionales rpa
    JOIN remisiones r ON r.id = rpa.remision_id
    WHERE r.order_id = v_order_id;
    
    -- Calcular total combinado
    v_total := v_total_concreto + v_total_bombeo + v_total_vacio_olla + v_total_adicionales;
    
    -- Verificar si la orden requiere factura
    SELECT requires_invoice INTO v_requires_invoice
    FROM orders
    WHERE id = v_order_id;
    
    -- Actualizar montos finales en la orden
    UPDATE orders
    SET 
        final_amount = v_total,
        invoice_amount = CASE WHEN v_requires_invoice THEN v_total * 1.16 ELSE v_total END
    WHERE id = v_order_id
    AND (final_amount IS NULL OR final_amount <> v_total);
    
    -- Actualizar los balances del cliente solo si hay al menos una remisión
    IF EXISTS (SELECT 1 FROM remisiones WHERE order_id = v_order_id) THEN
        PERFORM update_client_balance(
            (SELECT client_id FROM orders WHERE id = v_order_id),
            (SELECT construction_site FROM orders WHERE id = v_order_id)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para procesar y distribuir pagos de clientes
CREATE OR REPLACE FUNCTION process_client_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_payment_id uuid;
    v_client_id uuid;
    v_amount numeric;
    v_remaining_amount numeric;
    v_construction_site text;
    v_order_record record;
BEGIN
    v_payment_id := NEW.id;
    v_client_id := NEW.client_id;
    v_amount := NEW.amount;
    v_remaining_amount := NEW.amount;
    v_construction_site := NEW.construction_site;
    
    -- Si el pago especifica una obra, simplemente se asigna a esa obra
    IF v_construction_site IS NOT NULL AND v_construction_site <> '' THEN
        -- Registrar la distribución completa a esta obra
        INSERT INTO client_payment_distributions
            (payment_id, construction_site, amount)
        VALUES
            (v_payment_id, v_construction_site, v_amount);
    ELSE
        -- Pago general: distribuir según antigüedad de órdenes con balance pendiente
        
        -- Seleccionar órdenes pendientes en orden cronológico (más antiguas primero)
        FOR v_order_record IN (
            -- Modificada para evitar error "subquery uses ungrouped column"
            WITH site_balances AS (
                SELECT 
                    o.construction_site,
                    MIN(o.created_at) as first_order_date,
                    SUM(CASE WHEN o.requires_invoice THEN o.final_amount * 1.16 ELSE o.final_amount END) as total_orders,
                    COALESCE((
                        SELECT SUM(cpd.amount)
                        FROM client_payment_distributions cpd
                        JOIN client_payments cp ON cp.id = cpd.payment_id
                        WHERE cp.client_id = v_client_id  -- Usar variable de la función en lugar de o.client_id
                        AND cpd.construction_site = o.construction_site
                    ), 0) as paid_amount
                FROM orders o
                WHERE o.client_id = v_client_id  -- Usar variable v_client_id 
                AND o.credit_status = 'approved'
                AND o.order_status NOT IN ('cancelled')
                AND o.final_amount IS NOT NULL
                AND o.construction_site IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM remisiones 
                    WHERE remisiones.order_id = o.id
                )
                GROUP BY o.construction_site
            )
            SELECT 
                construction_site,
                total_orders - paid_amount as remaining_balance
            FROM site_balances
            WHERE total_orders > paid_amount
            ORDER BY first_order_date ASC
        ) LOOP
            -- Si todavía hay monto por distribuir
            IF v_remaining_amount > 0 THEN
                -- Calcular cuánto asignar a esta obra
                DECLARE
                    v_amount_to_assign numeric;
                BEGIN
                    -- Asignar lo que sea menor: el balance pendiente o el monto restante
                    v_amount_to_assign := LEAST(v_order_record.remaining_balance, v_remaining_amount);
                    
                    -- Registrar esta distribución
                    INSERT INTO client_payment_distributions
                        (payment_id, construction_site, amount)
                    VALUES
                        (v_payment_id, v_order_record.construction_site, v_amount_to_assign);
                    
                    -- Actualizar monto restante
                    v_remaining_amount := v_remaining_amount - v_amount_to_assign;
                END;
            ELSE
                -- Si ya no queda monto por distribuir, salir del loop
                EXIT;
            END IF;
        END LOOP;
        
        -- Si sobra monto después de cubrir todas las obras, crear un crédito general
        IF v_remaining_amount > 0 THEN
            INSERT INTO client_payment_distributions
                (payment_id, construction_site, amount)
            VALUES
                (v_payment_id, NULL, v_remaining_amount);
        END IF;
    END IF;
    
    -- Actualizar los balances del cliente
    PERFORM update_client_balance(v_client_id, NULL);
    
    -- Si el pago fue para una obra específica, actualizar ese balance también
    IF v_construction_site IS NOT NULL AND v_construction_site <> '' THEN
        PERFORM update_client_balance(v_client_id, v_construction_site);
    ELSE
        -- Si fue un pago general, actualizar cada obra afectada por la distribución
        FOR v_order_record IN (
            SELECT DISTINCT construction_site
            FROM client_payment_distributions
            WHERE payment_id = v_payment_id
            AND construction_site IS NOT NULL
        ) LOOP
            PERFORM update_client_balance(v_client_id, v_order_record.construction_site);
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar balance de cliente (CORREGIDA)
CREATE OR REPLACE FUNCTION update_client_balance(p_client_id uuid, p_site_name text DEFAULT NULL)
RETURNS void AS $$
DECLARE
    v_total_orders numeric := 0;
    v_total_payments numeric := 0;
    v_current_balance numeric := 0;
    v_balance_record_exists boolean;
    v_has_distributions boolean;
BEGIN
    -- Verificar si existen distribuciones de pagos
    SELECT EXISTS(
        SELECT 1 FROM client_payment_distributions LIMIT 1
    ) INTO v_has_distributions;

    -- Calcular el total de órdenes para el cliente/obra
    SELECT COALESCE(SUM(
        CASE 
            WHEN orders.final_amount IS NOT NULL THEN 
                CASE WHEN orders.requires_invoice THEN orders.final_amount * 1.16 ELSE orders.final_amount END
            ELSE 0
        END
    ), 0) INTO v_total_orders
    FROM orders
    WHERE orders.client_id = p_client_id
    AND (p_site_name IS NULL OR orders.construction_site = p_site_name)
    AND orders.credit_status = 'approved'
    AND orders.order_status NOT IN ('cancelled')
    AND EXISTS (
        SELECT 1 FROM remisiones 
        WHERE remisiones.order_id = orders.id
    );
    
    -- Calcular el total de pagos usando la distribución (si existe la tabla) o el método anterior
    IF v_has_distributions THEN
        IF p_site_name IS NULL THEN
            -- Para balance general, sumar todas las distribuciones
            SELECT COALESCE(SUM(cpd.amount), 0) INTO v_total_payments
            FROM client_payment_distributions cpd
            JOIN client_payments cp ON cp.id = cpd.payment_id
            WHERE cp.client_id = p_client_id;
        ELSE
            -- Para balance por obra, solo distribuciones para esa obra
            SELECT COALESCE(SUM(cpd.amount), 0) INTO v_total_payments
            FROM client_payment_distributions cpd
            JOIN client_payments cp ON cp.id = cpd.payment_id
            WHERE cp.client_id = p_client_id
            AND cpd.construction_site = p_site_name;
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
    END IF;
    
    -- Calcular balance actual
    v_current_balance := v_total_orders - v_total_payments;
    
    -- Verificar si ya existe registro de balance
    SELECT EXISTS(
        SELECT 1 FROM client_balances 
        WHERE client_balances.client_id = p_client_id
        AND (
            (p_site_name IS NULL AND client_balances.construction_site IS NULL) OR
            (p_site_name IS NOT NULL AND client_balances.construction_site = p_site_name)
        )
    ) INTO v_balance_record_exists;
    
    -- Actualizar o insertar registro de balance
    IF v_balance_record_exists THEN
        UPDATE client_balances
        SET 
            current_balance = v_current_balance,
            last_updated = timezone('utc'::text, now())
        WHERE client_balances.client_id = p_client_id
        AND (
            (p_site_name IS NULL AND client_balances.construction_site IS NULL) OR
            (p_site_name IS NOT NULL AND client_balances.construction_site = p_site_name)
        );
    ELSE
        INSERT INTO client_balances (client_id, construction_site, current_balance)
        VALUES (p_client_id, p_site_name, v_current_balance);
    END IF;
END;
$$ LANGUAGE plpgsql;
```

## Actualización de Triggers:

```sql
-- Actualizar el trigger para procesar pagos
DROP TRIGGER IF EXISTS payment_process_trigger ON client_payments;
CREATE TRIGGER payment_process_trigger
AFTER INSERT ON client_payments
FOR EACH ROW
EXECUTE FUNCTION process_client_payment();
```

## Políticas RLS Adicionales:

```sql
-- Habilitar RLS para distribución de pagos
ALTER TABLE client_payment_distributions ENABLE ROW LEVEL SECURITY;

-- Políticas para client_payment_distributions
CREATE POLICY read_client_payment_distributions ON client_payment_distributions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR', 'SALES_AGENT')
    )
);

CREATE POLICY insert_client_payment_distributions ON client_payment_distributions
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE')
    )
);
```

## Componentes React para la gestión de pagos:

Se han implementado los siguientes componentes:

1. **ClientPaymentsList.tsx**: Muestra el historial de pagos del cliente, filtrable por obra.
2. **ClientPaymentForm.tsx**: Formulario para registrar nuevos pagos, con distribución automática a obras según antigüedad.
3. **ClientFinancialManager.tsx**: Componente principal que integra el resumen de balances, formulario de pagos e historial por pestañas.

Estos componentes funcionan en conjunto con la distribución automática de pagos, asegurando que:

- Los pagos sin obra específica se distribuyan automáticamente a las obras más antiguas con saldo pendiente
- El balance general del cliente refleje la suma total de todas las órdenes menos todos los pagos
- Los balances por obra muestren correctamente los montos pendientes específicos

## Correcciones y Mejoras:

### Corrección de Bug de Interfaz de Usuario:

Se optimizó la UI de pagos para evitar la duplicación del botón de registro de pagos. El problema ocurría porque el componente `ClientPaymentForm` mantenía su propia variable de estado `showForm` independiente de la del componente padre. La solución implementada:

```tsx
// Antes: ClientPaymentForm tenía su propia lógica de visualización
function ClientPaymentForm({/*...*/}) {
  const [showForm, setShowForm] = useState(false);
  // ...
  
  if (!showForm) {
    return (
      <div className="mt-6">
        <RoleProtectedButton>Registrar Pago</RoleProtectedButton>
      </div>
    );
  }
  // ...
}

// Después: Eliminamos el estado interno y gestionamos la visualización desde el padre
function ClientPaymentForm({/*...*/}) {
  // Sin estado showForm interno
  // ...
  
  return (
    <div className="mt-6 bg-gray-50 p-4 rounded-md">
      {/* ... */}
    </div>
  );
}

// En el componente padre, controlamos la visualización
{!showForm ? (
  <RoleProtectedButton onClick={() => setShowForm(true)}>
    Registrar Pago
  </RoleProtectedButton>
) : (
  <ClientPaymentForm onPaymentAdded={() => setShowForm(false)} />
)}
```

### Corrección de Error SQL en Distribución de Pagos:

Se solucionó el error "subquery uses ungrouped column o.client_id from outer query" en la función `process_client_payment`. El problema ocurría porque se estaba referenciando una columna no agrupada en una subconsulta dentro de un contexto GROUP BY:

```sql
-- Versión corregida de la función process_client_payment
CREATE OR REPLACE FUNCTION process_client_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_payment_id uuid;
    v_client_id uuid;
    v_amount numeric;
    v_remaining_amount numeric;
    v_construction_site text;
    v_order_record record;
BEGIN
    v_payment_id := NEW.id;
    v_client_id := NEW.client_id;
    v_amount := NEW.amount;
    v_remaining_amount := NEW.amount;
    v_construction_site := NEW.construction_site;
    
    -- Si el pago especifica una obra, simplemente se asigna a esa obra
    IF v_construction_site IS NOT NULL AND v_construction_site <> '' THEN
        -- Registrar la distribución completa a esta obra
        INSERT INTO client_payment_distributions
            (payment_id, construction_site, amount)
        VALUES
            (v_payment_id, v_construction_site, v_amount);
    ELSE
        -- Pago general: distribuir según antigüedad de órdenes con balance pendiente
        
        -- Seleccionar órdenes pendientes en orden cronológico (más antiguas primero)
        FOR v_order_record IN (
            -- Modificada para evitar error "subquery uses ungrouped column"
            WITH site_balances AS (
                SELECT 
                    o.construction_site,
                    MIN(o.created_at) as first_order_date,
                    SUM(CASE WHEN o.requires_invoice THEN o.final_amount * 1.16 ELSE o.final_amount END) as total_orders,
                    COALESCE((
                        SELECT SUM(cpd.amount)
                        FROM client_payment_distributions cpd
                        JOIN client_payments cp ON cp.id = cpd.payment_id
                        WHERE cp.client_id = v_client_id  -- Usar variable de la función en lugar de o.client_id
                        AND cpd.construction_site = o.construction_site
                    ), 0) as paid_amount
                FROM orders o
                WHERE o.client_id = v_client_id  -- Usar variable v_client_id 
                AND o.credit_status = 'approved'
                AND o.order_status NOT IN ('cancelled')
                AND o.final_amount IS NOT NULL
                AND o.construction_site IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM remisiones 
                    WHERE remisiones.order_id = o.id
                )
                GROUP BY o.construction_site
            )
            SELECT 
                construction_site,
                total_orders - paid_amount as remaining_balance
            FROM site_balances
            WHERE total_orders > paid_amount
            ORDER BY first_order_date ASC
        ) LOOP
            -- Resto de la función...
        END LOOP;
        
        -- Resto de la implementación...
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Los cambios principales para solucionar el error fueron:

1. Usar la variable `v_client_id` en lugar de `o.client_id` en la subconsulta
2. Adaptar la consulta para usar esta variable de la función en el WHERE principal
3. Mantener el GROUP BY solo para las columnas necesarias

Con estos cambios, la distribución de pagos ahora funciona correctamente, asignando los montos a las obras en el orden adecuado según su antigüedad.

