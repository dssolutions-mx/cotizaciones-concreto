-- Create a special policy for sending quotes to approval
CREATE POLICY "send_to_approval_policy" ON public.quotes FOR UPDATE TO authenticated USING (created_by = auth.uid() AND status = 'DRAFT') WITH CHECK (status = 'PENDING_APPROVAL');
