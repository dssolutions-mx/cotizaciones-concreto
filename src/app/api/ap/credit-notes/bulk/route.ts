import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createCreditNote, type CreateCreditNoteInput } from '@/lib/ap/createCreditNote'

const WRITE_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS']

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const notes: CreateCreditNoteInput[] = body?.credit_notes
    if (!Array.isArray(notes) || notes.length === 0) {
      return NextResponse.json({ error: 'credit_notes es requerido' }, { status: 400 })
    }

    const created: Array<{ cfdi_uuid: string; credit_note_id: string }> = []
    const failed: Array<{ cfdi_uuid: string; error: string }> = []

    for (const note of notes) {
      const uuid = note.cfdi_uuid ?? ''
      const result = await createCreditNote(supabase, user.id, {
        ...note,
        cfdi_capture_mode: note.cfdi_capture_mode ?? (note.cfdi_uuid ? 'cfdi' : 'manual'),
      })
      if (result.ok) {
        created.push({
          cfdi_uuid: uuid,
          credit_note_id: String((result.credit_note as { id: string }).id),
        })
      } else {
        failed.push({ cfdi_uuid: uuid, error: result.error })
      }
    }

    return NextResponse.json({ created, failed })
  } catch (err) {
    console.error('POST /api/ap/credit-notes/bulk error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
