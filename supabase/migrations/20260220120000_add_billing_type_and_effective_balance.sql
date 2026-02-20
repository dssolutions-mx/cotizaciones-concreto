-- Additional products billing model + balance effectiveness flag
-- Source of truth for additional products pricing: order_items + app recalc.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_type_enum') THEN
    CREATE TYPE billing_type_enum AS ENUM ('PER_M3', 'PER_ORDER_FIXED', 'PER_UNIT');
  END IF;
END$$;

ALTER TABLE public.additional_products
  ADD COLUMN IF NOT EXISTS billing_type billing_type_enum;

ALTER TABLE public.quote_additional_products
  ADD COLUMN IF NOT EXISTS billing_type billing_type_enum;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS billing_type billing_type_enum;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS effective_for_balance boolean;

UPDATE public.additional_products
SET billing_type = 'PER_M3'
WHERE billing_type IS NULL;

UPDATE public.quote_additional_products qap
SET billing_type = COALESCE(ap.billing_type, 'PER_M3')
FROM public.additional_products ap
WHERE qap.additional_product_id = ap.id
  AND qap.billing_type IS NULL;

UPDATE public.order_items
SET billing_type = 'PER_M3'
WHERE billing_type IS NULL
  AND product_type LIKE 'PRODUCTO ADICIONAL:%';

UPDATE public.orders o
SET effective_for_balance = EXISTS (
  SELECT 1
  FROM public.remisiones r
  WHERE r.order_id = o.id
)
WHERE effective_for_balance IS NULL;

ALTER TABLE public.additional_products
  ALTER COLUMN billing_type SET DEFAULT 'PER_M3',
  ALTER COLUMN billing_type SET NOT NULL;

ALTER TABLE public.quote_additional_products
  ALTER COLUMN billing_type SET DEFAULT 'PER_M3',
  ALTER COLUMN billing_type SET NOT NULL;

ALTER TABLE public.orders
  ALTER COLUMN effective_for_balance SET DEFAULT false,
  ALTER COLUMN effective_for_balance SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_remisiones_order_id ON public.remisiones(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_site_balance_scope
  ON public.orders(client_id, construction_site)
  WHERE order_status <> 'cancelled';

-- Keep orders effective for balance as soon as delivery evidence exists.
CREATE OR REPLACE FUNCTION public.set_order_effective_for_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.orders
  SET effective_for_balance = true,
      updated_at = timezone('utc'::text, now())
  WHERE id = NEW.order_id
    AND effective_for_balance IS DISTINCT FROM true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_effective_for_balance ON public.remisiones;
CREATE TRIGGER trg_set_order_effective_for_balance
AFTER INSERT OR UPDATE OF order_id ON public.remisiones
FOR EACH ROW
EXECUTE FUNCTION public.set_order_effective_for_balance();

-- Use effective_for_balance as an alternative to remisiones existence.
CREATE OR REPLACE FUNCTION public.update_client_balance(p_client_id uuid, p_site_name text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total_orders numeric := 0;
    v_total_payments numeric := 0;
    v_general_credit numeric := 0;
    v_current_balance numeric := 0;
    v_balance_record_exists boolean;
    v_has_distributions boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM client_payment_distributions LIMIT 1
    ) INTO v_has_distributions;

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
    AND (
      EXISTS (
        SELECT 1 FROM remisiones
        WHERE remisiones.order_id = orders.id
      )
      OR orders.effective_for_balance = true
    );

    IF v_has_distributions THEN
        IF p_site_name IS NULL THEN
            SELECT COALESCE(SUM(cpd.amount), 0) INTO v_total_payments
            FROM client_payment_distributions cpd
            JOIN client_payments cp ON cp.id = cpd.payment_id
            WHERE cp.client_id = p_client_id;
        ELSE
            SELECT COALESCE(SUM(cpd.amount), 0) INTO v_total_payments
            FROM client_payment_distributions cpd
            JOIN client_payments cp ON cp.id = cpd.payment_id
            WHERE cp.client_id = p_client_id
            AND cpd.construction_site = p_site_name;

            SELECT
                CASE
                    WHEN current_balance < 0 THEN ABS(current_balance)
                    ELSE 0
                END INTO v_general_credit
            FROM client_balances
            WHERE client_id = p_client_id
            AND construction_site IS NULL;

            IF v_general_credit > 0 THEN
                v_total_payments := v_total_payments + LEAST(v_general_credit, v_total_orders);
            END IF;
        END IF;
    ELSE
        SELECT COALESCE(SUM(client_payments.amount), 0) INTO v_total_payments
        FROM client_payments
        WHERE client_payments.client_id = p_client_id
        AND (
            (p_site_name IS NULL AND (client_payments.construction_site IS NULL OR client_payments.construction_site = ''))
            OR
            (p_site_name IS NOT NULL AND client_payments.construction_site = p_site_name)
        );

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
                v_total_payments := v_total_payments + LEAST(v_general_credit, v_total_orders);
            END IF;
        END IF;
    END IF;

    v_current_balance := v_total_orders - v_total_payments;

    SELECT EXISTS(
        SELECT 1 FROM client_balances
        WHERE client_balances.client_id = p_client_id
        AND (
            (p_site_name IS NULL AND client_balances.construction_site IS NULL) OR
            (p_site_name IS NOT NULL AND client_balances.construction_site = p_site_name)
        )
    ) INTO v_balance_record_exists;

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
$function$;

-- Align trigger function with order_items additional products and billing_type.
CREATE OR REPLACE FUNCTION public.actualizar_volumenes_orden()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
    v_order_id uuid;
    v_total_concreto numeric := 0;
    v_total_bombeo numeric := 0;
    v_total_adicionales numeric := 0;
    v_total_vacio_olla numeric := 0;
    v_total numeric := 0;
    v_requires_invoice boolean;
    v_concrete_volume numeric := 0;
    v_pump_volume numeric := 0;
    v_vat_rate numeric := 0.16;
BEGIN
    IF current_setting('app.arkik_bulk_mode', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    v_order_id := COALESCE(NEW.order_id, OLD.order_id);

    WITH volume_totals AS (
        SELECT
            COALESCE(SUM(CASE WHEN tipo_remision = 'CONCRETO' THEN volumen_fabricado ELSE 0 END), 0) AS concrete_vol,
            COALESCE(SUM(CASE WHEN tipo_remision = 'BOMBEO' THEN volumen_fabricado ELSE 0 END), 0) AS pump_vol
        FROM remisiones
        WHERE order_id = v_order_id
    )
    SELECT concrete_vol, pump_vol
    INTO v_concrete_volume, v_pump_volume
    FROM volume_totals;

    UPDATE order_items
    SET
        concrete_volume_delivered = v_concrete_volume,
        pump_volume_delivered = v_pump_volume
    WHERE order_id = v_order_id;

    SELECT COALESCE(SUM(oi.unit_price * oi.concrete_volume_delivered), 0)
    INTO v_total_concreto
    FROM order_items oi
    WHERE oi.order_id = v_order_id
      AND oi.concrete_volume_delivered > 0
      AND oi.product_type <> 'VACÍO DE OLLA'
      AND oi.product_type <> 'SERVICIO DE BOMBEO'
      AND (oi.has_empty_truck_charge = false OR oi.has_empty_truck_charge IS NULL)
      AND oi.product_type NOT LIKE 'PRODUCTO ADICIONAL:%';

    IF EXISTS (SELECT 1 FROM order_items WHERE order_id = v_order_id AND product_type = 'SERVICIO DE BOMBEO') THEN
        SELECT COALESCE(SUM(COALESCE(oi.pump_price, 0) * oi.pump_volume_delivered), 0)
        INTO v_total_bombeo
        FROM order_items oi
        WHERE oi.order_id = v_order_id
          AND oi.product_type = 'SERVICIO DE BOMBEO'
          AND oi.pump_volume_delivered > 0;
    ELSE
        SELECT COALESCE(SUM(CASE WHEN oi.has_pump_service THEN COALESCE(oi.pump_price, 0) * oi.pump_volume_delivered ELSE 0 END), 0)
        INTO v_total_bombeo
        FROM order_items oi
        WHERE oi.order_id = v_order_id
          AND oi.pump_volume_delivered > 0;
    END IF;

    SELECT COALESCE(SUM(COALESCE(oi.empty_truck_price, 0) * COALESCE(oi.empty_truck_volume, 0)), 0)
    INTO v_total_vacio_olla
    FROM order_items oi
    WHERE oi.order_id = v_order_id
      AND (oi.has_empty_truck_charge = true OR oi.product_type = 'VACÍO DE OLLA');

    SELECT COALESCE(SUM(
      CASE COALESCE(oi.billing_type::text, 'PER_M3')
        WHEN 'PER_ORDER_FIXED' THEN COALESCE(oi.unit_price, 0)
        WHEN 'PER_UNIT' THEN COALESCE(oi.volume, 0) * COALESCE(oi.unit_price, 0)
        ELSE COALESCE(oi.volume, 0) * v_concrete_volume * COALESCE(oi.unit_price, 0)
      END
    ), 0)
    INTO v_total_adicionales
    FROM order_items oi
    WHERE oi.order_id = v_order_id
      AND oi.product_type LIKE 'PRODUCTO ADICIONAL:%';

    v_total := v_total_concreto + v_total_bombeo + v_total_vacio_olla + v_total_adicionales;

    SELECT
        o.requires_invoice,
        COALESCE(bu.vat_rate, 0.16) AS vat_rate
    INTO v_requires_invoice, v_vat_rate
    FROM orders o
    LEFT JOIN plants p ON p.id = o.plant_id
    LEFT JOIN business_units bu ON bu.id = p.business_unit_id
    WHERE o.id = v_order_id;

    UPDATE orders
    SET
        final_amount = v_total,
        invoice_amount = CASE WHEN v_requires_invoice THEN v_total * (1 + v_vat_rate) ELSE v_total END,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_order_id;

    IF EXISTS (SELECT 1 FROM remisiones WHERE order_id = v_order_id) OR
       EXISTS (SELECT 1 FROM orders WHERE id = v_order_id AND effective_for_balance = true) THEN
        PERFORM update_client_balance(
            (SELECT client_id FROM orders WHERE id = v_order_id),
            (SELECT construction_site FROM orders WHERE id = v_order_id)
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$function$;
