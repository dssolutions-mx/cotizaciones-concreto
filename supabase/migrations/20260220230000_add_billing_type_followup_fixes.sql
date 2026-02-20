-- Follow-up safety fixes for billing_type / effective_for_balance rollout.
-- 1) Ensure orphan quote_additional_products rows are backfilled before NOT NULL enforcement.
-- 2) Keep effective_for_balance accurate when remisiones are deleted.

UPDATE public.quote_additional_products qap
SET billing_type = 'PER_M3'
WHERE qap.billing_type IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.additional_products ap
    WHERE ap.id = qap.additional_product_id
  );

CREATE OR REPLACE FUNCTION public.clear_order_effective_for_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.orders
  SET effective_for_balance = false,
      updated_at = timezone('utc'::text, now())
  WHERE id = OLD.order_id
    AND effective_for_balance = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.remisiones
      WHERE order_id = OLD.order_id
    );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_order_effective_for_balance ON public.remisiones;
CREATE TRIGGER trg_clear_order_effective_for_balance
AFTER DELETE ON public.remisiones
FOR EACH ROW
EXECUTE FUNCTION public.clear_order_effective_for_balance();
