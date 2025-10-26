import { supabase } from '@/lib/supabase/client';

export async function getVolumeByMaster(
  plantId: string,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from('remisiones')
    .select(`
      volumen_fabricado,
      master_recipe_id,
      master_recipes:master_recipe_id(
        master_code,
        display_name,
        strength_fc,
        placement_type
      )
    `)
    .eq('plant_id', plantId)
    .gte('fecha', startDate)
    .lte('fecha', endDate);
  if (error) throw error;
  const grouped: Record<string, any> = {};
  (data || []).forEach((row: any) => {
    const key = row.master_recipe_id || 'unlinked';
    if (!grouped[key]) {
      grouped[key] = {
        master_code: row.master_recipes?.master_code || '—',
        display_name: row.master_recipes?.display_name || '—',
        strength_fc: row.master_recipes?.strength_fc || null,
        placement_type: row.master_recipes?.placement_type || null,
        total_volume: 0
      };
    }
    grouped[key].total_volume += row.volumen_fabricado || 0;
  });
  return Object.values(grouped);
}


