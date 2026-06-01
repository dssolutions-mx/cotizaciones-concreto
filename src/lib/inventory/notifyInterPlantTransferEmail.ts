/**
 * Notifies fixed recipients when an inter-plant material transfer is recorded.
 * Uses SendGrid v3; same env vars as other inventory notifications.
 */

const DEFAULT_RECIPIENTS = [
  'juan.aguirre@dssolutions-mx.com',
  'asistente.contable@dcconcretos.com.mx',
]

type Payload = {
  transferId: string
  fromPlantName: string
  toPlantName: string
  sourceMaterialName: string
  sourceMaterialCode: string
  destMaterialName: string
  destMaterialCode: string
  quantityKg: number
  transferDate: string
  notes?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getRecipients(): string[] {
  const env = process.env.INTER_PLANT_TRANSFER_NOTIFY_EMAIL?.trim()
  if (env) {
    return env
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean)
  }
  return [...DEFAULT_RECIPIENTS]
}

function formatTransferDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function buildPlainText(payload: Payload, sameMaterial: boolean): string {
  const materialLines = sameMaterial
    ? [`Material: ${payload.sourceMaterialName} (${payload.sourceMaterialCode})`]
    : [
        `Material origen: ${payload.sourceMaterialName} (${payload.sourceMaterialCode})`,
        `Material destino: ${payload.destMaterialName} (${payload.destMaterialCode})`,
      ]

  return [
    'Nueva transferencia de material entre plantas.',
    '',
    `Fecha: ${formatTransferDate(payload.transferDate)}`,
    `Origen: ${payload.fromPlantName}`,
    `Destino: ${payload.toPlantName}`,
    ...materialLines,
    `Cantidad: ${payload.quantityKg.toLocaleString('es-MX')} kg`,
    payload.notes ? `Notas: ${payload.notes}` : null,
    '',
    `Referencia: ${payload.transferId}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildHtml(payload: Payload, sameMaterial: boolean, appUrl: string): string {
  const formattedDate = formatTransferDate(payload.transferDate)
  const quantity = payload.quantityKg.toLocaleString('es-MX')
  const transferUrl = `${appUrl}/production-control/transfer-between-plants`

  const materialRows = sameMaterial
    ? `<tr>
        <td style="padding:8px 0;color:#64748B;vertical-align:top;width:140px;">Material</td>
        <td style="padding:8px 0;font-weight:600;">
          ${escapeHtml(payload.sourceMaterialName)}
          <span style="color:#64748B;font-weight:500;">(${escapeHtml(payload.sourceMaterialCode)})</span>
        </td>
      </tr>`
    : `<tr>
        <td style="padding:8px 0;color:#64748B;vertical-align:top;">Material origen</td>
        <td style="padding:8px 0;font-weight:600;">
          ${escapeHtml(payload.sourceMaterialName)}
          <span style="color:#64748B;font-weight:500;">(${escapeHtml(payload.sourceMaterialCode)})</span>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#64748B;vertical-align:top;">Material destino</td>
        <td style="padding:8px 0;font-weight:600;">
          ${escapeHtml(payload.destMaterialName)}
          <span style="color:#64748B;font-weight:500;">(${escapeHtml(payload.destMaterialCode)})</span>
        </td>
      </tr>`

  const notesBlock = payload.notes
    ? `<tr>
        <td style="padding:8px 0;color:#64748B;vertical-align:top;">Notas</td>
        <td style="padding:8px 0;">${escapeHtml(payload.notes)}</td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:16px;background:#f1f5f9;">
  <div style="font-family:Calibri,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#1B365D;padding:18px 22px;border-radius:6px 6px 0 0;">
      <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">
        Inventario · Transferencia inter-planta
      </p>
      <h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:700;line-height:1.35;">
        ${escapeHtml(payload.fromPlantName)} → ${escapeHtml(payload.toPlantName)}
      </h1>
    </div>
    <div style="padding:22px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;">
      <p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.5;">
        Se registró una nueva transferencia de material entre plantas.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px 16px;margin:0 0 18px;text-align:center;">
        <p style="margin:0 0 6px;color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:0.03em;">Cantidad transferida</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#1B365D;line-height:1.2;">${quantity} <span style="font-size:16px;font-weight:600;color:#64748B;">kg</span></p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#64748B;vertical-align:top;width:140px;">Fecha</td>
          <td style="padding:8px 0;font-weight:600;">${escapeHtml(formattedDate)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748B;vertical-align:top;">Origen</td>
          <td style="padding:8px 0;font-weight:600;">${escapeHtml(payload.fromPlantName)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748B;vertical-align:top;">Destino</td>
          <td style="padding:8px 0;font-weight:600;">${escapeHtml(payload.toPlantName)}</td>
        </tr>
        ${materialRows}
        ${notesBlock}
      </table>
      <a href="${escapeHtml(transferUrl)}" style="display:inline-block;background:#00A64F;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:4px;font-weight:600;margin:20px 0 4px;">
        Ver en la aplicación
      </a>
    </div>
    <div style="padding:14px 22px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 6px 6px;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        Referencia: <span style="font-family:Consolas,'Courier New',monospace;color:#64748B;">${escapeHtml(payload.transferId)}</span>
        · DC Concretos
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function sendInterPlantTransferEmail(payload: Payload): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY
  const from = process.env.NOTIFICATION_FROM_EMAIL || 'juan.aguirre@dssolutions-mx.com'
  const recipients = getRecipients()
  if (!apiKey) {
    console.warn('[inter-plant-transfer] SENDGRID_API_KEY not set; skip email')
    return
  }
  if (recipients.length === 0) {
    console.warn('[inter-plant-transfer] no recipients configured; skip email')
    return
  }

  const sameMaterial =
    payload.sourceMaterialCode === payload.destMaterialCode &&
    payload.sourceMaterialName === payload.destMaterialName

  const subject = `Transferencia inter-planta: ${payload.fromPlantName} → ${payload.toPlantName}`
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://dcconcretos-hub.com').replace(/\/$/, '')
  const text = buildPlainText(payload, sameMaterial)
  const html = buildHtml(payload, sameMaterial, appUrl)

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: recipients.map((email) => ({ email })),
          subject,
        },
      ],
      from: { email: from, name: 'DC Concretos — Inventario' },
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`SendGrid inter-plant transfer: ${res.status} ${errText}`)
  }
}
