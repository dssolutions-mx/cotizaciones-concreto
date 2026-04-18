/**
 * Order CONCRETO remisiones the same way as accounting export (RemisionesList / formatRemisionesForAccounting).
 * Sort by fecha ascending, then remision_number ascending (numeric-aware string compare).
 * Caller should pass only CONCRETO rows (or a single tipo).
 */
export type MinimalConcreteRemisionRow = {
  id: string;
  remision_number: string;
  fecha: string;
  /** TIME from DB; display without timezone conversion */
  hora_carga?: string | null;
  volumen_fabricado?: number | null;
  unidad?: string | null;
  conductor?: string | null;
};

export function sortConcreteRemisionesForAccounting<T extends MinimalConcreteRemisionRow>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    const dateA = new Date(a.fecha || 0).getTime();
    const dateB = new Date(b.fecha || 0).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return (a.remision_number ?? '').localeCompare(b.remision_number ?? '', undefined, { numeric: true });
  });
}
