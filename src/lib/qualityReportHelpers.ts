/**
 * Resolve display resistance for report rows, preferring guarantee-age values.
 */
export function getResistenciaForDisplay(muestras: unknown[] | null | undefined, fallbackValue: number = 0): number {
  if (!muestras || !Array.isArray(muestras) || muestras.length === 0) {
    return fallbackValue;
  }

  const allValues: { value: number; isGarantia: boolean }[] = [];

  muestras.forEach((muestra: any) => {
    const isGarantia =
      muestra.is_edad_garantia === true ||
      muestra.fecha_programada_matches_garantia === true ||
      (muestra.ensayos && muestra.ensayos.some((e: any) => e.is_edad_garantia === true));

    if (typeof muestra.resistencia === 'number' && !isNaN(muestra.resistencia) && muestra.resistencia > 0) {
      allValues.push({ value: muestra.resistencia, isGarantia });
    }

    if (muestra.ensayos && Array.isArray(muestra.ensayos) && muestra.ensayos.length > 0) {
      muestra.ensayos.forEach((ensayo: any) => {
        const ensayoIsGarantia = ensayo.is_edad_garantia === true;
        if (
          typeof ensayo.resistencia_calculada === 'number' &&
          !isNaN(ensayo.resistencia_calculada) &&
          ensayo.resistencia_calculada > 0
        ) {
          allValues.push({
            value: ensayo.resistencia_calculada,
            isGarantia: isGarantia || ensayoIsGarantia,
          });
        }
      });
    }
  });

  const garantiaValues = allValues.filter((item) => item.isGarantia);
  if (garantiaValues.length > 0) {
    return Math.min(...garantiaValues.map((item) => item.value));
  }
  if (allValues.length > 0) {
    return Math.min(...allValues.map((item) => item.value));
  }
  return fallbackValue;
}
