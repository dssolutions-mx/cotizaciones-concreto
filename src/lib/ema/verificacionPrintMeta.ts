import type { CompletedVerificacionDetalle } from '@/types/ema'
import type { CompletedVerificacionFichaProps } from '@/components/ema/CompletedVerificacionFicha'

export const VERIFICACION_RESULTADO_LABEL: Record<string, string> = {
  conforme: 'Conforme',
  no_conforme: 'No conforme',
  condicional: 'Condicional',
  pendiente: 'Pendiente',
}

export function formatVerificacionCondiciones(
  c: CompletedVerificacionDetalle['condiciones_ambientales'],
): string | null {
  if (!c) return null
  return (
    [
      c.temperatura && `Temp: ${c.temperatura}`,
      c.humedad && `Hum: ${c.humedad}`,
      c.lugar,
    ]
      .filter(Boolean)
      .join(' · ') || null
  )
}

export function verificacionPrintMeta(
  data: CompletedVerificacionDetalle,
): NonNullable<CompletedVerificacionFichaProps['meta']> {
  return {
    instrumentoCodigo: data.instrumento?.codigo,
    instrumentoNombre: data.instrumento?.nombre,
    fechaVerificacion: data.fecha_verificacion,
    fechaProxima: data.fecha_proxima_verificacion,
    resultado: VERIFICACION_RESULTADO_LABEL[data.resultado] ?? data.resultado,
    verificador: data.created_by_profile?.full_name ?? null,
    condiciones: formatVerificacionCondiciones(data.condiciones_ambientales),
    observaciones: data.observaciones_generales,
  }
}
