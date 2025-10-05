SELECT id, order_number, credit_status, rejection_reason FROM public.orders WHERE credit_status = 'rejected_by_validator';
