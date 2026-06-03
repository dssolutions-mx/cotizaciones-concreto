import { describe, expect, it } from 'vitest';
import { getTransferableMaterials, type StagingRemision } from '../arkik';

function minimalRemision(
  materials: Pick<StagingRemision, 'materials_real' | 'materials_retrabajo' | 'materials_manual'>,
): StagingRemision {
  return {
    id: '1',
    session_id: 's',
    row_number: 1,
    fecha: new Date(),
    hora_carga: new Date(),
    remision_number: '100',
    estatus: 'cancelado',
    volumen_fabricado: 0,
    cliente_codigo: '',
    cliente_name: '',
    obra_name: '',
    prod_tecnico: '',
    materials_teorico: {},
    validation_status: 'valid',
    validation_errors: [],
    suggested_order_group: '',
    ...materials,
  };
}

describe('getTransferableMaterials', () => {
  it('sums real + retrabajo + manual per code', () => {
    const r = minimalRemision({
      materials_real: { CEM: 100 },
      materials_retrabajo: { CEM: 50 },
      materials_manual: { CEM: 25 },
    });
    expect(getTransferableMaterials(r)).toEqual({ CEM: 175 });
  });

  it('omits codes with zero total', () => {
    const r = minimalRemision({
      materials_real: { CEM: 0, ARE: 10 },
      materials_retrabajo: { CEM: 0 },
      materials_manual: {},
    });
    expect(getTransferableMaterials(r)).toEqual({ ARE: 10 });
  });

  it('includes codes only present in retrabajo or manual', () => {
    const r = minimalRemision({
      materials_real: {},
      materials_retrabajo: { AG1: 30 },
      materials_manual: { AG2: 5 },
    });
    expect(getTransferableMaterials(r)).toEqual({ AG1: 30, AG2: 5 });
  });
});
