import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'QUALITY_TEAM']
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    let plantId = searchParams.get('plant_id') || profile.plant_id

    if (profile.role !== 'EXECUTIVE' && plantId !== profile.plant_id) {
      plantId = profile.plant_id
    }

    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Run all queries in parallel
    const [
      muestreosToday,
      pendingEnsayos,
      recentEnsayos,
      estudiosCount,
      suppliersCount,
      caracterizacionesCount,
      materialsCount,
      recipesCount,
      arkikPending,
      recentActivity,
    ] = await Promise.all([
      // OPERACIONES: today's muestreos
      supabase
        .from('muestreos')
        .select('id', { count: 'exact', head: true })
        .eq('plant_id', plantId)
        .gte('fecha_muestreo', today),

      // OPERACIONES: pending ensayos (scheduled for today, not yet done)
      supabase
        .from('muestras')
        .select('id', { count: 'exact', head: true })
        .eq('plant_id', plantId)
        .lte('fecha_programada_ensayo', today)
        .eq('estado', 'PENDIENTE'),

      // OPERACIONES: recent ensayos (last 7 days)
      supabase
        .from('ensayos')
        .select('id', { count: 'exact', head: true })
        .gte('fecha_ensayo', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),

      // EQUIPOS: estudios count by type
      supabase
        .from('alta_estudio')
        .select('tipo_estudio')
        .eq('id_planta', plantId),

      // EQUIPOS: suppliers count
      supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true }),

      // VALIDACIONES: active characterizations
      supabase
        .from('alta_estudio')
        .select('id', { count: 'exact', head: true })
        .eq('id_planta', plantId)
        .contains('tipo_estudio', ['CARACTERIZACION']),

      // VALIDACIONES: materials count
      supabase
        .from('materials')
        .select('id', { count: 'exact', head: true }),

      // RECETAS: active recipes
      supabase
        .from('master_recipes')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),

      // RECETAS: pending arkik requests
      supabase
        .from('arkik_quality_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),

      // OPERACIONES: recent activity (last 10 muestreos)
      supabase
        .from('muestreos')
        .select('id, fecha_muestreo, created_at, remision_id')
        .eq('plant_id', plantId)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // Process estudios by type (tipo_estudio is text[] in DB)
    const estudios = estudiosCount.data || []
    const rowHasTipo = (e: { tipo_estudio: unknown }, tipo: string) =>
      Array.isArray(e.tipo_estudio) && e.tipo_estudio.includes(tipo)
    const certificadosCount = estudios.filter((e) => rowHasTipo(e, 'CERTIFICADO')).length
    const fichasTecnicasCount = estudios.filter((e) => rowHasTipo(e, 'FICHA_TECNICA')).length
    const hojasSeguridad = estudios.filter((e) => rowHasTipo(e, 'HOJA_SEGURIDAD')).length

    return NextResponse.json({
      success: true,
      data: {
        operaciones: {
          muestreosHoy: muestreosToday.count || 0,
          ensayosPendientes: pendingEnsayos.count || 0,
          ensayosRecientes: recentEnsayos.count || 0,
          actividadReciente: recentActivity.data || [],
        },
        equipos: {
          certificados: certificadosCount,
          fichasTecnicas: fichasTecnicasCount,
          hojasSeguridad: hojasSeguridad,
          proveedores: suppliersCount.count || 0,
        },
        validaciones: {
          caracterizacionesActivas: caracterizacionesCount.count || 0,
          materiales: materialsCount.count || 0,
        },
        recetas: {
          recetasActivas: recipesCount.count || 0,
          solicitudesArkikPendientes: arkikPending.count || 0,
        },
      },
    })
  } catch (error) {
    console.error('Hub summary error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
