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

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function getPlantRecipients(
  supabase: ReturnType<typeof createClient>,
  plantId: string,
  roles: string[]
): Promise<string[]> {
  const emails = new Set<string>();

  // Plant-level users with the requested roles
  const { data: plantUsers } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('plant_id', plantId)
    .in('role', roles);

  for (const u of plantUsers || []) {
    if (u.email) emails.add(u.email);
  }

  // Get business unit for this plant
  const { data: plant } = await supabase
    .from('plants')
    .select('business_unit_id')
    .eq('id', plantId)
    .single();

  if (plant?.business_unit_id) {
    // BU-level users (plant_id IS NULL but business_unit_id matches)
    const { data: buUsers } = await supabase
      .from('user_profiles')
      .select('email')
      .is('plant_id', null)
      .eq('business_unit_id', plant.business_unit_id)
      .in('role', roles);

    for (const u of buUsers || []) {
      if (u.email) emails.add(u.email);
    }
  }

  // Global admins
  const { data: globalUsers } = await supabase
    .from('user_profiles')
    .select('email')
    .is('plant_id', null)
    .is('business_unit_id', null)
    .in('role', ['EXECUTIVE', 'ADMIN_OPERATIONS']);

  for (const u of globalUsers || []) {
    if (u.email) emails.add(u.email);
  }

  return [...emails];
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
      return new Response(JSON.stringify({ success: false, skipped: true, reason: 'no_sendgrid' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { alert_id } = await req.json();

    if (!alert_id) {
      return new Response(JSON.stringify({ error: 'alert_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch alert with material and plant info
    const { data: alert, error: alertErr } = await supabase
      .from('material_alerts')
      .select(`
        id, alert_number, plant_id, material_id, status,
        triggered_stock_kg, reorder_point_kg, confirmation_deadline,
        material:materials!material_id(material_name, category),
        plant:plants!plant_id(name, code)
      `)
      .eq('id', alert_id)
      .single();

    if (alertErr || !alert) {
      return new Response(JSON.stringify({ error: 'Alert not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const material = alert.material as { material_name: string; category: string };
    const plant = alert.plant as { name: string; code: string };

    // Get recipients: dosificador + plant manager (+ global EXEC/ADMIN via helper)
    let recipients = await getPlantRecipients(supabase, alert.plant_id, [
      'DOSIFICADOR', 'PLANT_MANAGER',
    ]);

    // If still nobody at plant/BU for those roles, escalate to BU-level EXEC / ADMIN_OPERATIONS
    if (recipients.length === 0) {
      const { data: plantRow } = await supabase
        .from('plants')
        .select('business_unit_id')
        .eq('id', alert.plant_id)
        .single();
      if (plantRow?.business_unit_id) {
        const { data: buEscalation } = await supabase
          .from('user_profiles')
          .select('email')
          .is('plant_id', null)
          .eq('business_unit_id', plantRow.business_unit_id)
          .in('role', ['EXECUTIVE', 'ADMIN_OPERATIONS']);
        recipients = (buEscalation || []).map((u) => u.email).filter(Boolean);
      }
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: false, skipped: true, reason: 'no_recipients' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deadlineStr = alert.confirmation_deadline
      ? new Date(alert.confirmation_deadline).toLocaleString('es-MX', { timeZone: 'America/Tijuana' })
      : 'N/A';

    const html = `
      <div style="font-family:Calibri,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B365D;padding:16px 20px;border-radius:4px 4px 0 0;">
          <h2 style="color:white;margin:0;font-size:16px;">Alerta de Material — ${escapeHtml(plant.code)}</h2>
        </div>
        <div style="padding:20px;border:1px solid #e2e8f0;border-top:none;">
          <p style="color:#C00000;font-weight:700;font-size:15px;margin:0 0 12px;">
            Inventario bajo: ${escapeHtml(material.material_name)}
          </p>
          <table style="width:100%;border-collapse:collapse;margin:12px 0;">
            <tr><td style="padding:6px 0;color:#64748B;">Planta</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(plant.name)} (${escapeHtml(plant.code)})</td></tr>
            <tr><td style="padding:6px 0;color:#64748B;">Material</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(material.material_name)}</td></tr>
            <tr><td style="padding:6px 0;color:#64748B;">Stock actual</td><td style="padding:6px 0;font-weight:600;color:#C00000;">${Number(alert.triggered_stock_kg).toLocaleString('es-MX')} kg</td></tr>
            <tr><td style="padding:6px 0;color:#64748B;">Punto de reorden</td><td style="padding:6px 0;">${Number(alert.reorder_point_kg).toLocaleString('es-MX')} kg</td></tr>
            <tr><td style="padding:6px 0;color:#64748B;">Fecha limite</td><td style="padding:6px 0;font-weight:600;color:#B84500;">${deadlineStr}</td></tr>
          </table>
          <p style="margin:16px 0 8px;">El dosificador debe verificar fisicamente el material y confirmar esta alerta en la app antes de la fecha limite.</p>
          <a href="${FRONTEND_URL}/inventario/alertas" style="display:inline-block;background:#00A64F;color:white;text-decoration:none;padding:10px 20px;border-radius:4px;font-weight:600;margin:8px 0;">
            Ver Alerta en App
          </a>
        </div>
        <div style="padding:12px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 4px 4px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">Alerta ${escapeHtml(alert.alert_number)} — DC Concretos</p>
        </div>
      </div>
    `;

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: recipients.map((email) => ({ email })) }],
        from: { email: FROM_EMAIL, name: 'DC Concretos — Inventario' },
        subject: `[Alerta] Material bajo: ${material.material_name} — ${plant.code}`,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `SendGrid error: ${errText.substring(0, 200)}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, recipients: recipients.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
