import assert from 'node:assert';
import { sectionRequestsInstrumentGridInstanceCode } from './sectionInstanceTraceability';
import type { VerificacionTemplateSection, VerificacionTemplateItem } from '@/types/ema';

function sec(over: Partial<VerificacionTemplateSection> & { items?: VerificacionTemplateItem[] }) {
  return {
    id: 's1',
    template_id: 't1',
    orden: 1,
    titulo: 'S',
    descripcion: null,
    repetible: true,
    repeticiones_default: 2,
    layout: 'instrument_grid' as const,
    instances_config: { min_count: 2, max_count: 2 },
    evidencia_config: {},
    created_at: '',
    updated_at: '',
    items: [] as VerificacionTemplateItem[],
    ...over,
  }
}

assert.strictEqual(
  sectionRequestsInstrumentGridInstanceCode(sec({ items: [] }), 'A'),
  false,
  'grilla sin patrón ni codigo_required → no pedir código',
);

assert.strictEqual(
  sectionRequestsInstrumentGridInstanceCode(
    sec({
      items: [{ tipo: 'referencia_equipo' } as VerificacionTemplateItem],
    }),
    'C',
  ),
  true,
  'tipo C + ítem referencia_equipo → sí',
);

assert.strictEqual(
  sectionRequestsInstrumentGridInstanceCode(
    sec({
      instances_config: { min_count: 2, max_count: 2, codigo_required: true },
    }),
    'A',
  ),
  true,
  'codigo_required explícito → sí',
);

assert.strictEqual(
  sectionRequestsInstrumentGridInstanceCode(
    sec({
      layout: 'linear',
      repetible: false,
      repeticiones_default: 1,
      items: [{ tipo: 'referencia_equipo' } as VerificacionTemplateItem],
    }),
    'C',
  ),
  false,
  'linear → no',
);

console.log('sectionInstanceTraceability.test.ts OK');
