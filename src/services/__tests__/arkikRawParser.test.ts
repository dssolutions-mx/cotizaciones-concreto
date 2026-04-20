import { readFileSync } from 'fs';
import { join } from 'path';
import { ArkikRawParser } from '@/services/arkikRawParser';

describe('ArkikRawParser', () => {
  it('maps Comentarios Externos and empty Comentarios Internos from fixture CSV', async () => {
    const csvPath = join(process.cwd(), 'MDFILES/copia.csv');
    const csv = readFileSync(csvPath, 'utf8');
    const file = new File([csv], 'copia.csv', { type: 'text/csv' });
    const { data } = await new ArkikRawParser().parseFile(file);
    expect(data.length).toBeGreaterThan(0);
    const row = data[0];
    expect(row.comentarios_internos.trim()).toBe('');
    expect(row.comentarios_externos).toContain('COLUMNA');
    expect(row.elementos.trim()).toBe('');
  });

  it('maps Comentarios Internos column when present', async () => {
    const csvPath = join(process.cwd(), 'MDFILES/copia.csv');
    let csv = readFileSync(csvPath, 'utf8');
    csv = csv.replace(
      /6-350-2-B-28-18-B-2-000,,"COLUMNA/g,
      '6-350-2-B-28-18-B-2-000,"NOTA_INTERNA_TEST","COLUMNA',
    );
    const file = new File([csv], 'copia.csv', { type: 'text/csv' });
    const { data } = await new ArkikRawParser().parseFile(file);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].comentarios_internos).toContain('NOTA_INTERNA_TEST');
    expect(data[0].comentarios_externos).toContain('COLUMNA');
  });
});
