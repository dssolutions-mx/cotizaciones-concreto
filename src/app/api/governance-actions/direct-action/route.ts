import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dcconcretos-hub.com';

function governanceErrorUrl(reason: string) {
  return `${baseUrl}/finanzas/gobierno-precios?action=error&reason=${reason}`;
}

export async function GET(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const entityTypeParam = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const action = searchParams.get('action');
    const email = searchParams.get('email');

    if (!entityTypeParam || !entityId || !action || !email) {
      return NextResponse.redirect(governanceErrorUrl('missing_params'));
    }

    const entityType = entityTypeParam === 'site' ? 'construction_site' : entityTypeParam;
    if (entityType !== 'client' && entityType !== 'construction_site') {
      return NextResponse.redirect(governanceErrorUrl('invalid_entity'));
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tokenRecord, error: tokenError } = await supabase
      .from('governance_action_tokens')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('recipient_email', email)
      .single();

    if (tokenError && tokenError.code === 'PGRST116') {
      const { data: altTokens } = await supabase
        .from('governance_action_tokens')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);

      if (altTokens?.length) {
        const rec = altTokens[0];
        const token = action === 'approve' ? rec.approve_token : action === 'reject' ? rec.reject_token : null;
        if (token) {
          return NextResponse.redirect(`${baseUrl}/api/governance-actions/process?token=${token}`);
        }
      }
      return NextResponse.redirect(governanceErrorUrl('token_not_found'));
    }

    if (tokenError || !tokenRecord) {
      return NextResponse.redirect(governanceErrorUrl('token_not_found'));
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.redirect(governanceErrorUrl('token_expired'));
    }

    const token = action === 'approve' ? tokenRecord.approve_token : action === 'reject' ? tokenRecord.reject_token : null;
    if (!token) {
      return NextResponse.redirect(governanceErrorUrl('invalid_action'));
    }

    return NextResponse.redirect(`${baseUrl}/api/governance-actions/process?token=${token}`);
  } catch (error) {
    console.error('[governance direct-action]', error);
    return NextResponse.redirect(governanceErrorUrl('unexpected_error'));
  }
}
