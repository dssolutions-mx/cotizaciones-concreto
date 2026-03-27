import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pkjqznogflgbnwzkzmpg.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://dcconcretos-hub.com';
const FROM_EMAIL = 'juan.aguirre@dssolutions-mx.com';

/** Returns YYYY-MM-DD for a date offset by `days` from today */
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const emailStyles = `
  body { margin: 0; padding: 0; background-color: #f1f5f9; }
  .wrapper { padding: 30px 15px; }
  .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .header { padding: 24px 28px 18px; border-bottom: 1px solid #e2e8f0; }
  .header-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 12px; }
  .badge-warning { background-color: #fef3c7; color: #92400e; }
  .badge-urgent { background-color: #fee2e2; color: #991b1b; }
  .title { font-size: 20px; color: #0f172a; margin: 0 0 4px; }
  .subtitle { font-size: 14px; color: #64748b; margin: 0; }
  .body { padding: 24px 28px; }
  .info-grid { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 20px; }
  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
  .info-row:last-child { border-bottom: none; }
  .info-label { color: #64748b; font-size: 13px; }
  .info-value { font-weight: 600; color: #1e293b; font-size: 13px; text-align: right; }
  .status-chip { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: bold; }
  .status-vigente { background: #dcfce7; color: #166534; }
  .status-proximo { background: #fef3c7; color: #92400e; }
  .status-vencido { background: #fee2e2; color: #991b1b; }
  .btn-row { margin-top: 22px; }
  .btn { display: inline-block; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; }
  .btn-primary { background-color: #2563eb; color: #ffffff; }
  .footer { padding: 16px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
`;

function buildEmail(opts: {
  daysUntil: number;
  instrumentCodigo: string;
  instrumentNombre: string;
  instrumentTipo: string;
  plantNombre: string;
  tipoEvento: string;
  fechaProgramada: string;
  estadoActual: string;
  instrumentId: string;
}): { subject: string; html: string } {
  const isUrgent = opts.daysUntil <= 1;
  const badgeClass = isUrgent ? 'badge-urgent' : 'badge-warning';
  const badgeText = isUrgent ? '¡MAÑANA!' : `${opts.daysUntil} DÍAS`;

  const tipoEventoLabel: Record<string, string> = {
    calibracion_externa: 'Calibración externa (EMA)',
    verificacion_interna: 'Verificación interna',
    verificacion_post_incidente: 'Verificación post-incidente',
  };
  const tipoLabel = tipoEventoLabel[opts.tipoEvento] ?? opts.tipoEvento;

  const tipoInstrLabel: Record<string, string> = { A: 'Tipo A — Maestro verificador', B: 'Tipo B — Externo independiente', C: 'Tipo C — Trabajo interno' };

  const statusMap: Record<string, string> = {
    vigente: '<span class="status-chip status-vigente">Vigente</span>',
    proximo_vencer: '<span class="status-chip status-proximo">Próximo a vencer</span>',
    vencido: '<span class="status-chip status-vencido">Vencido</span>',
    en_revision: '<span class="status-chip status-vencido">En revisión</span>',
  };
  const estadoChip = statusMap[opts.estadoActual] ?? opts.estadoActual;

  const subject = isUrgent
    ? `⚠️ MAÑANA — ${tipoLabel}: ${opts.instrumentCodigo} (${opts.plantNombre})`
    : `📅 En ${opts.daysUntil} días — ${tipoLabel}: ${opts.instrumentCodigo} (${opts.plantNombre})`;

  const html = `
  <html>
  <head><style>${emailStyles}</style></head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <span class="header-badge ${badgeClass}">${badgeText}</span>
          <h1 class="title">Evento de calibración próximo</h1>
          <p class="subtitle">${tipoLabel} — ${opts.plantNombre}</p>
        </div>
        <div class="body">
          <div class="info-grid">
            <div class="info-row">
              <span class="info-label">Instrumento</span>
              <span class="info-value">${opts.instrumentNombre}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Código</span>
              <span class="info-value">${opts.instrumentCodigo}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Tipo</span>
              <span class="info-value">${tipoInstrLabel[opts.instrumentTipo] ?? opts.instrumentTipo}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Planta</span>
              <span class="info-value">${opts.plantNombre}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Tipo de evento</span>
              <span class="info-value">${tipoLabel}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Fecha programada</span>
              <span class="info-value">${opts.fechaProgramada}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Estado actual</span>
              <span class="info-value">${estadoChip}</span>
            </div>
          </div>

          <p style="color: #475569; font-size: 14px; margin: 0 0 20px;">
            ${isUrgent
              ? `Este instrumento tiene un evento de calibración programado para <strong>mañana</strong>. Asegúrate de que el laboratorio o técnico responsable esté listo para proceder.`
              : `Este instrumento tiene un evento de calibración programado en <strong>${opts.daysUntil} días</strong>. Coordina con el laboratorio externo o técnico interno para garantizar la continuidad de la trazabilidad EMA.`
            }
          </p>

          <div class="btn-row">
            <a href="${FRONTEND_URL}/quality/instrumentos/${opts.instrumentId}" class="btn btn-primary">
              Ver instrumento →
            </a>
          </div>
        </div>
        <div class="footer">
          Este mensaje fue generado automáticamente por el sistema de trazabilidad EMA · DC Concretos
        </div>
      </div>
    </div>
  </body>
  </html>`;

  return { subject, html };
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (!res.ok) {
    console.error(`SendGrid error for ${to}: ${await res.text()}`);
  }
  return res.ok;
}

serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY!);

    const today7 = dateOffset(7);
    const today1 = dateOffset(1);

    // --- Fetch entries due in exactly 7 days (notif not yet sent) ---
    const { data: entries7, error: err7 } = await supabase
      .from('programa_calibraciones')
      .select(`
        id, tipo_evento, fecha_programada, roles_notificar,
        instrumento:instrumento_id (
          id, codigo, nombre, tipo, estado,
          plant:plant_id (id, name)
        )
      `)
      .eq('estado', 'pendiente')
      .eq('fecha_programada', today7)
      .eq('notif_7dias_enviada', false);

    if (err7) {
      console.error('Error fetching 7-day entries:', err7);
    }

    // --- Fetch entries due in exactly 1 day (notif not yet sent) ---
    const { data: entries1, error: err1 } = await supabase
      .from('programa_calibraciones')
      .select(`
        id, tipo_evento, fecha_programada, roles_notificar,
        instrumento:instrumento_id (
          id, codigo, nombre, tipo, estado,
          plant:plant_id (id, name)
        )
      `)
      .eq('estado', 'pendiente')
      .eq('fecha_programada', today1)
      .eq('notif_1dia_enviada', false);

    if (err1) {
      console.error('Error fetching 1-day entries:', err1);
    }

    let totalSent = 0;

    const processEntries = async (
      entries: any[],
      daysUntil: number,
      markField: 'notif_7dias_enviada' | 'notif_1dia_enviada'
    ) => {
      for (const entry of entries ?? []) {
        const instrumento = entry.instrumento;
        if (!instrumento) continue;

        const plant = instrumento.plant;
        if (!plant) continue;

        // Get recipients: users with matching roles + (no plant_id OR plant_id matches)
        const roles: string[] = entry.roles_notificar ?? ['QUALITY_TEAM', 'PLANT_MANAGER'];
        const { data: recipients } = await supabase
          .from('user_profiles')
          .select('email, first_name, last_name')
          .in('role', roles)
          .or(`plant_id.is.null,plant_id.eq.${plant.id}`);

        if (!recipients || recipients.length === 0) {
          console.log(`No recipients for programa entry ${entry.id}`);
          // Still mark as sent to avoid re-querying empty sets
          await supabase
            .from('programa_calibraciones')
            .update({ [markField]: true })
            .eq('id', entry.id);
          continue;
        }

        const { subject, html } = buildEmail({
          daysUntil,
          instrumentId: instrumento.id,
          instrumentCodigo: instrumento.codigo,
          instrumentNombre: instrumento.nombre,
          instrumentTipo: instrumento.tipo,
          plantNombre: plant.name,
          tipoEvento: entry.tipo_evento,
          fechaProgramada: entry.fecha_programada,
          estadoActual: instrumento.estado,
        });

        let anySent = false;
        for (const recipient of recipients) {
          const ok = await sendEmail(recipient.email, subject, html);
          if (ok) {
            totalSent++;
            anySent = true;
          }
        }

        if (anySent) {
          await supabase
            .from('programa_calibraciones')
            .update({ [markField]: true })
            .eq('id', entry.id);
        }
      }
    };

    await processEntries(entries7 ?? [], 7, 'notif_7dias_enviada');
    await processEntries(entries1 ?? [], 1, 'notif_1dia_enviada');

    return new Response(
      JSON.stringify({ success: true, emailsSent: totalSent }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
