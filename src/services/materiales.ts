import { supabase } from '@/lib/supabase';

export async function getRemisionMaterialesByRemisionIdsInChunks(remisionIds: string[], chunkSize: number = 25, select: string = 'remision_id, material_id, cantidad_real') {
  const results: any[] = [];
  for (let i = 0; i < remisionIds.length; i += chunkSize) {
    const chunk = remisionIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('remision_materiales')
      .select(select)
      .in('remision_id', chunk);
    if (error) {
      console.error('getRemisionMaterialesByRemisionIdsInChunks error:', error);
      continue;
    }
    if (data) results.push(...data);
  }
  return results;
}

export async function getMaterialsMetaByIdsInChunks(materialIds: string[], chunkSize: number = 25, select: string = 'id, material_name, material_code, category, unit_of_measure') {
  const results: any[] = [];
  for (let i = 0; i < materialIds.length; i += chunkSize) {
    const chunk = materialIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('materials')
      .select(select)
      .in('id', chunk);
    if (error) {
      console.error('getMaterialsMetaByIdsInChunks error:', error);
      continue;
    }
    if (data) results.push(...data);
  }
  return results;
}


