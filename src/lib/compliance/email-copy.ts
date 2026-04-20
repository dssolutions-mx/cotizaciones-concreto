import type { ComplianceFinding } from '../../../supabase/functions/_shared/compliance-core';

const PAYROLL_LINE =
  'En apego a política, el día del operador podría no ser reconocido para efectos de nómina hasta que se documente la disputa. La responsabilidad es compartida entre operador (por no reportar), dosificador (por cargar sin verificar checklist) y jefe de planta (por no supervisar).';

export function buildMissingChecklistHtml(
  plantCode: string,
  date: string,
  findings: ComplianceFinding[],
): { subject: string; html: string } {
  const rows = findings
    .map((f) => {
      const d = f.details;
      return `<tr>
        <td style="padding:8px;border:1px solid #ddd">${String(d.assetId ?? '')}</td>
        <td style="padding:8px;border:1px solid #ddd">${String(d.homePlantCode ?? '')}</td>
        <td style="padding:8px;border:1px solid #ddd">${String(d.totalM3 ?? '')}</td>
        <td style="padding:8px;border:1px solid #ddd">${(d.remisionIds as string[] | undefined)?.length ?? 0}</td>
      </tr>`;
    })
    .join('');

  const subject = `[Compliance] Checklist faltante — Planta ${plantCode} — ${date}`;
  const html = `
  <p>Estimado equipo,</p>
  <p>Se detectaron unidades con remisión de concreto el <strong>${date}</strong> sin checklist del día en el sistema de mantenimiento.</p>
  <p>${PAYROLL_LINE}</p>
  <p>Favor de responder con la disputa o justificación dentro de las próximas 24 horas.</p>
  <table style="border-collapse:collapse;width:100%;max-width:720px">
    <thead>
      <tr style="background:#f3f4f6">
        <th align="left" style="padding:8px;border:1px solid #ddd">Unidad</th>
        <th align="left" style="padding:8px;border:1px solid #ddd">Planta hogar</th>
        <th align="left" style="padding:8px;border:1px solid #ddd">m³</th>
        <th align="left" style="padding:8px;border:1px solid #ddd">Remisiones</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:16px;color:#6b7280;font-size:12px">Mensaje generado por el sistema de compliance.</p>`;

  return { subject, html };
}

export function buildMissingEvidenceHtml(
  plantCode: string,
  date: string,
  findings: ComplianceFinding[],
): { subject: string; html: string } {
  const subject = `[Compliance] Evidencia de concreto faltante — Planta ${plantCode} — ${date}`;
  const rows = findings
    .map((f) => {
      const d = f.details;
      const label = String(d.order_label ?? 'Pedido');
      const who = String(d.client_label ?? '—');
      const oid = String(d.orderId ?? '');
      return `<tr>
        <td style="padding:8px;border:1px solid #ddd">${label}</td>
        <td style="padding:8px;border:1px solid #ddd">${who}</td>
        <td style="padding:8px;border:1px solid #ddd;font-size:11px;color:#6b7280">${oid}</td>
      </tr>`;
    })
    .join('');
  const html = `
  <p>Estimado equipo,</p>
  <p>Los siguientes pedidos con remisión el <strong>${date}</strong> no tienen evidencia de concreto cargada:</p>
  <table style="border-collapse:collapse;width:100%;max-width:720px">
    <thead>
      <tr style="background:#f3f4f6">
        <th align="left" style="padding:8px;border:1px solid #ddd">Pedido</th>
        <th align="left" style="padding:8px;border:1px solid #ddd">Cliente / obra</th>
        <th align="left" style="padding:8px;border:1px solid #ddd">ID sistema</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p>Favor de subir la evidencia o justificar en las próximas 24 horas.</p>`;
  return { subject, html };
}

export function buildMissingMaterialEntriesHtml(
  plantCode: string,
  date: string,
  message: string,
): { subject: string; html: string } {
  const subject = `[Compliance] Sin entradas de material — Planta ${plantCode} — ${date}`;
  const html = `
  <p>Estimado equipo,</p>
  <p><strong>${message}</strong></p>
  <p>Planta <strong>${plantCode}</strong>, fecha <strong>${date}</strong>.</p>
  <p>Favor de registrar las entradas de material correspondientes o justificar en las próximas 24 horas.</p>`;
  return { subject, html };
}

export function buildMissingPumpingHtml(
  plantCode: string,
  date: string,
  findings: ComplianceFinding[],
): { subject: string; html: string } {
  const subject = `[Compliance] Bombeo faltante — Planta ${plantCode} — ${date}`;
  const rows = findings
    .map((f) => {
      const d = f.details;
      const label = String(d.order_label ?? 'Pedido');
      const who = String(d.client_label ?? '—');
      return `<tr>
        <td style="padding:8px;border:1px solid #ddd">${label}</td>
        <td style="padding:8px;border:1px solid #ddd">${who}</td>
      </tr>`;
    })
    .join('');
  const html = `
  <p>Estimado equipo,</p>
  <p>Pedidos que requieren bombeo pero sin remisión BOMBEO el <strong>${date}</strong>:</p>
  <table style="border-collapse:collapse;width:100%;max-width:720px">
    <thead>
      <tr style="background:#f3f4f6">
        <th align="left" style="padding:8px;border:1px solid #ddd">Pedido</th>
        <th align="left" style="padding:8px;border:1px solid #ddd">Cliente / obra</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p>Favor de corregir remisiones o justificar en las próximas 24 horas.</p>`;
  return { subject, html };
}

export function buildOperatorMismatchHtml(
  plantCode: string,
  date: string,
  findings: ComplianceFinding[],
): { subject: string; html: string } {
  const subject = `[Compliance] Conductor vs operador — Planta ${plantCode} — ${date}`;
  const rows = findings
    .map((f) => {
      const d = f.details;
      const rem = String(d.remisionNumber ?? '—');
      const unit = String(d.unidad ?? '—');
      const driver = String(d.driver ?? '—');
      const op = String(d.assignedOperator ?? '—');
      return `<tr>
        <td style="padding:8px;border:1px solid #ddd">${rem}</td>
        <td style="padding:8px;border:1px solid #ddd">${unit}</td>
        <td style="padding:8px;border:1px solid #ddd">${driver}</td>
        <td style="padding:8px;border:1px solid #ddd">${op}</td>
      </tr>`;
    })
    .join('');
  const html = `
  <p>Estimado equipo,</p>
  <p>Remisiones del <strong>${date}</strong> donde el conductor no coincide con el operador asignado en mantenimiento:</p>
  <table style="border-collapse:collapse;width:100%;max-width:880px">
    <thead>
      <tr style="background:#f3f4f6">
        <th align="left" style="padding:8px;border:1px solid #ddd">Remisión</th>
        <th align="left" style="padding:8px;border:1px solid #ddd">Unidad</th>
        <th align="left" style="padding:8px;border:1px solid #ddd">Conductor (remisión)</th>
        <th align="left" style="padding:8px;border:1px solid #ddd">Operador asignado</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p>Favor de validar y corregir en las próximas 24 horas.</p>`;
  return { subject, html };
}

export function buildUnknownUnitHtml(
  plantCode: string,
  date: string,
  findings: ComplianceFinding[],
): { subject: string; html: string } {
  const subject = `[Compliance] Unidad no registrada — Planta ${plantCode} — ${date}`;
  const rows = findings
    .map((f) => {
      const d = f.details;
      return `<tr>
        <td style="padding:8px;border:1px solid #ddd">${String(d.unidad ?? '')}</td>
        <td style="padding:8px;border:1px solid #ddd">${String(d.canonical ?? '')}</td>
        <td style="padding:8px;border:1px solid #ddd;font-size:11px">${String(d.remisionId ?? '')}</td>
      </tr>`;
    })
    .join('');
  const html = `
  <p>Estimado equipo,</p>
  <p>Unidades en remisión el <strong>${date}</strong> no enlazadas a un activo en mantenimiento:</p>
  <table style="border-collapse:collapse;width:100%;max-width:720px">
    <thead>
      <tr style="background:#f3f4f6">
        <th align="left" style="padding:8px;border:1px solid #ddd">Texto remisión</th>
        <th align="left" style="padding:8px;border:1px solid #ddd">Canónico</th>
        <th align="left" style="padding:8px;border:1px solid #ddd">Remisión id</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p>Favor de crear alias o dar de alta la unidad en mantenimiento.</p>`;
  return { subject, html };
}

export function buildMissingProductionHtml(
  plantCode: string,
  date: string,
): { subject: string; html: string } {
  const subject = `[Compliance] Sin remisiones (día operando) — Planta ${plantCode} — ${date}`;
  const html = `
  <p>Estimado equipo,</p>
  <p>La planta <strong>${plantCode}</strong> está marcada como operativa el <strong>${date}</strong> pero no hay remisiones de CONCRETO registradas.</p>
  <p>Favor de registrar las remisiones correspondientes o explicar la situación en las próximas 24 horas.</p>`;
  return { subject, html };
}

export function buildMorningDigestHtml(
  date: string,
  appUrl: string,
  summaryLines: string[],
): { subject: string; html: string } {
  const subject = `[Compliance] Resumen ${date}`;
  const body = summaryLines.map((l) => `<li>${l}</li>`).join('');
  const html = `
  <p>Resumen de hallazgos (${date}):</p>
  <ul>${body}</ul>
  <p><a href="${appUrl}/production-control/daily-compliance?date=${date}">Abrir panel</a></p>`;
  return { subject, html };
}
