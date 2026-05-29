import type { createAdminClientForApi } from '@/lib/supabase/api'

export type EnsayoComplianceCtx = {
  resistencia_calculada: number | null
  factor_correccion: number | null
  specimen_type_spec_id: string | null
  fecha_ensayo: string
  fecha_ensayo_ts: string | null
  muestra?: {
    muestreo?: {
      fecha_muestreo?: string | null
      fecha_muestreo_ts?: string | null
      hora_muestreo?: string | null
      concrete_specs?: unknown
      remision?: {
        recipe?: { strength_fc?: number | null; age_days?: number | null; age_hours?: number | null } | null
      } | null
    } | null
  } | null
}

type MuestreoLite = NonNullable<EnsayoComplianceCtx['muestra']>['muestreo']

function muestreoBaseTs(muestreo: MuestreoLite | null | undefined): Date | null {
  if (!muestreo) return null
  if (muestreo.fecha_muestreo_ts) return new Date(muestreo.fecha_muestreo_ts)
  if (muestreo.fecha_muestreo) return new Date(`${muestreo.fecha_muestreo}T${muestreo.hora_muestreo || '00:00:00'}`)
  return null
}

function edadGarantiaFromCtx(ctx: EnsayoComplianceCtx): { dias: number; horas: number } {
  const r = ctx.muestra?.muestreo?.remision?.recipe
  let dias: number | null = r?.age_days != null ? Number(r.age_days) : null
  let horas: number | null = r?.age_hours != null ? Number(r.age_hours) : null
  if (horas == null && dias != null) horas = dias * 24

  let specs: Record<string, unknown> = {}
  const cs = ctx.muestra?.muestreo?.concrete_specs
  if (typeof cs === 'string') {
    try {
      specs = JSON.parse(cs) as Record<string, unknown>
    } catch {
      specs = {}
    }
  } else if (cs && typeof cs === 'object') {
    specs = cs as Record<string, unknown>
  }

  const unidad = specs.unidad_edad
  const valor = specs.valor_edad
  if (dias == null && unidad === 'DÍA' && typeof valor === 'number') dias = valor
  if (horas == null && unidad === 'HORA' && typeof valor === 'number') horas = valor
  if (horas == null && dias != null) horas = dias * 24
  if (dias == null && horas != null) dias = Math.ceil(horas / 24)

  return {
    dias: dias ?? 28,
    horas: horas ?? (dias ?? 28) * 24,
  }
}

/** Official % cumplimiento for a corrected strength (same logic as ensayos PATCH API). */
export async function computeEnsayoPorcentajeCumplimiento(
  admin: ReturnType<typeof createAdminClientForApi>,
  ctx: EnsayoComplianceCtx,
  resistenciaCorregida: number
): Promise<number> {
  const fc = ctx.muestra?.muestreo?.remision?.recipe?.strength_fc
  const strengthFc = fc != null ? Number(fc) : null
  if (!strengthFc || strengthFc <= 0 || resistenciaCorregida <= 0) return 0

  const { horas: edadGarantiaHoras, dias: edadGarantiaDias } = edadGarantiaFromCtx(ctx)
  const mTs = muestreoBaseTs(ctx.muestra?.muestreo)

  let edadEnsayoHoras: number | null = null
  if (ctx.fecha_ensayo_ts && mTs) {
    edadEnsayoHoras = Math.floor(
      (new Date(ctx.fecha_ensayo_ts).getTime() - mTs.getTime()) / 3600000
    )
  }

  if (edadEnsayoHoras != null && edadGarantiaHoras > 0) {
    const { data, error } = await admin.rpc('calcular_porcentaje_cumplimiento_horas' as never, {
      resistencia_calculada: resistenciaCorregida,
      resistencia_diseno: strengthFc,
      edad_ensayo_horas: edadEnsayoHoras,
      edad_garantia_horas: edadGarantiaHoras,
    } as never)

    if (!error && data != null && typeof data === 'number' && Number.isFinite(data)) {
      return Math.min(9999.99, Number(data))
    }
  }

  let edadEnsayoDias = 0
  if (mTs && ctx.fecha_ensayo) {
    const d0 = new Date(mTs.toISOString().split('T')[0])
    const d1 = new Date(ctx.fecha_ensayo)
    edadEnsayoDias = Math.max(0, Math.floor((d1.getTime() - d0.getTime()) / 86400000))
  }

  const { data: d2, error: e2 } = await admin.rpc('calcular_porcentaje_cumplimiento', {
    resistencia_calculada: resistenciaCorregida,
    resistencia_diseno: strengthFc,
    edad_ensayo: edadEnsayoDias,
    edad_garantia: edadGarantiaDias,
  })

  if (!e2 && d2 != null && typeof d2 === 'number' && Number.isFinite(d2)) {
    return Math.min(9999.99, Number(d2))
  }

  return Math.min(9999.99, (resistenciaCorregida / strengthFc) * 100)
}
