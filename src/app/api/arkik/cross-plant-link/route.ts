import { NextRequest, NextResponse } from 'next/server';
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const supabaseAdmin = createAdminClientForApi();

export interface CrossPlantLinkRequest {
  source_remision_id: string;   // Plant B's #Y ID (just created)
  source_plant_id: string;      // Plant B
  target_remision_number: string; // Plant A's #X remision number
  target_plant_id: string;      // Plant A
  session_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (isUsingFallbackEnv) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    const body = await request.json() as CrossPlantLinkRequest;
    const { source_remision_id, source_plant_id, target_remision_number, target_plant_id, session_id } = body;

    if (!source_remision_id || !source_plant_id || !target_remision_number || !target_plant_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Look up Plant A's billing remision (service role bypasses RLS)
    const { data: targetRemision, error: lookupError } = await supabaseAdmin
      .from('remisiones')
      .select('id, remision_number, plant_id')
      .eq('remision_number', target_remision_number.trim())
      .eq('plant_id', target_plant_id)
      .eq('is_production_record', false)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (!targetRemision) {
      // Plant A hasn't uploaded yet — store as pending link for auto-resolution
      const { error: pendingError } = await supabaseAdmin
        .from('cross_plant_pending_links')
        .insert({
          source_remision_id,
          source_plant_id,
          target_remision_number: target_remision_number.trim(),
          target_plant_id,
          session_id,
        });

      if (pendingError) {
        console.error('[cross-plant-link] Error storing pending link:', pendingError);
        return NextResponse.json({ error: pendingError.message }, { status: 500 });
      }

      console.log(`[cross-plant-link] Pending link stored: ${source_remision_id} → ${target_remision_number} @ ${target_plant_id}`);
      return NextResponse.json({ status: 'pending', message: 'Vínculo pendiente almacenado. Se resolverá automáticamente cuando la planta de facturación suba su archivo.' });
    }

    // Both sides exist — resolve bidirectionally
    const [updateSource, updateTarget] = await Promise.all([
      supabaseAdmin
        .from('remisiones')
        .update({
          cross_plant_billing_remision_id: targetRemision.id,
          cross_plant_billing_plant_id: target_plant_id,
        })
        .eq('id', source_remision_id),

      supabaseAdmin
        .from('remisiones')
        .update({
          cross_plant_billing_remision_id: source_remision_id,
          cross_plant_billing_plant_id: source_plant_id,
        })
        .eq('id', targetRemision.id),
    ]);

    if (updateSource.error) {
      return NextResponse.json({ error: `Error updating source: ${updateSource.error.message}` }, { status: 500 });
    }
    if (updateTarget.error) {
      return NextResponse.json({ error: `Error updating target: ${updateTarget.error.message}` }, { status: 500 });
    }

    console.log(`[cross-plant-link] ✅ Bidirectional link resolved: ${source_remision_id} ↔ ${targetRemision.id}`);
    return NextResponse.json({
      status: 'resolved',
      source_remision_id,
      target_remision_id: targetRemision.id,
      target_remision_number: targetRemision.remision_number,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
