import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || supabaseServiceKey;
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dcconcretos-hub.com';

function successRedirect(entityType: string, action: string) {
  const tab = entityType === 'client' ? 'clients' : 'sites';
  return `${baseUrl}/finanzas/gobierno-precios?tab=${tab}&action=${action === 'approve' ? 'approved' : 'rejected'}`;
}

function errorRedirect(reason: string) {
  return `${baseUrl}/finanzas/gobierno-precios?action=error&reason=${reason}`;
}

async function verifyJWT(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    const signatureBytes = Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const hmac = crypto.createHmac('sha256', JWT_SECRET!);
    hmac.update(data);
    const expectedSignature = hmac.digest();
    const signatureBuffer = Buffer.from(signatureBytes);
    if (signatureBuffer.length !== expectedSignature.length) return null;
    let mismatch = 0;
    for (let i = 0; i < signatureBuffer.length; i++) {
      mismatch |= signatureBuffer[i] ^ expectedSignature[i];
    }
    if (mismatch !== 0) return null;
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey || !JWT_SECRET) {
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (!token) {
      return NextResponse.redirect(errorRedirect('missing_token'));
    }

    const payload = await verifyJWT(token);
    if (!payload?.data) {
      return NextResponse.redirect(errorRedirect('invalid_token'));
    }

    const { entityType, entityId, action, recipientEmail } = payload.data;
    if (!entityType || !entityId || !action || !recipientEmail) {
      return NextResponse.redirect(errorRedirect('invalid_token'));
    }
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.redirect(errorRedirect('invalid_action'));
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tokenRecord, error: tokenError } = await supabase
      .from('governance_action_tokens')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('recipient_email', recipientEmail)
      .single();

    let activeRecord = tokenRecord;
    if (tokenError && tokenError.code === 'PGRST116') {
      const { data: alt } = await supabase
        .from('governance_action_tokens')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);
      activeRecord = alt?.[0] ?? null;
    }

    if (!activeRecord) {
      return NextResponse.redirect(errorRedirect('token_not_found'));
    }

    if (activeRecord.expires_at && new Date(activeRecord.expires_at) < new Date()) {
      return NextResponse.redirect(errorRedirect('token_expired'));
    }

    const expectedToken = action === 'approve' ? activeRecord.approve_token : activeRecord.reject_token;
    if (expectedToken !== token) {
      return NextResponse.redirect(errorRedirect('invalid_token'));
    }

    const table = entityType === 'client' ? 'clients' : 'construction_sites';
    const { data: entity } = await supabase.from(table).select('approval_status').eq('id', entityId).single();
    if (!entity || (entity.approval_status || '').toUpperCase() !== 'PENDING_APPROVAL') {
      return NextResponse.redirect(successRedirect(entityType, action) + '&already_processed=true');
    }

    const { data: userData } = await supabase.from('user_profiles').select('id').eq('email', recipientEmail).single();
    const validatorId = userData?.id ?? recipientEmail;

    const updatePayload =
      action === 'approve'
        ? {
            approval_status: 'APPROVED',
            approved_by: validatorId,
            approved_at: new Date().toISOString(),
          }
        : {
            approval_status: 'REJECTED',
            approved_by: validatorId,
            approved_at: new Date().toISOString(),
          };

    const { error: updateError } = await supabase
      .from(table)
      .update(updatePayload)
      .eq('id', entityId)
      .eq('approval_status', 'PENDING_APPROVAL');

    if (updateError) {
      console.error('[governance process] update error:', updateError);
      return NextResponse.redirect(errorRedirect('update_failed'));
    }

    await supabase
      .from('governance_action_tokens')
      .delete()
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    return NextResponse.redirect(successRedirect(entityType, action));
  } catch (error) {
    console.error('[governance process]', error);
    return NextResponse.redirect(errorRedirect('server_error'));
  }
}
