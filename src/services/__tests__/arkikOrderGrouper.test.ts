import { describe, expect, it } from 'vitest';
import { ArkikOrderGrouper } from '../arkikOrderGrouper';
import {
  extractArkikLocalYmdString,
  formatStagingRemisionLocalDate,
} from '../arkikMatchingUtils';
import type { StagingRemision } from '../../types/arkik';

function pitahayaBase(overrides: Partial<StagingRemision>): StagingRemision {
  return {
    id: crypto.randomUUID(),
    session_id: 'test',
    row_number: 1,
    fecha: new Date(2026, 4, 20, 14, 58, 0),
    hora_carga: new Date(2026, 4, 20, 14, 58, 0),
    remision_number: '6959',
    estatus: 'V',
    volumen_fabricado: 8,
    cliente_codigo: '',
    cliente_name: 'HYCSA',
    obra_name: 'LA PITAHAYA- LIBRAMIENTO ORIENTE SLP',
    prod_tecnico: '5-250-2-C-28-18-B',
    validation_errors: [],
    validation_status: 'valid',
    comentarios_externos: 'aleros de entrada y salida \nkm 2+096',
    comentarios_internos: 'GERARDO SANCHEZ',
    client_id: 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca',
    construction_site_id: 'b456f0b9-a789-4932-b763-de1798e3bcf8',
    recipe_id: '79b4c0ca-c018-4bab-8275-bee0503bd4ae',
    master_recipe_id: 'ed8d687f-515f-4d2b-96ab-d918ce7e7c5e',
    ...overrides,
  } as StagingRemision;
}

describe('formatStagingRemisionLocalDate', () => {
  it('uses local calendar day, not UTC (Pitahaya 18:08 case)', () => {
    const eveningLoad = new Date(2026, 4, 20, 18, 8, 53);
    const utcYmd = eveningLoad.toISOString().split('T')[0];
    expect(formatStagingRemisionLocalDate(eveningLoad)).toBe('2026-05-20');
    expect(extractArkikLocalYmdString(eveningLoad)).toBe('2026-05-20');
    // In western TZ (e.g. Mexico), UTC YMD can be next day — old grouper used this and split orders.
    if (utcYmd !== '2026-05-20') {
      expect(utcYmd).toBe('2026-05-21');
    }
  });
});

describe('ArkikOrderGrouper', () => {
  const grouper = new ArkikOrderGrouper();

  it('groups same client/obra/elemento on one local day despite late hora_carga (hybrid unmatched)', () => {
    const remisiones = [
      pitahayaBase({
        id: 'a',
        remision_number: '6959',
        fecha: new Date(2026, 4, 20, 14, 58, 28),
        hora_carga: new Date(2026, 4, 20, 14, 58, 28),
      }),
      pitahayaBase({
        id: 'b',
        remision_number: '6960',
        fecha: new Date(2026, 4, 20, 15, 16, 31),
        hora_carga: new Date(2026, 4, 20, 15, 16, 31),
      }),
      pitahayaBase({
        id: 'c',
        remision_number: '6966',
        fecha: new Date(2026, 4, 20, 18, 8, 53),
        hora_carga: new Date(2026, 4, 20, 18, 8, 53),
        volumen_fabricado: 6.5,
      }),
    ];

    const suggestions = grouper.groupRemisiones(remisiones, {
      processingMode: 'hybrid',
      existingOrderMatches: [],
    });

    const newSuggestions = suggestions.filter((s) => !s.is_existing_order);
    expect(newSuggestions).toHaveLength(1);
    expect(newSuggestions[0].remisiones).toHaveLength(3);
    expect(newSuggestions[0].remisiones.map((r) => r.remision_number).sort()).toEqual([
      '6959',
      '6960',
      '6966',
    ]);
    expect(newSuggestions[0].group_key).toContain('2026-05-20');
    expect(newSuggestions[0].suggested_name).toContain('2026-05-20');
  });

  it('still splits by different comentarios externo first segment', () => {
    const remisiones = [
      pitahayaBase({
        id: 'a',
        remision_number: '7001',
        comentarios_externos: 'COLUMNA, nivel 1',
      }),
      pitahayaBase({
        id: 'b',
        remision_number: '7002',
        comentarios_externos: 'LOSA, nivel 2',
      }),
    ];

    const suggestions = grouper.groupRemisiones(remisiones, {
      processingMode: 'dedicated',
    });

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].remisiones).toHaveLength(1);
    expect(suggestions[1].remisiones).toHaveLength(1);
  });

  it('groups all five Pitahaya remisiones like production case', () => {
    const nums = ['6959', '6960', '6963', '6965', '6966'];
    const hours = [14, 15, 16, 16, 18];
    const minutes = [58, 16, 20, 58, 8];
    const volumes = [8, 8, 8, 8, 6.5];

    const remisiones = nums.map((num, i) =>
      pitahayaBase({
        id: `id-${num}`,
        remision_number: num,
        fecha: new Date(2026, 4, 20, hours[i], minutes[i], 0),
        hora_carga: new Date(2026, 4, 20, hours[i], minutes[i], 0),
        volumen_fabricado: volumes[i],
      })
    );

    const suggestions = grouper.groupRemisiones(remisiones, {
      processingMode: 'hybrid',
      existingOrderMatches: [],
    });

    const newSuggestions = suggestions.filter((s) => !s.is_existing_order);
    expect(newSuggestions).toHaveLength(1);
    expect(newSuggestions[0].remisiones).toHaveLength(5);
    expect(newSuggestions[0].total_volume).toBe(38.5);
  });
});
