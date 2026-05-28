export type MoldeInstrumentoRef = {
  codigo?: string | null;
  nombre?: string | null;
};

/** Label for informes and ensayos: molde from catálogo EMA, else identificación de muestra. */
export function formatMoldeInstrumentoDisplay(
  molde: MoldeInstrumentoRef | null | undefined,
  fallbackIdentificacion?: string | null,
): string {
  const codigo = molde?.codigo?.trim();
  const nombre = molde?.nombre?.trim();
  if (codigo && nombre) return `${codigo} · ${nombre}`;
  if (codigo) return codigo;
  if (nombre) return nombre;
  const id = fallbackIdentificacion?.trim();
  return id || '—';
}
