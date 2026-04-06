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

/** Minimal RFC 5322–style check; avoids SendGrid / blank-address issues. */
function normalizeRecipientEmail(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length < 5) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function addEmail(set: Set<string>, raw: string | null | undefined) {
  const e = normalizeRecipientEmail(raw);
  if (e) set.add(e);
}

/**
 * Same recipient rules as daily quality reports — see getQualityTeamByPlant in
 * supabase/functions/daily-quality-schedule-report/index.ts (and send-actual-notification-enhanced).
 * Plant QUALITY_TEAM + BU QUALITY_TEAM (plant_id null, same business_unit_id) + fixed CC list.
 */
async function getQualityTeamByPlant(supabase: ReturnType<typeof createClient>, plantId: string): Promise<string[]> {
  const emails = new Set<string>();

  const { data: plantData, error: plantError } = await supabase
    .from('plants')
    .select('business_unit_id')
    .eq('id', plantId)
    .single();

  if (plantError) {
    console.error('arkik-quality-request-notification: plant fetch', plantError);
    return [];
  }

  const businessUnitId = plantData?.business_unit_id as string | undefined;

  const { data: plantAssignedUsers, error: plantErr } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('plant_id', plantId)
    .in('role', ['QUALITY_TEAM'])
    .eq('is_active', true);

  if (plantErr) {
    console.error('arkik-quality-request-notification: plant quality team', plantErr);
  }
  for (const u of plantAssignedUsers || []) {
    addEmail(emails, (u as { email: string | null }).email);
  }

  if (businessUnitId) {
    const { data: buAssignedUsers, error: buErr } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('business_unit_id', businessUnitId)
      .is('plant_id', null)
      .in('role', ['QUALITY_TEAM'])
      .eq('is_active', true);

    if (buErr) {
      console.error('arkik-quality-request-notification: BU quality team', buErr);
    } else {
      for (const u of buAssignedUsers || []) {
        addEmail(emails, (u as { email: string | null }).email);
      }
    }
  }

  // Always include (same as daily-quality-schedule-report / send-actual-notification-enhanced)
  addEmail(emails, 'juan.aguirre@dssolutions-mx.com');
  addEmail(emails, 'alejandrodiaz@dcconcretos.com.mx');

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

    const recipients = await getQualityTeamByPlant(supabase, row.plant_id);
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
    const baseUrl = FRONTEND_URL.replace(/\/$/, '');
    const queueUrl = `${baseUrl}/quality/arkik-requests`;
    const deepParams = new URLSearchParams({
      open: String(row.id),
      plant: String(row.plant_id),
    });
    const openModalUrl = `${baseUrl}/quality/arkik-requests?${deepParams.toString()}`;

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
  <p style="margin:16px 0 8px;"><a href="${escapeHtml(openModalUrl)}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Abrir y crear receta (mismo flujo que Arkik)</a></p>
  <p style="margin:0 0 8px;font-size:13px;color:#4b5563;">Te lleva al hub, selecciona la planta si aplica, y abre el modal para revisar datos y crear la receta en un solo paso.</p>
  <p style="margin:12px 0 8px;"><a href="${escapeHtml(queueUrl)}" style="color:#2563eb;text-decoration:underline;">Ver todas las solicitudes abiertas</a></p>
  <p style="font-size:12px;color:#6b7280;margin-top:24px;">Mensaje automático — DC Concretos</p>
</body></html>`;

    const subject = `[Arkik] Receta / código pendiente — ${plant?.code || 'planta'} — ${truncate(row.primary_code, 40)}`;
    const mailBody = {
      from: { email: FROM_EMAIL, name: 'DC Concretos — Calidad' },
      subject,
      content: [{ type: 'text/html', value: html }],
      personalizations: recipients.map((email) => ({ to: [{ email }] })),
    };

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mailBody),
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
