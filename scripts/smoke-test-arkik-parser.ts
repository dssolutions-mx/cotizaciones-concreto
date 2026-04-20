/**
 * Smoke test for ArkikRawParser Comentarios Internos / Externos mapping.
 * Run: npx tsx scripts/smoke-test-arkik-parser.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { ArkikRawParser } from '../src/services/arkikRawParser';

async function main() {
  const csvPath = join(process.cwd(), 'MDFILES/copia.csv');
  const csv = readFileSync(csvPath, 'utf8');
  const file = new File([csv], 'copia.csv', { type: 'text/csv' });
  const { data } = await new ArkikRawParser().parseFile(file);
  if (data.length === 0) throw new Error('expected at least one parsed row');
  if (!data[0].comentarios_externos.includes('COLUMNA')) {
    throw new Error(`expected externos to contain COLUMNA, got: ${data[0].comentarios_externos}`);
  }
  if (data[0].comentarios_internos.trim() !== '') {
    throw new Error('first row should have empty internos in fixture');
  }

  const csv2 = csv.replace(
    /6-350-2-B-28-18-B-2-000,,"COLUMNA/g,
    '6-350-2-B-28-18-B-2-000,"NOTA_INTERNA_TEST","COLUMNA',
  );
  const f2 = new File([csv2], 'copia.csv', { type: 'text/csv' });
  const { data: d2 } = await new ArkikRawParser().parseFile(f2);
  if (!d2[0].comentarios_internos.includes('NOTA_INTERNA_TEST')) {
    throw new Error(`internos inject failed: ${JSON.stringify(d2[0].comentarios_internos)}`);
  }
  console.log('smoke-test-arkik-parser: OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
