import type { InformeSnapshot } from '@/types/informe-ensayo';

export const FRESH_HEADERS_BASE = ['Ensayo', 'Resultado', 'Especificado', 'C/NC'] as const;

export const FRESH_HEADERS_WITH_LECTURA = [
  'Ensayo',
  'Lectura',
  'Resultado',
  'Especificado',
  'C/NC',
] as const;

export const COMPRESSION_HEADERS = [
  'Espécimen',
  'Edad',
  'kN',
  'kg/cm²',
  'C/NC',
] as const;

export type InformeExportTable = {
  headers: readonly string[];
  rows: string[][];
};

function formatFreshResultado(resultado: string, uncertaintyDisplay?: string): string {
  if (uncertaintyDisplay) return `${resultado}\n${uncertaintyDisplay}`;
  return resultado;
}

export function informeFreshShowsLecturaCol(snapshot: InformeSnapshot): boolean {
  return snapshot.resultados_fresco.some((r) => r.lectura);
}

export function buildFreshExportTable(snapshot: InformeSnapshot): InformeExportTable {
  const showLecturaCol = informeFreshShowsLecturaCol(snapshot);

  if (showLecturaCol) {
    return {
      headers: FRESH_HEADERS_WITH_LECTURA,
      rows: snapshot.resultados_fresco.map((r) => [
        r.ensayo,
        r.lectura ?? '—',
        formatFreshResultado(r.resultado, r.uncertainty?.display),
        r.especificado,
        r.conformidad,
      ]),
    };
  }

  return {
    headers: FRESH_HEADERS_BASE,
    rows: snapshot.resultados_fresco.map((r) => [
      r.ensayo,
      formatFreshResultado(r.resultado, r.uncertainty?.display),
      r.especificado,
      r.conformidad,
    ]),
  };
}

export function buildCompressionExportTable(snapshot: InformeSnapshot): InformeExportTable {
  return {
    headers: COMPRESSION_HEADERS,
    rows: snapshot.resultados_compresion.map((r) => [
      r.identificacion,
      r.edad_dias != null ? `${r.edad_dias} d` : '—',
      r.carga_kn != null ? String(r.carga_kn) : '—',
      r.fc_kg_cm2 != null ? String(r.fc_kg_cm2) : '—',
      r.conformidad,
    ]),
  };
}
