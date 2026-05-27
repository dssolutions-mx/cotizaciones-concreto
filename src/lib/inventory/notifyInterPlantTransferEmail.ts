/**
 * Notifies fixed recipient when an inter-plant material transfer is recorded.
 * Uses SendGrid v3; same env vars as other inventory notifications.
 */

const DEFAULT_TO = 'juan.aguirre@dssolutions-mx.com'

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

export async function sendInterPlantTransferEmail(payload: Payload): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY
  const from = process.env.NOTIFICATION_FROM_EMAIL || 'juan.aguirre@dssolutions-mx.com'
  const to = process.env.INTER_PLANT_TRANSFER_NOTIFY_EMAIL || DEFAULT_TO
  if (!apiKey) {
    console.warn('[inter-plant-transfer] SENDGRID_API_KEY not set; skip email')
    return
  }

  const sameLabel =
    payload.sourceMaterialCode === payload.destMaterialCode &&
    payload.sourceMaterialName === payload.destMaterialName

  const materialLines = sameLabel
    ? [`Material: ${payload.sourceMaterialName} (${payload.sourceMaterialCode})`]
    : [
        `Material origen: ${payload.sourceMaterialName} (${payload.sourceMaterialCode})`,
        `Material destino: ${payload.destMaterialName} (${payload.destMaterialCode})`,
      ]

  const subject = `Transferencia inter-planta: ${payload.fromPlantName} → ${payload.toPlantName}`
  const text = [
    `Nueva transferencia de material entre plantas.`,
    ``,
    `ID: ${payload.transferId}`,
    `Fecha: ${payload.transferDate}`,
    `Origen: ${payload.fromPlantName}`,
    `Destino: ${payload.toPlantName}`,
    ...materialLines,
    `Cantidad: ${payload.quantityKg} kg`,
    payload.notes ? `Notas: ${payload.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }], subject }],
      from: { email: from },
      content: [{ type: 'text/plain', value: text }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`SendGrid inter-plant transfer: ${res.status} ${errText}`)
  }
}
