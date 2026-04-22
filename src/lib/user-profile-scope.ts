/**
 * Normalizes optional plant vs business-unit assignment (mutually exclusive).
 */
export function normalizePlantScope(
  plantId: string | null | undefined,
  businessUnitId: string | null | undefined
):
  | { ok: true; plant_id: string | null; business_unit_id: string | null }
  | { ok: false; error: string } {
  const plant_id =
    plantId === undefined || plantId === null || plantId === '' ? null : plantId;
  const business_unit_id =
    businessUnitId === undefined || businessUnitId === null || businessUnitId === ''
      ? null
      : businessUnitId;

  if (plant_id && business_unit_id) {
    return { ok: false, error: 'Solo puede asignar planta o unidad de negocio, no ambos' };
  }

  return { ok: true, plant_id, business_unit_id };
}
