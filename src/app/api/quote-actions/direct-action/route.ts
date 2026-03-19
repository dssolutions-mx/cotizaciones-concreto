import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dcconcretos-hub.com';

function quoteErrorUrl(reason: string) {
  return `${baseUrl}/quote-action-result?action=error&reason=${reason}`;
}

export async function GET(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const quoteId = searchParams.get('quoteId');
    const action = searchParams.get('action');
    const email = searchParams.get('email');

    if (!quoteId || !action || !email) {
      return NextResponse.redirect(quoteErrorUrl('missing_params'));
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tokenRecord, error: tokenError } = await supabase
      .from('quote_action_tokens')
      .select('*')
      .eq('quote_id', quoteId)
      .eq('recipient_email', email)
      .single();

    if (tokenError && tokenError.code === 'PGRST116') {
      const { data: altTokens } = await supabase
        .from('quote_action_tokens')
        .select('*')
        .eq('quote_id', quoteId);

      if (altTokens?.length) {
        const rec = altTokens[0];
        const token = action === 'approve' ? rec.approve_token : action === 'reject' ? rec.reject_token : null;
        if (token) {
          return NextResponse.redirect(`${baseUrl}/api/quote-actions/process?token=${encodeURIComponent(token)}`);
        }
      }
      return NextResponse.redirect(quoteErrorUrl('token_not_found'));
    }

    if (tokenError || !tokenRecord) {
      return NextResponse.redirect(quoteErrorUrl('token_not_found'));
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.redirect(quoteErrorUrl('token_expired'));
    }

    const token =
      action === 'approve' ? tokenRecord.approve_token : action === 'reject' ? tokenRecord.reject_token : null;
    if (!token) {
      return NextResponse.redirect(quoteErrorUrl('invalid_action'));
    }

    return NextResponse.redirect(`${baseUrl}/api/quote-actions/process?token=${encodeURIComponent(token)}`);
  } catch (error) {
    console.error('[quote direct-action]', error);
    return NextResponse.redirect(quoteErrorUrl('unexpected_error'));
  }
}
