import { describe, expect, it } from 'vitest';
import {
  formatEdadEspecificada,
  isInformeLabExperiment,
  protocolTypeLabel,
} from './informeLabContext';

describe('informeLabContext', () => {
  it('detects lab experiment by contexto or estudio', () => {
    expect(isInformeLabExperiment({ contexto: 'laboratorio_interno' })).toBe(true);
    expect(isInformeLabExperiment({ contexto: 'obra' })).toBe(false);
    expect(
      isInformeLabExperiment({
        estudio_laboratorio: { lote_number: 'LAB-1' } as never,
      })
    ).toBe(true);
  });

  it('labels protocol types', () => {
    expect(protocolTypeLabel('validacion_receta')).toBe('Validación de receta');
  });

  it('formats edad from days or hours', () => {
    expect(formatEdadEspecificada(28, null)).toBe('28 d');
    expect(formatEdadEspecificada(null, 24)).toBe('24 h');
  });
});
