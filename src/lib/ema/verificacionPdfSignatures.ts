import type { CompletedVerificacionDetalle, VerificacionSignature } from '@/types/ema'

export type VerificacionPdfSignatureSlot = {
  name: string
  signedAt: string | null
  imageUrl: string | null
}

function formatSignedAt(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

function slotFromSignature(sig: VerificacionSignature): VerificacionPdfSignatureSlot {
  return {
    name: sig.signer_name,
    signedAt: formatSignedAt(sig.signed_at),
    imageUrl: sig.signature_url ?? null,
  }
}

/** Who performed / registered the verification (operator). */
export function resolveVerificacionRealizoSlot(
  data: CompletedVerificacionDetalle,
): VerificacionPdfSignatureSlot {
  const elaborado = data.signatures?.find((s) => s.rol === 'elaborado')
  if (elaborado) return slotFromSignature(elaborado)

  const creator = data.created_by_profile?.full_name?.trim()
  if (creator) {
    return {
      name: creator,
      signedAt: formatSignedAt(data.created_at),
      imageUrl: null,
    }
  }

  return {
    name: '—',
    signedAt: formatSignedAt(data.created_at),
    imageUrl: null,
  }
}

/** Who supervised / reviewed the verification (technical reviewer). */
export function resolveVerificacionSupervisoSlot(
  data: CompletedVerificacionDetalle,
): VerificacionPdfSignatureSlot {
  const revisado = data.signatures?.find((s) => s.rol === 'revisado')
  if (revisado) return slotFromSignature(revisado)

  return {
    name: '—',
    signedAt: null,
    imageUrl: null,
  }
}
