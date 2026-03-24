import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://dcconcretos-hub.com';
const FROM_EMAIL = Deno.env.get('NOTIFICATION_FROM_EMAIL') || 'juan.aguirre@dssolutions-mx.com';

/**
 * Resolve emails for quality + plant manager for a plant (same idea as daily quality reports,
 * without hardcoding extra recipients).
 */
async function getRecipientsForPlant(supabase: ReturnType<typeof createClient>, plantId: string): Promise<string[]> {
  const { data: plantData, error: plantError } = await supabase
    .from('plants')
    .select('business_unit_id')
    .eq('id', plantId)
    .single();

  if (plantError) {
    console.error('arkik-quality-request-notification: plant fetch', plantError);
  }

  const businessUnitId = plantData?.business_unit_id;
  const emails = new Set<string>();

  const { data: plantQuality, error: qErr } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('plant_id', plantId)
    .in('role', ['QUALITY_TEAM', 'PLANT_MANAGER'])
    .eq('is_active', true);

  if (qErr) console.error('arkik-quality-request-notification: plant profiles', qErr);
  (plantQuality || []).forEach((u: { email: string }) => {
    if (u.email) emails.add(u.email);
  });

  if (businessUnitId) {
    const { data: buQuality, error: buErr } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('business_unit_id', businessUnitId)
      .is('plant_id', null)
      .eq('role', 'QUALITY_TEAM')
      .eq('is_active', true);

    if (buErr) console.error('arkik-quality-request-notification: BU profiles', buErr);
    (buQuality || []).forEach((u: { email: string }) => {
      if (u.email) emails.add(u.email);
    });
  }

  return Array.from(emails);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!SENDGRID_API_KEY) {
      console.warn('arkik-quality-request-notification: SENDGRID_API_KEY missing, skipping email');
      return new Response(JSON.stringify({ success: false, skipped: true, reason: 'no_sendgrid' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = body?.request_id as string | undefined;

    if (!requestId) {
      return new Response(JSON.stringify({ error: 'request_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: row, error: rowError } = await supabase
      .from('arkik_quality_requests')
      .select('id, plant_id, primary_code, request_type, payload, status, created_at')
      .eq('id', requestId)
      .single();

    if (rowError || !row) {
      return new Response(JSON.stringify({ error: rowError?.message || 'Request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (row.status !== 'open') {
      return new Response(JSON.stringify({ success: false, message: 'Request not open' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: plant } = await supabase.from('plants').select('name, code').eq('id', row.plant_id).single();

    const recipients = await getRecipientsForPlant(supabase, row.plant_id);
    if (recipients.length === 0) {
      console.warn('arkik-quality-request-notification: no recipients for plant', row.plant_id);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'no_recipients' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = (row.payload || {}) as Record<string, unknown>;
    const allRemisiones = Array.isArray(payload.remision_numbers) ? (payload.remision_numbers as string[]) : [];
    const remisionNumbers = allRemisiones.slice(0, 15);
    const fileLabel = typeof payload.file_label === 'string' ? payload.file_label : '';
    const queueUrl = `${FRONTEND_URL.replace(/\/$/, '')}/quality/arkik-requests`;

    const remisionLine =
      remisionNumbers.length > 0
        ? `<p><strong>Remisiones (muestra):</strong> ${remisionNumbers.join(', ')}${
            allRemisiones.length > 15 ? '…' : ''
          }</p>`
        : '';

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:18px;margin:0 0 12px;">Solicitud Arkik — calidad</h1>
  <p style="margin:0 0 8px;">Se registró una solicitud desde el procesador Arkik.</p>
  <ul style="margin:0 0 16px;padding-left:20px;">
    <li><strong>Planta:</strong> ${plant?.name || '—'} (${plant?.code || row.plant_id})</li>
    <li><strong>Código / receta (Arkik):</strong> <code>${escapeHtml(row.primary_code)}</code></li>
    <li><strong>Tipo:</strong> ${escapeHtml(row.request_type)}</li>
    ${fileLabel ? `<li><strong>Archivo:</strong> ${escapeHtml(fileLabel)}</li>` : ''}
  </ul>
  ${remisionLine}
  <p style="margin:16px 0 8px;"><a href="${queueUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Abrir solicitudes Arkik</a></p>
  <p style="font-size:12px;color:#6b7280;margin-top:24px;">Mensaje automático — DC Concretos</p>
</body></html>`;

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: recipients.map((email) => ({ email })) }],
        from: { email: FROM_EMAIL, name: 'DC Concretos — Calidad' },
        subject: `[Arkik] Receta / código pendiente — ${plant?.code || 'planta'} — ${truncate(row.primary_code, 40)}`,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('SendGrid error', res.status, t);
      return new Response(JSON.stringify({ success: false, error: 'sendgrid_failed', detail: t.slice(0, 200) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, recipients: recipients.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('arkik-quality-request-notification', e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, n: number): string {
  if (!s || s.length <= n) return s;
  return s.slice(0, n) + '…';
}
