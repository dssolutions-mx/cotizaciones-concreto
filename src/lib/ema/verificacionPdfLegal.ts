/** Declaraciones de trazabilidad para registros de verificación interna (NMX-EC-17025-IMNC-2018 §7.2, §7.6, §7.8). */
export const VERIFICACION_PDF_LEGAL_DECLARATIONS = [
  'Este registro documenta la verificación interna del estado de funcionamiento del equipo de medición, conforme al procedimiento del laboratorio y a la norma de referencia indicada.',
  'Los patrones de medición utilizados se encuentran calibrados o verificados y son trazables a patrones nacionales o internacionales, según corresponda.',
  'Los resultados consignados reflejan las condiciones ambientales y el estado del equipo al momento de la verificación.',
  'El dictamen de conformidad se basa en los criterios de aceptación definidos en el formato de verificación vigente al momento de la ejecución.',
  'Documento controlado por el sistema de gestión de la calidad del laboratorio. Copia no controlada si se reproduce fuera del sistema.',
] as const

export const VERIFICACION_ESTADO_LABEL: Record<string, string> = {
  cerrado: 'Cerrada',
  en_proceso: 'En proceso',
  firmado_operador: 'Firmada por operador',
  firmado_revisor: 'Firmada por revisor',
  cancelado: 'Cancelada',
}
