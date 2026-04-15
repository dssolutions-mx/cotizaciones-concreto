/**
 * Resolves kg/m³ for m³ PO lines: agreed density on the PO line wins, then supplier agreement, then material default, then optional entry override.
 */
export type VolumetricWeightSource = 'po_item' | 'supplier_agreement' | 'material_default' | 'entry';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveVolumetricWeightKgPerM3(
  supabase: any,
  params: {
    poItemVolumetricKgPerM3?: number | null;
    supplierId: string | null | undefined;
    materialId: string | null | undefined;
    materialBulkDensityKgPerM3?: number | null;
    entryOverride?: number | null;
  }
): Promise<{ volW: number; volSource: VolumetricWeightSource } | null> {
  let volW: number | null =
    params.poItemVolumetricKgPerM3 != null && params.poItemVolumetricKgPerM3 !== undefined
      ? Number(params.poItemVolumetricKgPerM3)
      : null;
  let volSource: VolumetricWeightSource | null = volW && volW > 0 ? 'po_item' : null;
  if (!volW || volW <= 0) {
    volW = null;
    volSource = null;
  }

  if (!volW && params.supplierId && params.materialId) {
    const { data: agreement } = await supabase
      .from('supplier_agreements')
      .select('volumetric_weight_kg_per_m3')
      .eq('supplier_id', params.supplierId)
      .eq('is_service', false)
      .eq('material_id', params.materialId)
      .is('effective_to', null)
      .limit(1)
      .single();
    if (agreement?.volumetric_weight_kg_per_m3 != null && Number(agreement.volumetric_weight_kg_per_m3) > 0) {
      volW = Number(agreement.volumetric_weight_kg_per_m3);
      volSource = 'supplier_agreement';
    }
  }

  if (!volW && params.materialBulkDensityKgPerM3 != null && Number(params.materialBulkDensityKgPerM3) > 0) {
    volW = Number(params.materialBulkDensityKgPerM3);
    volSource = 'material_default';
  }

  if (!volW && params.entryOverride != null && Number(params.entryOverride) > 0) {
    volW = Number(params.entryOverride);
    volSource = 'entry';
  }

  if (!volW || volW <= 0 || !volSource) return null;
  return { volW, volSource };
}
