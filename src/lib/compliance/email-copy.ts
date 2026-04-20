import type { ComplianceFinding } from '../../../supabase/functions/_shared/compliance-core';

// ---------------------------------------------------------------------------
// Brand tokens (mirrors src/lib/reports/branding.ts DC_DOCUMENT_THEME)
// ---------------------------------------------------------------------------
const B = {
  navy:        '#1B365D',
  navyDark:    '#142848',
  green:       '#00A64F',
  white:       '#FFFFFF',
  textPrimary: '#1C1917',
  textSecondary:'#44403C',
  textMuted:   '#78716C',
  borderLight: '#E7E5E4',
  borderMedium:'#D6D3D1',
  surface:     '#FAFAF9',
  rowAlt:      '#F5F5F4',
} as const;

const CONTACT = {
  companyLine: 'DC CONCRETOS, S.A. DE C.V.',
  address:     'Carr. Silao-San Felipe km 4.1, CP 36110',
  phone:       '477-129-2394',
  email:       'ventas@dcconcretos.com.mx',
  web:         'www.dcconcretos.com.mx',
};

const PAYROLL_LINE =
  'En apego a política, el día del operador podría no ser reconocido para efectos de nómina hasta que se documente la disputa. La responsabilidad es compartida entre operador (por no reportar), dosificador (por cargar sin verificar checklist) y jefe de planta (por no supervisar).';

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:system-ui,-apple-system,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 0">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#FFFFFF;border:1px solid ${B.borderMedium};border-radius:4px;overflow:hidden">
${body}
</table>
</td></tr>
</table>
</body></html>`;
}

function header(plantCode: string, date: string, category: string): string {
  return `
<tr><td>
  <!-- Green accent bar -->
  <div style="height:4px;background:${B.green}"></div>
  <!-- Navy header -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${B.navy}">
    <tr>
      <td style="padding:18px 24px">
        <div style="color:${B.white};font-size:16px;font-weight:700;letter-spacing:0.02em">${CONTACT.companyLine}</div>
        <div style="color:#93A8C4;font-size:11px;margin-top:2px">${CONTACT.address} · ${CONTACT.phone}</div>
      </td>
      <td align="right" style="padding:18px 24px;white-space:nowrap">
        <div style="color:${B.white};font-size:13px;font-weight:600">${category}</div>
        <div style="color:#93A8C4;font-size:11px;margin-top:2px">Planta ${plantCode} · ${date}</div>
      </td>
    </tr>
  </table>
</td></tr>`;
}

function content(body: string): string {
  return `<tr><td style="padding:24px">${body}</td></tr>`;
}

function footer(): string {
  return `
<tr><td style="padding:16px 24px;background:${B.surface};border-top:1px solid ${B.borderLight}">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="font-size:11px;color:${B.textMuted}">
        <strong style="color:${B.navy}">${CONTACT.companyLine}</strong><br>
        ${CONTACT.address}<br>
        ${CONTACT.phone} · <a href="mailto:${CONTACT.email}" style="color:${B.textMuted}">${CONTACT.email}</a> · <a href="https://${CONTACT.web}" style="color:${B.textMuted}">${CONTACT.web}</a>
      </td>
      <td align="right" style="font-size:10px;color:${B.textMuted}">
        Mensaje generado automáticamente.<br>Responde con tu disputa o justificación.
      </td>
    </tr>
  </table>
</td></tr>`;
}

function p(text: string, opts?: { bold?: boolean; color?: string }): string {
  const weight = opts?.bold ? 'font-weight:600;' : '';
  const color = `color:${opts?.color ?? B.textSecondary};`;
  return `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;${color}${weight}">${text}</p>`;
}

function alertBox(text: string): string {
  return `<div style="margin:12px 0 16px;padding:12px 16px;background:#FFF8E1;border-left:4px solid #F59E0B;border-radius:0 4px 4px 0">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#92400E">${text}</p>
  </div>`;
}

function deadlineNote(hours = 24): string {
  return p(`Favor de responder dentro de las próximas <strong>${hours} horas</strong>.`);
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

function th(label: string): string {
  return `<th align="left" style="padding:8px 10px;background:${B.navy};color:${B.white};font-size:11px;font-weight:600;white-space:nowrap;border-right:1px solid #2D4D7A">${label}</th>`;
}

function td(val: unknown, opts?: { mono?: boolean; dim?: boolean; right?: boolean }): string {
  const s = (val == null || val === '') ? '—' : String(val);
  let style = `padding:7px 10px;border-bottom:1px solid ${B.borderLight};border-right:1px solid ${B.borderLight};font-size:12px;vertical-align:top;color:${B.textSecondary};`;
  if (opts?.mono)  style += `font-family:monospace;`;
  if (opts?.dim)   style += `color:${B.textMuted};font-size:11px;`;
  if (opts?.right) style += `text-align:right;`;
  return `<td style="${style}">${s}</td>`;
}

function table(headers: string[], rows: string[]): string {
  const altRows = rows.map((r, i) =>
    i % 2 === 1 ? r.replace('<tr>', `<tr style="background:${B.rowAlt}">`) : r,
  );
  return `
<div style="overflow-x:auto;margin:16px 0;border:1px solid ${B.borderMedium};border-radius:4px;overflow:hidden">
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
  <thead><tr>${headers.map(th).join('')}</tr></thead>
  <tbody>${altRows.join('')}</tbody>
</table>
</div>`;
}

function strArr(v: unknown): string {
  if (!Array.isArray(v)) return '—';
  const filtered = (v as unknown[]).map(String).filter(Boolean);
  return filtered.length ? filtered.join(', ') : '—';
}

// ---------------------------------------------------------------------------
// Email builders
// ---------------------------------------------------------------------------

export function buildMissingChecklistHtml(
  plantCode: string,
  date: string,
  findings: ComplianceFinding[],
): { subject: string; html: string } {
  const rows = findings.map((f) => {
    const d = f.details;
    const turno = d.horaFirst && d.horaLast
      ? `${String(d.horaFirst).slice(0, 5)} – ${String(d.horaLast).slice(0, 5)}`
      : d.horaFirst ? String(d.horaFirst).slice(0, 5) : null;
    return `<tr>
      ${td(d.assetId, { mono: true })}
      ${td(d.homePlantCode)}
      ${td(d.primaryOperator)}
      ${td(strArr(d.drivers))}
      ${td(strArr(d.remisionNumbers))}
      ${td(d.totalM3 != null ? `${Number(d.totalM3).toFixed(1)} m³` : null, { right: true })}
      ${td(turno)}
      ${td(strArr(d.dosificador_names))}
    </tr>`;
  });

  const subject = `[DC Concretos] Checklist faltante — Planta ${plantCode} — ${date}`;
  const html = wrap(`
    ${header(plantCode, date, 'Checklist diario faltante')}
    ${content(`
      ${p('Estimado equipo,')}
      ${p(`Las siguientes unidades realizaron remisiones de concreto el <strong>${date}</strong> en planta <strong>${plantCode}</strong> sin haber completado el <strong>checklist diario</strong> en el sistema de mantenimiento.`)}
      ${alertBox(PAYROLL_LINE)}
      ${table(
        ['Unidad', 'Planta hogar', 'Operador asignado', 'Conductor(es) en remisión', 'Remisiones', 'm³', 'Turno', 'Dosificador'],
        rows,
      )}
      ${deadlineNote()}
    `)}
    ${footer()}
  `);

  return { subject, html };
}

export function buildMissingEvidenceHtml(
  plantCode: string,
  date: string,
  findings: ComplianceFinding[],
): { subject: string; html: string } {
  const rows = findings.map((f) => {
    const d = f.details;
    return `<tr>
      ${td(d.order_label ?? '—')}
      ${td(d.client_label)}
      ${td(d.m3Total != null ? `${Number(d.m3Total).toFixed(1)} m³` : null, { right: true })}
      ${td(d.remisionCount, { right: true })}
      ${td(strArr(d.remisionNumbers))}
      ${td(strArr(d.drivers))}
      ${td(strArr(d.dosificador_names))}
    </tr>`;
  });

  const subject = `[DC Concretos] Evidencia de concreto faltante — Planta ${plantCode} — ${date}`;
  const html = wrap(`
    ${header(plantCode, date, 'Evidencia fotográfica faltante')}
    ${content(`
      ${p('Estimado equipo,')}
      ${p(`Los siguientes pedidos con remisión de concreto el <strong>${date}</strong> en planta <strong>${plantCode}</strong> <strong>no tienen evidencia fotográfica</strong> cargada en el sistema.`)}
      ${table(
        ['Pedido', 'Cliente / Obra', 'm³', '# Remisiones', 'Nums. remisión', 'Conductor(es)', 'Dosificador'],
        rows,
      )}
      ${deadlineNote()}
    `)}
    ${footer()}
  `);

  return { subject, html };
}

export function buildMissingMaterialEntriesHtml(
  plantCode: string,
  date: string,
  message: string,
  details?: Record<string, unknown>,
): { subject: string; html: string } {
  const remCount = details?.concretoRemisionCount;
  const m3 = details?.concretoM3;
  const volumeLine = (remCount != null && m3 != null)
    ? p(`Producción registrada: <strong>${String(remCount)} remisiones</strong>, <strong>${Number(m3).toFixed(1)} m³</strong>.`)
    : '';

  const subject = `[DC Concretos] Sin entradas de material — Planta ${plantCode} — ${date}`;
  const html = wrap(`
    ${header(plantCode, date, 'Sin entradas de material')}
    ${content(`
      ${p('Estimado equipo,')}
      ${alertBox(`<strong>${message}</strong>`)}
      ${p(`Planta <strong>${plantCode}</strong> · Fecha <strong>${date}</strong>.`)}
      ${volumeLine}
      ${p('Favor de registrar las entradas de material correspondientes o justificar en las próximas <strong>24 horas</strong>.')}
    `)}
    ${footer()}
  `);
  return { subject, html };
}

export function buildMissingPumpingHtml(
  plantCode: string,
  date: string,
  findings: ComplianceFinding[],
): { subject: string; html: string } {
  const rows = findings.map((f) => {
    const d = f.details;
    return `<tr>
      ${td(d.order_label ?? '—')}
      ${td(d.client_label)}
      ${td(d.concretoM3 != null ? `${Number(d.concretoM3).toFixed(1)} m³` : null, { right: true })}
      ${td(d.concretoRemisionCount, { right: true })}
      ${td(strArr(d.remisionNumbers))}
      ${td(strArr(d.drivers))}
    </tr>`;
  });

  const subject = `[DC Concretos] Bombeo sin registrar — Planta ${plantCode} — ${date}`;
  const html = wrap(`
    ${header(plantCode, date, 'Remisión de bombeo faltante')}
    ${content(`
      ${p('Estimado equipo,')}
      ${p(`Los siguientes pedidos requieren servicio de bombeo pero <strong>no tienen remisión de BOMBEO registrada</strong> el <strong>${date}</strong> en planta <strong>${plantCode}</strong>:`)}
      ${table(
        ['Pedido', 'Cliente / Obra', 'm³ concreto', '# Remisiones', 'Nums. remisión', 'Conductor(es)'],
        rows,
      )}
      ${deadlineNote()}
    `)}
    ${footer()}
  `);

  return { subject, html };
}

export function buildOperatorMismatchHtml(
  plantCode: string,
  date: string,
  findings: ComplianceFinding[],
): { subject: string; html: string } {
  const rows = findings.map((f) => {
    const d = f.details;
    const hora = d.horaCarga ? String(d.horaCarga).slice(0, 5) : null;
    return `<tr>
      ${td(d.remisionNumber, { mono: true })}
      ${td(d.unidad)}
      ${td(hora)}
      ${td(d.driver)}
      ${td(d.assignedOperator)}
      ${td(d.order_label)}
      ${td(d.client_label)}
    </tr>`;
  });

  const subject = `[DC Concretos] Conductor ≠ operador asignado — Planta ${plantCode} — ${date}`;
  const html = wrap(`
    ${header(plantCode, date, 'Conductor ≠ operador asignado')}
    ${content(`
      ${p('Estimado equipo,')}
      ${p(`Las siguientes remisiones del <strong>${date}</strong> en planta <strong>${plantCode}</strong> tienen un <strong>conductor que no coincide</strong> con el operador asignado a esa unidad en el sistema de mantenimiento:`)}
      ${table(
        ['Remisión', 'Unidad', 'Hora carga', 'Conductor (remisión)', 'Operador asignado', 'Pedido', 'Cliente / Obra'],
        rows,
      )}
      ${deadlineNote()}
    `)}
    ${footer()}
  `);

  return { subject, html };
}

export function buildUnknownUnitHtml(
  plantCode: string,
  date: string,
  findings: ComplianceFinding[],
): { subject: string; html: string } {
  const rows = findings.map((f) => {
    const d = f.details;
    const hora = d.horaCarga ? String(d.horaCarga).slice(0, 5) : null;
    return `<tr>
      ${td(d.unidad)}
      ${td(d.canonical)}
      ${td(d.remisionNumber, { mono: true })}
      ${td(hora)}
      ${td(d.driver)}
      ${td(d.remisionId, { dim: true })}
    </tr>`;
  });

  const subject = `[DC Concretos] Unidad no registrada en sistema — Planta ${plantCode} — ${date}`;
  const html = wrap(`
    ${header(plantCode, date, 'Unidad no registrada')}
    ${content(`
      ${p('Estimado equipo,')}
      ${p(`Las siguientes unidades aparecen en remisiones de concreto el <strong>${date}</strong> en planta <strong>${plantCode}</strong> pero <strong>no están dadas de alta</strong> en el sistema de mantenimiento (ni existe un alias configurado):`)}
      ${table(
        ['Texto remisión', 'Canónico resuelto', 'Num. remisión', 'Hora carga', 'Conductor', 'ID remisión'],
        rows,
      )}
      ${p('Favor de dar de alta la unidad en mantenimiento o crear el alias correspondiente.')}
    `)}
    ${footer()}
  `);

  return { subject, html };
}

export function buildMissingProductionHtml(
  plantCode: string,
  date: string,
): { subject: string; html: string } {
  const subject = `[DC Concretos] Sin remisiones registradas — Planta ${plantCode} — ${date}`;
  const html = wrap(`
    ${header(plantCode, date, 'Sin remisiones registradas')}
    ${content(`
      ${p('Estimado equipo,')}
      ${p(`La planta <strong>${plantCode}</strong> está marcada como operativa el <strong>${date}</strong> pero <strong>no tiene remisiones de CONCRETO</strong> registradas en el sistema.`)}
      ${p('Favor de registrar las remisiones correspondientes o explicar la situación en las próximas <strong>24 horas</strong>.')}
    `)}
    ${footer()}
  `);
  return { subject, html };
}

export function buildMorningDigestHtml(
  date: string,
  appUrl: string,
  summaryLines: string[],
): { subject: string; html: string } {
  const subject = `[DC Concretos] Resumen operativo — ${date}`;
  const items = summaryLines.map(
    (l) => `<li style="margin-bottom:8px;font-size:13px;color:${B.textSecondary};line-height:1.5">${l}</li>`,
  ).join('');
  const html = wrap(`
    ${header('—', date, 'Resumen operativo diario')}
    ${content(`
      ${p(`Resumen de hallazgos del día <strong>${date}</strong>:`)}
      <ul style="margin:12px 0 20px;padding-left:20px">${items}</ul>
      <a href="${appUrl}/production-control/daily-compliance?date=${date}"
         style="display:inline-block;background:${B.navy};color:${B.white};padding:10px 22px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:600">
        Abrir panel de seguimiento
      </a>
    `)}
    ${footer()}
  `);
  return { subject, html };
}
