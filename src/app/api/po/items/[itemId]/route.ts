import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { POItemUpdateSchema } from '@/lib/validations/po';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let payload: z.infer<typeof POItemUpdateSchema>;
  try {
    const body = await request.json();
    payload = POItemUpdateSchema.parse({ ...body, id: itemId });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: err.flatten() },
        { status: 400 }
      );
    }
    throw err;
  }

  const { id, ...update } = payload;

  const { data, error } = await supabase
    .from('purchase_order_items')
    .update(update)
    .eq('id', itemId)
    .select('*')
    .single();

  if (error) {
    console.error('PO item update failed:', error.message);
    return NextResponse.json({ error: 'Failed to update PO item' }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Check if item has linked entries
  const { data: linkedEntries } = await supabase
    .from('material_entries')
    .select('id')
    .eq('po_item_id', itemId)
    .limit(1);

  if (linkedEntries && linkedEntries.length > 0) {
    return NextResponse.json(
      { error: 'No se puede eliminar este ítem porque tiene entradas vinculadas' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('purchase_order_items')
    .delete()
    .eq('id', itemId);

  if (error) return NextResponse.json({ error: 'Failed to delete PO item' }, { status: 500 });
  return NextResponse.json({ success: true });
}


