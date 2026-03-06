import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * POST /api/quotes/notify-approval
 * Invokes the quote-approval-notification Edge Function to send approval emails
 * to executives and plant managers. Called from QuoteBuilder when a quote is
 * created and remains PENDING_APPROVAL (not auto-approved).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const quoteId = body?.quoteId;

    if (!quoteId) {
      return NextResponse.json({ error: 'quoteId is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      );
    }

    const functionUrl = `${supabaseUrl}/functions/v1/quote-approval-notification`;
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        record: { id: quoteId },
        type: 'quote_pending',
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[notify-approval] Edge function error:', res.status, json);
      return NextResponse.json(
        { error: json.error || 'Failed to send notification' },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true, ...json });
  } catch (error) {
    console.error('[notify-approval]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
