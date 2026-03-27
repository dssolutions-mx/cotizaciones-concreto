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

/** Same recipient expansion as material-alert-notification (plant + BU + global EXEC/ADMIN_OPS). */
async function getPlantRecipients(
  supabase: ReturnType<typeof createClient>,
  plantId: string,
  roles: string[]
): Promise<string[]> {
  const emails = new Set<string>();

  const { data: plantUsers } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('plant_id', plantId)
    .in('role', roles);

  for (const u of plantUsers || []) {
    if (u.email) emails.add(u.email);
  }

  const { data: plant } = await supabase
    .from('plants')
    .select('business_unit_id')
    .eq('id', plantId)
    .single();

  if (plant?.business_unit_id) {
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

/**
 * Cron edge function — runs every 15 minutes.
 * Checks for alerts that have exceeded the 4-hour confirmation deadline
 * and transitions them to 'expired' status, notifying Jefe de Planta.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find expired alerts
    const { data: expired, error } = await supabase
      .from('material_alerts')
      .select(`
        id, alert_number, plant_id, material_id,
        triggered_stock_kg, reorder_point_kg, confirmation_deadline,
        material:materials!material_id(material_name),
        plant:plants!plant_id(name, code)
      `)
      .eq('status', 'pending_confirmation')
      .lt('confirmation_deadline', new Date().toISOString());

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!expired || expired.length === 0) {
      return new Response(JSON.stringify({ success: true, expired_count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let expiredCount = 0;

    for (const alert of expired) {
      // Transition to expired
      await supabase
        .from('material_alerts')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', alert.id);

      // Log event
      await supabase.from('material_alert_events').insert({
        alert_id: alert.id,
        event_type: 'auto_expired',
        from_status: 'pending_confirmation',
        to_status: 'expired',
        details: { reason: 'Confirmation deadline exceeded (4h)', deadline: alert.confirmation_deadline },
      });

      expiredCount++;

      // Notify plant + BU + global ops (same as material-alert-notification)
      if (SENDGRID_API_KEY) {
        const recipients = await getPlantRecipients(supabase, alert.plant_id, ['PLANT_MANAGER']);
        const material = alert.material as { material_name: string };
        const plant = alert.plant as { name: string; code: string };

        if (recipients.length === 0) {
          console.warn(
            `material-alert-expiry-check: no recipients for expired alert ${alert.alert_number} plant ${alert.plant_id}`
          );
        }

        if (recipients.length > 0) {
          await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${SENDGRID_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              personalizations: [{ to: recipients.map(email => ({ email })) }],
              from: { email: FROM_EMAIL, name: 'DC Concretos — Inventario' },
              subject: `[VENCIDA] Alerta no confirmada: ${material.material_name} — ${plant.code}`,
              content: [{
                type: 'text/html',
                value: `
                  <div style="font-family:Calibri,Arial,sans-serif;max-width:500px;">
                    <div style="background:#C00000;padding:12px 16px;border-radius:4px 4px 0 0;">
                      <h3 style="color:white;margin:0;">Alerta Vencida — ${escapeHtml(plant.code)}</h3>
                    </div>
                    <div style="padding:16px;border:1px solid #e2e8f0;border-top:none;">
                      <p>La alerta <strong>${escapeHtml(alert.alert_number)}</strong> para
                        <strong>${escapeHtml(material.material_name)}</strong> no fue confirmada
                        por el dosificador dentro del plazo de 4 horas.</p>
                      <p>Stock al momento de la alerta: <strong>${Number(alert.triggered_stock_kg).toLocaleString('es-MX')} kg</strong></p>
                      <a href="${FRONTEND_URL}/inventario/alertas"
                         style="display:inline-block;background:#1B365D;color:white;text-decoration:none;padding:8px 16px;border-radius:4px;margin-top:8px;">
                        Revisar en App
                      </a>
                    </div>
                  </div>
                `,
              }],
            }),
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, expired_count: expiredCount }), {
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
