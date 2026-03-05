import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pkjqznogflgbnwzkzmpg.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://dcconcretos-hub.com';

const EXPIRES_IN = 604800; // 7 days

const generateGovernanceToken = async (entityType, entityId, action, recipientEmail, expiresIn = EXPIRES_IN) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + expiresIn;
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: recipientEmail,
      iss: 'governance-approval-system',
      iat: now,
      exp,
      data: { entityType, entityId, action, recipientEmail },
    };
    const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('JWT_SECRET') || SUPABASE_SERVICE_KEY;
    const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const data = encodedHeader + '.' + encodedPayload;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${encodedHeader}.${encodedPayload}.${signatureBase64}`;
  } catch (error) {
    console.error('Error generating JWT:', error);
    return btoa(JSON.stringify({ entityType, entityId, action, recipientEmail, exp: Math.floor(Date.now() / 1000) + expiresIn }));
  }
};

const truncateText = (text, maxLength = 100) => (text || '').length > maxLength ? text.substring(0, maxLength) + '...' : (text || '');

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { record, type } = await req.json();
  const notificationType = type || 'client_pending';

  if (notificationType === 'client_pending') {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, business_name, client_code, rfc, address, contact_name, email, phone, created_by')
      .eq('id', record.id)
      .single();

    if (clientError || !client) {
      console.error('Error fetching client:', clientError);
      return new Response(JSON.stringify({ error: clientError?.message || 'Client not found' }), { status: 400 });
    }

    let creator = null;
    if (client.created_by) {
      const { data } = await supabase.from('user_profiles').select('email, first_name, last_name').eq('id', client.created_by).single();
      creator = data;
    }

    const recipients = await supabase.from('user_profiles').select('email, first_name, last_name').eq('role', 'CREDIT_VALIDATOR');
    if (recipients.error || !recipients.data?.length) {
      return new Response(JSON.stringify({ success: false, message: 'No credit validators found' }), { status: 200 });
    }

    const emailStyles = `
      .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #f8fafc; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
      .title { font-size: 24px; color: #1e293b; margin-bottom: 10px; }
      .subtitle { font-size: 18px; color: #334155; margin-bottom: 15px; }
      .info-box { background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
      .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
      .info-label { color: #64748b; font-weight: normal; }
      .info-value { font-weight: bold; color: #334155; }
      .contact-verify { background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
      .btn-container { margin-top: 25px; }
      .btn { display: inline-block; padding: 10px 20px; margin-right: 10px; text-decoration: none; border-radius: 5px; font-weight: bold; }
      .btn-approve { background-color: #22c55e; color: white; }
      .btn-reject { background-color: #ef4444; color: white; }
      .btn-view { background-color: #3b82f6; color: white; }
    `;

    for (const recipient of recipients.data) {
      const approveToken = await generateGovernanceToken('client', client.id, 'approve', recipient.email);
      const rejectToken = await generateGovernanceToken('client', client.id, 'reject', recipient.email);
      const approveUrl = `${FRONTEND_URL}/api/governance-actions/direct-action?entityType=client&entityId=${client.id}&action=approve&email=${encodeURIComponent(recipient.email)}`;
      const rejectUrl = `${FRONTEND_URL}/api/governance-actions/direct-action?entityType=client&entityId=${client.id}&action=reject&email=${encodeURIComponent(recipient.email)}`;
      const viewUrl = `${FRONTEND_URL}/clients/${client.id}`;

      const emailContent = `
        <html><head><style>${emailStyles}</style></head><body>
        <div class="container">
          <div class="header">
            <h1 class="title">Autorización de cliente requerida</h1>
            <h2 class="subtitle">${client.business_name || 'Sin nombre'}</h2>
          </div>
          <div class="contact-verify">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #b45309;">OBLIGATORIO: Verifique que los datos de contacto pertenezcan legítimamente al cliente y sean funcionales antes de aprobar.</p>
            <p style="margin: 0 0 8px 0; font-weight: 600;">Datos de contacto a verificar:</p>
            <div class="info-row"><span class="info-label">Contacto:</span><span class="info-value">${client.contact_name || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">Teléfono:</span><span class="info-value">${client.phone || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">Correo:</span><span class="info-value">${client.email || 'N/A'}</span></div>
          </div>
          <div class="info-box">
            <div class="info-row"><span class="info-label">Razón social:</span><span class="info-value">${client.business_name || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">Código cliente:</span><span class="info-value">${client.client_code || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">RFC:</span><span class="info-value">${client.rfc || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">Dirección:</span><span class="info-value">${truncateText(client.address, 80)}</span></div>
            ${creator ? `<div class="info-row"><span class="info-label">Creado por:</span><span class="info-value">${creator.first_name} ${creator.last_name}</span></div>` : ''}
          </div>
          <div class="btn-container">
            <a href="${approveUrl}" class="btn btn-approve">Aprobar</a>
            <a href="${rejectUrl}" class="btn btn-reject">Rechazar</a>
            <a href="${viewUrl}" class="btn btn-view">Ver detalles</a>
          </div>
        </div></body></html>
      `;

      await supabase.from('governance_action_tokens').upsert(
        {
          entity_type: 'client',
          entity_id: client.id,
          recipient_email: recipient.email,
          approve_token: approveToken,
          reject_token: rejectToken,
          expires_at: new Date(Date.now() + EXPIRES_IN * 1000).toISOString(),
        },
        { onConflict: 'entity_type,entity_id,recipient_email' }
      );

      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipient.email }] }],
          from: { email: 'juan.aguirre@dssolutions-mx.com' },
          subject: `Autorización de cliente requerida - ${client.business_name || 'Nuevo cliente'}`,
          content: [{ type: 'text/html', value: emailContent }],
        }),
      });

      if (res.ok) {
        await supabase.from('governance_notifications').insert({
          entity_type: 'client',
          entity_id: client.id,
          notification_type: 'CLIENT_APPROVAL_REQUEST',
          recipient: recipient.email,
          delivery_status: 'SENT',
        });
      }
    }
  } else if (notificationType === 'site_pending') {
    const { data: site, error: siteError } = await supabase
      .from('construction_sites')
      .select('id, name, location, access_restrictions, special_conditions, client_id, created_by')
      .eq('id', record.id)
      .single();

    if (siteError || !site) {
      console.error('Error fetching site:', siteError);
      return new Response(JSON.stringify({ error: siteError?.message || 'Site not found' }), { status: 400 });
    }

    const { data: client } = await supabase.from('clients').select('business_name, contact_name, phone, email').eq('id', site.client_id).single();
    let creator = null;
    if (site.created_by) {
      const { data } = await supabase.from('user_profiles').select('first_name, last_name').eq('id', site.created_by).single();
      creator = data;
    }

    const recipients = await supabase.from('user_profiles').select('email, first_name, last_name').eq('role', 'CREDIT_VALIDATOR');
    if (recipients.error || !recipients.data?.length) {
      return new Response(JSON.stringify({ success: false, message: 'No credit validators found' }), { status: 200 });
    }

    const emailStyles = `
      .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #f8fafc; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
      .title { font-size: 24px; color: #1e293b; margin-bottom: 10px; }
      .subtitle { font-size: 18px; color: #334155; margin-bottom: 15px; }
      .info-box { background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
      .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
      .info-label { color: #64748b; }
      .info-value { font-weight: bold; color: #334155; }
      .btn-container { margin-top: 25px; }
      .btn { display: inline-block; padding: 10px 20px; margin-right: 10px; text-decoration: none; border-radius: 5px; font-weight: bold; }
      .btn-approve { background-color: #22c55e; color: white; }
      .btn-reject { background-color: #ef4444; color: white; }
      .btn-view { background-color: #3b82f6; color: white; }
    `;

    for (const recipient of recipients.data) {
      const approveToken = await generateGovernanceToken('construction_site', site.id, 'approve', recipient.email);
      const rejectToken = await generateGovernanceToken('construction_site', site.id, 'reject', recipient.email);
      const approveUrl = `${FRONTEND_URL}/api/governance-actions/direct-action?entityType=site&entityId=${site.id}&action=approve&email=${encodeURIComponent(recipient.email)}`;
      const rejectUrl = `${FRONTEND_URL}/api/governance-actions/direct-action?entityType=site&entityId=${site.id}&action=reject&email=${encodeURIComponent(recipient.email)}`;
      const viewUrl = `${FRONTEND_URL}/finanzas/gobierno-precios?tab=sites`;

      const emailContent = `
        <html><head><style>${emailStyles}</style></head><body>
        <div class="container">
          <div class="header">
            <h1 class="title">Autorización de obra requerida</h1>
            <h2 class="subtitle">${site.name || 'Sin nombre'}</h2>
          </div>
          <div class="info-box">
            <div class="info-row"><span class="info-label">Obra:</span><span class="info-value">${site.name || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">Cliente:</span><span class="info-value">${client?.business_name || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">Ubicación:</span><span class="info-value">${truncateText(site.location, 80)}</span></div>
            ${client?.phone ? `<div class="info-row"><span class="info-label">Teléfono cliente:</span><span class="info-value">${client.phone}</span></div>` : ''}
            ${client?.email ? `<div class="info-row"><span class="info-label">Correo cliente:</span><span class="info-value">${client.email}</span></div>` : ''}
            ${site.access_restrictions ? `<div class="info-row"><span class="info-label">Restricciones acceso:</span><span class="info-value">${truncateText(site.access_restrictions, 80)}</span></div>` : ''}
            ${site.special_conditions ? `<div class="info-row"><span class="info-label">Condiciones especiales:</span><span class="info-value">${truncateText(site.special_conditions, 80)}</span></div>` : ''}
            ${creator ? `<div class="info-row"><span class="info-label">Creado por:</span><span class="info-value">${creator.first_name} ${creator.last_name}</span></div>` : ''}
          </div>
          <div class="btn-container">
            <a href="${approveUrl}" class="btn btn-approve">Aprobar</a>
            <a href="${rejectUrl}" class="btn btn-reject">Rechazar</a>
            <a href="${viewUrl}" class="btn btn-view">Ver detalles</a>
          </div>
        </div></body></html>
      `;

      await supabase.from('governance_action_tokens').upsert(
        {
          entity_type: 'construction_site',
          entity_id: site.id,
          recipient_email: recipient.email,
          approve_token: approveToken,
          reject_token: rejectToken,
          expires_at: new Date(Date.now() + EXPIRES_IN * 1000).toISOString(),
        },
        { onConflict: 'entity_type,entity_id,recipient_email' }
      );

      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipient.email }] }],
          from: { email: 'juan.aguirre@dssolutions-mx.com' },
          subject: `Autorización de obra requerida - ${site.name || 'Nueva obra'}`,
          content: [{ type: 'text/html', value: emailContent }],
        }),
      });

      if (res.ok) {
        await supabase.from('governance_notifications').insert({
          entity_type: 'construction_site',
          entity_id: site.id,
          notification_type: 'SITE_APPROVAL_REQUEST',
          recipient: recipient.email,
          delivery_status: 'SENT',
        });
      }
    }
  }

  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
});
