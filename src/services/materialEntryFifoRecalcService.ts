import type { SupabaseClient } from '@supabase/supabase-js';
import { autoAllocateRemisionFIFO } from '@/services/fifoPricingService';

export type FifoRecalcBeforeEntryDeleteResult =
  | { ok: true; remisionIds: string[] }
  | {
      ok: false;
      message: string;
      remisionErrors?: Array<{ remision_id: string; errors: string[] }>;
    };

/**
 * When a material entry has FIFO allocations, deleting it requires re-running FIFO on every
 * affected remisión with this layer excluded; otherwise the same layer would be consumed again.
 */
export async function recalculateFifoBeforeDeletingEntry(
  supabase: SupabaseClient,
  entryId: string,
  userId: string
): Promise<FifoRecalcBeforeEntryDeleteResult> {
  const { data: allocRows, error: allocQErr } = await supabase
    .from('material_consumption_allocations')
    .select('remision_id')
    .eq('entry_id', entryId);

  if (allocQErr) {
    return { ok: false, message: allocQErr.message };
  }

  const remisionIds = [
    ...new Set(
      (allocRows ?? [])
        .map((r) => r.remision_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];

  if (remisionIds.length === 0) {
    return { ok: true, remisionIds: [] };
  }

  const { error: exErr } = await supabase
    .from('material_entries')
    .update({ excluded_from_fifo: true })
    .eq('id', entryId);

  if (exErr) {
    return {
      ok: false,
      message: `No se pudo excluir la entrada del costeo FIFO: ${exErr.message}`,
    };
  }

  const remisionErrors: Array<{ remision_id: string; errors: string[] }> = [];

  for (const remisionId of remisionIds) {
    const result = await autoAllocateRemisionFIFO(remisionId, userId);
    if (!result.success || result.errors.length > 0) {
      remisionErrors.push({
        remision_id: remisionId,
        errors: result.errors.map((e) => e.error),
      });
    }
  }

  const rollback = async () => {
    await supabase.from('material_entries').update({ excluded_from_fifo: false }).eq('id', entryId);
    for (const remisionId of remisionIds) {
      await autoAllocateRemisionFIFO(remisionId, userId);
    }
  };

  if (remisionErrors.length > 0) {
    await rollback();
    return {
      ok: false,
      message:
        'No se pudo reasignar el costeo FIFO para todas las remisiones afectadas. Se revirtió el intento.',
      remisionErrors,
    };
  }

  const { count, error: cntErr } = await supabase
    .from('material_consumption_allocations')
    .select('id', { count: 'exact', head: true })
    .eq('entry_id', entryId);

  if (cntErr) {
    await rollback();
    return { ok: false, message: cntErr.message };
  }

  if ((count ?? 0) > 0) {
    await rollback();
    return {
      ok: false,
      message: `Aún existen asignaciones FIFO (${count}) vinculadas a esta entrada tras el recálculo. Operación abortada.`,
    };
  }

  await supabase.from('material_entries').update({ excluded_from_fifo: false }).eq('id', entryId);

  return { ok: true, remisionIds };
}
