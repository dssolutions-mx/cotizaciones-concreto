import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

function computeStats(values: number[]) {
  const valid = values.filter((v) => v != null && !isNaN(v))
  if (valid.length === 0) return { mean: null, stdDev: null, cv: null, count: 0, min: null, max: null }
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length
  const variance = valid.reduce((sum, v) => sum + (v - mean) ** 2, 0) / valid.length
  const stdDev = Math.sqrt(variance)
  const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : null
  return {
    mean: Math.round(mean * 10000) / 10000,
    stdDev: Math.round(stdDev * 10000) / 10000,
    cv: cv != null ? Math.round(cv * 100) / 100 : null,
    count: valid.length,
    min: Math.min(...valid),
    max: Math.max(...valid),
  }
}

const PROPERTY_KEYS = [
  'resistencia_compresion',
  'tiempo_fraguado_inicial',
  'tiempo_fraguado_final',
  'ph',
  'densidad_aditivo',
  'peso_volumetrico_suelto',
  'peso_volumetrico_compactado',
  'densidad_agregado',
  'absorcion',
  'modulo_finura',
  'perdida_lavado',
] as const

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createServerSupabaseClient()
    if (!supabase) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const { id: materialId } = await params
    const { searchParams } = new URL(request.url)
    const plantId = searchParams.get('plant_id')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

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

    // Material info with supplier
    const { data: material, error: matErr } = await supabase
      .from('materials')
      .select('*, aggregate_type, subcategory, suppliers(id, name, provider_number), plants(id, name, code)')
      .eq('id', materialId)
      .single()

    if (matErr || !material) return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 })

    // Property timeline
    let readingsQuery = supabase
      .from('material_property_readings')
      .select(`
        *,
        alta_estudio:alta_estudio_id (
          id, nombre_material, mina_procedencia, tecnico, tipo_material
        ),
        certificate:certificate_id (
          id, original_name, file_path
        )
      `)
      .eq('material_id', materialId)
      .order('reading_date', { ascending: true })

    if (plantId) readingsQuery = readingsQuery.eq('plant_id', plantId)
    if (from) readingsQuery = readingsQuery.gte('reading_date', from)
    if (to) readingsQuery = readingsQuery.lte('reading_date', to)

    const { data: readings, error: readingsErr } = await readingsQuery
    if (readingsErr) throw readingsErr

    // Stats per property
    const stats: Record<string, ReturnType<typeof computeStats>> = {}
    for (const key of PROPERTY_KEYS) {
      const values = (readings ?? [])
        .map((r) => r[key as keyof typeof r] as number | null)
        .filter((v): v is number => v != null)
      stats[key] = computeStats(values)
    }

    // Granulometry history (for agregados) — from estudios_seleccionados JSONB
    let granulometryHistory: unknown[] = []
    if (material.category === 'agregado') {
      const { data: granData } = await supabase
        .from('estudios_seleccionados')
        .select('resultados, alta_estudio:alta_estudio_id(id, fecha_muestreo, fecha_elaboracion, nombre_material, mina_procedencia)')
        .eq('nombre_estudio', 'Análisis Granulométrico')
        .not('resultados', 'is', null)
        .in(
          'alta_estudio_id',
          (await supabase
            .from('alta_estudio')
            .select('id')
            .eq('material_id', materialId)
            .then((r) => (r.data ?? []).map((x) => x.id)))
        )

      granulometryHistory = (granData ?? []).map((row) => ({
        alta_estudio: row.alta_estudio,
        mallas: (row.resultados as Record<string, unknown>)?.mallas ?? [],
        modulo_finura: (row.resultados as Record<string, unknown>)?.modulo_finura ?? null,
      }))
    }

    return NextResponse.json({
      material,
      propertyTimeline: readings ?? [],
      granulometryHistory,
      stats,
    })
  } catch (err) {
    console.error('[trend route]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
