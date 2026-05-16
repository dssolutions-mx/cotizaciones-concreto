// SAT CFDI 4.0 catalogs — abbreviated to the codes most commonly used in
// supplier invoicing. Full catalogs are at
// http://omawww.sat.gob.mx/tramitesyservicios/Paginas/catalogos_emision_cfdi_complemento_pagos.htm

export const c_FormaPago: Array<{ code: string; label: string }> = [
  { code: '01', label: '01 — Efectivo' },
  { code: '02', label: '02 — Cheque nominativo' },
  { code: '03', label: '03 — Transferencia electrónica de fondos' },
  { code: '04', label: '04 — Tarjeta de crédito' },
  { code: '05', label: '05 — Monedero electrónico' },
  { code: '06', label: '06 — Dinero electrónico' },
  { code: '08', label: '08 — Vales de despensa' },
  { code: '12', label: '12 — Dación en pago' },
  { code: '13', label: '13 — Pago por subrogación' },
  { code: '14', label: '14 — Pago por consignación' },
  { code: '15', label: '15 — Condonación' },
  { code: '17', label: '17 — Compensación' },
  { code: '23', label: '23 — Novación' },
  { code: '24', label: '24 — Confusión' },
  { code: '25', label: '25 — Remisión de deuda' },
  { code: '26', label: '26 — Prescripción o caducidad' },
  { code: '27', label: '27 — A satisfacción del acreedor' },
  { code: '28', label: '28 — Tarjeta de débito' },
  { code: '29', label: '29 — Tarjeta de servicios' },
  { code: '30', label: '30 — Aplicación de anticipos' },
  { code: '31', label: '31 — Intermediario pagos' },
  { code: '99', label: '99 — Por definir' },
]

export const c_MetodoPago: Array<{ code: string; label: string }> = [
  { code: 'PUE', label: 'PUE — Pago en una sola exhibición' },
  { code: 'PPD', label: 'PPD — Pago en parcialidades o diferido' },
]

export const c_UsoCFDI: Array<{ code: string; label: string }> = [
  { code: 'G01', label: 'G01 — Adquisición de mercancías' },
  { code: 'G02', label: 'G02 — Devoluciones, descuentos o bonificaciones' },
  { code: 'G03', label: 'G03 — Gastos en general' },
  { code: 'I01', label: 'I01 — Construcciones' },
  { code: 'I02', label: 'I02 — Mobiliario y equipo de oficina' },
  { code: 'I03', label: 'I03 — Equipo de transporte' },
  { code: 'I04', label: 'I04 — Equipo de cómputo y accesorios' },
  { code: 'I05', label: 'I05 — Dados, troqueles, moldes, matrices y herramental' },
  { code: 'I06', label: 'I06 — Comunicaciones telefónicas' },
  { code: 'I07', label: 'I07 — Comunicaciones satelitales' },
  { code: 'I08', label: 'I08 — Otra maquinaria y equipo' },
  { code: 'D01', label: 'D01 — Honorarios médicos, dentales y gastos hospitalarios' },
  { code: 'P01', label: 'P01 — Por definir' },
  { code: 'S01', label: 'S01 — Sin efectos fiscales' },
  { code: 'CP01', label: 'CP01 — Pagos' },
  { code: 'CN01', label: 'CN01 — Nómina' },
]

export const c_TipoDeComprobante: Array<{ code: 'I' | 'E' | 'P' | 'N' | 'T'; label: string }> = [
  { code: 'I', label: 'I — Ingreso' },
  { code: 'E', label: 'E — Egreso (Nota de crédito)' },
  { code: 'P', label: 'P — Pago (REP)' },
  { code: 'N', label: 'N — Nómina' },
  { code: 'T', label: 'T — Traslado' },
]

export function labelForFormaPago(code: string | null | undefined): string {
  if (!code) return ''
  return c_FormaPago.find((f) => f.code === code)?.label ?? code
}
export function labelForMetodoPago(code: string | null | undefined): string {
  if (!code) return ''
  return c_MetodoPago.find((m) => m.code === code)?.label ?? code
}
export function labelForUsoCFDI(code: string | null | undefined): string {
  if (!code) return ''
  return c_UsoCFDI.find((u) => u.code === code)?.label ?? code
}
