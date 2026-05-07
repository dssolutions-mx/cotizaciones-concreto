import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const PROPERTY_KEYS = [
  'resistencia_compresion', 'tiempo_fraguado_inicial', 'tiempo_fraguado_final',
  'ph', 'densidad_aditivo', 'peso_volumetrico_suelto', 'peso_volumetrico_compactado',
  'densidad_agregado', 'absorcion', 'modulo_finura', 'perdida_lavado',
] as const

type PropKey = typeof PROPERTY_KEYS[number]

function computeStats(values: number[]) {
  if (values.length === 0) return { mean: null, stdDev: null, cv: null, count: 0, min: null, max: null }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  const stdDev = Math.sqrt(variance)
  const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : null
  return {
    mean: +mean.toFixed(6),
    stdDev: +stdDev.toFixed(6),
    cv: cv != null ? +cv.toFixed(2) : null,
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

/** Derive a display-friendly category from category + aggregate_type */
function effectiveCategory(category: string, aggregateType: string | null, subcategory?: string | null): string {
  if (category !== 'agregado') return category
  if (aggregateType === 'AR') return 'arena'
  if (aggregateType === 'GR') return 'grava'
  const sub = (subcategory ?? '').toLowerCase()
  if (sub.includes('fino') || sub.includes('arena')) return 'arena'
  if (sub.includes('grueso') || sub.includes('grava')) return 'grava'
  return 'agregado'
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    if (!supabase) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['QUALITY_TEAM', 'EXECUTIVE'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const plantId = searchParams.get('plant_id')

    // ── 1. Fetch all active materials ──────────────────────────────────────
    let matQuery = supabase
      .from('materials')
      .select('id, material_name, category, subcategory, aggregate_type, plant_id, supplier_id, plants(id, name, code), suppliers(id, name)')
      .eq('is_active', true)
      .order('material_name')

    if (plantId) matQuery = matQuery.eq('plant_id', plantId)

    const { data: materials, error: matErr } = await matQuery
    if (matErr) throw matErr

    if (!materials || materials.length === 0) {
      return NextResponse.json({ materials: [] })
    }

    const materialIds = materials.map((m) => m.id)

    // ── 2. Fetch all readings for these materials in one query ─────────────
    const { data: allReadings, error: readingsErr } = await supabase
      .from('material_property_readings')
      .select(`id, material_id, reading_date, source, ${PROPERTY_KEYS.join(', ')}`)
      .in('material_id', materialIds)
      .order('reading_date', { ascending: true })

    if (readingsErr) throw readingsErr

    // ── 3. Group readings by material_id and compute stats ─────────────────
    const readingsByMaterial = new Map<string, typeof allReadings>()
    for (const r of allReadings ?? []) {
      if (!readingsByMaterial.has(r.material_id)) readingsByMaterial.set(r.material_id, [])
      readingsByMaterial.get(r.material_id)!.push(r)
    }

    const summaries = materials.map((mat) => {
      const readings = readingsByMaterial.get(mat.id) ?? []
      const readingCount = readings.length
      const lastReadingDate = readingCount > 0 ? readings[readings.length - 1].reading_date : null

      // Compute stats per property
      const stats: Record<string, ReturnType<typeof computeStats>> = {}
      for (const key of PROPERTY_KEYS) {
        const vals = readings.map((r) => r[key as keyof typeof r] as number | null).filter((v): v is number => v != null)
        stats[key] = computeStats(vals)
      }

      // Derive pv_promedio per reading (avg of suelto + compactado)
      const pvPromedioVals = readings.map((r) => {
        const s = r.peso_volumetrico_suelto as number | null
        const c = r.peso_volumetrico_compactado as number | null
        if (s != null && c != null) return (s + c) / 2
        return s ?? c ?? null
      }).filter((v): v is number => v != null)
      stats['pv_promedio'] = computeStats(pvPromedioVals)

      // Sparkline: last 12 reading dates + values per property
      const recent = readings.slice(-12)
      const sparklines: Record<string, Array<{ date: string; value: number }>> = {}
      for (const key of PROPERTY_KEYS) {
        const pts = recent
          .filter((r) => r[key as keyof typeof r] != null)
          .map((r) => ({ date: r.reading_date, value: r[key as keyof typeof r] as number }))
        if (pts.length > 0) sparklines[key] = pts
      }
      // pv_promedio sparkline
      const pvPts = recent.map((r) => {
        const s = r.peso_volumetrico_suelto as number | null
        const c = r.peso_volumetrico_compactado as number | null
        const v = s != null && c != null ? (s + c) / 2 : (s ?? c ?? null)
        return v != null ? { date: r.reading_date, value: v } : null
      }).filter((p): p is { date: string; value: number } => p != null)
      if (pvPts.length > 0) sparklines['pv_promedio'] = pvPts

      // Detect out-of-control on last reading
      const alertKeys = [...PROPERTY_KEYS, 'pv_promedio'] as const
      let hasAlert = false
      for (const key of alertKeys) {
        const stat = stats[key]
        if (!stat.mean || !stat.stdDev || stat.count < 4) continue
        const ucl = stat.mean + 3 * stat.stdDev
        const lcl = stat.mean - 3 * stat.stdDev
        const last = sparklines[key]?.slice(-1)[0]?.value
        if (last != null && (last > ucl || (lcl > 0 && last < lcl))) { hasAlert = true; break }
      }

      const effCat = effectiveCategory(mat.category, mat.aggregate_type, mat.subcategory)

      return {
        id: mat.id,
        material_name: mat.material_name,
        category: mat.category,
        effective_category: effCat,
        subcategory: mat.subcategory,
        aggregate_type: mat.aggregate_type,
        plant_id: mat.plant_id,
        plants: mat.plants,
        suppliers: mat.suppliers,
        readingCount,
        lastReadingDate,
        stats,
        sparklines,
        hasAlert,
      }
    })

    return NextResponse.json({ materials: summaries })
  } catch (err) {
    console.error('[materials/summary]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
