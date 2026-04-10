import { NextResponse } from 'next/server'
import { format, subDays } from 'date-fns'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const ARCHIVE_ROLES = ['QUALITY_TEAM', 'EXECUTIVE']

/** POST: mark PENDIENTE muestras with fecha_programada_ensayo older than cutoff as NO_REALIZADO */
export async function POST() {
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
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !ARCHIVE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const cutoff = format(subDays(new Date(), 60), 'yyyy-MM-dd')
    const nowIso = new Date().toISOString()

    const { count, error: countError } = await supabase
      .from('muestras')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'PENDIENTE')
      .lt('fecha_programada_ensayo', cutoff)

    if (countError) {
      console.error('[archive-stale] count', countError)
      return NextResponse.json({ error: 'Error al contar muestras' }, { status: 500 })
    }

    const { error: updateError } = await supabase
      .from('muestras')
      .update({ estado: 'NO_REALIZADO', updated_at: nowIso })
      .eq('estado', 'PENDIENTE')
      .lt('fecha_programada_ensayo', cutoff)

    if (updateError) {
      console.error('[archive-stale] update', updateError)
      return NextResponse.json({ error: 'Error al archivar muestras' }, { status: 500 })
    }

    return NextResponse.json({ archived: count ?? 0 })
  } catch (e) {
    console.error('[archive-stale]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
