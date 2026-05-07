import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

    const path = new URL(request.url).searchParams.get('path')
    if (!path) return NextResponse.json({ error: 'path requerido' }, { status: 400 })

    const { data, error } = await supabase.storage
      .from('material-certificates')
      .createSignedUrl(path, 300)

    if (error || !data?.signedUrl) {
      console.error('[cert download]', error)
      return NextResponse.json({ error: 'No se pudo generar enlace de descarga' }, { status: 500 })
    }

    const fileRes = await fetch(data.signedUrl)
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'No se pudo obtener el archivo' }, { status: 502 })
    }

    const filename = path.split('/').pop() ?? 'certificado.pdf'
    return new NextResponse(fileRes.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('[cert download]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
