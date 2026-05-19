import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { previewBudget } from '@/services/emaUncertaintyService';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const result = await previewBudget(id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    // User-facing validation errors (e.g. too few replicas) → 422, not 500
    const isValidationError =
      err instanceof Error &&
      (message.includes('réplicas') || message.includes('mensurando') || message.includes('Estudio'));
    const status = isValidationError ? 422 : 500;
    if (!isValidationError) {
      console.error('[POST /api/ema/uncertainty/studies/[id]/preview]', err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
