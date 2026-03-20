import { NextRequest, NextResponse } from 'next/server';
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const supabaseAdmin = createAdminClientForApi();

interface ResolvePendingLinksRequest {
  plant_id: string;          // Plant that just uploaded (becomes the billing/target plant)
  remision_numbers: string[]; // Newly created remision numbers to check against pending links
}

/**
 * POST /api/arkik/resolve-pending-links
 *
 * Called after a plant uploads their Arkik file to auto-resolve any pending cross-plant
 * links where another plant was waiting for THIS plant's remisiones to be created.
 *
 * Scenario: Plant B uploaded first and stored pending links pointing at Plant A.
 * When Plant A uploads, this endpoint resolves those links bidirectionally.
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (isUsingFallbackEnv) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    const body = await request.json() as ResolvePendingLinksRequest;
    const { plant_id, remision_numbers } = body;

    if (!plant_id || !remision_numbers?.length) {
      return NextResponse.json({ resolved: 0 }, { status: 200 });
    }

    // Find pending links where this plant's remisiones are the target
    const { data: pendingLinks, error: fetchError } = await supabaseAdmin
      .from('cross_plant_pending_links')
      .select('id, source_remision_id, source_plant_id, target_remision_number')
      .eq('target_plant_id', plant_id)
      .in('target_remision_number', remision_numbers);

    if (fetchError) {
      console.error('[resolve-pending-links] Error fetching pending links:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingLinks || pendingLinks.length === 0) {
      return NextResponse.json({ resolved: 0 });
    }

    console.log(`[resolve-pending-links] Found ${pendingLinks.length} pending links to resolve for plant ${plant_id}`);

    let resolved = 0;
    const resolvedIds: string[] = [];

    for (const link of pendingLinks) {
      // Look up the newly created billing remision (Plant A's #X)
      const { data: targetRemision, error: lookupError } = await supabaseAdmin
        .from('remisiones')
        .select('id, remision_number')
        .eq('remision_number', link.target_remision_number)
        .eq('plant_id', plant_id)
        .eq('is_production_record', false)
        .maybeSingle();

      if (lookupError || !targetRemision) {
        console.warn(`[resolve-pending-links] Could not find remision ${link.target_remision_number} in plant ${plant_id}`);
        continue;
      }

      // Resolve bidirectionally
      const [updateSource, updateTarget] = await Promise.all([
        supabaseAdmin
          .from('remisiones')
          .update({
            cross_plant_billing_remision_id: targetRemision.id,
            cross_plant_billing_plant_id: plant_id,
          })
          .eq('id', link.source_remision_id),

        supabaseAdmin
          .from('remisiones')
          .update({
            cross_plant_billing_remision_id: link.source_remision_id,
            cross_plant_billing_plant_id: link.source_plant_id,
          })
          .eq('id', targetRemision.id),
      ]);

      if (updateSource.error) {
        console.error(`[resolve-pending-links] Error updating source ${link.source_remision_id}:`, updateSource.error);
        continue;
      }
      if (updateTarget.error) {
        console.error(`[resolve-pending-links] Error updating target ${targetRemision.id}:`, updateTarget.error);
        continue;
      }

      resolvedIds.push(link.id);
      resolved++;
      console.log(`[resolve-pending-links] ✅ Resolved: ${link.source_remision_id} ↔ ${targetRemision.id} (${link.target_remision_number})`);
    }

    // Delete resolved pending links
    if (resolvedIds.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('cross_plant_pending_links')
        .delete()
        .in('id', resolvedIds);

      if (deleteError) {
        console.error('[resolve-pending-links] Error deleting resolved pending links:', deleteError);
        // Non-critical — links resolved but not cleaned up; next run will skip them since remision is already linked
      }
    }

    return NextResponse.json({ resolved });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
