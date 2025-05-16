-- Create table for storing credit action tokens
CREATE TABLE IF NOT EXISTS public.credit_action_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  approve_token TEXT NOT NULL,
  reject_token TEXT NOT NULL,
  jwt_token TEXT,  -- New column for JWT tokens
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Add unique constraint to prevent duplicate tokens for same order/recipient
  UNIQUE(order_id, recipient_email)
);

-- Add RLS policies
ALTER TABLE public.credit_action_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role and functions can access this table
CREATE POLICY "Service role can manage all tokens" 
ON public.credit_action_tokens
FOR ALL
TO service_role
USING (true);

-- Add relevant indexes
CREATE INDEX IF NOT EXISTS idx_credit_action_tokens_order_id ON public.credit_action_tokens(order_id);
CREATE INDEX IF NOT EXISTS idx_credit_action_tokens_recipient ON public.credit_action_tokens(recipient_email);

-- Add comments for better documentation
COMMENT ON TABLE public.credit_action_tokens IS 'Stores tokens for email-based credit approval/rejection actions';
COMMENT ON COLUMN public.credit_action_tokens.order_id IS 'The order this token relates to';
COMMENT ON COLUMN public.credit_action_tokens.recipient_email IS 'Email of the recipient who received the token';
COMMENT ON COLUMN public.credit_action_tokens.approve_token IS 'Token for approving credit';
COMMENT ON COLUMN public.credit_action_tokens.reject_token IS 'Token for rejecting credit';
COMMENT ON COLUMN public.credit_action_tokens.jwt_token IS 'JWT token that contains both approve and reject actions';
COMMENT ON COLUMN public.credit_action_tokens.expires_at IS 'When the token expires'; 