-- Legacy soft-void NCs are noise; allocations were already removed on void.
DELETE FROM public.invoice_credit_notes
WHERE status = 'void';
